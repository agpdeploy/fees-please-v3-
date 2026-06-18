// scripts/diagnose-ticket.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// PostHog Credentials
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID; 
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY; 
const POSTHOG_API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * Fetch PostHog recording link and recent user events.
 */
async function getPostHogSession(userId) {
  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) {
    return { error: "PostHog environment variables (POSTHOG_PERSONAL_API_KEY & POSTHOG_PROJECT_ID) not configured in .env.local" };
  }
  try {
    const apiHostBase = POSTHOG_API_HOST.replace("us.i.", "us."); // API endpoint is at us.posthog.com or app.posthog.com
    
    // Fetch recent session recordings for the user
    const res = await fetch(`${apiHostBase}/api/projects/${POSTHOG_PROJECT_ID}/session_recordings?distinct_id=${userId}`, {
      headers: { 'Authorization': `Bearer ${POSTHOG_PERSONAL_API_KEY}` }
    });
    
    if (!res.ok) return { error: `Failed to fetch session recordings: ${res.statusText}` };
    const data = await res.json();
    const latestSession = data.results?.[0];
    
    // Fetch recent events to trace errors
    const eventsRes = await fetch(`${apiHostBase}/api/projects/${POSTHOG_PROJECT_ID}/events?distinct_id=${userId}&limit=10`, {
      headers: { 'Authorization': `Bearer ${POSTHOG_PERSONAL_API_KEY}` }
    });
    const eventsData = await eventsRes.json();
    
    return {
      recordingUrl: latestSession ? `https://app.posthog.com/project/${POSTHOG_PROJECT_ID}/replay/${latestSession.id}` : null,
      lastEvents: eventsData.results?.map(e => ({
        event: e.event,
        timestamp: e.timestamp,
        path: e.properties?.$current_url || e.properties?.$pathname
      })) || []
    };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Main Diagnostic Triage Function
 */
async function diagnoseTicket(issueKey) {
  console.log(`\n🔍 Inspecting JSM Ticket: ${issueKey}...`);

  // 1. Fetch ticket details from JSM/Jira API
  // JSM credentials reuse the Confluence tokens from .env.local
  const email = process.env.CONFLUENCE_USER_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;
  const domain = process.env.CONFLUENCE_DOMAIN; // e.g. feespleaseapp.atlassian.net

  if (!email || !apiToken || !domain) {
    console.error("❌ Missing JSM API configurations (CONFLUENCE_USER_EMAIL/API_TOKEN/DOMAIN) in .env.local");
    return;
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  let issue;
  try {
    const res = await fetch(`https://${domain}/rest/api/3/issue/${issueKey}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
    });
    if (!res.ok) {
      console.error(`❌ Failed to retrieve JSM issue ${issueKey}: ${res.statusText}`);
      return;
    }
    issue = await res.json();
  } catch (err) {
    console.error("❌ Failed to query Jira REST API:", err);
    return;
  }

  // Parse details out of the description
  // Supports both rich text document formats and plaintext
  let descriptionText = "";
  const descContent = issue.fields?.description;
  if (typeof descContent === 'string') {
    descriptionText = descContent;
  } else if (descContent?.content) {
    // Traverse Jira's ADF (Atlassian Document Format) structure to extract text
    descriptionText = descContent.content
      .flatMap(node => node.content || [])
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
  }

  // Extract Metadata Context
  const clubIdMatch = descriptionText.match(/Club ID:\s*([a-f0-9\-]+)/i);
  const userIdMatch = descriptionText.match(/User ID:\s*([a-f0-9\-]+)/i);

  if (!clubIdMatch) {
    console.log("❌ Could not extract a valid Club ID from the ticket description. Unable to run Supabase checks.");
    return;
  }

  const clubId = clubIdMatch[1];
  const userId = userIdMatch ? userIdMatch[1] : null;

  console.log(`Club ID: ${clubId}`);
  console.log(`User ID: ${userId || 'Not Provided'}`);

  // 2. Database Checks
  let club, profile, userRole, teamsCount = 0, playersCount = 0, fixturesCount = 0, stripeLogs = [];
  try {
    const clubResult = await supabase.from('clubs').select('*').eq('id', clubId).single();
    club = clubResult.data;

    if (userId) {
      const profileResult = await supabase.from('profiles').select('*').eq('id', userId).single();
      profile = profileResult.data;

      const roleResult = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('club_id', clubId).maybeSingle();
      userRole = roleResult.data;
    }

    const { count: teams } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('club_id', clubId);
    teamsCount = teams || 0;

    const { count: players } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('club_id', clubId);
    playersCount = players || 0;

    const { count: fixtures } = await supabase.from('fixtures').select('*', { count: 'exact', head: true }).eq('club_id', clubId);
    fixturesCount = fixtures || 0;

    const transResult = await supabase.from('transactions').select('*').eq('club_id', clubId).order('created_at', { ascending: false }).limit(5);
    stripeLogs = transResult.data || [];
  } catch (dbErr) {
    console.error("⚠️ Supabase query warning:", dbErr);
  }

  // 3. Evaluate Human-First Troubleshooting Rules
  const humanChecks = [];
  let isHumanError = false;

  // Rule 1: Incorrect Scoping / Lack of Role
  if (userId && !profile) {
    humanChecks.push("❌ USER ERROR: User profile does not exist in our database.");
    isHumanError = true;
  } else if (userId && !userRole && profile?.role !== 'super_admin') {
    humanChecks.push("❌ USER ERROR: User has no configured role (user_roles entry) for this Club.");
    isHumanError = true;
  }

  // Rule 2: Unconfigured payment gateways
  const stripeConnected = !!club?.stripe_account_id;
  const squareConnected = !!club?.square_access_token;
  if (!stripeConnected && !squareConnected) {
    humanChecks.push("⚠️ CONFIG ERROR: No active payment gateways (Stripe or Square) configured for this club.");
    isHumanError = true;
  }

  // Rule 3: Zero Data Setup (Complaining about empty dashboards)
  if (teamsCount === 0) {
    humanChecks.push("⚠️ DATA ERROR: Club has 0 teams created. User cannot manage fixtures/rosters.");
    isHumanError = true;
  }
  if (playersCount === 0) {
    humanChecks.push("⚠️ DATA ERROR: Club has 0 players added. Roster sync and billing ledgers will be blank.");
    isHumanError = true;
  }

  const triageCategory = isHumanError ? "User Configuration / Onboarding Error" : "System / Technical Bug";
  const suggestedPriority = isHumanError ? "Low (Manual/Config Fix)" : "High (Triage Developer)";

  // 4. Fetch PostHog Context if userId is available
  let posthogReport = "PostHog tracking not executed (no User ID or disabled).";
  if (userId) {
    const phData = await getPostHogSession(userId);
    if (phData.error) {
      posthogReport = `⚠️ PostHog: ${phData.error}`;
    } else {
      posthogReport = `
- 🎥 Session Replay: ${phData.recordingUrl || "No active recording found for this session"}
- 🏷️ Last Captured Events:
${phData.lastEvents.length > 0 
  ? phData.lastEvents.map(e => `    * [${new Date(e.timestamp).toLocaleTimeString()}] ${e.event} on ${e.path}`).join('\n') 
  : '    * No recent events traced.'}`;
    }
  }

  // 5. Build Final Diagnostic Output
  const reportOutput = `
🤖 Antigravity Support Diagnostic Report:
------------------------------------------
Club: "${club?.name || 'Unknown'}" (${clubId})
User: ${profile?.email || 'Unknown'} (Role: ${userRole?.role || 'None'})

[Triage Categorization]
- Category: ${triageCategory}
- Suggested Priority: ${suggestedPriority}

[Human-First Troubleshooting Checklist]
${humanChecks.length > 0 
  ? humanChecks.map(c => ` - ${c}`).join('\n') 
  : " - ✅ All human-configuration checks passed (user has valid role, teams, players, and payment credentials)."}

[User Session Details (PostHog)]
${posthogReport}
`;

  console.log(reportOutput);

  // 6. Post back to Jira Ticket as an internal developer comment
  try {
    const commentBody = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: reportOutput
              }
            ]
          }
        ]
      },
      properties: [
        {
          key: "sd.public.comment",
          value: { internal: true } // Internal comment: invisible to the JSM customer
        }
      ]
    };

    const commentRes = await fetch(`https://${domain}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commentBody)
    });

    if (commentRes.ok) {
      console.log("✅ Diagnostic report successfully posted as an internal comment in JSM.");
    } else {
      const errData = await commentRes.text();
      console.warn("⚠️ JSM comment post failed:", errData);
    }
  } catch (commentErr) {
    console.error("❌ Failed to post diagnostic comment to Jira:", commentErr);
  }
}

// CLI entry point
const issueKey = process.argv[2];
if (!issueKey) {
  console.log("Usage: node scripts/diagnose-ticket.js <ISSUE-KEY>");
} else {
  diagnoseTicket(issueKey);
}
