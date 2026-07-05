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
  text = text.replace(/^[ \t]+/gm, ''); 
  return text.trim().replace(/\n+/g, '<br/>'); 
}

// Function to extract template body from files
function extractTemplate(file, startMark, endMark1, endMark2) {
  const content = fs.readFileSync(file, 'utf8');
  let start = content.indexOf(startMark) + startMark.length;
  let end = content.indexOf(endMark1, start);
  if (end === -1 && endMark2) end = content.indexOf(endMark2, start);
  if (end === -1) end = content.indexOf('`;', start + 500);
  return content.substring(start, end);
}

async function run() {

  const trialEmails = [
    { title: 'Trial Email - Day 0 (Welcome)', head: 'Get the most out of Plus', body: 'Your 14-day trial of Plus for <strong>{{ Club Name }}</strong> is now active! Start using premium features like unlimited teams, automated email summaries, and reduced transaction fees today.' },
    { title: 'Trial Email - Day 7 (Halfway)', head: "How's your trial going?", body: 'You have 7 days left in your free trial for <strong>{{ Club Name }}</strong>. Did you know you can earn rewards by referring a friend? Check out the "Refer a friend" section in your account!' },
    { title: 'Trial Email - Day 10 (Ending Soon)', head: 'Only 4 days left!', body: 'Your 14-day trial of Plus for <strong>{{ Club Name }}</strong> is almost over. To avoid losing access to premium features, head to the Billing tab in your account and upgrade to a paid plan today.' },
    { title: 'Trial Email - Day 14 (Ended)', head: 'You are back on the Free plan', body: "Your 14-day trial for <strong>{{ Club Name }}</strong> has ended and you've been moved back to the Free plan. To regain access to Plus features, simply upgrade your account in the Billing tab at any time. Continue with Plus to get the most out of Fees Please!" }
  ];
  
  const baseCronHtml = extractTemplate('app/api/cron/trial-emails/route.ts', 'const htmlContent = `', '`;\n\n            emailsToSend.push', '`;\r\n\n            emailsToSend.push');
  
  for (const t of trialEmails) {
    let raw = baseCronHtml.replace(/\$\{headline\}/g, t.head)
                          .replace(/\$\{firstName\}/g, '{{ First Name }}')
                          .replace(/\$\{personalizedBody\}/g, t.body);
    await createPage(t.title, stripHtml(raw), raw);
  }

  const onboardingEmails = [
    { title: 'Onboarding Email - Plus', head: 'Welcome to Fees Please Plus!', body: 'Your account <strong>{{ Club Name }}</strong> is now officially on the Plus plan! Your account has been upgraded and you have full access to all premium features. Start taking advantage of unlimited teams and automated summaries today!' },
    { title: 'Onboarding Email - Pro', head: 'Welcome to Fees Please Pro!', body: 'Your account <strong>{{ Club Name }}</strong> is now officially on the Pro plan! Your account has been upgraded and you have full access to all premium features. With Pro, you now have access to advanced reporting and deeper insights.' }
  ];
  
  const baseStripeHtml = extractTemplate('app/api/webhooks/stripe/route.ts', 'const htmlContent = `', '`;\n\n              emailsToSend.push', '`;\r\n\n              emailsToSend.push');
  
  for (const o of onboardingEmails) {
    let raw = baseStripeHtml.replace(/\$\{headline\}/g, o.head)
                            .replace(/\$\{firstName\}/g, '{{ First Name }}')
                            .replace(/\$\{personalizedBody\}/g, o.body);
    await createPage(o.title, stripHtml(raw), raw);
  }

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

  const baseWelcomeHtml = extractTemplate('app/api/send-welcome/route.ts', 'const htmlContent = `', '`;\n\n      emailsToSend.push', '`;\r\n\n      emailsToSend.push');
  
  for (const w of welcomeEmails) {
    let raw = baseWelcomeHtml.replace(/\$\{headline\}/g, w.head).replace(/\$\{bodyText\}/g, w.body);
    await createPage(w.title, stripHtml(raw), raw);
  }

  // 4. Availability Request Email
  let remBase = extractTemplate('app/api/send-reminders/route.ts', 'const htmlContent = `', '`;\n\n      const emailPayloads', '`;\r\n\n      const emailPayloads');
  let remRaw = remBase
    .replace(/\$\{teamLogoUrl \? `([\s\S]*?)` : ''\}/g, '$1')
    .replace(/\$\{teamLogoUrl\}/g, 'https://placehold.co/48x48?text=LOGO')
    .replace(/\$\{teamName\}/g, '{{ Team Name }}')
    .replace(/\$\{player\.nickname \|\| player\.first_name\}/g, '{{ Player Name }}')
    .replace(/\$\{customMessage \? `([\s\S]*?)` : ''\}/g, '$1')
    .replace(/\$\{senderName\}/g, '{{ Sender Name }}')
    .replace(/\$\{customMessage\}/g, '{{ Custom Message }}')
    .replace(/\$\{matchDate\}/g, '{{ Match Date }}')
    .replace(/\$\{opponent\}/g, '{{ Opponent }}')
    .replace(/\$\{time\}/g, '{{ Match Time }}')
    .replace(/\$\{location\}/g, '{{ Match Location }}')
    .replace(/\$\{urlYes\}/g, '#')
    .replace(/\$\{urlMaybe\}/g, '#')
    .replace(/\$\{urlNo\}/g, '#')
    .replace(/\$\{isPast \? `([\s\S]*?)` : ''\}/g, '')
    .replace(/\$\{yesCount\}/g, '{{ Yes Count }}')
    .replace(/\$\{totalSquadSize\}/g, '{{ Squad Size }}')
    .replace(/\$\{sponsorsHtml\}/g, '<div style="margin-top:20px;text-align:center;"><p>{{ Sponsors Go Here }}</p></div>');
  
  await createPage('Availability Request Email', stripHtml(remRaw), remRaw);

  // 5. Squad Payment Email
  let squadBase = extractTemplate('app/api/send-squad/route.ts', 'const htmlContent = `', '`;\n\n      const emailPayloads', '`;\r\n\n      const emailPayloads');
  let squadRaw = squadBase
    .replace(/\$\{teamLogoUrl \? `([\s\S]*?)` : ''\}/g, '$1')
    .replace(/\$\{teamLogoUrl\}/g, 'https://placehold.co/48x48?text=LOGO')
    .replace(/\$\{teamName\}/g, '{{ Team Name }}')
    .replace(/\$\{customMessage \? `([\s\S]*?)` : ''\}/g, '$1')
    .replace(/\$\{senderName\}/g, '{{ Sender Name }}')
    .replace(/\$\{customMessage\}/g, '{{ Custom Message }}')
    .replace(/\$\{sponsorsHtml\}/g, '<div style="margin-top:20px;text-align:center;"><p>{{ Sponsors Go Here }}</p></div>')
    .replace(/\$\{squadPlayers\.map\([\s\S]*?\.join\(''\)\}/g, `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #18181b;">{{ Player Name }}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f4f4f5; font-size: 14px; font-weight: 700; color: #18181b; text-align: right;">\${{ Player Amount }}</td>
      </tr>
    `)
    .replace(/\$\{paymentLink \? `([\s\S]*?)` : ''\}/g, '$1')
    .replace(/\$\{paymentLink\}/g, '#')
    .replace(/\$\{dueAmount\}/g, '{{ Due Amount }}')
    .replace(/\$\{previousBalance\}/g, '{{ Previous Balance }}')
    .replace(/\$\{checkoutAmount\}/g, '{{ Total Checkout Amount }}');
  
  await createPage('Squad Payment Email', stripHtml(squadRaw), squadRaw);

  // 6. Weekly Summary Report Email
  let weeklyBase = extractTemplate('app/api/cron/weekly-summary/route.ts', 'const htmlContent = `', '`;\n        }\n\n        return {', '`;\r\n        }\r\n\r\n        return {');
  let weeklyRaw = weeklyBase
    .replace(/\$\{teamLogoUrl \? `([\s\S]*?)` : ''\}/g, '$1')
    .replace(/\$\{teamLogoUrl\}/g, 'https://placehold.co/48x48?text=LOGO')
    .replace(/\$\{entityName\}/g, '{{ Entity Name }}')
    .replace(/\$\{process\.env\.NEXT_PUBLIC_SITE_URL \|\| 'https:\/\/app\.feesplease\.app'\}/g, 'https://app.feesplease.app')
    .replace(/\$\{collectedTotal\}/g, '{{ Collected Total }}')
    .replace(/\$\{unpaidTotal\}/g, '{{ Unpaid Total }}')
    .replace(/\$\{fixtureHTML\}/g, '<tr><td style="padding: 16px 20px; font-size: 13px; color: #71717a;">{{ Upcoming Fixtures Go Here }}</td></tr>')
    .replace(/\$\{outstandingHTML\}/g, '<tr><td style="padding: 16px 20px; font-size: 13px; color: #71717a;">{{ Outstanding Balances Go Here }}</td></tr>');

  await createPage('Weekly Summary Report Email', stripHtml(weeklyRaw), weeklyRaw);

  // 7. Chat Welcome Email
  let chatBase = extractTemplate('app/api/chat/route.ts', 'html: `', '`\n                  });', '`\r\n                  });');
  let chatRaw = chatBase
    .replace(/\$\{userName !== "Unknown User" \? ' ' \+ userName\.split\(' '\)\[0\] : ''\}/g, ' {{ User Name }}')
    .replace(/\$\{issueKey\}/g, '{{ Issue Key }}');

  await createPage('Chat Welcome Email', stripHtml(chatRaw), chatRaw);
}

run().catch(console.error);
