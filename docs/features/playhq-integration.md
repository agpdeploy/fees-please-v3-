---
title: PlayHQ Integration
parent: User Documentation
---

# PlayHQ Integration Guide

The PlayHQ integration allows you to automatically pull down fixtures, ladders, and roster updates directly into your Fees Please account. This removes the need for manual data entry and ensures your schedule is always perfectly synced with your sporting league.

## 1. Finding Your PlayHQ URLs

To connect Fees Please, you first need the public links to your team on the PlayHQ website.

1. Open a new tab in your web browser and go to `https://www.playhq.com`.
2. Use the search bar to find your club or association.
3. Navigate through the site to find your specific team's fixture page.
4. Copy the URL from your browser's address bar (e.g., `https://www.playhq.com/netball-australia/org/your-club/winter-2026/team-name/fixture`).
5. (Optional) If you also want to sync the ladder, navigate to the ladder tab for your grade and copy that URL as well.

## 2. Linking PlayHQ to Fees Please

1. Log in to your Fees Please account.
2. In the left navigation sidebar, click on **Settings**.
3. Select the **Integrations** tab.
4. Locate the **PlayHQ** section.
5. Paste the Fixture URL you copied into the **PlayHQ Fixture URL** input box.
6. (Optional) Paste the Ladder URL into the **PlayHQ Ladder URL** input box.
7. Click the **Save & Connect** button.

## 3. Running the Initial Sync

Once connected, you need to trigger the initial data pull:

1. Navigate to the **Fixtures** page using the left navigation sidebar.
2. At the top right of the screen, click the **Sync with PlayHQ** button.
3. A loading indicator will appear as the system fetches the data via the PlayHQ API.
4. Once complete, your upcoming matches, opponents, venues, and times will automatically populate the calendar/list view.
5. If there are new players listed on the PlayHQ roster that aren't in your Fees Please database, the system will prompt you to automatically import and merge them into your team roster.

## 4. Automated Background Syncs

* **Cron Jobs:** You do not need to manually click the sync button every week. Fees Please runs an automated background process (cron job) periodically to check PlayHQ for changes.
* **Match Changes:** If your league changes a venue, time, or date, the background sync will detect this and update your Fees Please fixtures automatically, ensuring your Game Day operations are never disrupted by last-minute schedule changes.
