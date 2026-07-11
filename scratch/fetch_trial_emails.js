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

const pageIds = [
  { id: "27426833", name: "Trial_Email_Day_0" },
  { id: "27590674", name: "Trial_Email_Day_7" },
  { id: "28475393", name: "Trial_Email_Day_10" },
  { id: "27590691", name: "Trial_Email_Day_14" }
];

const destDir = path.join(__dirname, 'templates');

async function fetchTemplates() {
  for (const page of pageIds) {
    const url = `https://${domain}/wiki/rest/api/content/${page.id}?expand=body.storage`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`Failed to fetch ${page.name} (${page.id}): ${res.status}`);
      continue;
    }
    const data = await res.json();
    const htmlCode = data.body?.storage?.value || "";
    
    let emailHtml = "";
    
    // Extract HTML code inside embed
    const embedMatch = htmlCode.match(/&quot;htmlCode&quot;:&quot;([\s\S]*?)&quot;,&quot;htmlHeight&quot;/);
    if (embedMatch) {
      emailHtml = embedMatch[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");
    } else {
      emailHtml = htmlCode;
    }
    
    const filePath = path.join(destDir, `${page.name}.html`);
    fs.writeFileSync(filePath, emailHtml, 'utf8');
    console.log(`Saved ${page.name} template to: ${filePath}`);
  }
}

fetchTemplates();
