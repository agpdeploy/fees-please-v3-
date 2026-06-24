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

const updates = [
  {
    kanKey: 'KAN-1',
    functionality: 'Admin UI Overhaul: Standardised terminology retaining "Game Day", overhauled labels across menu sidebar, setup widgets, and dashboard hubs.',
    deploymentDate: 'June 2026'
  },
  {
    kanKey: 'KAN-2',
    functionality: 'PayID / Manual Support: Implemented cross-team ledger features and manual transaction status updates allowing admins to mark payments outside the platform.',
    deploymentDate: 'May 2026'
  },
  {
    kanKey: 'KAN-3',
    functionality: 'Daive Onboarding Enhancements: Replaced old flow with an Interactive Setup Checklist on the Game Day dashboard covering sport selection, tokens, and invites.',
    deploymentDate: 'May 2026',
    jpdKeyToClose: 'JPDFP-10' // We missed closing this one previously
  },
  {
    kanKey: 'KAN-4',
    functionality: 'Play HQ Sync: Added Organization Sync by Org ID/Tenant Key to automatically fetch fixtures and team lists without overwriting local settings.',
    deploymentDate: 'June 2026'
  },
  {
    kanKey: 'KAN-5',
    functionality: 'Native App / PWA: Full Progressive Web App rollout including offline sync behavior for rosters and payments, with a skip-waiting service worker.',
    deploymentDate: 'April 2026'
  },
  {
    kanKey: 'KAN-6',
    functionality: 'Paywall (Stripe): Integrated Stripe Checkout portal for platform subscriptions and tiered access via Settings > Billing & Plan.',
    deploymentDate: 'May 2026'
  },
  {
    kanKey: 'KAN-7',
    functionality: 'WhatsApp Comms: Built Squad Graphic Generator producing premium lineup images and native WhatsApp sharing links.',
    deploymentDate: 'April 2026'
  },
  {
    kanKey: 'KAN-8',
    functionality: 'Daive Analytics: Integrated reporting algorithms into the admin dashboard allowing insights into player availability, attendance, and ledger status.',
    deploymentDate: 'June 2026'
  }
];

async function addKanComment(kanKey, functionality, deploymentDate) {
  const url = `https://${domain}/rest/api/3/issue/${kanKey}/comment`;
  const body = {
    body: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: `Deployment Date: `, marks: [{ type: 'strong' }] },
            { type: 'text', text: `${deploymentDate}\n` },
            { type: 'text', text: `Functionality Delivered: `, marks: [{ type: 'strong' }] },
            { type: 'text', text: functionality }
          ]
        }
      ]
    }
  };
  const res = await fetch(url, { method: 'POST', headers: jiraHeaders, body: JSON.stringify(body) });
  if (!res.ok) console.error(`Failed to comment on ${kanKey}:`, await res.text());
  else console.log(`Commented on ${kanKey}`);
}

async function transitionKanToDone(kanKey) {
  const url = `https://${domain}/rest/api/3/issue/${kanKey}/transitions`;
  // Transition ID 41 is "Done" for the KAN board
  const body = { transition: { id: "41" } };
  const res = await fetch(url, { method: 'POST', headers: jiraHeaders, body: JSON.stringify(body) });
  if (!res.ok) console.error(`Failed to transition ${kanKey}:`, await res.text());
  else console.log(`Transitioned ${kanKey} to Done`);
}

async function transitionJpdToDone(jpdKey) {
  const url = `https://${domain}/rest/api/3/issue/${jpdKey}/transitions`;
  // Transition ID 21 is "Done" for the JPDFP board
  const body = { transition: { id: "21" } };
  const res = await fetch(url, { method: 'POST', headers: jiraHeaders, body: JSON.stringify(body) });
  if (!res.ok) console.error(`Failed to transition ${jpdKey}:`, await res.text());
  else console.log(`Transitioned ${jpdKey} to Done`);
}

async function run() {
  for (const update of updates) {
    console.log(`Updating ${update.kanKey}...`);
    await addKanComment(update.kanKey, update.functionality, update.deploymentDate);
    await transitionKanToDone(update.kanKey);
    
    if (update.jpdKeyToClose) {
      console.log(`Closing associated JPD ticket: ${update.jpdKeyToClose}...`);
      await transitionJpdToDone(update.jpdKeyToClose);
    }
    console.log('---------------------------');
  }
}

run();
