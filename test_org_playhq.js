const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('response', response => {
    console.log('Response:', response.status(), response.url());
  });

  console.log('Navigating...');
  try {
    const res = await page.goto('https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428');
    console.log('HTML content length:', (await page.content()).length);
    console.log('HTML content (first 500 chars):\n', (await page.content()).substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  }
  await browser.close();
})();
