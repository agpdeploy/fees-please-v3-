const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const domain = process.env.CONFLUENCE_DOMAIN;
const email = process.env.CONFLUENCE_USER_EMAIL;
const token = process.env.CONFLUENCE_API_TOKEN;
const authHeader = 'Basic ' + Buffer.from(email + ':' + token).toString('base64');

async function run() {
  const url = `https://${domain}/wiki/api/v2/pages/27197441/children?limit=50`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });
  
  const data = await response.json();
  const results = [];
  
  for (const page of data.results || []) {
    const pageUrl = `https://${domain}/wiki/api/v2/pages/${page.id}?body-format=storage`;
    const pageRes = await fetch(pageUrl, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    const pageData = await pageRes.json();
    
    // Check if the body contains the "macro-code" with HTML
    const body = pageData.body?.storage?.value || '';
    const hasHtmlMacro = body.includes('ac:name="code"');
    const hasProperWrapper = body.includes('max-width: 600px') || body.includes('<body>'); 
    
    results.push({
      title: page.title,
      hasHtmlMacro,
      hasProperWrapper,
    });
  }
  
  fs.writeFileSync('confluence-check.json', JSON.stringify(results, null, 2));
  console.log("Check complete.");
}

run().catch(console.error);
