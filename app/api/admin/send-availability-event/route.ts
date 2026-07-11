import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server config error: Missing keys' }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    });

    const body = await req.json();
    const { fixtureId, teamId, playerId, status } = body;

    if (!fixtureId || !teamId || !playerId || !status) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // 1. Check if there's an active "instant_event" availability report for this team
    const { data: reports } = await supabaseAdmin
      .from('email_reports')
      .select('*')
      .eq('team_id', teamId)
      .eq('report_type', 'availability_report')
      .eq('frequency', 'instant_event')
      .eq('is_active', true);

    if (!reports || reports.length === 0) {
      return NextResponse.json({ success: true, message: 'No instant notification configured.' }, { status: 200 });
    }

    const report = reports[0];

    // 2. Queue the event
    const { error: insertError } = await supabaseAdmin.from('availability_queue').insert({
       player_id: playerId,
       fixture_id: fixtureId,
       team_id: teamId,
       status: status
    });

    if (insertError) {
      console.error("Queue insert error:", insertError);
      return NextResponse.json({ error: "Failed to queue update" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Availability update queued.' }, { status: 200 });
    
  } catch (error: any) {
    console.error("Availability Event API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
