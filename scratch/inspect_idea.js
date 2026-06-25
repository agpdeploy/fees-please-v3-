const fs = require('fs');
const path = require('path');

// Manually load .env.local from parent directory of scratch
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

if (!email || !apiToken || !domain) {
  console.error("Missing Jira credentials in environment variables. Email:", email, "Domain:", domain);
  process.exit(1);
}

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
const jiraHeaders = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json'
};

async function inspect(key) {
  const url = `https://${domain}/rest/api/3/issue/${key}`;
  const res = await fetch(url, { headers: jiraHeaders });
  const data = await res.json();
  if (!res.ok) {
    console.error(data);
    return;
  }
  const fields = data.fields;
  console.log("Summary:", fields.summary);
  console.log("Issue Type:", fields.issuetype.name);
  console.log("All non-null fields:");
  for (const k of Object.keys(fields)) {
    if (fields[k] !== null) {
      const valStr = typeof fields[k] === 'object' ? JSON.stringify(fields[k]).substring(0, 150) : fields[k];
      console.log(`- ${k}: ${valStr}`);
    }
  }
}

inspect('JPDFP-13');
