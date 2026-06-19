---
title: Payments & Billing Portal
parent: User Documentation
---

# Payments & Billing Portal Guide

The Fees Please platform handles two distinct types of payments:
1. **Platform Subscription:** Your account's subscription to the Fees Please software, powered by Stripe.
2. **Player Match Fees:** The money you collect from your players on Game Day, powered by Square.

This guide will walk you through setting up both integrations so you can manage your billing and start collecting fees.

## 1. Upgrading Your Platform Subscription (Stripe)

To unlock premium features and manage your account's subscription tier:

1. Log in and navigate to the **Settings** menu in the left navigation sidebar.
2. Click on the **Billing & Plan** tab.
3. Review the available subscription tiers (e.g., Free, Pro, Premium) and select the one that fits your needs.
4. Click the **Upgrade** or **Subscribe** button next to your desired plan.
5. You will be redirected to the secure **Stripe Checkout** portal.
6. Enter your credit card details and billing address.
7. Click **Subscribe**. Once the payment is successful, you will be redirected back to the Fees Please dashboard, and your new features will be unlocked immediately.

## 2. Managing Your Subscription

If you need to update your credit card, download an invoice, or cancel your subscription:

1. Go to **Settings > Billing & Plan**.
2. Click the **Manage Subscription** button.
3. This opens the **Stripe Customer Portal**. From here you can:
   * **Update Payment Methods:** Add a new card or set a default.
   * **View Invoice History:** Download PDF receipts for past subscription charges.
   * **Cancel/Pause Plan:** Modify your subscription status.
4. Once finished, click **Return to Fees Please**.

## 3. Connecting Square to Collect Player Fees

To allow players to pay their match fees via card (Tap-to-Pay or Online Checkout) directly to your bank account, you must link your Square account.

1. Navigate to the **Settings** menu in the left navigation sidebar.
2. Click on the **Integrations** or **Payments** tab.
3. Locate the Square integration card and click **Connect Square**.
4. You will be redirected to the Square authorization page.
5. Log in with your existing Square credentials (or create a new Square account if you don't have one).
6. Square will ask for permission to allow Fees Please to process payments on your behalf. Click **Allow**.
7. You will be redirected back to the Fees Please dashboard. A green checkmark will indicate that Square is successfully connected.

## 4. Processing Card Payments on Game Day

Once Square is connected, you can process card payments:

1. On match day, open the **Game Day** portal for your fixture.
2. Next to a player's name, click the **Pay** button.
3. Select **Card (Square)** from the dropdown.
4. This will trigger the Square Point of Sale app or Tap-to-Pay on your device.
5. The player taps their card. Once Square approves the transaction, Fees Please automatically updates the player's status to "Paid".
