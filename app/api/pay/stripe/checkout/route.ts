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
    const body = await req.json();
    const { clubId, plan, interval = 'monthly', successUrl, cancelUrl } = body;

    if (!clubId || !plan) {
      return NextResponse.json({ error: 'Missing required fields: clubId, plan' }, { status: 400 });
    }

    // 1. Fetch club info
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();

    if (clubError || !club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    // 2. Determine price ID
    let priceId;
    if (plan === 'pro') {
      priceId = interval === 'annual' 
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_ANNUAL 
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY;
    } else {
      priceId = interval === 'annual' 
        ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS_ANNUAL 
        : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS_MONTHLY;
    }

    if (!priceId) {
      return NextResponse.json({ error: `Stripe price ID for plan '${plan}' (${interval}) is not configured.` }, { status: 500 });
    }

    // 3. Count active teams to set checkout quantity
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId);

    // 4. Find or create Stripe Customer
    let stripeCustomerId = club.stripe_customer_id;
    if (!stripeCustomerId) {
      // Create new customer
      const customer = await stripe.customers.create({
        name: club.name,
        metadata: {
          club_id: clubId,
        },
      });
      stripeCustomerId = customer.id;

      // Update club with customer id
      await supabase
        .from('clubs')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', clubId);
    }

    // 5. Build line items
    const quantity = plan === 'pro' ? 1 : (teams ? Math.max(1, teams.length) : 1);
    const lineItems = [
      {
        price: priceId,
        quantity: quantity,
      },
    ];

    const hasUsedTrial = club.settings?.has_used_trial === true;

    // 6. Create Stripe Checkout Session
    const origin = req.headers.get('origin');
    
    const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      ui_mode: 'embedded' as any,
      allow_promotion_codes: true, // Allow promo codes / referral discounts
      return_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        club_id: clubId,
        plan_tier: plan,
      }
    };

    checkoutOptions.subscription_data = {
      metadata: {
        club_id: clubId,
        plan_tier: plan,
      }
    };

    const session = await stripe.checkout.sessions.create(checkoutOptions);

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
