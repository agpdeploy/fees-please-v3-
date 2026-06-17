---
title: Payments & Billing Portal
parent: User Documentation
---

# Payments & Billing Portal

Fees Please splits payments into two distinct categories: **Account Subscriptions (via Stripe)** and **Player Match Fees (via Square / PayID / Cash)**.

---

## 1. Account Subscriptions (Stripe)

To access premium features (Plus and Pro plans), accounts subscribe using **Stripe**:
* **Plans**:
  - **Free Tier**: Standard features, with a platform fee clip on player transactions.
  - **Plus/Pro Tiers**: Unlocks advanced features, multi-admin settings, and bypasses platform fee clips.
* **Embedded Checkout**: Upgrading is handled inside the app using Stripe's Embedded Checkout.
* **Quantity Syncing**: If your subscription is billed per-seat (per-active player), Fees Please automatically synchronizes your active player count with Stripe when players are added or deactivated.
* **Billing Portal**: Click **Manage Billing** to access the secure Stripe Customer Portal where you can update payment cards, view invoices, or cancel subscriptions.

---

## 2. Player Match Fees (Square)

To collect game fees from players on match day, Fees Please integrates with **Square**:
* **Square Online Checkout Links**:
  - The app generates unique payment checkout links or QR codes for players.
  - Players open the link on their mobile devices and pay using **Credit/Debit Card**, **Google Pay**, or **Apple Pay**.
  - Processing fees are automatically calculated based on your account tier.
* **Square POS API (Tap-to-Pay)**:
  - For on-the-spot mobile card payments, administrators can use **Tap-to-Pay**.
  - When you click Tap-to-Pay, Fees Please redirects to the native Square Point-of-Sale (POS) mobile app.
  - The player taps their card on the admin's phone, the payment processes, and Square redirects back to Fees Please to automatically record the transaction.
  - The app features platform-detection safeguards (iOS/Android redirects) and diagnostic checks.

---

## 3. Alternative Player Payments

* **PayID**: Account admins can configure a PayID and account name. Players are presented with this detail on checkout if they prefer direct bank transfers.
* **Cash**: Admins can manually log cash transactions directly on the Game Day portal.
