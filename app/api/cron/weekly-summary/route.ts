import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

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
    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get('report_id');

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Fetch the report configuration
    let query = supabaseAdmin.from('email_reports').select('*, clubs(name), teams(name)');
    if (reportId) {
      query = query.eq('id', reportId);
    } else {
      query = query.eq('is_active', true);
    }
    
    const { data: allReports, error: reportsErr } = await query;
    if (reportsErr || !allReports || allReports.length === 0) {
      return NextResponse.json({ success: true, message: 'No active reports found to send.' });
    }

    // Filter by time if this is an automated run
    let reports = allReports;
    if (!reportId) {
      const now = new Date();
      
      // Get current time in local timezone (assuming Brisbane AEST as per your prebuild script)
      // For a robust production app, you might use UTC or the club's timezone.
      // Here we format the current hour and day locally.
      const formatter = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
      const parts = formatter.formatToParts(now);
      const currentDay = parts.find(p => p.type === 'weekday')?.value.toLowerCase() || '';
      const currentHour = parts.find(p => p.type === 'hour')?.value || '00';

      reports = allReports.filter(r => {
        // schedule_time is '08:00', we just check the hour part for an hourly cron
        const reportHour = r.schedule_time ? r.schedule_time.split(':')[0] : '08';
        const isTimeMatch = r.schedule_day === currentDay && reportHour === currentHour;
        
        if (!isTimeMatch) return false;

        // Prevent duplicate sends and handle frequency
        if (r.last_sent_at) {
          const lastSent = new Date(r.last_sent_at);
          const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
          
          // 1. Prevent duplicate sends within the same day (e.g. if cron-job.org pings twice)
          if (hoursSinceLastSent < 24) return false;
          
          // 2. Handle Fortnightly frequency (must be at least ~13 days since last send)
          if (r.frequency === 'fortnightly' && hoursSinceLastSent < (13 * 24)) {
            return false;
          }
        }

        return true;
      });

      if (reports.length === 0) {
        return NextResponse.json({ success: true, message: `No active reports scheduled/due for ${currentDay} at ${currentHour}:00.` });
      }
    }

    let totalSent = 0;

    for (const report of reports) {
      const clubId = report.club_id;
      const teamId = report.team_id; // null if club-wide
      
      const clubName = report.clubs?.name || 'Fees Please Club';
      const teamName = report.teams?.name || 'All Teams';
      const entityName = report.report_type === 'club_summary' ? clubName : `${clubName} - ${teamName}`;
      const subjectDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      
      let htmlContent = '';
      let emailSubject = '';

      const formatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
      let collectedToDate = 0;
      let cash = 0;
      let card = 0;
      let expensesToDate = 0;
      let totalOutstanding = 0;
      let teamCollections: Record<string, { name: string, amount: number }> = {};
      let topDebtorsHtml = '';
      let topCreditsHtml = '';
      let fixturesHtml = '';

      // --- AVAILABILITY REPORT ---
      if (report.report_type === 'availability_report' && teamId) {
        const { data: nextFixtures } = await supabaseAdmin.from('fixtures')
          .select('id, match_date, opponent, location, start_time')
          .eq('team_id', teamId)
          .gte('match_date', new Date().toISOString().split('T')[0])
          .order('match_date', { ascending: true })
          .limit(3);

        if (nextFixtures && nextFixtures.length > 0) {
          
          const { data: allTeamPlayers } = await supabaseAdmin.from('players').select('id, first_name, last_name, nickname').eq('default_team_id', teamId).eq('is_active', true);
          const squadSize = allTeamPlayers?.length || 0;
          const playerList = allTeamPlayers || [];

          let featuredGamesHtml = '';
          for (const f of nextFixtures) {
            const fDate = new Date(f.match_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
            
            const { data: availData } = await supabaseAdmin.from('availability').select('player_id, status').eq('fixture_id', f.id);
            const availability = availData || [];

            const yesPlayers = playerList.filter(p => availability.find(a => a.player_id === p.id)?.status === 'yes');
            const maybePlayers = playerList.filter(p => availability.find(a => a.player_id === p.id)?.status === 'maybe');
            const noPlayers = playerList.filter(p => availability.find(a => a.player_id === p.id)?.status === 'no');
            const pendingPlayers = playerList.filter(p => !availability.find(a => a.player_id === p.id) || availability.find(a => a.player_id === p.id)?.status === 'no_reply');

            const formatNames = (players: any[]) => players.map(p => (p.nickname || `${p.first_name || ''} ${p.last_name?.charAt(0) || ''}.`).trim()).join('<br/>');

            featuredGamesHtml += `
              <div style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 16px;">
                <div style="padding: 16px; border-bottom: 1px solid #f4f4f5;">
                  <span style="background-color: #f4f4f5; color: #71717a; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px;">${fDate}</span>
                </div>
                <div style="padding: 16px;">
                  <div style="font-size: 14px; font-weight: 900; color: #18181b; text-transform: uppercase;">vs ${f.opponent || 'TBA'}</div>
                  <div style="font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">${f.start_time ? `${f.start_time} • ` : ''}${f.location || 'Location TBA'}</div>
                </div>
                ${getLineupStatsHtml(yesPlayers.length, maybePlayers.length, noPlayers.length, pendingPlayers.length, squadSize, formatNames(yesPlayers), formatNames(maybePlayers), formatNames(noPlayers), formatNames(pendingPlayers))}
              </div>
            `;
          }

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.feesplease.app';
          const teamUrl = `${baseUrl}/t/${report.teams?.slug || teamId}`;
          const loginUrl = `${baseUrl}/login`;
          const teamLogoUrl = null; // Can optionally fetch team logo here if needed, but not strictly necessary since it is a general report

          emailSubject = `Availability Report: ${teamName}`;
          
          htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
              <style>
                @media only screen and (max-width: 500px) {
                  .stack-column {
                    display: block !important;
                    width: 100% !important;
                    border-right: none !important;
                    border-bottom: 1px solid #f4f4f5 !important;
                    padding: 16px 0 !important;
                  }
                  .stack-column:last-child {
                    border-bottom: none !important;
                  }
                }
              </style>
            </head>
            <body>
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f5; padding: 20px; border-radius: 12px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="left" valign="middle">
                    <h1 style="color: #18181b; font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">Availability Summary</h1>
                  </td>
                </tr>
              </table>

              <p style="color: #52525b; font-size: 16px; margin-top: 0; margin-bottom: 24px; text-align: center;">
                Here is the latest availability for your upcoming matches.
              </p>
              
              ${featuredGamesHtml}

              <div style="text-align: center; margin-top: 24px;">
                <a href="${loginUrl}" style="display: inline-block; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 900; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px;">Log In</a>
              </div>

              <div style="text-align: center; margin-top: 40px;">
                <a href="https://feesplease.app" target="_blank" style="text-decoration: none;">
                  <p style="font-size: 10px; font-weight: 700; color: #a1a1aa; margin-bottom: 8px; margin-top: 0; text-transform: uppercase; letter-spacing: 1px;">Powered By</p>
                  <img src="https://app.feesplease.app/branding/logo-green-1000x300.png" alt="Fees Please" height="32" style="height: 32px; width: auto;" />
                </a>
              </div>
            </div>
            </body>
            </html>
          `;
        } else {
          console.log(`No upcoming fixtures for team ${teamId}, skipping availability report.`);
          continue;
        }
      }

      if (!htmlContent) {
      // --- FINANCIAL CALCULATION ---
      // Fetch all players for this club/team to associate balances
      let playersQuery = supabaseAdmin.from('players').select('id, first_name, last_name, nickname').eq('club_id', clubId);
      if (teamId) {
        playersQuery = playersQuery.eq('default_team_id', teamId);
      }
      const { data: players } = await playersQuery;
      const playerList = players || [];

      // Fetch all transactions
      let txQuery = supabaseAdmin.from('transactions').select('amount, transaction_type, payment_method, player_id, created_at, team_id, teams(name)').eq('club_id', clubId);
      if (teamId) {
        txQuery = txQuery.eq('team_id', teamId);
      }
      const { data: transactions } = await txQuery;
      
      collectedToDate = 0;
      let collectedThisWeek = 0;
      cash = 0;
      card = 0;
      expensesToDate = 0;
      
      teamCollections = {};
      const playerBalances: Record<string, { name: string, balance: number }> = {};
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      (transactions || []).forEach(tx => {
        const amt = Number(tx.amount);
        if (tx.transaction_type === 'payment') {
          collectedToDate += amt;
          if (tx.payment_method?.toLowerCase().includes('card') || tx.payment_method?.toLowerCase().includes('square')) card += amt;
          else cash += amt;
          
          if (new Date(tx.created_at) >= oneWeekAgo) {
            collectedThisWeek += amt;
          }
          
          if (!teamId && tx.team_id) {
            const txTeams: any = tx.teams;
            const tName = txTeams?.name || 'Club';
            if (!teamCollections[tx.team_id]) teamCollections[tx.team_id] = { name: tName, amount: 0 };
            teamCollections[tx.team_id].amount += amt;
          }
        }
        
        if (tx.transaction_type === 'expense') {
          expensesToDate += amt;
        }
        
        if (tx.player_id) {
          const player = playerList.find(p => p.id === tx.player_id);
          const name = player ? (player.nickname || `${player.first_name} ${player.last_name?.charAt(0) || ''}.`) : "Unknown Player";
          if (!playerBalances[tx.player_id]) playerBalances[tx.player_id] = { name, balance: 0 };
          
          if (tx.transaction_type === 'fee') playerBalances[tx.player_id].balance += amt;
          if (tx.transaction_type === 'payment') playerBalances[tx.player_id].balance -= amt;
        }
      });

      totalOutstanding = Object.values(playerBalances).reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
      
      const sortedBalances = Object.values(playerBalances).sort((a, b) => b.balance - a.balance);
      const topDebtors = sortedBalances.filter(p => p.balance > 0).slice(0, 5);
      
      const sortedCredits = Object.values(playerBalances).filter(p => p.balance < 0).sort((a, b) => a.balance - b.balance);
      const topCredits = sortedCredits.slice(0, 5);


      // --- FIXTURES CALCULATION ---
      let fixQuery = supabaseAdmin
        .from('fixtures')
        .select('id, opponent, match_date, teams(name), status')
        .order('match_date', { ascending: true });
        
      if (teamId) {
        fixQuery = fixQuery.eq('team_id', teamId);
      } else {
        const { data: teamsData } = await supabaseAdmin.from('teams').select('id').eq('club_id', clubId);
        const teamIds = (teamsData || []).map(t => t.id);
        if (teamIds.length > 0) {
          fixQuery = fixQuery.in('team_id', teamIds);
        } else {
          fixQuery = fixQuery.eq('club_id', clubId); // fallback
        }
      }
      
      const { data: allFixtures } = await fixQuery;
      
      const upcomingFixtures = (allFixtures || [])
        .filter(f => !['completed', 'forfeited', 'abandoned'].includes(f.status))
        .slice(0, 3);

      let fixturesHtml = '';
      if (upcomingFixtures && upcomingFixtures.length > 0) {
        for (const fix of upcomingFixtures) {
          const { data: avail } = await supabaseAdmin
            .from('availability')
            .select('status, players(nickname, first_name, last_name)')
            .eq('fixture_id', fix.id);
            
          let yes = 0, no = 0, maybe = 0;
          let yesNames: string[] = [], noNames: string[] = [], maybeNames: string[] = [];
          (avail || []).forEach(a => {
             const p = a.players as any;
             const name = p ? (p.nickname || `${p.first_name || ''} ${p.last_name?.charAt(0) || ''}.`).trim() : 'Unknown';
             if (a.status === 'yes') { yes++; yesNames.push(name); }
             else if (a.status === 'no') { no++; noNames.push(name); }
             else if (a.status === 'maybe') { maybe++; maybeNames.push(name); }
          });
          
          const fixDate = new Date(fix.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          const fixTeams: any = fix.teams;
          const fixTeamLabel = !teamId ? ` - ${fixTeams?.name}` : '';
          
          fixturesHtml += `
            <div style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <div style="padding: 16px 20px; border-bottom: 1px solid #f4f4f5;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left">
                      <div style="font-size: 14px; font-weight: 900; color: #18181b; text-transform: uppercase; letter-spacing: 1px;">VS ${fix.opponent}${fixTeamLabel}</div>
                    </td>
                    <td align="right">
                      <div style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">${fixDate}</div>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="padding: 16px 20px; background-color: #fafafa;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="33%" align="center" valign="top">
                       <div style="font-size: 20px; font-weight: 900; color: #18181b;">${yes}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">Avail</div>
                       <div style="font-size: 10px; color: #71717a; margin-top: 6px; line-height: 1.4;">${yesNames.join('<br/>')}</div>
                    </td>
                    <td width="33%" align="center" valign="top">
                       <div style="font-size: 20px; font-weight: 900; color: #18181b;">${maybe}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #f59e0b; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">Maybe</div>
                       <div style="font-size: 10px; color: #71717a; margin-top: 6px; line-height: 1.4;">${maybeNames.join('<br/>')}</div>
                    </td>
                    <td width="33%" align="center" valign="top">
                       <div style="font-size: 20px; font-weight: 900; color: #18181b;">${no}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #ef4444; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">Out</div>
                       <div style="font-size: 10px; color: #71717a; margin-top: 6px; line-height: 1.4;">${noNames.join('<br/>')}</div>
                    </td>
                  </tr>
                </table>
              </div>
            </div>
          `;
        }
      } else {
        const debugText = `No upcoming fixtures scheduled. (Found ${allFixtures?.length || 0} total fixtures for team ${teamId || 'all'}, ${upcomingFixtures.length} upcoming)`;
        fixturesHtml = `
          <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 24px; text-align: center;">
            <p style="color: #71717a; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0;">${debugText}</p>
          </div>
        `;
      }


      // --- HTML BUILDERS ---
      
      topDebtorsHtml = '';
      if (topDebtors.length === 0) {
        topDebtorsHtml = '<div style="font-size: 10px; font-weight: 700; font-style: italic; color: #a1a1aa;">No outstanding debts.</div>';
      } else {
        topDebtorsHtml = topDebtors.map(d => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td align="left" style="font-size: 11px; font-weight: 700; color: #18181b;">${d.name}</td>
              <td align="right" style="font-size: 11px; font-weight: 900; color: #ef4444;">${formatter.format(d.balance)}</td>
            </tr></table>
          </div>
        `).join('');
      }

      topCreditsHtml = '';
      if (topCredits.length === 0) {
        topCreditsHtml = '<div style="font-size: 10px; font-weight: 700; font-style: italic; color: #a1a1aa;">No players in credit.</div>';
      } else {
        topCreditsHtml = topCredits.map(c => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td align="left" style="font-size: 11px; font-weight: 700; color: #18181b;">${c.name}</td>
              <td align="right" style="font-size: 11px; font-weight: 900; color: #10b981;">+${formatter.format(Math.abs(c.balance))}</td>
            </tr></table>
          </div>
        `).join('');
      }


      // End of if(!htmlContent) financial calculation block
      }

      // --- RECIPIENTS ---
      let recipientEmails: string[] = [];

      if (report.send_to_all_admins !== false) {
        let rolesQuery = supabaseAdmin.from('user_roles').select('email, role').eq('club_id', clubId);
        if (teamId) {
          rolesQuery = rolesQuery.or(`and(role.eq.team_admin,team_id.eq.${teamId}),role.in.(club_admin)`);
        } else {
          rolesQuery = rolesQuery.in('role', ['club_admin']);
        }
        const { data: recipientsData } = await rolesQuery;
        recipientEmails = (recipientsData || []).map(r => r.email).filter(Boolean);

        // Also get super admins
        const { data: superAdmins } = await supabaseAdmin.from('profiles').select('email').eq('role', 'super_admin');
        if (superAdmins) {
          recipientEmails.push(...superAdmins.map(p => p.email).filter(Boolean));
        }
      }

      if (report.recipient_emails) {
        const customEmails = report.recipient_emails.split(',').map((e: string) => e.trim()).filter(Boolean);
        recipientEmails.push(...customEmails);
      }

      recipientEmails = Array.from(new Set(recipientEmails));
      if (recipientEmails.length === 0) continue;

      // Fetch team profile for logo
      let tpQuery = supabaseAdmin.from('public_team_profiles').select('club_logo_url').eq('club_id', clubId);
      if (teamId) {
        tpQuery = tpQuery.eq('team_id', teamId);
      }
      const finalTpQuery = tpQuery.limit(1).maybeSingle();
      const { data: tpData } = await finalTpQuery;

      // Fetch sponsors
      let spQuery = supabaseAdmin.from('team_sponsors').select('*').eq('is_active', true);
      if (teamId) {
        spQuery = spQuery.eq('team_id', teamId);
      } else {
        // Find one active team's sponsors for club emails
        const { data: teamsData } = await supabaseAdmin.from('teams').select('id').eq('club_id', clubId).limit(1);
        if (teamsData && teamsData.length > 0) {
          spQuery = spQuery.eq('team_id', teamsData[0].id);
        } else {
          spQuery = spQuery.eq('team_id', '00000000-0000-0000-0000-000000000000'); // Force empty if no team
        }
      }
      const { data: teamSponsorsData } = await spQuery;
      const sponsors = teamSponsorsData || [];

      let sponsorsHtml = '';
      if (sponsors.length > 0) {
        sponsorsHtml = `
          <div style="margin-top: 32px; margin-bottom: 8px; text-align: center;">
            <p style="font-size: 10px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; margin-top: 0;">Supported By</p>
            <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                ${sponsors.slice(0, 4).map((s: any) => {
                  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.feesplease.app';
                  const clickUrl = s.url ? `${baseUrl}/api/track-sponsor?team_id=${teamId || s.team_id}&sponsor_id=${s.id}&event_type=click&source=email&redirect=${encodeURIComponent(s.url)}` : '';
                  const impressionUrl = `${baseUrl}/api/track-sponsor?team_id=${teamId || s.team_id}&sponsor_id=${s.id}&event_type=impression&source=email`;
                  return `<td align="center" style="padding: 0 8px;">${clickUrl ? `<a href="${clickUrl}" target="_blank">` : ''}<img src="${s.logo_url}" alt="${s.name || 'Sponsor'}" height="48" style="max-height: 48px; max-width: 120px; width: auto; display: block; object-fit: contain;" />${clickUrl ? `</a>` : ''}<img src="${impressionUrl}" width="1" height="1" style="display:none;" alt="" /></td>`;
                }).join('')}
              </tr>
            </table>
          </div>
        `;
      }
      
      const teamLogoUrl = tpData?.club_logo_url || null;

      if (!htmlContent) {
      // --- FINAL EMAIL HTML (LIGHT THEME) ---
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <style>
            @media only screen and (max-width: 500px) {
              .stack-column {
                display: block !important;
                width: 100% !important;
                border-right: none !important;
                border-bottom: 1px solid #f4f4f5 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                padding-bottom: 16px !important;
                margin-bottom: 16px !important;
              }
              .stack-column:last-child {
                border-bottom: none !important;
                padding-bottom: 0 !important;
                margin-bottom: 0 !important;
              }
            }
          </style>
        </head>
        <body>
        <div style="background-color: #f4f4f5; padding: 32px 16px; text-align: center;">
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; text-align: left;">
            
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
              <tr>
                ${teamLogoUrl ? `<td width="48" align="left" valign="middle" style="padding-right: 12px;">
                  <img src="${teamLogoUrl}" width="48" height="48" style="display: block; border-radius: 8px; border: 1px solid #e4e4e7; background-color: #ffffff; object-fit: contain;" />
                </td>` : ''}
                <td align="left" valign="middle">
                  <h1 style="color: #10b981; font-size: 24px; font-style: italic; text-transform: uppercase; margin: 0 0 4px 0; font-weight: 900; letter-spacing: -0.5px;">Fees Please</h1>
                  <h2 style="font-size: 12px; color: #71717a; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Weekly Insights for ${entityName}</h2>
                </td>
                <td align="right" valign="middle">
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.feesplease.app'}/login" style="display: inline-block; background-color: #18181b; color: #ffffff; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Log In</a>
                </td>
              </tr>
            </table>
            
            <!-- Financial Health Card -->
            <div style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              
              <div style="padding: 16px 20px; border-bottom: 1px solid #f4f4f5;">
                <span style="background-color: #f4f4f5; color: #18181b; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px;">Financial Health</span>
              </div>
              
              <div style="padding: 24px 20px;">
                 <table width="100%" cellpadding="0" cellspacing="0">
                   <tr>
                     <td class="stack-column" width="33%" valign="top" style="border-right: 1px solid #f4f4f5; padding-right: 10px;">
                       <div style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Collected</div>
                       <div style="font-size: 24px; font-weight: 900; color: #10b981; margin-bottom: 8px; letter-spacing: -1px;">${formatter.format(collectedToDate)}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">
                         Cash: ${formatter.format(cash)}<br/>Card: ${formatter.format(card)}
                       </div>
                     </td>
                     <td class="stack-column" width="33%" valign="top" style="border-right: 1px solid #f4f4f5; padding-left: 10px; padding-right: 10px;">
                       <div style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Net Pos</div>
                       <div style="font-size: 24px; font-weight: 900; color: ${collectedToDate - expensesToDate >= 0 ? '#10b981' : '#ef4444'}; margin-bottom: 8px; letter-spacing: -1px;">${collectedToDate - expensesToDate > 0 ? '+' : ''}${formatter.format(collectedToDate - expensesToDate)}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">
                         Fees: ${formatter.format(expensesToDate)}
                       </div>
                     </td>
                     <td class="stack-column" width="33%" valign="top" style="padding-left: 10px;">
                       <div style="font-size: 10px; font-weight: 900; color: #ef4444; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">O/S</div>
                       <div style="font-size: 24px; font-weight: 900; color: #ef4444; letter-spacing: -1px;">${formatter.format(totalOutstanding)}</div>
                     </td>
                   </tr>
                 </table>
              </div>

              ${report.report_type === 'club_summary' && Object.keys(teamCollections).length > 0 ? `
              <div style="border-top: 1px solid #f4f4f5; padding: 16px 20px; background-color: #fafafa;">
                <div style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Collected By Team</div>
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${Object.values(teamCollections).map(tc => `
                  <tr>
                    <td style="padding: 4px 0; font-size: 12px; font-weight: 600; color: #3f3f46;">${tc.name}</td>
                    <td style="padding: 4px 0; font-size: 12px; font-weight: 900; color: #18181b; text-align: right;">${formatter.format(tc.amount)}</td>
                  </tr>
                  `).join('')}
                </table>
              </div>
              ` : ''}

              <div style="border-top: 1px solid #f4f4f5; padding: 20px; background-color: #fafafa;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50%" valign="top" style="padding-right: 12px;">
                       <div style="font-size: 9px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;"><span style="color: #ef4444;">⚠</span> Top Debtors</div>
                       ${topDebtorsHtml}
                    </td>
                    <td width="50%" valign="top" style="padding-left: 12px;">
                       <div style="font-size: 9px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;"><span style="color: #10b981;">+</span> In Credit</div>
                       ${topCreditsHtml}
                    </td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Fixtures -->
            <div style="margin-bottom: 12px;">
               <span style="font-size: 11px; font-weight: 900; color: #18181b; text-transform: uppercase; letter-spacing: 1px;">Upcoming Fixtures</span>
            </div>
            ${fixturesHtml}

            <!-- Footer -->
            ${sponsorsHtml}
            <div style="text-align: center; margin-top: 24px;">
              <p style="color: #a1a1aa; font-size: 12px;">You received this email because you are an admin for ${entityName} on Fees Please.</p>
            </div>
            <div style="text-align: center; margin-top: 32px;">
              <a href="https://feesplease.app" target="_blank" style="text-decoration: none;">
                <p style="font-size: 10px; font-weight: 700; color: #a1a1aa; margin-bottom: 8px; margin-top: 0; text-transform: uppercase; letter-spacing: 1px;">Powered By</p>
                <img src="https://app.feesplease.app/branding/logo-green-1000x300.png" alt="Fees Please" height="32" style="height: 32px; width: auto;" />
              </a>
            </div>
          </div>
        </div>
        </body>
        </html>
      `;
      } // End of htmlContent overwrite block

      if (!emailSubject) {
         emailSubject = `Summary Report for ${entityName} ${subjectDate}`;
      }

      const isTestingEnv = process.env.NODE_ENV !== 'production' || 
                           process.env.VERCEL_ENV === 'preview' || 
                           process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') || 
                           process.env.NEXT_PUBLIC_SITE_URL?.includes('staging');

      // 6. Send the emails
      const emailPayloads = recipientEmails.map(email => {
        const targetEmail = isTestingEnv ? 'emailtesting@feesplease.app' : email;
        const testPrefix = isTestingEnv ? '[TEST] ' : '';
        
        let finalHtml = htmlContent;
        if (isTestingEnv) {
          finalHtml = `
            <div style="background-color: #fef08a; border-bottom: 2px solid #eab308; padding: 12px; text-align: center; font-family: sans-serif; font-size: 12px; color: #854d0e; font-weight: bold;">
              [TEST MODE INTERCEPT]<br/>
              This email was originally addressed to: <span style="color: #000;">${email}</span>
            </div>
            ${htmlContent}
          `;
        }

        return {
          from: `Fees Please Insights <insights@mail.feesplease.app>`,
          to: targetEmail,
          subject: `${testPrefix}${emailSubject}`,
          html: finalHtml,
        };
      });
      
      const { error: sendError } = await resend.batch.send(emailPayloads);
      
      if (!sendError) {
        totalSent += emailPayloads.length;
        await supabaseAdmin.from('email_reports').update({ last_sent_at: new Date().toISOString() }).eq('id', report.id);
      } else {
        console.error("Resend Error:", sendError);
      }
    }

    return NextResponse.json({ success: true, sentCount: totalSent });
  } catch (err: any) {
    console.error("Cron Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
