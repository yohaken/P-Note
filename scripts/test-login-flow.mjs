import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'https://mypeer-501909.web.app/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.locator('#login-btn').click();
await page.waitForTimeout(6000);

const pages = context.pages();
const pageTexts = [];
for (const [i, p] of pages.entries()) {
  const text = await p.locator('body').innerText().catch(() => '');
  pageTexts.push(text);
  console.log(`\n--- page ${i} url: ${p.url().slice(0, 180)}`);
  console.log(text.slice(0, 400));
}

const loginError = await page.locator('#login-error').innerText().catch(() => '');
const allText = pageTexts.join('\n');

console.log(`\nlogin-error: "${loginError}"`);
if (consoleErrors.length) {
  console.log(`console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
}

const configError = /configuration-not-found|operation-not-allowed|redirect_uri_mismatch|origin_mismatch|invalid_request|Error 400/i.test(allText + loginError);
const popupOk = pageTexts.some((text) => /Choose an account|Email or phone|continue to/i.test(text));

if (configError) {
  console.log('\nRESULT: FAIL - auth not configured (enable Google in Firebase Console)');
  process.exit(1);
}
if (popupOk) {
  console.log('\nRESULT: PASS - sign-in popup loaded');
  process.exit(0);
}

console.log('\nRESULT: FAIL - could not reach sign-in UI');
process.exit(1);
