const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
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

if (!email || !apiToken || !domain) {
  console.error("Missing Jira credentials in environment variables.");
  process.exit(1);
}

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
const jiraHeaders = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

const ideasToCreate = [
  {
    summary: 'Desktop Layout: Responsive Shell & Navigation Sidebar',
    description: 'Adjust the root wrapper in app/page.tsx to remove the max-width restriction on desktop screens. Add a persistent left-sidebar layout for navigation on desktop, replacing the bottom navigation bar on screens above md breakpoint.'
  },
  {
    summary: 'Desktop Layout: Split Screen List-Detail for Game Day & Teams',
    description: 'Overhaul GameDay, Team Hub, and public availability pages for desktop screens. Transition from vertically stacked lists to a responsive split-screen (List-Detail) view where users can select a fixture or player on the left and see full details/actions on the right.'
  },
  {
    summary: 'Desktop Layout: Table & Balance views for Ledger',
    description: 'Redesign the Ledger and transactions tabs for desktop. Instead of compact mobile cards, show full-bleed transaction tables, side-by-side balance summary widgets, and split panels for recording payments.'
  },
  {
    summary: 'Desktop Layout: Side-by-Side Builder for Team List Graphic Generator',
    description: 'Optimize the Team List Graphic Builder (TeamListGraphicBuilder.tsx) for desktop. Implement a side-by-side viewport configuration on desktop where customization controls are on one side and a full-size high-fidelity live graphic preview renders on the other, eliminating excessive scaling and toggles.'
  }
];

async function createIdea(idea) {
  const url = `https://${domain}/rest/api/3/issue`;
  const body = {
    fields: {
      project: { key: 'JPDFP' },
      summary: idea.summary,
      issuetype: { name: 'Idea' },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: idea.description }]
          }
        ]
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: jiraHeaders,
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`Failed to create Idea "${idea.summary}":`, JSON.stringify(data, null, 2));
    return null;
  }
  console.log(`Created Idea: [${data.key}] ${idea.summary}`);
  return data;
}

async function run() {
  console.log("Starting JPD Idea creation in project JPDFP...");
  for (const idea of ideasToCreate) {
    await createIdea(idea);
    console.log("-----------------------------------------");
  }
  console.log("Completed creation of all JPD ideas.");
}

run();
