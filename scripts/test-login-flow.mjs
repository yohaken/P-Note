import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'https://mypeer-501909.web.app/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    console.log(`console error: ${msg.text().slice(0, 200)}`);
  }
});

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const loginBtn = page.locator('#login-btn');
console.log(`login button visible: ${await loginBtn.isVisible()}`);

const popupPromise = context.waitForEvent('page', { timeout: 20000 }).catch(() => null);
await loginBtn.click();
const popup = await popupPromise;

if (!popup) {
  const loginError = await page.locator('#login-error').innerText().catch(() => '');
  console.log(`\nno popup opened; login-error: "${loginError}"`);
  console.log('RESULT: FAIL - sign-in popup did not open');
  await browser.close();
  process.exit(1);
}

await popup.waitForLoadState('domcontentloaded').catch(() => {});
await popup.waitForTimeout(5000);

const popupUrl = popup.url();
console.log(`\npopup URL: ${popupUrl.slice(0, 200)}`);

const popupText = await popup.locator('body').innerText().catch(() => '');
console.log(`popup text (first 500 chars):\n${popupText.slice(0, 500)}`);

if (/redirect_uri_mismatch|origin_mismatch|invalid_request|Error 400|operation-not-allowed/i.test(popupText)) {
  console.log('\nRESULT: FAIL - auth configuration error');
  await browser.close();
  process.exit(1);
}

if (/Sign in|ลงชื่อเข้าใช้|Choose an account|เลือกบัญชี|Email or phone|อีเมลหรือโทรศัพท์|continue to/i.test(popupText)) {
  console.log('\nRESULT: PASS - Firebase/Google sign-in popup loaded');
} else {
  console.log('\nRESULT: UNKNOWN - inspect popup text above');
}

await browser.close();
