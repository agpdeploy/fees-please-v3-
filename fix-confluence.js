const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const domain = process.env.CONFLUENCE_DOMAIN;
const email = process.env.CONFLUENCE_USER_EMAIL;
const token = process.env.CONFLUENCE_API_TOKEN;
const authHeader = 'Basic ' + Buffer.from(email + ':' + token).toString('base64');

async function createPage(title, rawTextHtml, rawHtmlString) {
  const storageFormat = `
    <h2>Raw Text Preview</h2>
    <div>${rawTextHtml}</div>
    <br/>
    <hr/>
    <br/>
    <h2>HTML Template Snippet</h2>
    <ac:structured-macro ac:name="code" ac:schema-version="1" ac:macro-id="macro-code">
      <ac:parameter ac:name="language">html</ac:parameter>
      <ac:parameter ac:name="theme">Eclipse</ac:parameter>
      <ac:plain-text-body><![CDATA[${rawHtmlString}]]></ac:plain-text-body>
    </ac:structured-macro>
  `;

  const body = {
    title: title,
    type: 'page',
    space: { key: 'FPG' },
    ancestors: [{ id: '27197441' }],
    body: {
      storage: {
        value: storageFormat,
        representation: 'storage'
      }
    }
  };

  // Check if page exists to update it, or just create it
  // Actually, wait, if we POST it creates a new one, but if we delete the old one first it's easier.
  // First, find the page ID
  const searchRes = await fetch(`https://${domain}/wiki/rest/api/content?spaceKey=FPG&title=${encodeURIComponent(title)}`, {
    headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
  });
  const searchData = await searchRes.json();
  
  if (searchData.results && searchData.results.length > 0) {
    const pageId = searchData.results[0].id;
    // Delete it
    await fetch(`https://${domain}/wiki/rest/api/content/${pageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': authHeader }
    });
    console.log('Deleted old ' + title);
  }

  const response = await fetch(`https://${domain}/wiki/rest/api/content`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (response.ok) {
     console.log('Created ' + title);
  } else {
     console.log('Failed ' + title, response.status, await response.text());
  }
}

function stripHtml(html) {
  if (!html) return '';
  let text = html.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<[^>]*>?/gm, '');
  text = text.replace(/^[ \t]+/gm, ''); // remove leading spaces
  return text.trim().replace(/\n+/g, '<br/>'); // convert newlines back to basic br for Confluence display
}

async function run() {
  const others = [
    { title: 'Availability Request Email', file: 'app/api/send-reminders/route.ts' },
    { title: 'Weekly Summary Report Email', file: 'app/api/cron/weekly-summary/route.ts' },
    { title: 'Squad Payment Email', file: 'app/api/send-squad/route.ts' }
  ];

  for (const o of others) {
    const content = fs.readFileSync(o.file, 'utf8');
    
    // Instead of a broken regex, use substring up to the last known '`;' or '};'
    let startIndex = content.indexOf('const htmlContent = `');
    if (startIndex === -1) {
       console.log('Could not find start for ' + o.file);
       continue;
    }
    
    startIndex += 'const htmlContent = `'.length;
    let endIndex = content.indexOf('`;\n', startIndex);
    
    if (endIndex === -1) endIndex = content.indexOf('`;\r\n', startIndex);
    // If there are multiple `;\n, find the one that properly closes the block.
    // For these files, the end of the html string is followed by emailsToSend.push or similar
    
    if (o.title === 'Availability Request Email') {
      endIndex = content.indexOf('`;\n\n      const emailPayloads', startIndex);
      if(endIndex === -1) endIndex = content.indexOf('`;\r\n\n      const emailPayloads', startIndex);
    } else if (o.title === 'Weekly Summary Report Email') {
      endIndex = content.indexOf('`;\n        }\n\n        return {', startIndex);
      if(endIndex === -1) endIndex = content.indexOf('`;\r\n        }\r\n\r\n        return {', startIndex);
      if(endIndex === -1) endIndex = content.indexOf('`;', startIndex + 5000); // fallback
    } else if (o.title === 'Squad Payment Email') {
      endIndex = content.indexOf('`;\n\n      const emailPayloads', startIndex);
      if(endIndex === -1) endIndex = content.indexOf('`;\r\n\n      const emailPayloads', startIndex);
      if(endIndex === -1) endIndex = content.indexOf('`;', startIndex + 5000); // fallback
    }
    
    let rawHtmlString = content.substring(startIndex, endIndex);
    
    if (rawHtmlString) {
      const rawTextHtml = stripHtml(rawHtmlString);
      await createPage(o.title, rawTextHtml, rawHtmlString);
    }
  }
}

run().catch(console.error);
