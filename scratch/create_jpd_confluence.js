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
const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'FP';

if (!email || !apiToken || !domain) {
  console.error("Missing credentials in env.");
  process.exit(1);
}

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
const jiraHeaders = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

const confluenceHeaders = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

async function createJpdIdea() {
  const url = `https://${domain}/rest/api/3/issue`;
  
  const summary = "Automated Engagement and Onboarding Communications (Drips)";
  const descriptionText = `Introduce lifecycle email drops for onboarding and engagement:
1. Free accounts with no Square integration (nudge to integrate).
2. Checklist incomplete after signup (guide them to complete setup).
3. PlayHQ integration nudge (sync fixtures).
4. Free tier usage drops (promote Plus tier features).
5. Role-specific comms (Club Admin vs Team Admin vs Affiliate; leaving Players alone).

Details and implementation designs have been documented on the Confluence page: "Automated Engagement & Onboarding Communications (Drips)" in space ${spaceKey}.`;

  const body = {
    fields: {
      project: { key: 'JPDFP' },
      summary: summary,
      issuetype: { id: '10007' }, // Idea
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: descriptionText }
            ]
          }
        ]
      }
    }
  };

  console.log("Creating JPD Idea...");
  const res = await fetch(url, { method: 'POST', headers: jiraHeaders, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    console.error("Jira Error:", JSON.stringify(data, null, 2));
    throw new Error(`Failed to create JPD Idea: ${res.status}`);
  }
  console.log(`Created JPD Idea: ${data.key} (${data.self})`);
  return data.key;
}

async function createConfluencePage(jpdKey) {
  const url = `https://${domain}/wiki/rest/api/content`;

  const title = "Automated Engagement & Onboarding Communications (Drips)";
  
  // Construct Confluence Storage format HTML content
  const htmlContent = `
<h2>Executive Summary</h2>
<p>To optimize user onboarding, payment volume, and premium subscription conversions, Fees Please requires automated, attribute-driven lifecycle communications. By identifying specific user cohorts and triggering emails based on their database states, we can guide admins through friction points and drive upgrading behaviors.</p>

<hr />

<h2>Targeted User Cohorts</h2>
<table border="1">
  <thead>
    <tr>
      <th>Cohort / Scenario</th>
      <th>Database Condition</th>
      <th>Messaging Strategy</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Free Tier &amp; No Square Connected</strong></td>
      <td><code>clubs.plan_tier = 'free' AND clubs.is_square_enabled = false</code></td>
      <td>Prompt them to connect Square so they can start collecting fees. Emphasize ease of setup.</td>
    </tr>
    <tr>
      <td><strong>Just Registered &amp; Incomplete Onboarding</strong></td>
      <td><code>profiles.onboarding_completed = false AND profiles.created_at &gt; now() - 3 days</code></td>
      <td>Nudge them to complete checklist items (add teams, invite players). Point them to the Setup Checklist on the Game Day page.</td>
    </tr>
    <tr>
      <td><strong>PlayHQ Org Configured but No Teams/Fixtures Synced</strong></td>
      <td><code>clubs.settings-&gt;'playhq_org_id' IS NOT NULL</code> and no active teams/fixtures mapping</td>
      <td>Help them sync their first competition. Walk through matching PlayHQ URL configurations.</td>
    </tr>
    <tr>
      <td><strong>Active Free Users (Potential Plus Upgrades)</strong></td>
      <td><code>clubs.plan_tier = 'free' AND (count of transactions or teams &gt; threshold)</code></td>
      <td>Drip feed premium features (e.g., automated reminders, custom branding) and direct them to upgrade in Billing.</td>
    </tr>
    <tr>
      <td><strong>Affiliates vs. Club/Team Admins</strong></td>
      <td><code>profiles.referral_code IS NOT NULL</code> vs. <code>user_roles.role = 'club_admin' / 'team_admin'</code></td>
      <td>Send relevant updates: Affiliates get referral stats, Team Admins get manager tips. <em>Players are excluded from marketing drips.</em></td>
    </tr>
  </tbody>
</table>

<hr />

<h2>Implementation Approaches</h2>

<h3>Approach A: Next.js API Cron Route (Pure Code-Driven, 100% Free)</h3>
<p>Utilize the existing <code>resend</code> npm dependency and your configured Resend API key to schedule a daily cron job that queries PostgreSQL and sends batch emails.</p>
<p><strong>Proposed Route:</strong> <code>/app/api/cron/onboarding-drips/route.ts</code></p>
<p><strong>Example Query Structure:</strong></p>
<pre><code>
// Cohort: Free tier and no payment integration
const { data: noPaymentClubs } = await supabase
  .from('clubs')
  .select('id, name, contact_email')
  .eq('plan_tier', 'free')
  .eq('is_square_enabled', false)
  .eq('accepts_cash', false); // No payout method setup at all
</code></pre>

<h3>Approach B: Synced Audiences + Customer Engagement Tool (e.g., Loops.so)</h3>
<p>Sync user attributes on signup or update to a specialized developer email marketing tool like <strong>Loops.so</strong> or <strong>Customer.io</strong>. Loops integrates natively with Resend or works independently.</p>
<p><strong>Action Items:</strong></p>
<ul>
  <li>On user sign up or profile update, dispatch profile attributes to Loops: <code>email</code>, <code>role</code>, <code>plan_tier</code>, <code>is_square_enabled</code>, <code>has_playhq</code>, <code>onboarding_completed</code>.</li>
  <li>Create automated visual workflows in Loops triggered by user events or field updates.</li>
</ul>

<hr />

<h2>Next Steps</h2>
<ol>
  <li><strong>Select Approach:</strong> Determine if we should build Next.js cron routes (Approach A) or integrate a third-party automation sync (Approach B).</li>
  <li><strong>Design Templates:</strong> Draft the Resend templates following standard brand styling.</li>
  <li><strong>Configure Trigger Times:</strong> Establish delays (e.g., Day 2 integration nudge, Day 5 feature drip).</li>
</ol>

<p><em>Associated JPD Discovery Issue: ${jpdKey}</em></p>
  `;

  const body = {
    type: 'page',
    title: title,
    space: { key: spaceKey },
    body: {
      storage: {
        value: htmlContent,
        representation: 'storage'
      }
    }
  };

  console.log("Creating Confluence Page...");
  const res = await fetch(url, { method: 'POST', headers: confluenceHeaders, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    console.error("Confluence Error:", JSON.stringify(data, null, 2));
    throw new Error(`Failed to create Confluence Page: ${res.status}`);
  }
  
  const pageUrl = `https://${domain}/wiki${data._links.webui}`;
  console.log(`Created Confluence Page successfully! URL: ${pageUrl}`);
  return pageUrl;
}

async function run() {
  try {
    const jpdKey = await createJpdIdea();
    const pageUrl = await createConfluencePage(jpdKey);
    console.log("All tasks completed successfully!");
  } catch (error) {
    console.error("Failed:", error.message);
  }
}

run();
