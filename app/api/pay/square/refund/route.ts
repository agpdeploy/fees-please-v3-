import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { squarePaymentId, clubId } = await request.json();

    if (!squarePaymentId || !clubId) {
      return NextResponse.json({ error: "Missing squarePaymentId or clubId" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    );
    
    // Create a service role client for bypassing RLS during DB updates
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get current user to verify permissions
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a club_admin or super_admin for this club
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['club_admin', 'super_admin'])
      .eq('club_id', clubId)
      .limit(1)
      .single();

    if (roleError || !userRole) {
      // Check if they are a global super_admin
      const { data: superAdminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .limit(1)
        .single();
        
      if (!superAdminRole) {
         return NextResponse.json({ error: "Forbidden: You must be a Account Admin or Super Admin to process refunds." }, { status: 403 });
      }
    }

    // Fetch the club's Square Access Token
    const { data: club } = await serviceRoleClient
      .from('clubs')
      .select('square_access_token')
      .eq('id', clubId)
      .single();
      
    if (!club || !club.square_access_token) {
      return NextResponse.json({ error: "Club Square account not connected" }, { status: 400 });
    }

    const squareBaseUrl = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.startsWith("sandbox")
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com";

    // Fetch the original payment from Square to get the exact amount_money
    const paymentResponse = await fetch(`${squareBaseUrl}/v2/payments/${squarePaymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${club.square_access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error("Square Get Payment Error:", paymentData);
      return NextResponse.json({ error: "Could not find original payment in Square" }, { status: 400 });
    }

    const idempotencyKey = crypto.randomUUID();

    const squarePayload = {
      idempotency_key: idempotencyKey,
      payment_id: squarePaymentId,
      amount_money: paymentData.payment.amount_money
    };

    // Call Square Refund API
    const response = await fetch(`${squareBaseUrl}/v2/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${club.square_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(squarePayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Square Refund Error:", data);
      return NextResponse.json({ error: data.errors?.[0]?.detail || "Refund failed at Square" }, { status: 400 });
    }

    // Refund succeeded at Square. Delete the payment and checkout_link transactions.
    const { error: deleteError } = await serviceRoleClient
      .from('transactions')
      .delete()
      .eq('square_payment_id', squarePaymentId)
      .in('transaction_type', ['payment', 'checkout_link']);

    if (deleteError) {
      console.error("Failed to delete refunded transactions:", deleteError);
      return NextResponse.json({ error: "Refund processed at Square, but failed to update ledger." }, { status: 500 });
    }

    // Revert associated fees and expenses back to unpaid
    await serviceRoleClient
      .from('transactions')
      .update({ status: 'unpaid', square_payment_id: null })
      .eq('square_payment_id', squarePaymentId)
      .in('transaction_type', ['fee', 'expense']);

    return NextResponse.json({ success: true, refundId: data.refund.id });
  } catch (error: any) {
    console.error("Refund processing error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
