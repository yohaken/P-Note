import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'https://mypeer-501909.web.app/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const loginBtn = page.locator('#login-btn');
console.log(`login button visible: ${await loginBtn.isVisible()}`);

await Promise.all([
  page.waitForURL(/accounts\.google\.com/, { timeout: 20000 }).catch(() => {}),
  loginBtn.click(),
]);
await page.waitForTimeout(4000);

const currentUrl = page.url();
console.log(`\nafter click, URL: ${currentUrl.slice(0, 200)}`);

const params = new URLSearchParams(currentUrl.split('?')[1] || '');
console.log(`redirect_uri param: ${params.get('redirect_uri')}`);
console.log(`client_id param: ${params.get('client_id')}`);

const bodyText = await page.locator('body').innerText().catch(() => '');
console.log(`\npage text (first 600 chars):\n${bodyText.slice(0, 600)}`);

if (/redirect_uri_mismatch|Error 400|invalid_request|ไม่ถูกต้อง|doesn.t comply/i.test(bodyText)) {
  console.log('\nRESULT: Google rejected the OAuth request');
} else if (/Sign in|ลงชื่อเข้าใช้|Choose an account|เลือกบัญชี|อีเมลหรือโทรศัพท์/i.test(bodyText)) {
  console.log('\nRESULT: Google sign-in page loaded OK');
} else {
  console.log('\nRESULT: unknown state');
}

await browser.close();
