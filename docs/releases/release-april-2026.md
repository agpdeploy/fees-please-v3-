---
title: Release Notes - April 2026
parent: Release Notes
---

# Release Notes - April 2026

April saw a massive feature rollout, transitioning Fees Please into a highly autonomous, offline-capable assistant.

## Major Highlights

### 1. Google OAuth & Unified Login
- Added support for Google single sign-on (SSO).
- Restructured user authentication into a unified login screen supporting multi-org and Role-Based Access Control (RBAC).

### 2. Tap-to-Pay Integration (Square POS API)
- Shifted to the native Square Point-of-Sale (POS) API for mobile tap-to-pay.
- Built-in automatic platform detection (iOS vs. Android) handles redirects seamlessly, allowing administrators to collect card payments on their phones instantly.
- Added a Square diagnostic modal and safeguards to prevent payment collection failures.

### 3. AI Extraction (Gemini Integration)
- Integrated Gemini models to parse player rosters and match schedules.
- You can upload rosters or fixtures as PDFs or image files; the AI automatically extracts names, emails, phones, and match details.
- Introduced an editable preview grid to double-check AI extractions before merging.

### 4. dAIve Chat Assistant
- Launched our embedded AI chat bot: **dAIve**.
- dAIve interacts with you in natural language, answering questions about your ledger balances, upcoming fixtures, and searching Confluence user guides dynamically.

### 5. Squad Graphic Generator & WhatsApp Share
- Built a visual graphic generator that takes your lineup roster and draws a premium announcement image (squad list).
- Generates native sharing links for WhatsApp and other chat tools so you can announce your team lists instantly.

### 6. Full PWA & Offline Sync
- Officially rolled out the Progressive Web App (PWA) with a "skip-waiting" service worker to apply software updates instantly.
- Implemented offline sync behavior (`useOfflineSync`) allowing users to check rosters, log cash payments, and track scores offline, syncing automatically once a connection is detected.
