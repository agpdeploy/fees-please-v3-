import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getIcsData } from '@/lib/calendar';

export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new NextResponse('Server Error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resolvedParams = await props.params;
    const fixtureId = resolvedParams.fixtureId;

    const { data: fixture } = await supabase
      .from('fixtures')
      .select('*, teams(name, slug)')
      .eq('id', fixtureId)
      .single();

    if (!fixture) {
      return new NextResponse('Fixture not found', { status: 404 });
    }

    // Pass team slug along so the URL works
    fixture.team_slug = fixture.teams?.slug;

    const icsContent = getIcsData(fixture, fixture.teams?.name || 'Your Team');
    if (!icsContent) {
      return new NextResponse('Error generating ICS', { status: 500 });
    }

    const filename = `${fixture.teams?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'team'}_${fixture.opponent?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'match'}.ics`;

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (err) {
    console.error('ICS Error', err);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
