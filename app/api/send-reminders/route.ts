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
    const { fixtureId, teamId, action = 'send', senderName = "Your Captain", selectedPlayerIds } = body;

    if (!fixtureId || !teamId) {
      return NextResponse.json({ error: 'Missing fixtureId or teamId' }, { status: 400 });
    }

    // 1. Fetch Fixture and Team details
    const { data: fixture } = await supabaseAdmin
      .from('fixtures')
      .select('*, teams (name, slug, club_id, public_team_profiles(club_logo_url))')
      .eq('id', fixtureId)
      .maybeSingle();

    if (!fixture) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
    }
    
    if (fixture.reminder_sent && action === 'send') {
      return NextResponse.json({ error: 'A reminder has already been sent for this game.' }, { status: 400 });
    }

    const team = fixture.teams;
    if (!team) {
       return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const matchDate = new Date(fixture.match_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    const teamSlug = team.slug || teamId;
    const teamName = team.name || "Your Team";

    // 2. Fetch all players for this team who have emails
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, first_name, nickname, email, unsubscribed')
      .eq('default_team_id', teamId)
      .not('email', 'is', null);

    if (playersError) {
      console.error('Supabase players error:', playersError);
      return NextResponse.json({ 
        sentCount: 0, 
        message: 'Database error fetching players',
        errorDetails: playersError.message 
      }, { status: 200 });
    }

    if (!players || players.length === 0) {
      return NextResponse.json({ sentCount: 0, message: 'No players with emails found' }, { status: 200 });
    }

    // 3. Fetch existing availability responses for this fixture
    const { data: availability } = await supabaseAdmin
      .from('availability')
      .select('player_id, status')
      .eq('fixture_id', fixtureId);

    const { data: allTeamPlayers } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('default_team_id', teamId);

    const totalSquadSize = allTeamPlayers ? allTeamPlayers.length : players.length;

    const yesCount = availability?.filter(a => a.status === 'yes').length || 0;
    const maybeCount = availability?.filter(a => a.status === 'maybe').length || 0;
    const noCount = availability?.filter(a => a.status === 'no').length || 0;
    const unconfirmedCount = totalSquadSize - (yesCount + maybeCount + noCount);
    
    const yesPct = totalSquadSize > 0 ? (yesCount / totalSquadSize) * 100 : 0;
    const maybePct = totalSquadSize > 0 ? (maybeCount / totalSquadSize) * 100 : 0;
    const noPct = totalSquadSize > 0 ? (noCount / totalSquadSize) * 100 : 0;
    const unconfirmedPct = totalSquadSize > 0 ? (unconfirmedCount / totalSquadSize) * 100 : 0;

    const respondedPlayerIds = new Set(
      availability?.filter(a => ['yes', 'no', 'maybe'].includes(a.status)).map(a => a.player_id) || []
    );

    // 4. Filter players
    let pendingPlayers = players.filter(p => p.email && p.email.trim() !== '' && p.unsubscribed !== true);
    
    if (selectedPlayerIds && Array.isArray(selectedPlayerIds) && selectedPlayerIds.length > 0) {
      // If specific players are selected, only email them (bypasses already responded check)
      pendingPlayers = pendingPlayers.filter(p => selectedPlayerIds.includes(p.id));
    } else {
      // Default behavior: email those who haven't responded
      pendingPlayers = pendingPlayers.filter(p => !respondedPlayerIds.has(p.id));
    }

    const isTestingEnv = process.env.NODE_ENV !== 'production';
    
    // In testing mode, strictly limit the blast to only 2 players max
    if (isTestingEnv) {
      pendingPlayers = pendingPlayers.slice(0, 2);
    }

    if (pendingPlayers.length === 0) {
      return NextResponse.json({ 
        sentCount: 0, 
        message: 'No pending players after filtering',
        debug: {
          originalPlayersCount: players.length,
          selectedPlayerIds: selectedPlayerIds || [],
          playersInDbIds: players.map(p => p.id)
        }
      }, { status: 200 });
    }

    if (action === 'check') {
      return NextResponse.json({ 
        success: true, 
        pendingCount: pendingPlayers.length, 
        reminderSent: fixture.reminder_sent 
      }, { status: 200 });
    }

    // 5. Send Emails via Resend
    const sentEmails = [];
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Fees Please <reminders@mail.feesplease.app>'; 
    
    // We can use resend.batch.send to send up to 100 emails at once
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (isTestingEnv ? 'http://localhost:3000' : 'https://app.feesplease.app');

    const emailPayloads = pendingPlayers.map(player => {
      const publicHubUrl = `${baseUrl}/t/${teamSlug}?fixture=${fixture.id}`;
      const unsubscribeUrl = `${baseUrl}/t/${teamSlug}/unsubscribe?player=${player.id}`;

      const urlYes = `${publicHubUrl}&player=${player.id}&status=yes`;
      const urlMaybe = `${publicHubUrl}&player=${player.id}&status=maybe`;
      const urlNo = `${publicHubUrl}&player=${player.id}&status=no`;

      const team = fixture.teams;
      const teamLogoUrl = Array.isArray(team.public_team_profiles) 
        ? team.public_team_profiles[0]?.club_logo_url 
        : team.public_team_profiles?.club_logo_url;

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f5; padding: 20px; border-radius: 12px;">
          
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
            <tr>
              ${teamLogoUrl ? `<td width="48" align="left" valign="middle" style="padding-right: 12px;">
                <img src="${teamLogoUrl}" width="48" height="48" style="display: block; border-radius: 8px; border: 1px solid #e4e4e7; background-color: #ffffff; object-fit: contain;" />
              </td>` : ''}
              <td align="left" valign="middle">
                <h1 style="color: #18181b; font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">Availability Request for ${teamName}</h1>
              </td>
            </tr>
          </table>

          <div style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 24px;">
            <div style="padding: 24px;">
              <p style="color: #18181b; font-size: 15px; margin-top: 0; margin-bottom: 16px;">Hi ${player.nickname || player.first_name},</p>
              <p style="color: #52525b; font-size: 15px; margin-top: 0; margin-bottom: 24px; line-height: 1.5;">${teamName} needs to confirm your availability for the upcoming match. Please indicate via the buttons below.</p>
              <p style="color: #18181b; font-size: 15px; margin-top: 0; margin-bottom: 0;">Cheers,<br/><strong>${senderName}</strong></p>
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

            <!-- Squad Status -->
            <div style="background-color: #fafafa; padding: 16px; border-top: 1px solid #f4f4f5;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                <tr>
                  <td align="left"><span style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Squad Status</span></td>
                  <td align="right"><span style="font-size: 10px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">${yesCount} / ${totalSquadSize} Confirmed</span></td>
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
          
          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #a1a1aa; font-size: 12px;">You received this email because you are a member of ${teamName} on Fees Please.</p>
            <p style="color: #a1a1aa; font-size: 12px;"><a href="${unsubscribeUrl}" style="color: #71717a; text-decoration: underline;">Unsubscribe from availability reminders</a></p>
          </div>
        </div>
      `;

      const targetEmail = isTestingEnv ? 'emailtesting@feesplease.app' : player.email;

      return {
        from: `${teamName} on Fees Please <reminders@mail.feesplease.app>`,
        to: targetEmail,
        subject: `${isTestingEnv ? '[TEST] ' : ''}Availability for upcoming match ${teamName} vs ${fixture.opponent || 'TBA'}`,
        html: htmlContent,
      };
    });

    const { data, error } = await resend.batch.send(emailPayloads);

    if (error) {
      console.error('Resend Error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log the emails to the database for analytics
    if (data && data.data) {
      try {
        const emailLogs = pendingPlayers.map((player, index) => ({
          resend_id: data.data[index]?.id,
          fixture_id: fixtureId,
          player_id: player.id,
          team_id: teamId,
          status: 'sent'
        })).filter(log => log.resend_id);
        
        if (emailLogs.length > 0) {
          await supabaseAdmin.from('email_logs').insert(emailLogs);
        }
      } catch (logErr) {
        console.error('Failed to log emails to DB:', logErr);
      }
    }

    await supabaseAdmin.from('fixtures').update({ reminder_sent: true }).eq('id', fixtureId);

    return NextResponse.json({ 
      success: true, 
      sentCount: emailPayloads.length,
      data
    }, { status: 200 });

  } catch (err: any) {
    console.error('Send Reminders Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
