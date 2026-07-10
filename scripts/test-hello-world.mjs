import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'https://mypeer-501909.web.app/';

async function runScenario(name, setup) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    if (setup) await setup(page);

    const visibleText = await page.locator('body').innerText();
    const loginHidden = await page.locator('#login-view').isHidden();
    const listHidden = await page.locator('#list-view').isHidden();
    const hasHello = visibleText.includes('hello world');

    console.log(`\n=== ${name} ===`);
    console.log(`login-view hidden: ${loginHidden}`);
    console.log(`list-view hidden: ${listHidden}`);
    console.log(`visible "hello world": ${hasHello}`);
    console.log(`visible text preview:\n${visibleText.slice(0, 400)}`);

    return hasHello;
  } finally {
    await browser.close();
  }
}

const scenarios = [
  {
    name: 'Fresh visitor (login screen)',
    setup: null,
  },
  {
    name: 'Logged-in user (notes list screen)',
    setup: async (page) => {
      await page.evaluate(() => {
        document.getElementById('loading-overlay').hidden = true;
        document.getElementById('login-view').hidden = true;
        document.getElementById('list-view').hidden = false;
      });
    },
  },
];

let failed = false;
for (const scenario of scenarios) {
  const ok = await runScenario(scenario.name, scenario.setup);
  if (!ok) {
    console.error(`\nFAIL: ${scenario.name}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('\nPASS: hello world visible on all user screens');
