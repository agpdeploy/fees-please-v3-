---
title: Roster & Fixture Management
parent: User Documentation
---

# Roster & Fixture Management

Managing your players and match schedules in Fees Please is streamlined through custom roles, interactive wizards, and AI-powered extraction tools.

## 1. Inviting Players & Assigning Roles

Fees Please implements Role-Based Access Control (RBAC) to ensure security and clean management. When adding players, you can specify their role:

| Role | Permissions |
| :--- | :--- |
| **Owner** | Full system rights, account configuration, billing/Stripe management, and deletion capabilities. |
| **Account Admin** | Full access to manage all teams, view cross-team ledgers, edit roles, and run sync procedures. |
| **Team Admin** | Access restricted to managing their assigned team's lineup, fixtures, and logging payments. |
| **Member** | View-only access to their own transaction history, match list, and payment portals. |

To invite a player, add their **First Name**, **Last Name**, **Email**, and optionally **Mobile Number** and **Nickname**.

---

## 2. AI-Powered Roster Extraction

Instead of typing in dozens of player names, you can upload your roster via a PDF or an image (e.g., screenshots of sheets):
1. Navigate to the **Players** tab.
2. Click **AI Upload**.
3. Select your file (PDF or Image under 3.2MB).
4. The system will send the file to our Gemini AI engine.
5. Gemini extracts the **First Name**, **Last Name**, **Email**, and **Mobile Numbers** from the document.
6. The UI displays an **Editable Preview** grid. Review the extracted data, make corrections, and click **Auto-Merge** to create the player accounts.

---

## 3. AI-Powered Fixture Extraction

If your sport does not use PlayHQ and you do not want to add fixtures manually:
1. Navigate to the **Game Day** or **Fixtures** tab.
2. Click **AI Upload Fixture**.
3. Upload your schedule image or PDF.
4. Gemini AI parses the document and extracts match dates, times, and opponents.
5. Review the extracted schedule and click **Save** to populate your fixtures instantly.

* ℹ️ **Note:** To prevent Brave browser shields from blocking the upload due to canvas fingerprinting protection, canvas compression is automatically bypassed for files under 3.2MB.
