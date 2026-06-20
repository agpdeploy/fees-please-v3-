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
    // Strip quotes if any
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

async function test() {
  try {
    const jql = 'statusCategory != Done ORDER BY created DESC';
    const url = `https://${domain}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=10&fields=summary,status,description,created`;
    console.log(`Querying Jira: ${url}`);
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    console.log("HTTP Status:", res.status);
    const data = await res.json();
    if (!res.ok) {
      console.error("Error from Jira API:", data);
      return;
    }
    
    if (data.issues && data.issues.length > 0) {
      data.issues.forEach(issue => {
        console.log(`- [${issue.key || issue.id}] (${issue.fields?.status?.name || 'No Status'}): ${issue.fields?.summary || 'No Summary'}`);
      });
    } else {
      console.log("No issues returned or missing fields.");
    }
  } catch (error) {
    console.error("Failed to fetch from Jira:", error);
  }
}

test();
