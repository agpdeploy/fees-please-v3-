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

async function fetchIssue(idOrKey) {
  const url = `https://${domain}/rest/api/3/issue/${idOrKey}`;
  console.log(`Fetching issue from: ${url}`);
  
  const res = await fetch(url, { headers: jiraHeaders });
  console.log("Response Status:", res.status);
  const data = await res.json();
  if (!res.ok) {
    console.error("Error payload:", JSON.stringify(data, null, 2));
    return null;
  }
  return data;
}

async function run() {
  console.log(`Fetching JPDFP issues 1-17...`);
  const issues = [];
  for (let i = 1; i <= 17; i++) {
    const url = `https://${domain}/rest/api/3/issue/JPDFP-${i}`;
    const res = await fetch(url, { headers: jiraHeaders });
    if (res.ok) {
      const data = await res.json();
      issues.push({ key: `JPDFP-${i}`, summary: data.fields.summary, status: data.fields.status.name });
    }
  }
  console.table(issues);
}

run();
