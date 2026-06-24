const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEquals = trimmed.indexOf('=');
    if (firstEquals === -1) return;
    const key = trimmed.substring(0, firstEquals).trim();
    let val = trimmed.substring(firstEquals + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  });
}

const email = process.env.CONFLUENCE_USER_EMAIL;
const apiToken = process.env.CONFLUENCE_API_TOKEN;
const domain = process.env.CONFLUENCE_DOMAIN;

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
const jiraHeaders = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

async function createIdea() {
  const url = `https://${domain}/rest/api/3/issue`;
  
  const descriptionText = 
    "Extract player-by-player statistics from the AI match report generator and integrate with PlayHQ feeds.\n\n" +
    "Key Features:\n" +
    "1. AI Player Stats Extraction: Modify the Gemini API match report generator to output a structured JSON of player performance. Supports sport-specific metrics (e.g., runs/wickets for Cricket, goals/attempts for Netball).\n" +
    "2. PlayHQ Stats Feed: Retrieve detailed game scorecards directly via PlayHQ's spectator GraphQL API when available, mapping it to user profiles.\n" +
    "3. Personalized Player Messages: End-of-match/season notifications for players showing their stats, best batting/bowling/contribution, etc.";

  const body = {
    fields: {
      project: { key: 'JPDFP' },
      summary: 'Player Stats Extraction & PlayHQ Feed Integration',
      issuetype: { id: '10007' }, // 'Idea' type
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: descriptionText }]
          }
        ]
      },
      customfield_10056: 4, // Impact: 4
      customfield_10050: 3  // Effort: 3
    }
  };

  console.log("Sending issue creation request...");
  const res = await fetch(url, {
    method: 'POST',
    headers: jiraHeaders,
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Failed to create idea:", JSON.stringify(data, null, 2));
    return;
  }
  console.log("Success! Created JPD Idea:", data.key);
}

createIdea();
