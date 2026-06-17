---
title: PlayHQ Integration
parent: User Documentation
---

# PlayHQ Integration

Fees Please features native integration with PlayHQ, allowing you to sync organization settings, import teams, and automatically pull match fixtures.

## 1. Setting Up the Integration

To connect your PlayHQ organization:
1. Go to the **Settings** or **Config** tab in the sidebar.
2. Select your integration type from the dropdown (select **PlayHQ**).
3. Enter your **PlayHQ Org ID** and associate the correct **Tenant Key** (e.g., `ca` for Cricket Australia, or other regional mappings).
4. Save the configuration. Fees Please will now query the PlayHQ GraphQL API to synchronize your organization data.

---

## 2. Linking Teams and Importing Fixtures

Once your organization is connected, you can link specific teams to their PlayHQ URL:
1. Go to your **Teams** manager.
2. For each team, enter its public PlayHQ Team URL. 
   - *Example URL:* `https://www.playhq.com/cricket-australia/org/.../teams/.../b7cf852d`
3. Click **Sync**. The integration will automatically:
   - Connect to the PlayHQ API.
   - Fetch the team's entire fixture calendar (match dates, start times, venues, and opponents).
   - Insert the fixtures into your Fees Please database automatically, removing the need for manual scheduling.

---

## 3. Automated Season Tracking (Background Cron)

Fees Please runs a background cron job (`playhq-check`) to monitor your PlayHQ space:
- **Scan**: It periodically checks PlayHQ for new active or upcoming seasons associated with your Org ID.
- **Alerts**: If a new season is detected, account administrators will receive an email notification:
  > *Subject: New PlayHQ Seasons Available for [Account Name]*
- **Action**: When notified, log into Fees Please, verify the new season, and update your team PlayHQ URLs to automatically pull the new fixtures.

* ℹ️ **Note:** The sync logic includes safeguards to prevent deleting matches that have already been finalized or have manual payments logged against them.
