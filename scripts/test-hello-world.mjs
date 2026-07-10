import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'https://mypeer-501909.web.app/';

async function runScenario(name, options = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    serviceWorkers: options.allowServiceWorker ? 'allow' : 'block',
  });
  const page = await context.newPage();

  try {
    if (options.seedOldCache) {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(async () => {
        const cache = await caches.open('pnote-v2');
        const oldHtml = `<!DOCTYPE html><html><body><h1>OLD VERSION</h1></body></html>`;
        await cache.put(
          location.origin + location.pathname,
          new Response(oldHtml, { headers: { 'Content-Type': 'text/html' } }),
        );
      });
    }

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(options.allowServiceWorker ? 5000 : 2000);

    if (options.setup) {
      await options.setup(page);
    }

    const bannerVisible = await page.locator('#hello-world-banner').isVisible();
    const bannerText = bannerVisible
      ? await page.locator('#hello-world-banner').innerText()
      : '';
    const bodyText = await page.locator('body').innerText();
    const hasHello = bannerText.includes('hello world') || bodyText.includes('hello world');

    console.log(`\n=== ${name} ===`);
    console.log(`banner visible: ${bannerVisible}`);
    console.log(`banner text: ${bannerText}`);
    console.log(`visible "hello world": ${hasHello}`);
    console.log(`preview:\n${bodyText.slice(0, 350)}`);

    return hasHello;
  } finally {
    await browser.close();
  }
}

const scenarios = [
  { name: 'Fresh visitor' },
  {
    name: 'Logged-in user (notes list)',
    setup: async (page) => {
      await page.evaluate(() => {
        document.getElementById('loading-overlay').hidden = true;
        document.getElementById('login-view').hidden = true;
        document.getElementById('list-view').hidden = false;
      });
    },
  },
  {
    name: 'Returning visitor with old service worker cache',
    allowServiceWorker: true,
    seedOldCache: true,
  },
];

let failed = false;
for (const scenario of scenarios) {
  const ok = await runScenario(scenario.name, scenario);
  if (!ok) {
    console.error(`\nFAIL: ${scenario.name}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('\nPASS: hello world visible in all scenarios');
