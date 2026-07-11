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

async function listPages() {
  const spaceKey = "FPG";
  const url = `https://${domain}/wiki/rest/api/content?spaceKey=${spaceKey}&limit=50&expand=body.storage`;
  console.log(`Listing pages in space ${spaceKey}...`);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`Error: ${res.status}`, await res.text());
    return;
  }
  const data = await res.json();
  if (data.results) {
    console.log(`Found ${data.results.length} pages:`);
    data.results.forEach(page => {
      console.log(`\n========================================`);
      console.log(`ID: ${page.id}`);
      console.log(`Title: ${page.title}`);
      console.log(`Type: ${page.type}`);
      console.log(`----------------------------------------`);
      // Extract html content if available
      const htmlCode = page.body?.storage?.value;
      if (htmlCode) {
        // Let's see if there is an embed HTML block
        const match = htmlCode.match(/&quot;htmlCode&quot;:&quot;([\s\S]*?)&quot;,&quot;htmlHeight&quot;/);
        if (match) {
          // Unescape the JSON string
          let rawHtml = match[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
          console.log(rawHtml);
        } else {
          console.log(htmlCode);
        }
      }
    });
  } else {
    console.log("No pages found.");
  }
}

listPages();
