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

    // 1. Fetch club info and stripe subscription
    const { data: club } = await supabase
      .from('clubs')
      .select('stripe_subscription_id, plan_tier')
      .eq('id', clubId)
      .single();

    if (!club || !club.stripe_subscription_id || club.plan_tier === 'free') {
      // Nothing to sync if they don't have an active paid subscription
      return NextResponse.json({ status: 'noop', reason: 'No active paid subscription' });
    }

    // 2. Count active teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('club_id', clubId);
      
    const quantity = teams ? Math.max(1, teams.length) : 1;

    // 3. Get the subscription from Stripe to find the subscription item ID
    const subscription = await stripe.subscriptions.retrieve(club.stripe_subscription_id);
    const subItemId = subscription.items.data[0]?.id;

    if (!subItemId) {
      return NextResponse.json({ error: 'Subscription item not found in Stripe' }, { status: 404 });
    }

    // 4. Update the quantity in Stripe
    await stripe.subscriptionItems.update(subItemId, {
      quantity: quantity,
    });

    return NextResponse.json({ status: 'success', quantity });
  } catch (error: any) {
    console.error('Stripe sync-quantity error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
