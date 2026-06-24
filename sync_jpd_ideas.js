const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '.env.local');
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

const ideasToSync = [
  {
    key: 'JPDFP-12',
    summary: 'Paywall (Stripe)',
    releaseDate: 'recent release',
    description: 'Implemented Stripe subscription paywall and limits for club setups.'
  },
  {
    key: 'JPDFP-8',
    summary: 'WhatsApp Comms',
    releaseDate: 'recent release',
    description: 'Implemented match availability communication templates and flows.'
  },
  {
    key: 'JPDFP-13',
    summary: 'Daive Analytics',
    releaseDate: 'recent release',
    description: 'Integrated analytics and reports functionality into the admin dashboard.'
  },
  // These already have KAN tickets but need transitioning in JPDFP
  {
    key: 'JPDFP-7',
    existingKan: 'KAN-1',
    releaseDate: 'recent release'
  },
  {
    key: 'JPDFP-9',
    existingKan: 'KAN-2',
    releaseDate: 'recent release'
  }
];

async function createKanTicket(summary, description) {
  const url = `https://${domain}/rest/api/3/issue`;
  const body = {
    fields: {
      project: { key: 'KAN' },
      summary: summary,
      issuetype: { name: 'Task' },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: description }]
          }
        ]
      }
    }
  };
  const res = await fetch(url, { method: 'POST', headers: jiraHeaders, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error(`Failed to create KAN ticket for ${summary}:`, await res.text());
    return null;
  }
  const data = await res.json();
  return data.key;
}

async function linkIssues(kanKey, jpdKey) {
  const url = `https://${domain}/rest/api/3/issueLink`;
  const body = {
    type: { name: 'Relates' },
    inwardIssue: { key: kanKey },
    outwardIssue: { key: jpdKey }
  };
  const res = await fetch(url, { method: 'POST', headers: jiraHeaders, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error(`Failed to link ${kanKey} to ${jpdKey}:`, await res.text());
  } else {
    console.log(`Linked ${kanKey} to ${jpdKey}`);
  }
}

async function transitionIdea(jpdKey) {
  const url = `https://${domain}/rest/api/3/issue/${jpdKey}/transitions`;
  const body = { transition: { id: "21" } }; // 21 is "Done"
  const res = await fetch(url, { method: 'POST', headers: jiraHeaders, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error(`Failed to transition ${jpdKey}:`, await res.text());
  } else {
    console.log(`Transitioned ${jpdKey} to Done.`);
  }
}

async function commentIdea(jpdKey, releaseDate, kanKey) {
  const url = `https://${domain}/rest/api/3/issue/${jpdKey}/comment`;
  const body = {
    body: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: `This idea was fully implemented and released in ${releaseDate}. Tracked via ${kanKey}.` }
          ]
        }
      ]
    }
  };
  const res = await fetch(url, { method: 'POST', headers: jiraHeaders, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error(`Failed to add comment to ${jpdKey}:`, await res.text());
  } else {
    console.log(`Commented on ${jpdKey}.`);
  }
}

async function run() {
  for (const idea of ideasToSync) {
    console.log(`Processing ${idea.key}...`);
    let kanKey = idea.existingKan;
    if (!kanKey) {
      kanKey = await createKanTicket(idea.summary, idea.description);
    }
    
    if (kanKey) {
      console.log(`Using KAN ticket: ${kanKey}`);
      if (!idea.existingKan) {
        await linkIssues(kanKey, idea.key);
        // Auto-transition the KAN ticket to Done as well, since it's already built
        const kanTransitionUrl = `https://${domain}/rest/api/3/issue/${kanKey}/transitions`;
        await fetch(kanTransitionUrl, { method: 'POST', headers: jiraHeaders, body: JSON.stringify({ transition: { id: "31" } }) });
      }
      await commentIdea(idea.key, idea.releaseDate, kanKey);
      await transitionIdea(idea.key);
    }
    console.log('----------------------------------------');
  }
}

run();
