import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const fixtureId = formData.get('fixtureId') as string;
    const playerId = formData.get('playerId') as string;
    const amount = parseFloat(formData.get('amount') as string);

    if (!fixtureId || !playerId || !amount) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Fetch Fixture and Player context
    const { data: fixture } = await supabaseAdmin.from('fixtures').select('*').eq('id', fixtureId).single();
    const { data: player } = await supabaseAdmin.from('players').select('*').eq('id', playerId).single();

    if (!fixture || !player) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 });
    }

    // 2. Fetch Club config
    const { data: club } = await supabaseAdmin.from('clubs').select('*').eq('id', player.club_id).single();
    if (!club || !club.is_square_enabled || !club.square_location_id || !club.square_access_token) {
      return NextResponse.json({ error: 'Club not configured for online payments.' }, { status: 400 });
    }

    // 3. Check for existing fee transaction for THIS match
    const { data: existingFee } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('player_id', player.id)
      .eq('fixture_id', fixture.id)
      .eq('transaction_type', 'fee')
      .maybeSingle();

    let transactionId = existingFee?.id;

    // 4. Create Fee Transaction if it doesn't exist
    if (!existingFee) {
      const { data: newTx, error: insertError } = await supabaseAdmin.from('transactions').insert({
        club_id: club.id,
        player_id: player.id,
        team_id: player.default_team_id,
        fixture_id: fixture.id,
        amount: amount,
        transaction_type: 'fee',
        status: 'unpaid',
        description: `${player.first_name} Match Fees (${fixture.opponent || 'TBA'})`
      }).select().single();

      if (insertError) throw insertError;
      transactionId = newTx.id;
    } else if (existingFee.amount !== amount) {
      // Update amount if balance changed
      await supabaseAdmin.from('transactions').update({ amount }).eq('id', transactionId);
    }

    // 5. Create Square Checkout Link
    const orderData = {
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: club.square_location_id,
        reference_id: transactionId,
        line_items: [{
          name: `Match Fees (${player.first_name} ${player.last_name || ''})`,
          quantity: '1',
          base_price_money: {
            amount: Math.round(amount * 100),
            currency: 'AUD'
          }
        }]
      },
      checkout_options: {
        redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/pay/${transactionId}`,
        accepted_payment_methods: {
          apple_pay: true,
          google_pay: true,
          afterpay_clearpay: true
        }
      }
    };

    const sqRes = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: {
        'Square-Version': '2024-05-15',
        'Authorization': `Bearer ${club.square_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const sqJson = await sqRes.json();
    if (!sqRes.ok) {
      console.error("Square Error:", sqJson);
      throw new Error("Failed to generate payment link");
    }

    // 6. Redirect to Square
    return NextResponse.redirect(sqJson.payment_link.url, { status: 303 });

  } catch (error: any) {
    console.error("Prepay Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
