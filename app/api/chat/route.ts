// @ts-nocheck
import { google } from '@ai-sdk/google';
import { generateText, tool } from 'ai'; 
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js'; 
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const maxDuration = 60;

export async function POST(req: Request) {
  let reqData: any = {};
  try {
    reqData = await req.json();
    const { messages, clubId, userId } = reqData;
    const activeClub = clubId && clubId !== "Unknown" ? clubId : null;
    const lastUserMsgObj = messages.filter((m: any) => m.role === 'user').pop();
    const lastUserMessage = lastUserMsgObj?.content || "";
    const lastUserAttachments = lastUserMsgObj?.attachments || [];

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    );

    let userRole = "Member";
    let userEmail = "";
    let userName = "Unknown User";
    let clubName = "Unknown Club";
    let planTier = "Free";
    
    if (activeClub) {
      const { data: club } = await supabaseAdmin.from('clubs').select('name, plan_tier').eq('id', activeClub).single();
      if (club) {
        clubName = club.name;
        planTier = club.plan_tier || "Free";
      }
    }

    if (userId !== "Unknown") {
      const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userAuth?.user?.email) userEmail = userAuth.user.email;
      const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, last_name, role').eq('id', userId).single();
      if (profile) userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || "Unknown User";
      if (profile?.role === 'super_admin') {
        userRole = "Super Admin";
      } else if (activeClub) {
        const { data: rolesData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId).eq('club_id', activeClub);
        if (rolesData && rolesData.length > 0) {
          const isClubAdmin = rolesData.some((r: any) => r.role === 'club_admin');
          const isTeamAdmin = rolesData.some((r: any) => r.role === 'team_admin');
          userRole = isClubAdmin ? 'Account Admin' : (isTeamAdmin ? 'Team Admin' : 'Member');
        }
      }
    }

    const modelParams = {
      maxSteps: 10,
      system: `You are dAIve, the legendary, smart assistant for "Fees Please". 
      
      CORE IDENTITY & TONE:
      - You are a helpful, direct club mate. No robotic filler.
      - CONCISENESS IS MANDATORY: Keep responses under 3 sentences whenever possible. Never output large walls of text. 
      - The user speaking to you is a ${userRole} for the club "${clubName}". Tailor your advice to what this role can do (e.g. Account Admins manage global settings and all teams; Team Admins manage only their assigned teams).
      - The club "${clubName}" is currently on the ${planTier.toUpperCase()} plan. If they ask about features, keep their plan and access level in mind.
      
      SETUP & PROACTIVE HELP:
      - If the user asks for setup help, or asks general questions like "what's next?" or "getting started", ALWAYS use 'get_club_setup_status' to check their progress.
      - After checking status, proactively point out ONE missing step and ask if they'd like help with it. Do NOT list everything at once. Keep a conversation flowing.
      
      SECURITY & GUARDRAILS (STRICT):
      - You are strictly an assistant for the Fees Please application.
      - NEVER share, explain, or discuss internal database schemas, source code, API keys, infrastructure, or technical admin links.
      - If asked about these, politely decline and steer the conversation back to managing the club.
      - Do not output raw JSON or SQL.
      
      KNOWLEDGE & TOOLS:
      - "What is Fees Please?": Payment/roster app for grassroots clubs.
      - "Plans & Pricing": Free (1 team limit, 2.5% fee), Plus (Unlimited teams, email reminders, game reports, 30c fee, billed per team), Pro (Flat rate for up to 5 teams, SMS coming soon).
      - "Next Game/Fixtures": You MUST use 'get_fixtures'.
      - "Ledger Totals": Use 'get_financial_summary'.
      - "How is that calculated?" or "Who owes what?": You MUST use 'get_ledger_breakdown'.
      - "How-to/Permissions": Use 'searchKnowledgeBase'. Use 1 word for the search.

      CRITICAL: If a tool returns "No data", explain that it might be a scoping issue (e.g., no club selected). Do NOT just go silent.`,
      messages,
      tools: {
        get_club_setup_status: tool({
          description: 'Check the database to see what setup steps the club has completed.',
          parameters: z.object({}),
          execute: async () => {
            if (!activeClub) return "ERROR: No club selected.";
            const { count: teams } = await supabaseAdmin.from('teams').select('*', { count: 'exact', head: true }).eq('club_id', activeClub);
            const { count: players } = await supabaseAdmin.from('players').select('*', { count: 'exact', head: true }).eq('club_id', activeClub);
            const { count: fixtures } = await supabaseAdmin.from('fixtures').select('*', { count: 'exact', head: true }).eq('club_id', activeClub);
            const { data: club } = await supabaseAdmin.from('clubs').select('stripe_account_id, square_access_token').eq('id', activeClub).single();
            
            const hasPayments = !!(club?.stripe_account_id || club?.square_access_token);
            
            return JSON.stringify({
               teams_created: teams && teams > 0,
               players_added: players && players > 0,
               fixtures_added: fixtures && fixtures > 0,
               payments_configured: hasPayments
            });
          }
        }),
        searchKnowledgeBase: tool({
          description: 'Search the wiki for technical guides like "permissions" or "setup".',
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            const searchTerm = query.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            try {
              const auth = Buffer.from(`${process.env.CONFLUENCE_USER_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');
              // WIDEST SEARCH POSSIBLE
              const cqlQuery = `space="${process.env.CONFLUENCE_SPACE_KEY}" AND (title ~ "${searchTerm}" OR text ~ "${searchTerm}")`;
              const response = await fetch(`https://${process.env.CONFLUENCE_DOMAIN}/wiki/rest/api/content/search?cql=${encodeURIComponent(cqlQuery)}&expand=body.storage`, {
                headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
              });
              const data = await response.json();
              console.log(`WIKI RESULTS FOR "${searchTerm}":`, data.results?.length || 0);
              if (!data.results?.length) return `Nothing found for "${searchTerm}" in the manual.`;
              return data.results.slice(0, 2).map(p => `### ${p.title}\n${p.body?.storage?.value.replace(/<[^>]*>?/gm, '').substring(0, 800)}`).join('\n\n');
            } catch (err) { return "Wiki's offline, mate."; }
          }
        }),
        get_fixtures: tool({
          description: 'Get match dates and opponents.',
          parameters: z.object({}),
          execute: async () => {
            if (!activeClub) return "ERROR: No club selected. The user needs to pick a club.";
            const { data } = await supabaseAdmin.from('fixtures').select(`opponent, match_date, start_time`).eq('club_id', activeClub).order('match_date', { ascending: true });
            return data?.length ? data.map(f => `vs ${f.opponent} on ${f.match_date} at ${f.start_time}`).join('\n') : "Database shows zero fixtures for this club ID.";
          }
        }),
        get_financial_summary: tool({
          description: 'Get the overall dollar totals for the club.',
          parameters: z.object({}),
          execute: async () => {
            if (!activeClub) return "ERROR: No club selected.";
            const { data } = await supabaseAdmin.from('transactions').select('amount, transaction_type').eq('club_id', activeClub);
            let billed = 0; let collected = 0;
            data?.forEach(t => {
               const amt = Math.abs(t.amount || 0);
               if (['payment', 'cash', 'card'].includes(t.transaction_type.toLowerCase())) collected += amt;
               else billed += amt;
            });
            return `TOTALS: Billed $${billed}, Collected $${collected}`;
          }
        }),
        get_ledger_breakdown: tool({
          description: 'Use this to explain HOW the totals were calculated. Shows player balances.',
          parameters: z.object({}),
          execute: async () => {
            if (!activeClub) return "ERROR: No club selected.";
            const { data } = await supabaseAdmin.from('players').select(`first_name, last_name, transactions(amount, transaction_type)`).eq('club_id', activeClub);
            const breakdown = data.map(p => {
                let paid = p.transactions.filter(t => ['payment', 'cash', 'card'].includes(t.transaction_type.toLowerCase())).reduce((acc, t) => acc + Math.abs(t.amount), 0);
                let billed = p.transactions.filter(t => ['fee', 'charge'].includes(t.transaction_type.toLowerCase())).reduce((acc, t) => acc + Math.abs(t.amount), 0);
                return `${p.first_name} ${p.last_name}: Billed $${billed}, Paid $${paid}`;
            }).join('\n');
            return `Individual Player Breakdown:\n${breakdown}`;
          }
        }),
        raise_jsm_ticket: tool({
          description: 'Raise a support ticket in Jira Service Management (JSM) when a problem cannot be resolved.',
          parameters: z.object({
            summary: z.string().optional().describe('A clear, human-readable title summarizing the user\'s issue.'),
            description: z.string().optional().describe('A detailed, human-readable explanation of what is going wrong based on the conversation.')
          }),
          execute: async ({ summary, description }) => {
            if (!activeClub) return "ERROR: No club selected. Cannot raise ticket.";
            try {
              const email = process.env.CONFLUENCE_USER_EMAIL;
              const apiToken = process.env.CONFLUENCE_API_TOKEN;
              const domain = process.env.CONFLUENCE_DOMAIN;
              const serviceDeskId = process.env.JSM_SERVICE_DESK_ID || "1";
              const requestTypeId = process.env.JSM_REQUEST_TYPE_ID || "1";

              const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
              const finalSummary = summary || `Support request for ${clubName}`;
              const finalDescription = description || 'No description provided by AI.';

              // --- Handle JSM Organization ---
              let orgId = null;
              if (clubName !== "Unknown Club") {
                const orgSearch = await fetch(`https://${domain}/rest/servicedeskapi/organization?searchTerm=${encodeURIComponent(clubName)}`, {
                   headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
                });
                const orgData = await orgSearch.json();
                if (orgData.values && orgData.values.length > 0) {
                  orgId = orgData.values[0].id;
                } else {
                  const orgCreate = await fetch(`https://${domain}/rest/servicedeskapi/organization`, {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ name: clubName })
                  });
                  if (orgCreate.ok) {
                    const newOrg = await orgCreate.json();
                    orgId = newOrg.id;
                  }
                }
              }

              // --- Create Ticket ---
              const payload: any = {
                serviceDeskId, requestTypeId,
                requestFieldValues: { summary: finalSummary, description: finalDescription }
              };
              if (userEmail) {
                payload.raiseOnBehalfOf = userEmail;
              }

              const response = await fetch(`https://${domain}/rest/servicedeskapi/request`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
              });
              
              const data = await response.json();
              if (!response.ok) throw new Error(data.errorMessage || 'JSM API failed');

              const issueKey = data.issueKey;
              const reporterAccountId = data.reporter?.accountId;

              // --- Add user to Org ---
              if (orgId && reporterAccountId) {
                 await fetch(`https://${domain}/rest/servicedeskapi/organization/${orgId}/user`, {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ accountIds: [reporterAccountId] })
                 });
              }

              // --- Add Internal Comment for Diagnostics ---
              const posthogUrl = `https://us.posthog.com/project/415115/person/${userId}?activeTab=sessionRecordings`;
              const conversationLog = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
              const internalCommentBody = `--- Conversation Log ---\n${conversationLog}\n\n--- Diagnostic Context ---\nClub: ${clubName} (ID: ${activeClub})\nUser: ${userName} (ID: ${userId})\nUser Role: ${userRole}\nPostHog Replay: ${posthogUrl}`;
              
              await fetch(`https://${domain}/rest/servicedeskapi/request/${issueKey}/comment`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ body: internalCommentBody, public: false })
              });

              // --- Upload Attachments ---
              if (lastUserAttachments.length > 0) {
                for (const file of lastUserAttachments) {
                  const { data: fileBlob } = await supabaseAdmin.storage.from('support-attachments').download(file.path);
                  if (fileBlob) {
                    const formData = new FormData();
                    formData.append('file', fileBlob, file.name);
                    await fetch(`https://${domain}/rest/servicedeskapi/request/${issueKey}/attachment`, {
                      method: 'POST',
                      headers: { 'Authorization': `Basic ${auth}`, 'X-Atlassian-Token': 'no-check' },
                      body: formData as any
                    });
                  }
                }
              }

              // --- Send Initial Welcome Email via Resend ---
              if (userEmail && process.env.RESEND_API_KEY) {
                try {
                  const resend = new Resend(process.env.RESEND_API_KEY);
                  const { data: resendData, error: resendError } = await resend.emails.send({
                    from: 'Fees Please Support <support@mail.feesplease.app>',
                    to: userEmail,
                    subject: `Support Request Logged - Ref: ${issueKey}`,
                    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f9fafb; padding: 40px 0; }
    .main { background-color: #ffffff; margin: 0 auto; max-width: 500px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
    .header { padding: 32px 32px 20px 32px; text-align: center; }
    .content { padding: 0 40px 40px 40px; text-align: left; }
    h1 { color: #111827; font-size: 22px; font-weight: 700; margin-bottom: 24px; text-align: center; }
    p { color: #4b5563; font-size: 16px; line-height: 24px; margin-bottom: 24px; }
    .footer { text-align: center; font-size: 12px; color: #9ca3af; padding: 24px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <img src="https://joazqqkfqxaujebfhges.supabase.co/storage/v1/object/public/Logo/fees-please-email-1000x150.png" width="300" alt="Fees Please">
      </div>
      <div class="content">
        <h1>Support Request Logged</h1>
        <p>Hi${userName !== "Unknown User" ? ' ' + userName.split(' ')[0] : ''},</p>
        <p>Thanks for reaching out. We've successfully logged a ticket with our engineering team.</p>
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Your Reference</p>
            <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 900; color: #00B27A;">${issueKey}</p>
        </div>
        <p>Our team will investigate and if they need to respond, you'll receive an email notification directly from our ticketing system.</p>
        <p style="margin-bottom: 0;">Cheers,<br><strong>The Fees Please Team</strong></p>
      </div>
    </div>
    <div class="footer">
      <strong>Fees Please</strong><br>
      Less chasing. More playing.
    </div>
  </div>
</body>
</html>
                    `
                  });
                  if (resendError) {
                    console.error("Resend API error:", resendError);
                  } else {
                    console.log("Resend email sent successfully:", resendData);
                  }
                } catch (emailErr) {
                  console.error("Failed to send Resend email:", emailErr);
                }
              }

              return `Got it! I've logged a ticket with support for you. The reference number is ${issueKey}. We've emailed you with a reference and will get back to you as soon as we can. Is there anything else I can help you with today?`;
            } catch (err) {
              console.error("JSM ticket creation failed:", err);
              return "I ran into an issue trying to submit the ticket, mate. Please try again shortly.";
            }
          }
        })
      }
    };

    const { generateTextWithFallback } = require("@/lib/gemini-fallback");
    const result = await generateTextWithFallback(modelParams);
    let finalText = result.text;

    // --- RECOVERY LOGIC (The "Anti-Stupid" Layer) ---
    if (!finalText || finalText.trim() === "") {
        const tr = result.steps?.flatMap(s => s.toolResults).pop();
        if (tr) {
            console.log("Forcing summary of tool result...");
            const retry = await generateTextWithFallback({
                system: "You are dAIve. Summarize this data clearly for the user. Do not be a robot.",
                prompt: `User asked: ${lastUserMessage}\n\nTool Result: ${tr.result || tr.output}`
            });
            finalText = retry.text;
        } else {
            finalText = "I've hit a bit of a snag with the data. Check that your Club is selected in the sidebar, or give me another specific question about fixtures or the manual.";
        }
    }

    let logId = undefined;
    try {
        const { data: logData } = await supabaseAdmin.from('ai_logs').insert({
            user_id: userId !== "Unknown" ? userId : null,
            prompt: lastUserMessage,
            response: finalText,
            session_id: activeClub || 'general',
            metadata: { feature: 'daive_chat', club_id: activeClub }
        }).select('id').single();
        logId = logData?.id;
    } catch (logErr) {
        console.error("Failed to log to ai_logs", logErr);
    }

    return NextResponse.json({ text: finalText, logId });
  } catch (error) {
    console.error("CRITICAL ERROR:", error);
    
    // --- Auto Bug Reporting ---
    try {
      const domain = process.env.CONFLUENCE_DOMAIN;
      const user = process.env.CONFLUENCE_USER_EMAIL;
      const token = process.env.CONFLUENCE_API_TOKEN;
      if (domain && user && token) {
        const auth = Buffer.from(`${user}:${token}`).toString('base64');
        const serviceDeskId = process.env.JSM_SERVICE_DESK_ID || '1';
        const requestTypeId = process.env.JSM_REQUEST_TYPE_ID || '1';
        
        await fetch(`https://${domain}/rest/servicedeskapi/request`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            serviceDeskId,
            requestTypeId,
            requestFieldValues: {
              summary: "CRITICAL: Automated Bug Report from AI Chat",
              description: `An unhandled exception occurred in the AI Chat widget.\\n\\nError: ${String(error)}\\n\\nPayload context:\\n${JSON.stringify(reqData, null, 2)}`
            }
          })
        });
      }
    } catch (bugErr) {
      console.error("Failed to auto-report bug:", bugErr);
    }

    return NextResponse.json({ 
      text: "I ran into a critical system error, but don't worry, I've automatically logged a bug report with our engineering team.", 
      error: String(error) 
    }, { status: 500 });
  }
}