import { NextResponse } from 'next/server';
// @ts-ignore - Bypassing strict TS module resolution for Square SDK
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

    if (!club?.square_access_token || !club?.square_location_id) {
        throw new Error("Square credentials missing for this organization in Setup.");
    }

    // 2. Initialize Square Client (PRODUCTION)
    const square = new Client({
      accessToken: club.square_access_token,
      environment: Environment.Production, 
    });

    // 3. Math for the clip
    const platformFeeCents = Math.round(calculatePlatformFee(amount) * 100);
    const totalAmountCents = Math.round(amount * 100);

    // 4. Process Payment
    const { result } = await square.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: BigInt(totalAmountCents), currency: 'AUD' },
      appFeeMoney: { amount: BigInt(platformFeeCents), currency: 'AUD' },
      locationId: club.square_location_id,
    });

    const safeResult = JSON.parse(JSON.stringify(result, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({ success: true, payment: safeResult.payment });
  } catch (error: any) {
    console.error("SQUARE API ERROR:", error);
    return NextResponse.json({ error: error.message || "Payment Failed" }, { status: 400 });
  }
}