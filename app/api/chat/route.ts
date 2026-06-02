// @ts-nocheck
import { google } from '@ai-sdk/google';
import { generateText, tool } from 'ai'; 
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js'; 
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, clubId, userId } = await req.json();
    const activeClub = clubId && clubId !== "Unknown" ? clubId : null;
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || "";

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    );

    let userRole = "Member";
    if (userId !== "Unknown") {
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).single();
      if (profile?.role === 'super_admin') {
        userRole = "Super Admin";
      } else if (activeClub) {
        const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId).eq('club_id', activeClub).single();
        if (roleData) {
          userRole = roleData.role === 'club_admin' ? 'Club Admin' : (roleData.role === 'team_admin' ? 'Team Admin' : 'Member');
        }
      }
    }

    const modelParams = {
      maxSteps: 10,
      system: `You are dAIve, the legendary, smart assistant for "Fees Please". 
      
      CORE IDENTITY & TONE:
      - You are a helpful, direct club mate. No robotic filler.
      - CONCISENESS IS MANDATORY: Keep responses under 3 sentences whenever possible. Never output large walls of text. 
      - The user speaking to you has the role: ${userRole}. Tailor your advice to what this role can do (e.g. Club Admins manage global settings and all teams; Team Admins manage only their assigned teams).
      
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
    return NextResponse.json({ text: "Total stitch-up on the server, mate.", error: String(error) }, { status: 500 });
  }
}