import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { clubId } = await req.json();

    if (!clubId) {
      return NextResponse.json({ error: "Missing clubId" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify club doesn't already have a trial used
    const { data: club } = await supabaseAdmin.from('clubs').select('has_had_trial, trial_ends_at').eq('id', clubId).single();
    if (club?.has_had_trial) {
      return NextResponse.json({ error: "This account has already used its free trial." }, { status: 400 });
    }

    // Trial ends 14 days from now
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const { error } = await supabaseAdmin.from('clubs').update({
      trial_ends_at: trialEndsAt.toISOString(),
      has_had_trial: true
    }).eq('id', clubId);

    if (error) throw error;

    return NextResponse.json({ success: true, trialEndsAt });
  } catch (err: any) {
    console.error("Start trial error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
