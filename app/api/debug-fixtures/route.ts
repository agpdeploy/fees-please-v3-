import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: allReports } = await supabaseAdmin.from('email_reports').select('*').order('created_at', { ascending: false });
  
  if (!allReports) return NextResponse.json({ ok: true });

  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const r of allReports) {
    const key = `${r.club_id}-${r.team_id || 'null'}-${r.report_type}`;
    if (seen.has(key)) {
      toDelete.push(r.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await supabaseAdmin.from('email_reports').delete().in('id', toDelete);
  }

  return NextResponse.json({ deleted: toDelete.length, remaining: seen.size });
}
