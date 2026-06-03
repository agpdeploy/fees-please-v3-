import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { calculateSquareOnlineGross } from '@/lib/fees';

export async function POST(request: Request) {
  try {
    const { sourceId, txId } = await request.json();

    if (!sourceId || !txId) {
      return NextResponse.json({ error: "Missing sourceId or txId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch transaction details
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, players(first_name, last_name)')
      .eq('id', txId)
      .single();

    if (txError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.status === 'paid' || transaction.transaction_type === 'payment') {
      return NextResponse.json({ error: "Already paid" }, { status: 400 });
    }

    const { data: club } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', transaction.club_id)
      .single();
      
    if (!club || !club.square_access_token) {
      return NextResponse.json({ error: "Club Square account not connected" }, { status: 400 });
    }

    // Process Square Payment
    const grossAmount = calculateSquareOnlineGross(transaction.amount, club);
    const amountCents = Math.round(grossAmount * 100);
    
    // Square charges 2.2% + 30c on the gross amount for online payments
    const squareFeeCents = Math.round((grossAmount * 0.022 + 0.30) * 100);
    const netAmountCents = Math.round(transaction.amount * 100);
    
    // The platform fee is what's left over after Square takes their cut and the club gets their net amount
    const platformFeeCents = amountCents - netAmountCents - squareFeeCents;
    
    // Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    const playerName = transaction.players ? `${transaction.players.first_name} ${transaction.players.last_name}` : 'Unknown Player';
    const noteStr = `${transaction.description || 'Match Fees'} - ${playerName}`;

    const squarePayload: any = {
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      note: noteStr,
      amount_money: {
        amount: amountCents,
        currency: 'AUD'
      },
    };

    if (platformFeeCents > 0) {
      squarePayload.app_fee_money = {
        amount: platformFeeCents,
        currency: 'AUD'
      };
    }

    const squareBaseUrl = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.startsWith("sandbox")
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com"

    const response = await fetch(`${squareBaseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${club.square_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(squarePayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Square API Error:", data);
      return NextResponse.json({ error: data.errors?.[0]?.detail || "Payment failed at Square" }, { status: 400 });
    }

    // 1. Mark existing checkout_link as paid and link to square payment
    const { error: markPaidError } = await supabase.from('transactions').update({ 
      status: 'paid',
      square_payment_id: data.payment.id
    }).eq('id', txId);
    
    if (markPaidError) {
       console.error("Failed to mark tx as paid:", markPaidError);
    }

    // 1.5. Ledger Reconciliation: Mark old unpaid fees as paid until the payment amount is consumed
    let remainingPayment = transaction.amount;
    
    const { data: unpaidDebts } = await supabase
      .from('transactions')
      .select('*')
      .eq('player_id', transaction.player_id)
      .eq('club_id', transaction.club_id)
      .neq('status', 'paid')
      .in('transaction_type', ['fee', 'expense'])
      .order('created_at', { ascending: true });
      
    if (unpaidDebts && unpaidDebts.length > 0) {
      const debtsToMarkPaid = [];
      for (const debt of unpaidDebts) {
        if (remainingPayment >= debt.amount) {
          debtsToMarkPaid.push(debt.id);
          remainingPayment -= debt.amount;
        }
      }
      
      if (debtsToMarkPaid.length > 0) {
        await supabase
          .from('transactions')
          .update({ status: 'paid', square_payment_id: data.payment.id })
          .in('id', debtsToMarkPaid);
      }
    }

    // 2. Insert corresponding payment transaction linked to square payment
    const { error: insertPaymentError } = await supabase.from('transactions').insert({
      club_id: transaction.club_id,
      player_id: transaction.player_id,
      team_id: transaction.team_id,
      fixture_id: transaction.fixture_id,
      amount: transaction.amount,
      transaction_type: 'payment',
      payment_method: 'Square Online',
      description: `Payment for ${transaction.description || 'fee'}`,
      status: 'completed',
      square_payment_id: data.payment.id
    });
    
    if (insertPaymentError) {
      console.error("Failed to insert payment tx:", insertPaymentError);
    }

    return NextResponse.json({ success: true, paymentId: data.payment.id });
  } catch (error: any) {
    console.error("Checkout processing error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
