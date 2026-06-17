---
title: Release Notes - June 2026
parent: Release Notes
---

# Release Notes - June 2026

June brings enhanced payment flexibilities, terminology alignment, and deeper PlayHQ capabilities.

## Major Highlights

### 1. PlayHQ Organization Sync
- Added a club category selector allowing users to mark their account as a **PlayHQ** account.
- Unlocks the ability to sync full organization details (Org ID and Tenant key) to configure settings and fetch team lists automatically.
- Prevented PlayHQ sync routines from deleting existing localized fixtures and ensured untagged matches are retained in views.

### 2. Apple Pay & Google Pay Support
- Integrated mobile wallets into the Square payment checkout portal.
- Players can now check out instantly using **Google Pay** or **Apple Pay** on their mobile browsers, in addition to standard credit/debit cards.

### 3. UI Terminology Overhaul
- Aligned terminology to match local club structures.
- Standardised and retained the name **Game Day** (reverting the temporary Match Hub change) and renamed "Squad" to **Lineup**.
- Updated labels across the menu sidebar, setup widgets, and dashboard hubs.

### 4. Player Credit & Chronological Debt Consumption
- Added **Apply Credit** functionality inside the ledger. Admins can award dynamic credit balances to players.
- Implemented **Chronological Debt Consumption** logic. If a player pays or checking out when they have multiple unpaid fees (e.g. week 1 and week 2), the system automatically applies payments to the oldest outstanding invoice first, ensuring clean bookkeeping.
