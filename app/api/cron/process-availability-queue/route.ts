import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function getEmailHtml(
  playerName: string, 
  teamName: string, 
  teamLogoUrl: string | undefined, 
  featuredGamesHtml: string, 
  teamUrl: string,
  baseUrl: string
) {
  return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f5; padding: 20px; border-radius: 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            ${teamLogoUrl ? `<td width="48" align="left" valign="middle" style="padding-right: 12px;">
              <img src="${teamLogoUrl}" width="48" height="48" style="display: block; border-radius: 8px; border: 1px solid #e4e4e7; background-color: #ffffff; object-fit: contain;" />
            </td>` : ''}
            <td align="left" valign="middle">
              <h1 style="color: #18181b; font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">Availability Update</h1>
            </td>
          </tr>
        </table>

        <p style="color: #52525b; font-size: 16px; margin-top: 0; margin-bottom: 24px; text-align: center;">
          <strong>${playerName}</strong> has recently updated their availability.
        </p>
        
        ${featuredGamesHtml}

        <div style="text-align: center; margin-top: 24px;">
          <a href="${baseUrl}/login" style="display: inline-block; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 900; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px;">Log In</a>
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <a href="https://feesplease.app" target="_blank" style="text-decoration: none;">
            <p style="font-size: 10px; font-weight: 700; color: #a1a1aa; margin-bottom: 8px; margin-top: 0; text-transform: uppercase; letter-spacing: 1px;">Powered By</p>
            <img src="https://app.feesplease.app/branding/logo-green-1000x300.png" alt="Fees Please" height="32" style="height: 32px; width: auto;" />
          </a>
        </div>
      </div>
  `;
}

function getStatusBadge(status: string) {
    if (status === 'yes') return '<span style="background-color: #d1fae5; color: #059669; font-weight: 700; padding: 4px 12px; border-radius: 99px; font-size: 12px; text-transform: uppercase;">Available ✓</span>';
    if (status === 'maybe') return '<span style="background-color: #fef3c7; color: #d97706; font-weight: 700; padding: 4px 12px; border-radius: 99px; font-size: 12px; text-transform: uppercase;">Maybe ?</span>';
    if (status === 'no') return '<span style="background-color: #fee2e2; color: #dc2626; font-weight: 700; padding: 4px 12px; border-radius: 99px; font-size: 12px; text-transform: uppercase;">Unavailable ✗</span>';
    return '<span style="background-color: #f4f4f5; color: #71717a; font-weight: 700; padding: 4px 12px; border-radius: 99px; font-size: 12px; text-transform: uppercase;">Unconfirmed</span>';
}

function getLineupStatsHtml(
    yesCount: number, 
    maybeCount: number, 
    noCount: number, 
    unconfirmedCount: number, 
    squadSize: number,
    yesNamesHtml: string,
    maybeNamesHtml: string,
    noNamesHtml: string,
    unconfirmedNamesHtml: string
) {
    return `
    <div style="background-color: #fafafa; padding: 16px; border-top: 1px solid #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
        <tr>
          <td align="left"><span style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Lineup Status</span></td>
          <td align="right"><span style="font-size: 10px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">${yesCount} / ${squadSize} Confirmed</span></td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
        <tr>
          <td align="center" valign="top" width="25%" style="padding: 0 4px; overflow-wrap: break-word;">
            <div style="font-size: 14px; font-weight: 900; color: #18181b;">${yesCount}</div>
            <div style="font-size: 8px; font-weight: 700; color: #10b981; text-transform: uppercase; margin-top: 2px;">Avail</div>
            <div style="font-size: 10px; color: #71717a; margin-top: 6px; line-height: 1.4;">${yesNamesHtml}</div>
          </td>
          <td align="center" valign="top" width="25%" style="padding: 0 4px; overflow-wrap: break-word;">
            <div style="font-size: 14px; font-weight: 900; color: #18181b;">${maybeCount}</div>
            <div style="font-size: 8px; font-weight: 700; color: #f59e0b; text-transform: uppercase; margin-top: 2px;">Maybe</div>
            <div style="font-size: 10px; color: #71717a; margin-top: 6px; line-height: 1.4;">${maybeNamesHtml}</div>
          </td>
          <td align="center" valign="top" width="25%" style="padding: 0 4px; overflow-wrap: break-word;">
            <div style="font-size: 14px; font-weight: 900; color: #18181b;">${noCount}</div>
            <div style="font-size: 8px; font-weight: 700; color: #ef4444; text-transform: uppercase; margin-top: 2px;">Out</div>
            <div style="font-size: 10px; color: #71717a; margin-top: 6px; line-height: 1.4;">${noNamesHtml}</div>
          </td>
          <td align="center" valign="top" width="25%" style="padding: 0 4px; overflow-wrap: break-word;">
            <div style="font-size: 14px; font-weight: 900; color: #18181b;">${unconfirmedCount}</div>
            <div style="font-size: 8px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; margin-top: 2px;">Unconf</div>
            <div style="font-size: 10px; color: #71717a; margin-top: 6px; line-height: 1.4;">${unconfirmedNamesHtml}</div>
          </td>
        </tr>
      </table>
    </div>
    `;
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      return NextResponse.json({ error: 'Missing keys' }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { autoRefreshToken: false, persistSession: false } 
    });

    // 1. Fetch queue
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from('availability_queue')
      .select('*')
      .order('created_at', { ascending: true });

    if (queueError || !queueItems || queueItems.length === 0) {
      return NextResponse.json({ success: true, message: 'Queue is empty' }, { status: 200 });
    }

    // Process items by team -> player -> fixtures
    const updatesByTeamAndPlayer: Record<string, Record<string, Record<string, string>>> = {};
    const processedIds: string[] = [];

    for (const item of queueItems) {
      processedIds.push(item.id);
      if (!updatesByTeamAndPlayer[item.team_id]) updatesByTeamAndPlayer[item.team_id] = {};
      if (!updatesByTeamAndPlayer[item.team_id][item.player_id]) updatesByTeamAndPlayer[item.team_id][item.player_id] = {};
      
      // Store latest status for this fixture
      updatesByTeamAndPlayer[item.team_id][item.player_id][item.fixture_id] = item.status;
    }

    const isTestingEnv = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview' || process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (isTestingEnv ? 'http://localhost:3000' : 'https://app.feesplease.app');
    const emailPayloads: any[] = [];

    // 2. Build emails
    for (const teamId of Object.keys(updatesByTeamAndPlayer)) {
        
        // Ensure team has instant_event report configured
        const { data: reports } = await supabaseAdmin
          .from('email_reports')
          .select('*')
          .eq('team_id', teamId)
          .eq('report_type', 'availability_report')
          .eq('frequency', 'instant_event')
          .eq('is_active', true);
    
        if (!reports || reports.length === 0) continue;
        const report = reports[0];

        // Fetch team and recipients
        const { data: team } = await supabaseAdmin.from('teams').select('name, club_id, slug, public_team_profiles(club_logo_url)').eq('id', teamId).maybeSingle();
        if (!team) continue;

        let recipientEmails: string[] = [];
        
        if (report.send_to_all_admins !== false) {
          let rolesQuery = supabaseAdmin.from('user_roles').select('email, role').eq('club_id', team.club_id);
          rolesQuery = rolesQuery.or(`and(role.eq.team_admin,team_id.eq.${teamId}),role.in.(club_admin)`);
          
          const { data: recipientsData } = await rolesQuery;
          recipientEmails = (recipientsData || []).map(r => r.email).filter(Boolean);
          const { data: superAdmins } = await supabaseAdmin.from('profiles').select('email').eq('role', 'super_admin');
          if (superAdmins) recipientEmails.push(...superAdmins.map(p => p.email).filter(Boolean));
        }

        if (report.recipient_emails) recipientEmails.push(...report.recipient_emails.split(',').map((e: string) => e.trim()).filter(Boolean));
        recipientEmails = Array.from(new Set(recipientEmails));
        
        if (recipientEmails.length === 0) continue;

        const teamName = team.name || "Your Team";

        // Squad size for lineup stats
        const { data: allTeamPlayers } = await supabaseAdmin.from('players').select('id, first_name, last_name, nickname').eq('default_team_id', teamId).eq('is_active', true);
        const squadSize = allTeamPlayers?.length || 0;
        const playerList = allTeamPlayers || [];

        // Generate email content
        const { data: tpData } = await supabaseAdmin.from('public_team_profiles').select('club_logo_url').eq('team_id', teamId).maybeSingle();
        const teamLogoUrl = tpData?.club_logo_url || undefined;
        const teamUrl = `${baseUrl}/t/${team.slug || teamId}`;

        const updatesByPlayer = updatesByTeamAndPlayer[teamId];

        for (const [playerId, updatedFixturesMap] of Object.entries(updatesByPlayer)) {
            const { data: player } = await supabaseAdmin.from('players').select('first_name, nickname, last_name').eq('id', playerId).maybeSingle();
            if (!player) continue;
            const playerName = player.nickname || `${player.first_name} ${player.last_name || ''}`.trim();

            const updatedFixtureIds = Object.keys(updatedFixturesMap);

            // Fetch the updated fixtures
            const { data: updatedFixtures } = await supabaseAdmin
              .from('fixtures')
              .select('id, match_date, opponent, location, start_time')
              .in('id', updatedFixtureIds)
              .order('match_date', { ascending: true });

            // Fetch next upcoming games to fill out the 3 slots if needed
            const updatedCount = updatedFixtures?.length || 0;
            let upcomingFixtures: any[] = [];
            
            if (updatedCount < 3) {
              const fetchLimit = 3 - updatedCount;
              const { data: upcomingData } = await supabaseAdmin
                .from('fixtures')
                .select('id, match_date, opponent, location, start_time')
                .eq('team_id', teamId)
                .gte('match_date', new Date().toISOString())
                .not('id', 'in', `(${updatedFixtureIds.join(',')})`)
                .order('match_date', { ascending: true })
                .limit(fetchLimit);
              
              if (upcomingData) upcomingFixtures = upcomingData;
            }

            // Combine them, prioritizing updated fixtures, up to 3 total
            const featuredFixtures = [...(updatedFixtures || [])].slice(0, 3);
            if (featuredFixtures.length < 3) {
                featuredFixtures.push(...upcomingFixtures);
            }

            let featuredGamesHtml = '';
            for (const f of featuredFixtures) {
                const fDate = new Date(f.match_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
                const isUpdated = updatedFixtureIds.includes(f.id);
                
                // Fetch lineup stats and this player's status
                const { data: availData } = await supabaseAdmin.from('availability').select('player_id, status').eq('fixture_id', f.id);
                const availability = availData || [];
                const playerStatusRow = availability.find(a => a.player_id === playerId);
                const playerStatus = playerStatusRow ? playerStatusRow.status : 'unconfirmed';

                const yesPlayers = playerList.filter(p => availability.find(a => a.player_id === p.id)?.status === 'yes');
                const maybePlayers = playerList.filter(p => availability.find(a => a.player_id === p.id)?.status === 'maybe');
                const noPlayers = playerList.filter(p => availability.find(a => a.player_id === p.id)?.status === 'no');
                const pendingPlayers = playerList.filter(p => !availability.find(a => a.player_id === p.id) || availability.find(a => a.player_id === p.id)?.status === 'no_reply');

                const formatNames = (players: any[]) => players.map(p => (p.nickname || `${p.first_name || ''} ${p.last_name?.charAt(0) || ''}.`).trim()).join('<br/>');

                const yesCount = yesPlayers.length;
                const maybeCount = maybePlayers.length;
                const noCount = noPlayers.length;
                const unconfirmedCount = pendingPlayers.length;

                featuredGamesHtml += `
                  <div style="background-color: #ffffff; border: 1px solid ${isUpdated ? '#10b981' : '#e4e4e7'}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 16px; ${isUpdated ? 'border-left: 4px solid #10b981;' : ''}">
                    <div style="padding: 16px; border-bottom: 1px solid #f4f4f5;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="left"><span style="background-color: #f4f4f5; color: #71717a; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px;">${fDate}</span></td>
                          <td align="right">${getStatusBadge(playerStatus)}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="padding: 16px;">
                      <div style="font-size: 14px; font-weight: 900; color: #18181b; text-transform: uppercase;">vs ${f.opponent || 'TBA'}</div>
                      <div style="font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">${f.start_time ? `${f.start_time} • ` : ''}${f.location || 'Location TBA'}</div>
                    </div>
                    ${getLineupStatsHtml(yesCount, maybeCount, noCount, unconfirmedCount, squadSize, formatNames(yesPlayers), formatNames(maybePlayers), formatNames(noPlayers), formatNames(pendingPlayers))}
                  </div>
                `;
            }

            const extraCount = updatedCount > 3 ? updatedCount - 3 : 0;
            const extraHtml = extraCount > 0 ? `<p style="text-align: center; color: #71717a; font-size: 12px; margin-bottom: 16px;">...and ${extraCount} other match${extraCount === 1 ? '' : 'es'} updated.</p>` : '';

            const htmlContent = getEmailHtml(playerName, teamName, teamLogoUrl, featuredGamesHtml + extraHtml, teamUrl, baseUrl);

            recipientEmails.forEach(email => {
                let targetEmail = email;
                let finalHtml = htmlContent;
                if (isTestingEnv) {
                  targetEmail = 'emailtesting@feesplease.app';
                  finalHtml = `<div style="background-color: #fef08a; padding: 12px; text-align: center; font-size: 12px; color: #854d0e; font-weight: bold;">[TEST MODE INTERCEPT]<br/>Addressed to: ${email}</div>${htmlContent}`;
                }
                emailPayloads.push({
                    from: `${teamName} Updates <reminders@mail.feesplease.app>`,
                    to: targetEmail,
                    subject: `${isTestingEnv ? '[TEST] ' : ''}Availability Update from ${playerName}`,
                    html: finalHtml,
                });
            });
        }
    }

    if (emailPayloads.length > 0) {
        const { error: sendError } = await resend.batch.send(emailPayloads);
        if (sendError) {
            console.error('Resend batch error:', sendError);
            return NextResponse.json({ error: sendError.message }, { status: 500 });
        }
    }

    // 3. Delete processed queue items
    if (processedIds.length > 0) {
        await supabaseAdmin.from('availability_queue').delete().in('id', processedIds);
    }

    return NextResponse.json({ success: true, processed: processedIds.length, emailsSent: emailPayloads.length }, { status: 200 });
  } catch (error: any) {
    console.error("Queue Processor Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
