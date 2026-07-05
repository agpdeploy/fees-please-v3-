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

  // Variables for Trial / Onboarding emails
  const headline = '{{ Headline }}';
  const firstName = '{{ First Name }}';
  const personalizedBody = '{{ Personalized Body Text }}';
  
  // 1. Trial Emails
  const cronFile = fs.readFileSync('app/api/cron/trial-emails/route.ts', 'utf8');
  let startC = cronFile.indexOf('const htmlContent = `') + 20;
  let endC = cronFile.indexOf('`;\n\n            emailsToSend.push');
  if (endC === -1) endC = cronFile.indexOf('`;\r\n\n            emailsToSend.push');
  if (endC === -1) endC = cronFile.indexOf('`;', startC + 500);
  const baseCronHtml = cronFile.substring(startC, endC);
  
  const trialEmails = [
    { title: 'Trial Email - Day 0 (Welcome)', head: 'Get the most out of Plus', body: 'Your 14-day trial of Plus for <strong>{{ Club Name }}</strong> is now active! Start using premium features like unlimited teams, automated email summaries, and reduced transaction fees today.' },
    { title: 'Trial Email - Day 7 (Halfway)', head: "How's your trial going?", body: 'You have 7 days left in your free trial for <strong>{{ Club Name }}</strong>. Did you know you can earn rewards by referring a friend? Check out the "Refer a friend" section in your account!' },
    { title: 'Trial Email - Day 10 (Ending Soon)', head: 'Only 4 days left!', body: 'Your 14-day trial of Plus for <strong>{{ Club Name }}</strong> is almost over. To avoid losing access to premium features, head to the Billing tab in your account and upgrade to a paid plan today.' },
    { title: 'Trial Email - Day 14 (Ended)', head: 'You are back on the Free plan', body: "Your 14-day trial for <strong>{{ Club Name }}</strong> has ended and you've been moved back to the Free plan. To regain access to Plus features, simply upgrade your account in the Billing tab at any time. Continue with Plus to get the most out of Fees Please!" }
  ];

  for (const t of trialEmails) {
    let rawHtmlString = eval('`' + baseCronHtml.replace(/\$\{headline\}/g, t.head).replace(/\$\{firstName\}/g, firstName).replace(/\$\{personalizedBody\}/g, t.body) + '`');
    const rawTextHtml = `<strong>Headline:</strong> ${t.head}<br/><strong>Body:</strong> Hi ${firstName}, ${t.body}`;
    await createPage(t.title, rawTextHtml, rawHtmlString);
  }

  // 2. Onboarding Emails
  const stripeFile = fs.readFileSync('app/api/webhooks/stripe/route.ts', 'utf8');
  let startS = stripeFile.indexOf('const htmlContent = `') + 20;
  let endS = stripeFile.indexOf('`;\n\n              emailsToSend.push');
  if (endS === -1) endS = stripeFile.indexOf('`;\r\n\n              emailsToSend.push');
  if (endS === -1) endS = stripeFile.indexOf('`;', startS + 500);
  const baseStripeHtml = stripeFile.substring(startS, endS);

  const onboardingEmails = [
    { title: 'Onboarding Email - Plus', head: 'Welcome to Fees Please Plus!', body: 'Your account <strong>{{ Club Name }}</strong> is now officially on the Plus plan! Your account has been upgraded and you have full access to all premium features. Start taking advantage of unlimited teams and automated summaries today!' },
    { title: 'Onboarding Email - Pro', head: 'Welcome to Fees Please Pro!', body: 'Your account <strong>{{ Club Name }}</strong> is now officially on the Pro plan! Your account has been upgraded and you have full access to all premium features. With Pro, you now have access to advanced reporting and deeper insights.' }
  ];

  for (const o of onboardingEmails) {
    let rawHtmlString = eval('`' + baseStripeHtml.replace(/\$\{headline\}/g, o.head).replace(/\$\{firstName\}/g, firstName).replace(/\$\{personalizedBody\}/g, o.body) + '`');
    const rawTextHtml = `<strong>Headline:</strong> ${o.head}<br/><strong>Body:</strong> Hi ${firstName}, ${o.body}`;
    await createPage(o.title, rawTextHtml, rawHtmlString);
  }

  // 3. Welcome Emails
  const welcomeFile = fs.readFileSync('app/api/send-welcome/route.ts', 'utf8');
  let startW = welcomeFile.indexOf('const htmlContent = `') + 20;
  let endW = welcomeFile.indexOf('`;\n\n      emailsToSend.push');
  if (endW === -1) endW = welcomeFile.indexOf('`;\r\n\n      emailsToSend.push');
  if (endW === -1) endW = welcomeFile.indexOf('`;', startW + 500);
  const baseWelcomeHtml = welcomeFile.substring(startW, endW);
  
  const welcomeEmails = [
    { 
      title: 'Welcome Email (Needs Onboarding)', 
      head: "Let's get your account set up!", 
      body: `
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Hi {{ First Name }},</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Welcome to Fees Please! We want to help you get the most out of <strong>{{ Club Name }}</strong>.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Getting set up only takes a few minutes. If your club uses PlayHQ, the process is incredibly fast. If you're using our standard setup, all you need is your logo, your player list, and your fixtures (a spreadsheet or even just screenshots work perfectly). Best of all, using the core platform is completely free.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Log in now to finish your setup and start managing your teams!</p>
        `
    },
    { 
      title: 'Welcome Email (Onboarded)', 
      head: "You're all set up! Here's what's next.", 
      body: `
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Hi {{ First Name }},</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Welcome to Fees Please! We want to help you get the most out of <strong>{{ Club Name }}</strong>.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Firstly, it's all about tracking money. You can now assign your players to games and track their payments. We highly recommend setting up the <strong>Square integration</strong>—it provides the best outcome for seamless payments. (Square charges a small transaction fee, but most users find the convenience well worth it).</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">Managing availability is also key. Head over to the <strong>Team Hub</strong> to start tracking who can play each week.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px; font-weight: bold; margin-top: 24px;">Ready to level up?</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">If you want to manage availability directly via email, pay reduced Square fees, use automated team list generators, highlight your sponsors, and access advanced reporting—you can trial <strong>Plus</strong> for 14 days with no credit card required.</p>
          <p style="color: #3f3f46; line-height: 1.6; font-size: 14px;">If you have 2 or more teams to manage, we recommend taking a look at our <strong>Pro</strong> plan.</p>
        `
    }
  ];

  for (const w of welcomeEmails) {
    let rawHtmlString = eval('`' + baseWelcomeHtml.replace(/\$\{headline\}/g, w.head).replace(/\$\{bodyText\}/g, w.body) + '`');
    const rawTextHtml = stripHtml(rawHtmlString);
    await createPage(w.title, rawTextHtml, rawHtmlString);
  }


  // 4. Availability Request Email
  const remFile = fs.readFileSync('app/api/send-reminders/route.ts', 'utf8');
  let startR = remFile.indexOf('const htmlContent = `') + 20;
  let endR = remFile.indexOf('`;\n\n      const emailPayloads');
  if (endR === -1) endR = remFile.indexOf('`;\r\n\n      const emailPayloads');
  const remBase = remFile.substring(startR, endR);
  
  // Dummy vars for Eval
  const teamLogoUrl = 'https://placehold.co/48x48?text=LOGO';
  const teamName = '{{ Team Name }}';
  const player = { nickname: '{{ Player Nickname }}', first_name: '{{ Player First Name }}' };
  const customMessage = '{{ Custom Message from Captain }}';
  const senderName = '{{ Sender Name }}';
  const matchDate = '{{ Match Date }}';
  const sponsorsHtml = '<div style="margin-top:20px;text-align:center;"><p>{{ Sponsors Go Here }}</p></div>';
  const yesCount = '{{ Yes Count }}', totalSquadSize = '{{ Squad Size }}';
  const opponent = '{{ Opponent Name }}', time = '{{ Match Time }}', location = '{{ Match Location }}';
  const urlYes = '#', urlMaybe = '#', urlNo = '#';
  const isPast = false;
  
  let remCompiledHtml = eval('`' + remBase + '`');
  await createPage('Availability Request Email', stripHtml(remCompiledHtml), remCompiledHtml);

  // 5. Squad Payment Email
  const squadFile = fs.readFileSync('app/api/send-squad/route.ts', 'utf8');
  let startSq = squadFile.indexOf('const htmlContent = `') + 20;
  let endSq = squadFile.indexOf('`;\n\n      const emailPayloads');
  if (endSq === -1) endSq = squadFile.indexOf('`;\r\n\n      const emailPayloads');
  const squadBase = squadFile.substring(startSq, endSq);
  
  const squadPlayers = [{ first_name: '{{ Player First Name }}', amount_owed: 15 }];
  const paymentLink = 'https://pay.feesplease.app/example';
  const dueAmount = '{{ Due Amount }}';
  const previousBalance = '{{ Previous Balance }}';
  const checkoutAmount = '{{ Total Checkout Amount }}';
  
  let squadCompiledHtml = eval('`' + squadBase + '`');
  await createPage('Squad Payment Email', stripHtml(squadCompiledHtml), squadCompiledHtml);

  // 6. Weekly Summary Report Email
  const weeklyFile = fs.readFileSync('app/api/cron/weekly-summary/route.ts', 'utf8');
  let startWk = weeklyFile.indexOf('const htmlContent = `') + 20;
  let endWk = weeklyFile.indexOf('`;\n        }\n\n        return {');
  if(endWk === -1) endWk = weeklyFile.indexOf('`;\r\n        }\r\n\r\n        return {');
  if(endWk === -1) endWk = weeklyFile.indexOf('`;', startWk + 5000);
  const weeklyBase = weeklyFile.substring(startWk, endWk);

  const entityName = '{{ Account/Team Name }}';
  const collectedTotal = '{{ Collected Total }}';
  const unpaidTotal = '{{ Unpaid Total }}';
  const fixtureHTML = '<tr><td>{{ Upcoming Fixtures Go Here }}</td></tr>';
  const outstandingHTML = '<tr><td>{{ Outstanding Balances Go Here }}</td></tr>';
  
  let weeklyCompiledHtml = eval('`' + weeklyBase + '`');
  await createPage('Weekly Summary Report Email', stripHtml(weeklyCompiledHtml), weeklyCompiledHtml);

  // 7. Chat Welcome Email
  const chatFile = fs.readFileSync('app/api/chat/route.ts', 'utf8');
  let startCh = chatFile.indexOf('html: `') + 7;
  let endCh = chatFile.indexOf('`\n                  });');
  if(endCh === -1) endCh = chatFile.indexOf('`\r\n                  });');
  if(endCh === -1) endCh = chatFile.indexOf('`', startCh + 1000);
  const chatBase = chatFile.substring(startCh, endCh);
  
  const userName = '{{ User Name }}';
  const issueKey = '{{ Issue Key }}';
  
  let chatCompiledHtml = eval('`' + chatBase + '`');
  await createPage('Chat Welcome Email', stripHtml(chatCompiledHtml), chatCompiledHtml);

}

run().catch(console.error);
