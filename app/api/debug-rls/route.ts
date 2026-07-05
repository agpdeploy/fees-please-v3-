import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: policies, error } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'sponsor_analytics');

    if (error) {
       // if pg_policies is not accessible, maybe we can run an RPC?
       return NextResponse.json({ error });
    }
    return NextResponse.json({ policies });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
