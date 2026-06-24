import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      return NextResponse.json({ error: 'Server config error: Missing keys' }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    });

    const body = await req.json();
    const { fixtureId, teamId, selectedPlayerIds, customMessage, senderName = "Your Team Admin" } = body;

    if (!fixtureId || !teamId || !selectedPlayerIds || selectedPlayerIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isTestingEnv = process.env.NODE_ENV === 'development';

    // 1. Fetch Fixture and Team details
    const { data: fixture } = await supabaseAdmin
      .from('fixtures')
      .select('*, teams (name, slug, club_id, public_team_profiles(sponsor_1_logo, sponsor_1_url, sponsor_2_logo, sponsor_2_url, sponsor_3_logo, sponsor_3_url, club_logo_url))')
      .eq('id', fixtureId)
      .maybeSingle();

    if (!fixture || !fixture.teams) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 });
    }

    const team = fixture.teams;
    const clubId = team.club_id;
    const matchDate = new Date(fixture.match_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    const teamSlug = team.slug || teamId;

    // 2. Fetch Club config
    const { data: club } = await supabaseAdmin.from('clubs').select('*').eq('id', clubId).single();
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

    const themeColor = club.theme_color || '#10B981';

    // 3. Fetch Selected Players
    const { data: players } = await supabaseAdmin
      .from('players')
      .select('id, first_name, nickname, email, unsubscribed')
      .in('id', selectedPlayerIds)
      .not('email', 'is', null)
      .eq('unsubscribed', false)
      .eq('is_active', true);

    if (!players || players.length === 0) {
      return NextResponse.json({ sentCount: 0, message: 'No valid emails found for selected players.' }, { status: 200 });
    }

    let emailsSent = 0;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (isTestingEnv ? 'http://localhost:3000' : 'https://app.feesplease.app');

    const tp = Array.isArray(fixture.teams?.public_team_profiles) ? fixture.teams?.public_team_profiles[0] : fixture.teams?.public_team_profiles;
    let sponsorsHtml = '';
    if (tp && (tp.sponsor_1_logo || tp.sponsor_2_logo || tp.sponsor_3_logo)) {
      const sponsors = [
        { logo: tp.sponsor_1_logo, url: tp.sponsor_1_url },
        { logo: tp.sponsor_2_logo, url: tp.sponsor_2_url },
        { logo: tp.sponsor_3_logo, url: tp.sponsor_3_url }
      ].filter(s => s.logo);
      
      if (sponsors.length > 0) {
        sponsorsHtml = `
          <div style="margin-top: 32px; margin-bottom: 8px; text-align: center;">
            <p style="font-size: 10px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; margin-top: 0;">Supported By</p>
            <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                ${sponsors.map(s => `<td align="center" style="padding: 0 8px;">${s.url ? `<a href="${s.url}" target="_blank">` : ''}<img src="${s.logo}" alt="Sponsor" height="32" style="max-height: 32px; width: auto; display: block;" />${s.url ? `</a>` : ''}</td>`).join('')}
              </tr>
            </table>
          </div>
        `;
      }
    }

    const teamLogoUrl = tp?.club_logo_url;

    const validPlayers = players.filter(p => p.email && p.email.trim() !== '');
    const emailPayloads = [];

    for (const player of validPlayers) {
      const prePayUrl = `${baseUrl}/t/${teamSlug}/prepay?f=${fixture.id}&p=${player.id}`;
      
      const paymentSection = (club.is_square_enabled && club.square_location_id) 
        ? `
            <div style="padding: 24px; text-align: center; border-top: 1px solid #f4f4f5;">
              <p style="margin-top: 0; font-size: 14px; font-weight: bold; color: #52525b; margin-bottom: 16px;">Pre-pay your Match Fees online:</p>
              <a href="${prePayUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${themeColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 900; font-size: 14px; text-transform: uppercase;">Pay Securely</a>
              
              <div style="margin-top: 16px; margin-bottom: 8px; text-align: center;">
                <img src="https://img.icons8.com/color/48/000000/visa.png" height="24" alt="Visa" style="display: inline-block; vertical-align: middle; margin: 0 4px;" />
                <img src="https://img.icons8.com/color/48/000000/mastercard.png" height="24" alt="Mastercard" style="display: inline-block; vertical-align: middle; margin: 0 4px;" />
                <img src="https://img.icons8.com/color/48/000000/apple-pay.png" height="24" alt="Apple Pay" style="display: inline-block; vertical-align: middle; margin: 0 4px;" />
                <img src="https://img.icons8.com/color/48/000000/google-pay.png" height="24" alt="Google Pay" style="display: inline-block; vertical-align: middle; margin: 0 4px;" />
              </div>
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">Payments processed securely by Square</p>
            </div>
        ` 
        : (club.pay_id_value ? `
            <div style="padding: 24px; text-align: center; border-top: 1px solid #f4f4f5;">
              <p style="margin-top: 0; font-size: 14px; font-weight: bold; color: #52525b;">Please transfer your Match Fees to the club:</p>
              <p style="font-size: 12px; font-weight: bold; color: #71717a; text-transform: uppercase;">${club.pay_id_type === 'bank_account' ? 'Bank Account' : club.pay_id_type}</p>
              <div style="background-color: #f4f4f5; padding: 12px; border-radius: 8px; border: 1px solid #e4e4e7; font-family: monospace; font-size: 16px; font-weight: bold; color: #18181b; margin-top: 8px;">
                ${club.pay_id_value}
              </div>
            </div>
        ` : '');

      const customMessageHtml = customMessage ? `
          <div style="padding: 0 24px 24px 24px;">
            <div style="padding: 16px; border-left: 4px solid ${themeColor}; background-color: #fafafa; font-style: italic; color: #3f3f46; font-size: 14px; line-height: 1.5; border-radius: 4px;">
              "${customMessage.replace(/\n/g, '<br />')}"
            </div>
          </div>
      ` : '';

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f5; padding: 20px; border-radius: 12px;">
          
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
            <tr>
              ${teamLogoUrl ? `<td width="48" align="left" valign="middle" style="padding-right: 12px;">
                <img src="${teamLogoUrl}" width="48" height="48" style="display: block; border-radius: 8px; border: 1px solid #e4e4e7; background-color: #ffffff; object-fit: contain;" />
              </td>` : ''}
              <td align="left" valign="middle">
                <h1 style="color: #18181b; font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">Lineup Selection for ${team.name}</h1>
              </td>
            </tr>
          </table>

          <div style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 24px;">
            <div style="padding: 24px; padding-bottom: ${customMessage ? '8px' : '24px'};">
              <p style="color: #18181b; font-size: 15px; margin-top: 0; margin-bottom: 16px;">Hi ${player.nickname || player.first_name},</p>
              <p style="color: #52525b; font-size: 15px; margin-top: 0; margin-bottom: 0; line-height: 1.5;">You've been selected in the final team for the upcoming match. Please see the details below.</p>
            </div>
            ${customMessageHtml}
          </div>
          
          <div style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            
            <!-- Header -->
            <div style="padding: 16px; border-bottom: 1px solid #f4f4f5;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left">
                    <span style="background-color: #10b981; color: #ffffff; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px;">Upcoming</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; font-weight: 700; color: #71717a; text-transform: uppercase;">${matchDate}</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Match Teams -->
            <div style="padding: 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" width="40%" style="font-size: 14px; font-weight: 900; color: #18181b; text-transform: uppercase;">
                     ${team.name}
                  </td>
                  <td align="center" width="20%" style="font-size: 10px; font-weight: 900; color: #d4d4d8; font-style: italic;">VS</td>
                  <td align="right" width="40%" style="font-size: 14px; font-weight: 900; color: #18181b; text-transform: uppercase; text-align: right;">
                     ${fixture.opponent || 'TBA'}
                  </td>
                </tr>
              </table>
            </div>

            <!-- Location -->
            <div style="background-color: #fafafa; padding: 12px 16px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0; font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">
                ${fixture.start_time ? `${fixture.start_time} &bull; ` : ''}${fixture.location || 'Location TBA'}
              </p>
            </div>

            <!-- Payment -->
            ${paymentSection}
            
          </div>
          
          ${sponsorsHtml}
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #a1a1aa; font-size: 12px;">You received this email because you are a member of ${team.name} on Fees Please.</p>
          </div>
          <div style="text-align: center; margin-top: 32px;">
            <a href="https://feesplease.app" target="_blank" style="text-decoration: none;">
              <p style="font-size: 10px; font-weight: 700; color: #a1a1aa; margin-bottom: 8px; margin-top: 0; text-transform: uppercase; letter-spacing: 1px;">Powered By</p>
              <img src="https://app.feesplease.app/branding/logo-green-1000x300.png" alt="Fees Please" height="32" style="height: 32px; width: auto;" />
            </a>
          </div>
        </div>
      `;

      emailPayloads.push({
        from: `${club.name} <reminders@mail.feesplease.app>`,
        reply_to: 'noreply@mail.feesplease.app',
        to: isTestingEnv ? 'emailtesting@feesplease.app' : player.email,
        subject: `You're in! ${fixture.opponent} (${matchDate})`,
        html: htmlContent
      });
    }

    if (emailPayloads.length === 0) {
      return NextResponse.json({ sentCount: 0, message: 'No valid emails to send.' });
    }

    const { data, error } = await resend.batch.send(emailPayloads);

    if (error) {
      console.error('Resend Error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data && data.data) {
      try {
        const emailLogs = validPlayers.map((player, index) => ({
          resend_id: data.data[index]?.id,
          fixture_id: fixtureId,
          player_id: player.id,
          team_id: teamId,
          status: 'sent',
          email_type: 'squad_notification'
        })).filter(log => log.resend_id);
        
        if (emailLogs.length > 0) {
          await supabaseAdmin.from('email_logs').insert(emailLogs);
        }
      } catch (logErr) {
        console.error('Failed to log emails to DB:', logErr);
      }
    }

    return NextResponse.json({ sentCount: emailPayloads.length, data });
  } catch (error: any) {
    console.error("Squad Notify Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
