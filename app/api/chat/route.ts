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
    const { messages, clubId, teamId, userId } = await req.json();
    const activeClub = clubId && clubId !== "Unknown" ? clubId : null;
    const activeTeam = teamId && teamId !== "Unknown" ? teamId : null;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY 
    );

    // Get context for system prompt
    let clubName = "your club";
    if (activeClub) {
      const { data } = await supabase.from('clubs').select('name').eq('id', activeClub).single();
      if (data) clubName = data.name;
    }

    const modelParams = {
      maxSteps: 5,
      system: `You are dAIve, the friendly, data-aware grassroots sports mate for the app "Fees Please".
      You are assisting "${teamId || 'the squad'}" at the club "${clubName}". 
      Help administrators with onboarding, reading the ledger, managing fixtures, and game day stats. Keep your tone helpful, matey, and direct.
      
      SSOT RULES:
      If asked about platform functionality (how to add a logo, permissions, etc), you MUST use searchKnowledgeBase. 
      If the search returns no results, tell the user you're still learning the ropes of the manual and suggest they check the "Settings" tab.
      
      CRITICAL: Always summarize tool results in a friendly way. Use Markdown for lists and bolding.`,
      messages,
      tools: {
        searchKnowledgeBase: tool({
          description: 'Search the Fees Please SSOT for business rules and how-to guides.',
          parameters: z.object({
            query: z.string().describe('The core topic to search for (e.g., "logo", "refund").')
          }),
          execute: async ({ query }) => {
            // IMPROVED: Extract only the most important nouns/verbs for Confluence
            let searchTerm = query.toLowerCase()
              .replace(/can you tell me about|what are the|tell me about|how do i|please|hey|now|add a|to my|account|about/g, '')
              .replace(/[?.!]/g, '')
              .trim()
              .split(' ')
              .pop(); // Take the most specific last word if multiple exist

            console.log(`dAIve IS SEARCHING THE WIKI FOR: "${searchTerm}"...`);
            try {
              const auth = Buffer.from(`${process.env.CONFLUENCE_USER_EMAIL}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64');
              const cqlQuery = `space="${process.env.CONFLUENCE_SPACE_KEY}" and (text ~ "${searchTerm}" or title ~ "${searchTerm}")`;
              const searchUrl = `https://${process.env.CONFLUENCE_DOMAIN}/wiki/rest/api/content/search?cql=${encodeURIComponent(cqlQuery)}&expand=body.storage`;

              const response = await fetch(searchUrl, {
                headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
              });

              const data = await response.json();
              if (!data.results || data.results.length === 0) return `No specific guide found for "${searchTerm}".`;

              return data.results.map((page: any) => {
                const cleanText = (page.body?.storage?.value || "").replace(/<[^>]*>?/gm, '').substring(0, 500);
                return `### Source: ${page.title}\n${cleanText}...`;
              }).join('\n\n');

            } catch (error) {
              return "Wiki's a bit dusty, couldn't read the page.";
            }
          }
        }),

        get_financial_summary: tool({
          description: 'Get total fees collected and outstanding.',
          parameters: z.object({}),
          execute: async () => {
            if (!activeClub) return "Select a club first, mate.";
            const { data } = await supabaseAdmin.from('transactions').select('amount, transaction_type').eq('club_id', activeClub);
            let collected = 0; let fees = 0;
            data?.forEach((t: any) => {
               const amt = Math.abs(Number(t.amount) || 0);
               if (['payment', 'cash', 'card'].some(s => t.transaction_type.toLowerCase().includes(s))) collected += amt;
               else if (['fee', 'charge'].some(s => t.transaction_type.toLowerCase().includes(s))) fees += amt;
            });
            return `**Financial Summary:**\n* Total Billed: $${fees}\n* Total Collected: $${collected}`;
          }
        }),

        get_roster_and_payments: tool({
          description: "Get player roster and payment status.",
          parameters: z.object({}),
          execute: async () => {
            if (!activeClub) return "Select a club first.";
            const { data } = await supabaseAdmin.from('players').select(`first_name, last_name, transactions ( amount, transaction_type )`).eq('club_id', activeClub);
            const roster = data.map((p: any) => {
              let paid = 0; let billed = 0;
              p.transactions?.forEach((t: any) => {
                const amt = Math.abs(Number(t.amount) || 0);
                if (t.transaction_type.toLowerCase() === 'payment') paid += amt; 
                else if (t.transaction_type.toLowerCase() === 'fee') billed += amt;
              });
              return `* **${p.first_name} ${p.last_name}**: Paid $${paid} / Billed $${billed}`;
            });
            return `**Roster Status:**\n${roster.join('\n')}`;
          }
        }),

        get_fixtures: tool({
          description: 'Get match schedule.',
          parameters: z.object({ filter: z.enum(['upcoming', 'past', 'all']).optional() }),
          execute: async ({ filter = 'upcoming' }) => {
            if (!activeClub) return "Select a club.";
            let query = supabaseAdmin.from('fixtures').select(`opponent, match_date, start_time, teams!inner(name, club_id)`).eq('teams.club_id', activeClub);
            const today = new Date().toISOString().split('T')[0];
            if (filter === 'upcoming') query = query.gte('match_date', today).order('match_date', { ascending: true }).limit(5);
            const { data } = await query;
            const schedule = data.map((f: any) => `* **vs ${f.opponent}**\n  - Date: ${f.match_date}\n  - Time: ${f.start_time || 'TBA'}`);
            return `**Upcoming Fixtures:**\n${schedule.join('\n')}`;
          }
        })
      }
    };

    let result;
    try {
      result = await generateText({
        ...modelParams,
        model: google('gemini-2.5-flash'),
      });
    } catch (primaryError) {
      console.warn(`2.5 Busy. Pivoting to 2.0-flash-latest...`);
      // FIXED FALLBACK FOR 2026
      result = await generateText({
        ...modelParams,
        model: google('gemini-2.0-flash-latest'), 
      });
    }

    let finalText = result.text;
    if (!finalText || finalText.trim() === "") {
        const tr = result.toolResults?.[0] || result.steps?.[0]?.toolResults?.[0];
        finalText = tr ? "Here's the data from the books:\n\n" + (tr.output || "Nothing found.") : "I'm a bit stumped. Try again?";
    }

    // --- LOGGING ---
    let newLogId = null;
    try {
      const userMessage = messages.slice().reverse().find((m: any) => m.role === 'user')?.content || "Unknown prompt";
      if (activeClub && userId) {
        const { data: logData } = await supabaseAdmin.from('ai_logs').insert({
          club_id: activeClub, user_id: userId, prompt: userMessage, response: finalText,
          tool_calls: result.steps ? result.steps.flatMap(s => s.toolCalls.map(tc => ({ tool: tc.toolName, args: tc.args }))) : [],
          metadata: { model: result.response?.model || "gemini-fallback", usage: result.usage }
        }).select('id').single();
        if (logData) newLogId = logData.id;
      }
    } catch (logError) { console.error("Logging failed:", logError); }

    return NextResponse.json({ text: finalText, logId: newLogId });

  } catch (error) {
    console.error("dAIve CRASHED:", error);
    return new Response(JSON.stringify({ error: "Total stitch up.", message: error.message }), { status: 500 });
  }
}