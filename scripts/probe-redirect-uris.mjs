import { chromium } from 'playwright';

const CLIENT_ID = '470549580687-ca7vl7cechdq430510e6jc6ch3b0ptr1.apps.googleusercontent.com';
const CANDIDATES = [
  'https://yohaken.github.io/P-Note/frontend/',
  'https://yohaken.github.io/P-Note/',
  'https://mypeer-501909.web.app/',
  'https://mypeer-501909.web.app',
  'https://mypeer-501909.firebaseapp.com/',
  'https://p-note.web.app/',
  'http://localhost:8080/',
  'http://localhost:3000/',
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const uri of CANDIDATES) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: uri,
    response_type: 'code',
    scope: 'openid',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  });

  await page.goto(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  await page.waitForTimeout(1500);

  const text = await page.locator('body').innerText().catch(() => '');
  const url = page.url();

  let status;
  if (/redirect_uri_mismatch/i.test(text) || /redirect_uri_mismatch/i.test(url)) {
    status = 'MISMATCH';
  } else if (/invalid_client|unauthorized_client|deleted_client/i.test(text + url)) {
    status = 'BAD CLIENT';
  } else if (/disabled_client|access_denied|admin/i.test(text + url)) {
    status = 'BLOCKED';
  } else {
    status = 'ACCEPTED (sign-in page shown)';
  }

  console.log(`${status.padEnd(30)} ${uri}`);
}

await browser.close();
