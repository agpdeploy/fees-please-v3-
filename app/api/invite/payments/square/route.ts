import { NextResponse } from 'next/server';
// @ts-ignore - Bypassing TS module resolution for Square SDK
import { Client, Environment } from 'square';
import { calculatePlatformFee } from '@/lib/fees';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { sourceId, amount, clubId, playerId, fixtureId } = await req.json();

    // 1. Fetch club's Square credentials
    const { data: club } = await supabase
      .from('clubs')
      .select('square_access_token, square_location_id')
      .eq('id', clubId)
      .single();

    if (!club?.square_access_token) throw new Error("Square not configured for this club");

    const square = new Client({
      accessToken: club.square_access_token,
      environment: Environment.Production, // or Environment.Sandbox for testing
    });

    // 2. Calculate your platform cut (1%)
    const platformFeeCents = Math.round(calculatePlatformFee(amount) * 100);
    const totalAmountCents = Math.round(amount * 100);

    // 3. Process Payment via Square
    const { result } = await square.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(totalAmountCents),
        currency: 'AUD' 
      },
      appFeeMoney: { // <--- THIS ROUTES YOUR 1% CLIP TO YOUR MASTER SQUARE DEV ACCOUNT
        amount: BigInt(platformFeeCents),
        currency: 'AUD'
      },
      locationId: club.square_location_id,
    });

    return NextResponse.json({ success: true, payment: result.payment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}