import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const payload = await req.text();
    
    // Fallback if not using headers function directly
    const svix_id = req.headers.get('svix-id');
    const svix_timestamp = req.headers.get('svix-timestamp');
    const svix_signature = req.headers.get('svix-signature');
    
    let event: any;

    // Check if we are running in local development to allow easy curl testing
    if (process.env.NODE_ENV === 'development' && (!svix_id || !svix_timestamp || !svix_signature)) {
      console.log('Bypassing webhook signature verification in local development');
      try {
        event = JSON.parse(payload);
      } catch (err: any) {
        console.error('Failed to parse webhook JSON payload in development:', err.message);
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
      }
    } else {
      if (!svix_id || !svix_timestamp || !svix_signature) {
        console.error('Missing Svix headers');
        return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
      }
      
      if (!WEBHOOK_SECRET) {
        console.error('Missing RESEND_WEBHOOK_SECRET');
        // If the secret isn't set, return 500
        return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 });
      }

      const wh = new Webhook(WEBHOOK_SECRET);
      try {
        event = wh.verify(payload, {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        });
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }
    
    const type = event.type;
    const data = event.data;
    const resend_id = data?.email_id;
    
    if (!resend_id) {
      return NextResponse.json({ success: true, message: 'No email_id in payload, ignoring' }, { status: 200 });
    }
    
    let newStatus = '';
    if (type === 'email.delivered') newStatus = 'delivered';
    else if (type === 'email.opened') newStatus = 'opened';
    else if (type === 'email.bounced') newStatus = 'bounced';
    else if (type === 'email.complained') newStatus = 'complained';
    else if (type === 'email.clicked') newStatus = 'clicked';
    
    if (newStatus) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { 
          auth: { autoRefreshToken: false, persistSession: false } 
        });

        // 1. Update the email log status
        await supabaseAdmin
          .from('email_logs')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('resend_id', resend_id);
          
        // 2. If it bounced or complained, automatically unsubscribe the player to protect sender reputation
        if (newStatus === 'bounced' || newStatus === 'complained') {
          const { data: logEntry } = await supabaseAdmin
            .from('email_logs')
            .select('player_id')
            .eq('resend_id', resend_id)
            .maybeSingle();
            
          if (logEntry?.player_id) {
            await supabaseAdmin
              .from('players')
              .update({ unsubscribed: true })
              .eq('id', logEntry.player_id);
          }
        }
      }
    }
    
    return NextResponse.json({ success: true }, { status: 200 });
    
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
