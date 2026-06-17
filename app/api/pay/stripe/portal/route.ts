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
    const { clubId, returnUrl } = await req.json();

    if (!clubId) {
      return NextResponse.json({ error: 'Missing clubId' }, { status: 400 });
    }

    const { data: club } = await supabase
      .from('clubs')
      .select('stripe_customer_id')
      .eq('id', clubId)
      .single();

    if (!club || !club.stripe_customer_id) {
      return NextResponse.json({ error: 'Club has no active Stripe customer' }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: club.stripe_customer_id,
      return_url: returnUrl || `${req.headers.get('origin')}/setup`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe portal error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
