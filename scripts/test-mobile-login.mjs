import { chromium, devices } from 'playwright';

const LOCAL = process.env.TEST_URL || 'http://localhost:5000/';
const PROD = 'https://mypeer-501909.web.app/';

async function testMobileLogin(url, label) {
  const browser = await chromium.launch({ headless: true });
  const iphone = devices['iPhone 13'];
  const context = await browser.newContext({ ...iphone, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);

  const loginVisible = await page.locator('#login-view').isVisible();
  const loginBtn = page.locator('#login-btn');
  const popupPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
  await loginBtn.click();
  await popupPromise;
  await page.waitForTimeout(3000);

  const pages = context.pages();
  const allUrls = pages.map((p) => p.url()).join(' ');
  const onGoogle = /accounts\.google\.com|google\.com\/signin/i.test(allUrls);

  console.log(`\n=== ${label} ===`);
  console.log('login screen:', loginVisible);
  console.log('reached Google sign-in (popup or redirect):', onGoogle);
  console.log('urls:', pages.map((p) => p.url().slice(0, 100)).join(' | '));
  if (errors.length) console.log('console errors:', errors.slice(0, 3).join(' | '));

  await browser.close();
  return { loginVisible, onGoogle, errors };
}

const local = await testMobileLogin(LOCAL, 'Local (iPhone 13 emulation)');
let prod = { onGoogle: false, errors: ['skipped'] };
try {
  prod = await testMobileLogin(PROD, 'Production (iPhone 13 emulation)');
} catch (e) {
  console.log('\nProduction test failed:', e.message);
}

const localOk = local.onGoogle && local.loginVisible;
const prodOk = prod.onGoogle;

console.log('\n--- Summary ---');
console.log('Local mobile redirect to Google:', localOk ? 'PASS' : 'FAIL');
console.log('Production mobile redirect to Google:', prodOk ? 'PASS' : 'FAIL (may need deploy)');

if (!localOk) process.exit(1);
