import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'https://mypeer-501909.web.app/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`console error: ${msg.text().slice(0, 200)}`);
});

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const loginBtn = page.locator('#login-btn');
console.log(`login button visible: ${await loginBtn.isVisible()}`);

const popupPromise = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);
await loginBtn.click();
const popup = await popupPromise;

if (!popup) {
  await page.waitForTimeout(2000);
  const loginError = await page.locator('#login-error').innerText().catch(() => '');
  console.log(`\nno popup opened; login-error text: "${loginError}"`);
  console.log('RESULT: FAIL - Google sign-in popup did not open');
  await browser.close();
  process.exit(1);
}

await popup.waitForLoadState('domcontentloaded').catch(() => {});
await popup.waitForTimeout(4000);

const popupUrl = popup.url();
console.log(`\npopup URL: ${popupUrl.slice(0, 180)}`);

const popupText = await popup.locator('body').innerText().catch(() => '');
console.log(`popup text (first 500 chars):\n${popupText.slice(0, 500)}`);

if (/redirect_uri_mismatch|invalid_request|Error 400|invalid_client|origin_mismatch|doesn.t comply/i.test(popupText)) {
  console.log('\nRESULT: FAIL - Google rejected the OAuth request');
  await browser.close();
  process.exit(1);
}

if (/Sign in|ลงชื่อเข้าใช้|Choose an account|เลือกบัญชี|Email or phone|อีเมลหรือโทรศัพท์/i.test(popupText)) {
  console.log('\nRESULT: PASS - Google sign-in popup loaded, user can log in');
} else {
  console.log('\nRESULT: UNKNOWN - inspect popup text above');
}

await browser.close();
