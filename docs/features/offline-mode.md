---
title: Offline Mode & PWA
parent: User Documentation
---

# Offline Mode & PWA

Playing fields often have poor mobile network coverage. Fees Please solves this by functioning as a fully offline-compatible Progressive Web App (PWA).

## 1. Installing the PWA

You can install Fees Please directly onto your smartphone or desktop:
1. Open the app in your mobile browser.
2. Tap the browser's menu (or share icon) and select **Add to Home Screen** or **Install App**.
3. Once installed, Fees Please launches as a native app with a full-screen display, custom launcher icon, and support for pinch-to-zoom.

---

## 2. Service Worker Caching

- The PWA uses service workers to cache all essential assets (HTML, JS, CSS, and UI icons).
- It is configured with a "skip-waiting" protocol, ensuring that any code updates or hotfixes are applied instantly the moment you reload, rather than waiting for background cycles.

---

## 3. Offline Sync Logic

When network connectivity is lost on game day:
- **Offline Mode Detection**: The app detects when you go offline and displays an offline indicator.
- **Local Cache Actions**: You can continue to edit lineups, log cash payments, and track match events. These actions are queued locally.
- **Automatic Sync**: The offline sync engine (`useOfflineSync`) monitors connection state. Once a stable internet connection is restored, the queue automatically uploads all pending transactions and updates to the server database.
