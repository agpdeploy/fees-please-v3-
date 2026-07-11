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
  { id: "28540929", name: "Welcome_Email_Needs_Onboarding" },
  { id: "28573697", name: "Welcome_Email_Onboarded" },
  { id: "28508161", name: "Onboarding_Email_Plus" },
  { id: "27754500", name: "Onboarding_Email_Pro" }
];

const destDir = path.join(__dirname, 'templates');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

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
      // Fallback: use raw storage if not an embed
      emailHtml = htmlCode;
    }
    
    const filePath = path.join(destDir, `${page.name}.html`);
    fs.writeFileSync(filePath, emailHtml, 'utf8');
    console.log(`Saved ${page.name} template to: ${filePath}`);
    
    // Log metadata context
    console.log(`\n========================================`);
    console.log(`Metadata for ${page.name}:`);
    
    // Look for lines containing Subject, Sends, etc.
    const lines = htmlCode.replace(/<[^>]+>/g, ' ').split(/\s{2,}/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (/subject|sends\s+from|unsubscribe|sends\s+as/i.test(trimmed)) {
        console.log(`  - ${trimmed}`);
      }
    });
  }
}

fetchTemplates();
