import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

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
        return r.schedule_day === currentDay && reportHour === currentHour;
      });

      if (reports.length === 0) {
        return NextResponse.json({ success: true, message: `No active reports scheduled for ${currentDay} at ${currentHour}:00.` });
      }
    }

    let totalSent = 0;

    for (const report of reports) {
      const clubId = report.club_id;
      const teamId = report.team_id; // null if club-wide
      
      const clubName = report.clubs?.name || 'Fees Please Club';
      const teamName = report.teams?.name || 'All Teams';

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
      
      let collectedToDate = 0;
      let collectedThisWeek = 0;
      let cash = 0;
      let card = 0;
      let expensesToDate = 0;
      
      const teamCollections: Record<string, { name: string, amount: number }> = {};
      const playerBalances: Record<string, { name: string, balance: number }> = {};
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      (transactions || []).forEach(tx => {
        const amt = Number(tx.amount);
        if (tx.transaction_type === 'payment') {
          collectedToDate += amt;
          if (tx.payment_method === 'card') card += amt;
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

      const totalOutstanding = Object.values(playerBalances).reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
      
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
            .select('status')
            .eq('fixture_id', fix.id);
            
          let yes = 0, no = 0, maybe = 0;
          (avail || []).forEach(a => {
             if (a.status === 'yes') yes++;
             else if (a.status === 'no') no++;
             else if (a.status === 'maybe') maybe++;
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
                    <td width="33%" align="center">
                       <div style="font-size: 20px; font-weight: 900; color: #18181b;">${yes}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">Avail</div>
                    </td>
                    <td width="33%" align="center">
                       <div style="font-size: 20px; font-weight: 900; color: #18181b;">${maybe}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #f59e0b; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">Maybe</div>
                    </td>
                    <td width="33%" align="center">
                       <div style="font-size: 20px; font-weight: 900; color: #18181b;">${no}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #ef4444; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">Out</div>
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
      const formatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
      
      let topDebtorsHtml = '';
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

      let topCreditsHtml = '';
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


      // --- RECIPIENTS ---
      let rolesQuery = supabaseAdmin.from('user_roles').select('email, role').eq('club_id', clubId);
      if (teamId) {
        rolesQuery = rolesQuery.or(`and(role.eq.team_admin,team_id.eq.${teamId}),role.in.(club_admin)`);
      } else {
        rolesQuery = rolesQuery.in('role', ['club_admin']);
      }
      const { data: recipientsData } = await rolesQuery;
      let recipientEmails = (recipientsData || []).map(r => r.email).filter(Boolean);

      // Also get super admins
      const { data: superAdmins } = await supabaseAdmin.from('profiles').select('email').eq('role', 'super_admin');
      if (superAdmins) {
        recipientEmails.push(...superAdmins.map(p => p.email).filter(Boolean));
      }

      recipientEmails = Array.from(new Set(recipientEmails));
      if (recipientEmails.length === 0) continue;

      const entityName = report.report_type === 'club_summary' ? clubName : `${clubName} - ${teamName}`;
      const subjectDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      // Fetch team profile for logo and sponsors
      let tpQuery = supabaseAdmin.from('public_team_profiles').select('club_logo_url, sponsor_1_logo, sponsor_1_url, sponsor_2_logo, sponsor_2_url, sponsor_3_logo, sponsor_3_url').eq('club_id', clubId);
      if (teamId) {
        tpQuery = tpQuery.eq('team_id', teamId);
      }
      const finalTpQuery = tpQuery.limit(1).maybeSingle();
      const { data: tpData } = await finalTpQuery;

      let sponsorsHtml = '';
      if (tpData && (tpData.sponsor_1_logo || tpData.sponsor_2_logo || tpData.sponsor_3_logo)) {
        const sponsors = [
          { logo: tpData.sponsor_1_logo, url: tpData.sponsor_1_url },
          { logo: tpData.sponsor_2_logo, url: tpData.sponsor_2_url },
          { logo: tpData.sponsor_3_logo, url: tpData.sponsor_3_url }
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
      
      const teamLogoUrl = tpData?.club_logo_url || null;

      // --- FINAL EMAIL HTML (LIGHT THEME) ---
      const htmlContent = `
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
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.feesplease.app'}/login" style="display: inline-block; background-color: #18181b; color: #ffffff; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; padding: 10px 16px; border-radius: 8px; text-decoration: none;">Log In</a>
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
                     <td width="33%" valign="top" style="border-right: 1px solid #f4f4f5; padding-right: 10px;">
                       <div style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Collected</div>
                       <div style="font-size: 24px; font-weight: 900; color: #10b981; margin-bottom: 8px; letter-spacing: -1px;">${formatter.format(collectedToDate)}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">
                         Cash: ${formatter.format(cash)}<br/>Card: ${formatter.format(card)}
                       </div>
                     </td>
                     <td width="33%" valign="top" style="border-right: 1px solid #f4f4f5; padding-left: 10px; padding-right: 10px;">
                       <div style="font-size: 10px; font-weight: 900; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Net Pos</div>
                       <div style="font-size: 24px; font-weight: 900; color: ${collectedToDate - expensesToDate >= 0 ? '#10b981' : '#ef4444'}; margin-bottom: 8px; letter-spacing: -1px;">${collectedToDate - expensesToDate > 0 ? '+' : ''}${formatter.format(collectedToDate - expensesToDate)}</div>
                       <div style="font-size: 9px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">
                         Fees: ${formatter.format(expensesToDate)}
                       </div>
                     </td>
                     <td width="33%" valign="top" style="padding-left: 10px;">
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
      `;

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
          subject: `${testPrefix}Summary Report for ${entityName} ${subjectDate}`,
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
