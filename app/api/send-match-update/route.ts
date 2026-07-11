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
    const { fixtureId, teamId, playerIds, customNote } = body;

    if (!fixtureId || !teamId || !playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields or player list is empty.' }, { status: 400 });
    }

    // Fetch Fixture and Team details
    const { data: fixture } = await supabaseAdmin
      .from('fixtures')
      .select('*, teams (name, slug, club_id, public_team_profiles(club_logo_url))')
      .eq('id', fixtureId)
      .maybeSingle();

    if (!fixture) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
    }
    
    const team = fixture.teams;
    if (!team) {
       return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const matchDate = new Date(fixture.match_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    const teamSlug = team.slug || teamId;
    const teamName = team.name || "Your Team";

    // Fetch players
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, first_name, nickname, email, unsubscribed')
      .in('id', playerIds)
      .not('email', 'is', null)
      .eq('is_active', true);

    if (playersError || !players || players.length === 0) {
      return NextResponse.json({ sentCount: 0, message: 'No eligible players found or database error.' }, { status: 200 });
    }

    const isTestingEnv = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview' || process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (isTestingEnv ? 'http://localhost:3000' : 'https://app.feesplease.app');

    // Fetch active sponsors
    const { data: teamSponsorsData } = await supabaseAdmin
      .from('team_sponsors')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true);

    const sponsors = teamSponsorsData || [];
    const tpArray = team.public_team_profiles;
    const tp = Array.isArray(tpArray) ? tpArray[0] : tpArray;
    let sponsorsHtml = '';

    if (sponsors.length > 0) {
      sponsorsHtml = `
        <div style="margin-top: 32px; margin-bottom: 8px; text-align: center;">
          <p style="font-size: 10px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; margin-top: 0;">Supported By</p>
          <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              ${sponsors.slice(0, 4).map((s: any) => {
                const clickUrl = s.url ? `${baseUrl}/api/track-sponsor?team_id=${teamId}&sponsor_id=${s.id}&event_type=click&source=email&redirect=${encodeURIComponent(s.url)}` : '';
                const impressionUrl = `${baseUrl}/api/track-sponsor?team_id=${teamId}&sponsor_id=${s.id}&event_type=impression&source=email`;
                return `<td align="center" style="padding: 0 8px;">${clickUrl ? `<a href="${clickUrl}" target="_blank">` : ''}<img src="${s.logo_url}" alt="${s.name || 'Sponsor'}" height="32" style="height: 32px; width: auto; display: block;" />${clickUrl ? `</a>` : ''}<img src="${impressionUrl}" width="1" height="1" style="display:none;" alt="" /></td>`;
              }).join('')}
            </tr>
          </table>
        </div>
      `;
    }

    // Fetch lineup stats for the card
    const { data: allTeamPlayers } = await supabaseAdmin.from('players').select('id').eq('default_team_id', teamId).eq('is_active', true);
    const squadSize = allTeamPlayers?.length || 0;
    
    const { data: availData } = await supabaseAdmin.from('availability').select('player_id, status').eq('fixture_id', fixture.id);
    const availability = availData || [];
    const yesCount = availability.filter(a => a.status === 'yes').length;
    const maybeCount = availability.filter(a => a.status === 'maybe').length;
    const noCount = availability.filter(a => a.status === 'no').length;
    const unconfirmedCount = squadSize - (yesCount + maybeCount + noCount);

    const emailPayloads = players.map(player => {
      const publicHubUrl = `${baseUrl}/t/${teamSlug}?fixture=${fixture.id}`;
      const urlYes = `${publicHubUrl}&player=${player.id}&status=yes`;
      const urlMaybe = `${publicHubUrl}&player=${player.id}&status=maybe`;
      const urlNo = `${publicHubUrl}&player=${player.id}&status=no`;
      const teamLogoUrl = tp?.club_logo_url;

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f5; padding: 20px; border-radius: 12px;">
          
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
            <tr>
              ${teamLogoUrl ? `<td width="48" align="left" valign="middle" style="padding-right: 12px;">
                <img src="${teamLogoUrl}" width="48" height="48" style="display: block; border-radius: 8px; border: 1px solid #e4e4e7; background-color: #ffffff; object-fit: contain;" />
              </td>` : ''}
              <td align="left" valign="middle">
                <h1 style="color: #18181b; font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">Match Details Updated</h1>
              </td>
            </tr>
          </table>

          <div style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 24px;">
            <div style="padding: 24px;">
              <p style="color: #18181b; font-size: 15px; margin-top: 0; margin-bottom: 16px;">Hi ${player.first_name || player.nickname || 'there'},</p>
              ${customNote ? `
              <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #10b981;">
                <p style="color: #18181b; font-size: 13px; font-weight: 700; margin-top: 0; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">Message from ${teamName}:</p>
                <p style="color: #52525b; font-size: 15px; margin: 0; line-height: 1.5; white-space: pre-wrap;">${customNote}</p>
              </div>
              ` : ''}
              <p style="color: #52525b; font-size: 15px; margin-top: 0; margin-bottom: 24px; line-height: 1.5;">${teamName} has updated the match details for your upcoming game. Please re-confirm your availability via the buttons below.</p>
            </div>
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
                     ${teamName}
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

            <!-- Lineup Status -->
            <div style="background-color: #fafafa; padding: 16px; border-top: 1px solid #f4f4f5;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                <tr>
                  <td align="left"><span style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Lineup Status</span></td>
                  <td align="right"><span style="font-size: 10px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">${yesCount} / ${squadSize} Confirmed</span></td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" width="25%">
                    <div style="font-size: 14px; font-weight: 900; color: #18181b;">${yesCount}</div>
                    <div style="font-size: 8px; font-weight: 700; color: #10b981; text-transform: uppercase; margin-top: 2px;">Avail</div>
                  </td>
                  <td align="center" width="25%">
                    <div style="font-size: 14px; font-weight: 900; color: #18181b;">${maybeCount}</div>
                    <div style="font-size: 8px; font-weight: 700; color: #f59e0b; text-transform: uppercase; margin-top: 2px;">Maybe</div>
                  </td>
                  <td align="center" width="25%">
                    <div style="font-size: 14px; font-weight: 900; color: #18181b;">${noCount}</div>
                    <div style="font-size: 8px; font-weight: 700; color: #ef4444; text-transform: uppercase; margin-top: 2px;">Out</div>
                  </td>
                  <td align="center" width="25%">
                    <div style="font-size: 14px; font-weight: 900; color: #18181b;">${unconfirmedCount}</div>
                    <div style="font-size: 8px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; margin-top: 2px;">Unconf</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Buttons -->
            <div style="background-color: #fafafa; padding: 16px; border-top: 1px solid #f4f4f5;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" width="32%" style="padding-right: 4px;">
                    <a href="${urlYes}" style="display: block; padding: 12px 0; background-color: #10b981; border: 1px solid #059669; border-radius: 8px; text-decoration: none; font-size: 10px; font-weight: 900; color: #ffffff; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">Available</a>
                  </td>
                  <td align="center" width="32%" style="padding-left: 2px; padding-right: 2px;">
                    <a href="${urlMaybe}" style="display: block; padding: 12px 0; background-color: #f59e0b; border: 1px solid #d97706; border-radius: 8px; text-decoration: none; font-size: 10px; font-weight: 900; color: #ffffff; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">Maybe</a>
                  </td>
                  <td align="center" width="32%" style="padding-left: 4px;">
                    <a href="${urlNo}" style="display: block; padding: 12px 0; background-color: #ef4444; border: 1px solid #b91c1c; border-radius: 8px; text-decoration: none; font-size: 10px; font-weight: 900; color: #ffffff; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">Out</a>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          
          ${sponsorsHtml}
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #a1a1aa; font-size: 12px;">You received this email because you are a member of ${teamName} on Fees Please.</p>
          </div>
          <div style="text-align: center; margin-top: 32px;">
            <a href="https://feesplease.app" target="_blank" style="text-decoration: none;">
              <p style="font-size: 10px; font-weight: 700; color: #a1a1aa; margin-bottom: 8px; margin-top: 0; text-transform: uppercase; letter-spacing: 1px;">Powered By</p>
              <img src="https://app.feesplease.app/branding/logo-green-1000x300.png" alt="Fees Please" height="32" style="height: 32px; width: auto;" />
            </a>
          </div>
          <div style="text-align: center; margin-top: 16px;">
            <a href="${baseUrl}/t/${teamSlug}/unsubscribe?player=${player.id}" style="font-size: 10px; color: #a1a1aa; text-decoration: underline;">Unsubscribe from availability requests</a>
          </div>
        </div>
      `;

      let finalHtml = htmlContent;
      let targetEmail = player.email;
      const testPrefix = isTestingEnv ? '[TEST] ' : '';
      
      if (isTestingEnv) {
        targetEmail = 'emailtesting@feesplease.app';
        finalHtml = `
          <div style="background-color: #fef08a; border-bottom: 2px solid #eab308; padding: 12px; text-align: center; font-family: sans-serif; font-size: 12px; color: #854d0e; font-weight: bold;">
            [TEST MODE INTERCEPT]<br/>
            This email was originally addressed to: <span style="color: #000;">${player.email}</span>
          </div>
          ${htmlContent}
        `;
      }

      return {
        from: `${teamName} Updates <reminders@mail.feesplease.app>`,
        to: targetEmail,
        subject: `${testPrefix}Match Updated: ${teamName} vs ${fixture.opponent || 'TBA'}`,
        html: finalHtml,
        headers: {
          'X-Entity-Ref-ID': fixture.id
        }
      };
    });

    const { data: resendData, error: sendError } = await resend.batch.send(emailPayloads);
    
    if (sendError) {
      console.error('Resend batch error:', sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    // Log the emails sent
    const logInserts = players.map(p => ({
      club_id: team.club_id,
      team_id: fixture.team_id,
      player_id: p.id,
      fixture_id: fixture.id,
      email_type: 'match_update',
      sent_to_email: p.email,
      status: 'sent'
    }));

    if (logInserts.length > 0) {
      await supabaseAdmin.from('email_logs').insert(logInserts);
    }

    return NextResponse.json({ success: true, sentCount: emailPayloads.length }, { status: 200 });
    
  } catch (error: any) {
    console.error("Match Update API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
