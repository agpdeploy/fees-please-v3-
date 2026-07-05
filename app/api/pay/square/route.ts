import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { calculateSquareOnlineGross } from '@/lib/fees';
import { ensureValidSquareToken } from '@/lib/squareToken';

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

    const club = await ensureValidSquareToken(transaction.club_id, supabase);
      
    if (!club || !club.square_access_token) {
      return NextResponse.json({ error: "Club Square account not connected" }, { status: 400 });
    }

    // Process Square Payment
    const grossAmount = calculateSquareOnlineGross(transaction.amount, club);
    const amountCents = Math.round(grossAmount * 100);
    
    // Square charges a flat 2.2% on the gross amount for online payments in Australia
    const squareFeeCents = Math.round((grossAmount * 0.022) * 100);
    const netAmountCents = Math.round(transaction.amount * 100);
    
    // The platform fee is what's left over after Square takes their cut and the club gets their net amount
    const platformFeeCents = amountCents - netAmountCents - squareFeeCents;
    
    // Generate idempotency key tied to txId and sourceId to prevent double charging on retry
    const idempotencyKey = `${txId}-${sourceId}`;

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
       throw new Error(`markPaidError: ${markPaidError.message} / ${markPaidError.details || ''} / ${markPaidError.hint || ''}`);
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
      square_payment_id: data.payment.id,
      season_name: transaction.season_name || null
    });
    
    if (insertPaymentError) {
      console.error("Failed to insert payment tx:", insertPaymentError);
      throw new Error(`insertPaymentError: ${insertPaymentError.message} / ${insertPaymentError.details || ''} / ${insertPaymentError.hint || ''}`);
    }

    // 3. Ensure a fee transaction exists for this fixture (to match cash/POS tracking logic)
    if (transaction.fixture_id) {
      const { data: existingFee } = await supabase
        .from('transactions')
        .select('id')
        .eq('player_id', transaction.player_id)
        .eq('fixture_id', transaction.fixture_id)
        .eq('transaction_type', 'fee')
        .limit(1)
        .maybeSingle();
        
      if (!existingFee) {
        // Find player's fee amount based on is_member
        const { data: player } = await supabase.from('players').select('is_member').eq('id', transaction.player_id).maybeSingle();
        const { data: team } = await supabase.from('teams').select('member_fee, casual_fee').eq('id', transaction.team_id).maybeSingle();
        
        const feeAmount = player?.is_member ? (team?.member_fee || 10) : (team?.casual_fee || 25);
        
        await supabase.from('transactions').insert({
          club_id: transaction.club_id,
          player_id: transaction.player_id,
          team_id: transaction.team_id,
          fixture_id: transaction.fixture_id,
          amount: feeAmount,
          transaction_type: 'fee',
          status: 'paid', // Mark as paid so it doesn't show as unpaid debt
          season_name: transaction.season_name || null
        });
      }
    }

    return NextResponse.json({ success: true, paymentId: data.payment.id });
  } catch (error: any) {
    console.error("Checkout processing error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
