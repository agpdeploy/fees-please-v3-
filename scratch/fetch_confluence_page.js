const fs = require('fs');
const path = require('path');
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
  console.error("Missing credentials.");
  process.exit(1);
}

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json'
};

async function fetchPage(pageId) {
  const url = `https://${domain}/wiki/rest/api/content/${pageId}?expand=body.storage,children.page`;
  console.log(`Fetching page ${pageId}...`);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`Error: ${res.status}`, await res.text());
    return;
  }
  const data = await res.json();
  console.log("--- TITLE ---");
  console.log(data.title);
  console.log("\n--- BODY ---");
  console.log(data.body?.storage?.value);
  console.log("\n--- CHILDREN ---");
  if (data.children?.page?.results) {
    data.children.page.results.forEach(child => {
      console.log(`- [${child.id}] ${child.title}`);
    });
  }
}

const targetPageId = process.argv[2] || "28540929";
fetchPage(targetPageId);
