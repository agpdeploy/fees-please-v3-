import { test, expect } from '@playwright/test';

test.describe('Account Setup and Onboarding Flow', () => {
  test('User can input email to receive magic link', async ({ page }) => {
    // 1. Intercept Supabase Auth OTP request to mock successful email dispatch
    await page.route('**/auth/v1/otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    // 2. Go to home page
    await page.goto('/');

    // 3. Verify Login page elements are visible
    const title = page.locator('h1');
    await expect(title).toContainText('Fees Please');

    const googleBtn = page.getByRole('button', { name: 'Continue with Google' });
    await expect(googleBtn).toBeVisible();

    // 4. Enter email and submit
    const emailInput = page.getByPlaceholder('name@example.com');
    await emailInput.fill('newuser@example.com');

    const submitBtn = page.getByRole('button', { name: 'Send Magic Link' });
    await submitBtn.click();

    // 5. Verify email sent success box is visible
    const successHeader = page.getByRole('heading', { name: 'Check Your Email' });
    await expect(successHeader).toBeVisible();

    const successEmail = page.locator('span.text-emerald-500');
    await expect(successEmail).toContainText('newuser@example.com');
  });
});
