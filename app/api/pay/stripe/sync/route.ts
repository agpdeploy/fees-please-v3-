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
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const clubId = session.metadata?.club_id;
    const planTier = session.metadata?.plan_tier;
    const subscriptionId = session.subscription as string;

    if (clubId && subscriptionId && planTier && session.status === 'complete') {
      let planInterval = 'monthly';
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const price = subscription.items.data[0]?.price;
        if (price?.recurring?.interval === 'year') {
          planInterval = 'yearly';
        }
      } catch (e) {
        console.error("Failed to retrieve subscription for interval:", e);
      }

      await supabase
        .from('clubs')
        .update({
          stripe_subscription_id: subscriptionId,
          plan_tier: planTier,
          plan_interval: planInterval,
        })
        .eq('id', clubId);
        
      return NextResponse.json({ success: true, plan: planTier, interval: planInterval });
    }

    return NextResponse.json({ success: false, reason: 'Incomplete or missing metadata' });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
