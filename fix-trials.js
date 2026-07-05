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

  const searchRes = await fetch(`https://${domain}/wiki/rest/api/content?spaceKey=FPG&title=${encodeURIComponent(title)}`, {
    headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
  });
  const searchData = await searchRes.json();
  
  if (searchData.results && searchData.results.length > 0) {
    const pageId = searchData.results[0].id;
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

async function run() {
  const cronFile = fs.readFileSync('app/api/cron/trial-emails/route.ts', 'utf8');
  let startC = cronFile.indexOf('const htmlContent = `') + 20;
  let endC = cronFile.indexOf('`;\n\n            emailsToSend.push');
  if (endC === -1) endC = cronFile.indexOf('`;\r\n\n            emailsToSend.push');
  if (endC === -1) endC = cronFile.indexOf('`;', startC + 500);
  
  const baseCronHtml = cronFile.substring(startC, endC);
  
  const trialEmails = [
    { title: 'Trial Email - Day 0 (Welcome)', head: 'Get the most out of Plus', body: 'Your 14-day trial of Plus for <strong>{clubName}</strong> is now active! Start using premium features like unlimited teams, automated email summaries, and reduced transaction fees today.' },
    { title: 'Trial Email - Day 7 (Halfway)', head: "How's your trial going?", body: 'You have 7 days left in your free trial for <strong>{clubName}</strong>. Did you know you can earn rewards by referring a friend? Check out the "Refer a friend" section in your account!' },
    { title: 'Trial Email - Day 10 (Ending Soon)', head: 'Only 4 days left!', body: 'Your 14-day trial of Plus for <strong>{clubName}</strong> is almost over. To avoid losing access to premium features, head to the Billing tab in your account and upgrade to a paid plan today.' },
    { title: 'Trial Email - Day 14 (Ended)', head: 'You are back on the Free plan', body: "Your 14-day trial for <strong>{clubName}</strong> has ended and you've been moved back to the Free plan. To regain access to Plus features, simply upgrade your account in the Billing tab at any time. Continue with Plus to get the most out of Fees Please!" }
  ];

  for (const t of trialEmails) {
    const rawHtmlString = baseCronHtml.replace('${headline}', t.head).replace('${firstName}', '{firstName}').replace('${personalizedBody}', t.body);
    const rawTextHtml = `<strong>Headline:</strong> ${t.head}<br/><strong>Body:</strong> Hi {firstName}, ${t.body}`;
    await createPage(t.title, rawTextHtml, rawHtmlString);
  }

  const stripeFile = fs.readFileSync('app/api/webhooks/stripe/route.ts', 'utf8');
  let startS = stripeFile.indexOf('const htmlContent = `') + 20;
  let endS = stripeFile.indexOf('`;\n\n              emailsToSend.push');
  if (endS === -1) endS = stripeFile.indexOf('`;\r\n\n              emailsToSend.push');
  if (endS === -1) endS = stripeFile.indexOf('`;', startS + 500);
  const baseStripeHtml = stripeFile.substring(startS, endS);

  const onboardingEmails = [
    { title: 'Onboarding Email - Plus', head: 'Welcome to Fees Please Plus!', body: 'Your account <strong>{clubName}</strong> is now officially on the Plus plan! Your account has been upgraded and you have full access to all premium features. Start taking advantage of unlimited teams and automated summaries today!' },
    { title: 'Onboarding Email - Pro', head: 'Welcome to Fees Please Pro!', body: 'Your account <strong>{clubName}</strong> is now officially on the Pro plan! Your account has been upgraded and you have full access to all premium features. With Pro, you now have access to advanced reporting and deeper insights.' }
  ];

  for (const o of onboardingEmails) {
    const rawHtmlString = baseStripeHtml.replace('${headline}', o.head).replace('${firstName}', '{firstName}').replace('${personalizedBody}', o.body);
    const rawTextHtml = `<strong>Headline:</strong> ${o.head}<br/><strong>Body:</strong> Hi {firstName}, ${o.body}`;
    await createPage(o.title, rawTextHtml, rawHtmlString);
  }
}

run().catch(console.error);
