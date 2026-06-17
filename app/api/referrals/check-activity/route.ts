import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { clubId } = await req.json();

    if (!clubId) {
      return NextResponse.json({ error: 'Missing clubId' }, { status: 400 });
    }

    // 1. Check if club was referred
    const { data: club } = await supabase
      .from('clubs')
      .select('id, referred_by_user_id')
      .eq('id', clubId)
      .single();

    if (!club || !club.referred_by_user_id) {
      return NextResponse.json({ status: 'noop', reason: 'Club was not referred' });
    }

    // 2. Count completed matches for this club
    const { data: teams } = await supabase.from('teams').select('id').eq('club_id', clubId);
    if (!teams || teams.length === 0) return NextResponse.json({ status: 'noop', reason: 'No teams' });
    
    const teamIds = teams.map(t => t.id);
    const { count } = await supabase
      .from('fixtures')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds)
      .in('status', ['completed', 'abandoned']);

    if (!count || count < 2) {
      return NextResponse.json({ status: 'noop', reason: 'Not enough completed matches yet' });
    }

    // 3. Mark the referral as active_free
    const { data: referral, error: refError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_club_id', clubId)
      .maybeSingle();

    let referralRecord = referral;

    if (!referralRecord) {
      // Create it if it somehow wasn't created yet
      const { data: newRef } = await supabase
        .from('referrals')
        .insert({
          referrer_user_id: club.referred_by_user_id,
          referred_club_id: clubId,
          status: 'active_free',
        })
        .select()
        .single();
      referralRecord = newRef;
    } else if (referralRecord.status === 'pending') {
      const { data: updatedRef } = await supabase
        .from('referrals')
        .update({ status: 'active_free', updated_at: new Date().toISOString() })
        .eq('id', referralRecord.id)
        .select()
        .single();
      referralRecord = updatedRef;
    }

    // If it's already rewarded, or was already 'paid', we stop here
    if (referralRecord.rewarded_at || referralRecord.status === 'paid') {
       return NextResponse.json({ status: 'noop', reason: 'Already rewarded or upgraded' });
    }

    // 4. Determine referrer's status to process rewards
    // Find if the referrer is an admin of any club to determine their tier
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('club_id')
      .eq('user_id', club.referred_by_user_id)
      .in('role', ['club_admin', 'super_admin']);

    const isReferrerAdmin = userRoles && userRoles.length > 0;

    if (!isReferrerAdmin) {
      // PLAYER REFERRER LOGIC
      // Reward immediately
      await supabase.from('referrals').update({ 
        rewarded_at: new Date().toISOString(), 
        reward_type: 'player_milestone' 
      }).eq('id', referralRecord.id);

      // Check total rewarded referrals for this player
      const { count: playerTotal } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_user_id', club.referred_by_user_id)
        .not('rewarded_at', 'is', null);

      // If multiple of 4, they earn a gift card reward
      if (playerTotal && playerTotal > 0 && playerTotal % 4 === 0) {
        await supabase.from('referral_rewards').insert({
          user_id: club.referred_by_user_id,
          reward_type: 'external_gift_4_referrals',
          status: 'pending'
        });
      }
      return NextResponse.json({ status: 'success', message: 'Player milestone recorded' });
    }

    // ADMIN REFERRER LOGIC
    // Admins need 3 active_free referrals to form a batch
    const { data: unrewardedActiveFree } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_user_id', club.referred_by_user_id)
      .eq('status', 'active_free')
      .is('rewarded_at', null);

    if (unrewardedActiveFree && unrewardedActiveFree.length >= 3) {
      // Process a batch of 3!
      const batchIds = unrewardedActiveFree.slice(0, 3).map(r => r.id);
      
      // Determine what tier the referrer's club is
      const referrerClubId = userRoles[0].club_id;
      const { data: referrerClub } = await supabase
        .from('clubs')
        .select('plan_tier, stripe_customer_id, name, contact_email')
        .eq('id', referrerClubId)
        .single();

      if (referrerClub) {
        const isReferrerPaid = referrerClub.plan_tier === 'plus' || referrerClub.plan_tier === 'pro';
        const creditAmountCents = isReferrerPaid ? 1398 : 699; // $13.98 or $6.99
        
        let customerId = referrerClub.stripe_customer_id;
        
        // If Free Admin doesn't have a Stripe customer yet, create one to hold the credit
        if (!customerId) {
          const customer = await stripe.customers.create({
            name: referrerClub.name,
            email: referrerClub.contact_email || undefined,
            metadata: { club_id: referrerClubId }
          });
          customerId = customer.id;
          await supabase.from('clubs').update({ stripe_customer_id: customerId }).eq('id', referrerClubId);
        }

        // Apply Customer Balance Transaction
        await stripe.customers.createBalanceTransaction(customerId, {
          amount: -creditAmountCents, // Negative means credit to the customer
          currency: 'aud',
          description: 'Referral Reward: 3 Active Free Teams',
        });

        // Mark the batch as rewarded
        await supabase.from('referrals').update({
          rewarded_at: new Date().toISOString(),
          reward_type: 'active_free_batch',
          rewarded_amount_cents: creditAmountCents,
        }).in('id', batchIds);

        return NextResponse.json({ status: 'success', message: `Batch of 3 rewarded with ${creditAmountCents} cents` });
      }
    }

    return NextResponse.json({ status: 'pending_batch', message: 'Not enough unrewarded active free referrals to form a batch yet' });
  } catch (error: any) {
    console.error('Referral activity check error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
