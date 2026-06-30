---
title: Sponsors & Sponsorship Analytics
parent: User Documentation
---

# Sponsors & Sponsorship Analytics Guide

The Fees Please platform allows clubs to showcase their sponsors and track the real-world value of those sponsorships. Sponsors are displayed across public-facing interfaces, and administrators can track their performance metrics in real-time.

---

## 1. Setting Up Sponsors

To add and manage sponsors for your club or team:

1. Log in and navigate to the **Sponsors** tab in the main sidebar.
2. If this is a new sponsor:
   * Click the **+ Add Sponsor** button.
   * Enter the **Sponsor Name** (e.g., *MJ & Co. Designs*).
   * Enter the **Website URL** (e.g., *https://www.mjandcodesigns.com.au/*).
   * Click **Change Logo** to upload the sponsor's logo image.
3. Click the **Save Sponsors** button at the bottom to apply changes.
4. **Archiving Sponsors**: If a sponsorship ends, you can click **Archive** next to the sponsor. They can be re-activated at any time under the *Archived Sponsors* list.

---

## 2. Where Sponsors Display

Sponsors are prominently featured at the bottom of the public **Team Hub** pages (e.g., `app.feesplease.app/t/your-team-slug`). 
* Logos are styled to blend seamlessly, using modern responsive grids with clean hover animations.
* Clicking a sponsor's logo opens their target website in a new browser tab.

---

## 3. Sponsorship Impact & Analytics

The Admin Dashboard provides real-time analytics for your active sponsorships under the **Sponsorship Impact** panel:

* **Impressions**: The total number of times any sponsor logo was viewed on the screen.
* **Clicks**: The number of times a user clicked a sponsor's logo to visit their website.
* **Click Rate (CTR)**: The click-through rate percentage, calculated as `(Clicks / Impressions) * 100`.
* **Breakdown by Source**: 
  * Under each sponsor name in the dashboard, the platform breaks down impressions into two categories:
    * **Hub**: Impressions generated on the public-facing Team Hub page.
    * **Email**: Impressions generated from emails sent by the platform (e.g., transactional templates, receipts).

---

## 4. Technical Architecture & Tracking

The analytics framework is built for maximum speed and security:

* **Asynchronous Recording**: Impression and click tracking are handled asynchronously using a lightweight `/api/track-sponsor` endpoint, ensuring that page loading and redirects remain instant for users.
* **Security & Row Level Security (RLS)**:
  * The raw `sponsor_analytics` table is protected by Postgres RLS.
  * Only authorized **Account Admins** for that club and **Super Admins** can read the aggregated analytics.
  * Public requests to track analytics (via the Team Hub) are authorized to insert tracking events but are strictly blocked from reading the metrics.
