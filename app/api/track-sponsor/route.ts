import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use admin client to bypass RLS for inserting analytics
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Check if the payload is an array (batch impressions) or a single object
    const isArray = Array.isArray(body);
    const dataToCheck = isArray ? body[0] : body;
    
    if (!dataToCheck || !dataToCheck.team_id || !dataToCheck.event_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (isArray) {
        const { error } = await supabaseAdmin.from('sponsor_analytics').insert(body.map(item => ({
            team_id: item.team_id,
            sponsor_id: item.sponsor_id,
            sponsor_index: item.sponsor_index,
            event_type: item.event_type,
            source: item.source || 'hub'
        })));
        if (error) throw error;
    } else {
        const { error } = await supabaseAdmin.from('sponsor_analytics').insert({
          team_id: body.team_id,
          sponsor_id: body.sponsor_id,
          sponsor_index: body.sponsor_index,
          event_type: body.event_type,
          source: body.source || 'hub',
        });
        if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in track-sponsor POST:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const team_id = searchParams.get('team_id');
    const sponsor_id = searchParams.get('sponsor_id');
    const sponsor_index = searchParams.get('sponsor_index') ? parseInt(searchParams.get('sponsor_index') as string) : null;
    const event_type = searchParams.get('event_type');
    const source = searchParams.get('source') || 'email';
    const redirect = searchParams.get('redirect');

    if (team_id && event_type) {
      // Record event asynchronously
      supabaseAdmin.from('sponsor_analytics').insert({
        team_id,
        sponsor_id,
        sponsor_index,
        event_type,
        source,
      }).then(({ error }) => {
        if (error) console.error('Sponsor analytics insert error:', error);
      });
    }

    if (event_type === 'click' && redirect) {
      return NextResponse.redirect(redirect);
    }

    if (event_type === 'impression') {
      // Return a 1x1 transparent PNG
      const transparentPixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
      return new NextResponse(transparentPixel, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in track-sponsor GET:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
