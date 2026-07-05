const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  
  // Create context with iPhone 14 Pro Max viewport
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3, // High DPI for crisp screenshots
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message));

  // 1. Intercept all Supabase REST and Auth endpoints
  console.log('Setting up API mocks...');
  
  // Auth Session mock
  await page.route('**/auth/v1/session', async (route) => {
    console.log('Mocked /auth/v1/session');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh',
        user: {
          id: '2be21ec9-e04f-4f89-abef-735f7a0f9cd1',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'ashleygpitt+sum26@gmail.com',
          email_confirmed_at: '2026-06-09T06:54:44Z',
          confirmed_at: '2026-06-09T06:54:44Z',
          last_sign_in_at: '2026-06-09T06:54:44Z',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          created_at: '2026-06-09T06:54:44Z',
          updated_at: '2026-06-09T06:54:44Z'
        }
      })
    });
  });

  // User mock
  await page.route('**/auth/v1/user', async (route) => {
    console.log('Mocked /auth/v1/user');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '2be21ec9-e04f-4f89-abef-735f7a0f9cd1',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'ashleygpitt+sum26@gmail.com',
        email_confirmed_at: '2026-06-09T06:54:44Z',
        created_at: '2026-06-09T06:54:44Z',
        updated_at: '2026-06-09T06:54:44Z'
      })
    });
  });

  // REST API Table Queries Mock
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    console.log(`Mocking REST request: ${url}`);
    
    if (url.includes('/profiles')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: '2be21ec9-e04f-4f89-abef-735f7a0f9cd1',
          email: 'ashleygpitt+sum26@gmail.com',
          full_name: 'Ashley Pitt',
          role: 'club_admin',
          has_onboarded: true,
          onboarding_completed: true
        }])
      });
    } else if (url.includes('/user_roles')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 1,
          user_id: '2be21ec9-e04f-4f89-abef-735f7a0f9cd1',
          club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756',
          role: 'club_admin',
          clubs: {
            id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756',
            name: 'Fees Please FC',
            is_active: true,
            logo_url: null,
            plan_tier: 'plus'
          }
        }])
      });
    } else if (url.includes('/clubs')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756',
          name: 'Fees Please FC',
          is_active: true,
          logo_url: null,
          plan_tier: 'plus',
          season_name: 'Winter 2026',
          is_square_enabled: true
        }])
      });
    } else if (url.includes('/teams')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'team-1', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', name: 'First XI', slug: 'first-xi', member_fee: 150, casual_fee: 15 },
          { id: 'team-2', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', name: 'Under 18s', slug: 'under-18s', member_fee: 120, casual_fee: 10 }
        ])
      });
    } else if (url.includes('/players')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'p1', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', first_name: 'John', last_name: 'Smith', is_member: true, default_team_id: 'team-1', phone: '0400000001', email: 'john@example.com' },
          { id: 'p2', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', first_name: 'Alex', last_name: 'Jones', is_member: false, default_team_id: 'team-1', phone: '0400000002', email: 'alex@example.com' },
          { id: 'p3', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', first_name: 'Chris', last_name: 'Miller', is_member: true, default_team_id: 'team-1', phone: '0400000003', email: 'chris@example.com' },
          { id: 'p4', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', first_name: 'David', last_name: 'Taylor', is_member: true, default_team_id: 'team-2', phone: '0400000004', email: 'david@example.com' }
        ])
      });
    } else if (url.includes('/fixtures')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'f1', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', team_id: 'team-1', match_date: new Date().toISOString().split('T')[0], opponent: 'Rangers FC', status: 'scheduled', season_name: 'Winter 2026' },
          { id: 'f2', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', team_id: 'team-1', match_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], opponent: 'United Athletic', status: 'scheduled', season_name: 'Winter 2026' }
        ])
      });
    } else if (url.includes('/match_squads')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'ms1', fixture_id: 'f1', player_id: 'p1' },
          { id: 'ms2', fixture_id: 'f1', player_id: 'p2' },
          { id: 'ms3', fixture_id: 'f1', player_id: 'p3' }
        ])
      });
    } else if (url.includes('/availability')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'a1', fixture_id: 'f1', player_id: 'p1', status: 'available' },
          { id: 'a2', fixture_id: 'f1', player_id: 'p2', status: 'available' },
          { id: 'a3', fixture_id: 'f1', player_id: 'p3', status: 'unavailable' }
        ])
      });
    } else if (url.includes('/transactions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 't1', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', player_id: 'p1', team_id: 'team-1', amount: 150, transaction_type: 'fee', status: 'paid', description: 'Annual Membership Fee', created_at: new Date().toISOString(), season_name: 'Winter 2026' },
          { id: 't2', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', player_id: 'p2', team_id: 'team-1', amount: 15, transaction_type: 'fee', status: 'unpaid', description: 'Match Fee vs Rangers', created_at: new Date().toISOString(), season_name: 'Winter 2026' },
          { id: 't3', club_id: 'eead69a9-d59b-45c6-8840-2fc9f3f59756', player_id: 'p3', team_id: 'team-1', amount: 150, transaction_type: 'fee', status: 'unpaid', description: 'Annual Membership Fee', created_at: new Date().toISOString(), season_name: 'Winter 2026' }
        ])
      });
    } else {
      // Fallback empty array
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    }
  });

  // PostHog event calls -> mock as empty success
  await page.route('**/e/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // 2. Navigate and populate local storage to trigger automatic authentication
  console.log('Navigating to local site...');
  await page.goto('http://localhost:3000/');

  console.log('Injecting session and configurations...');
  await page.evaluate(() => {
    // Set supabase session in localStorage
    const sessionData = {
      access_token: 'mock-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh',
      user: {
        id: '2be21ec9-e04f-4f89-abef-735f7a0f9cd1',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'ashleygpitt+sum26@gmail.com',
        email_confirmed_at: '2026-06-09T06:54:44Z',
        created_at: '2026-06-09T06:54:44Z',
        updated_at: '2026-06-09T06:54:44Z'
      },
      expires_at: 9999999999
    };
    
    localStorage.setItem('sb-jmayrdgouacskgarwltv-auth-token', JSON.stringify(sessionData));
    localStorage.setItem('supabase.auth.token', JSON.stringify(sessionData)); // backup older version
    sessionStorage.setItem('activeClubId', 'eead69a9-d59b-45c6-8840-2fc9f3f59756');
    sessionStorage.setItem('activeTab', 'gameday');
  });

  // Reload page to apply localStorage credentials
  console.log('Reloading page with active session...');
  await page.reload();

  // Wait for page to render
  await page.waitForTimeout(4000); // Allow react state to stabilize and load queries

  // Check if we are on login or dashboard
  const content = await page.content();
  if (content.includes('Continue with Email') || content.includes('Continue with Google')) {
    console.log('WARNING: Still on login screen. Attempting explicit tab/session overrides.');
  }

  // --- SCREENSHOT 1: GAMEDAY / DASHBOARD ---
  console.log('Capturing GameDay Screenshot...');
  await page.screenshot({
    path: 'C:/Users/ashle/feesplease-web/assets/screenshot_dashboard.png',
    fullPage: false
  });
  console.log('Saved dashboard screenshot.');

  // --- SCREENSHOT 2: FINANCIAL LEDGER ---
  console.log('Switching to Ledger Tab...');
  await page.evaluate(() => {
    sessionStorage.setItem('activeTab', 'ledger');
  });
  await page.reload();
  await page.waitForTimeout(3000);
  
  console.log('Capturing Ledger Screenshot...');
  await page.screenshot({
    path: 'C:/Users/ashle/feesplease-web/assets/screenshot_payments.png',
    fullPage: false
  });
  console.log('Saved ledger screenshot.');

  // --- SCREENSHOT 3: TEAM TAB ---
  console.log('Switching to Team Tab...');
  await page.evaluate(() => {
    sessionStorage.setItem('activeTab', 'team');
  });
  await page.reload();
  await page.waitForTimeout(3000);
  
  console.log('Capturing Team Screenshot...');
  await page.screenshot({
    path: 'C:/Users/ashle/feesplease-web/assets/screenshot_ai_roster.png',
    fullPage: false
  });
  console.log('Saved team screenshot.');

  console.log('Closing browser...');
  await browser.close();
  console.log('Completed successfully!');
}

run().catch(err => {
  console.error('ERROR CAPTURING SCREENSHOTS:', err);
});
