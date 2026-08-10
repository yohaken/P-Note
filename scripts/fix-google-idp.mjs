/**
 * One-shot: inspect / repair Firebase Google IdP so Auth uses this project's
 * OAuth web client (not a leftover MyPeer client), and ensure the redirect URI
 * https://<project>.firebaseapp.com/__/auth/handler is accepted.
 *
 * Runs in GitHub Actions with GCP_SA_KEY (ADC).
 */
import { GoogleAuth } from 'google-auth-library';
import { execFileSync } from 'node:child_process';

const PROJECT_ID = process.env.PROJECT_ID || 'mynote-f1bbc';
const EXPECTED_REDIRECT = `https://${PROJECT_ID}.firebaseapp.com/__/auth/handler`;
const LEGACY_PREFIX = '470549580687-'; // old MyPeer project number

async function getAccessToken() {
  const auth = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
      'https://www.googleapis.com/auth/identitytoolkit',
    ],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) throw new Error('No access token from ADC');
  return token.token;
}

async function api(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function projectNumberFromClientId(clientId) {
  const m = String(clientId || '').match(/^(\d+)-/);
  return m ? m[1] : null;
}

async function main() {
  const token = await getAccessToken();
  console.log('Project:', PROJECT_ID);
  console.log('Expected redirect:', EXPECTED_REDIRECT);

  // Project number
  const proj = await api(
    token,
    'GET',
    `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}`,
  );
  console.log('CRM status', proj.status, proj.json?.projectNumber || proj.json?.error || proj.json);

  const projectNumber = String(proj.json?.projectNumber || '');

  // Current Google IdP config
  const idpUrl =
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com`;
  const current = await api(token, 'GET', idpUrl);
  console.log('Current google.com IdP:', current.status, JSON.stringify(current.json, null, 2));

  const currentClientId = current.json?.clientId || '';
  const currentNum = projectNumberFromClientId(currentClientId);
  console.log('Current client project number:', currentNum);

  // List OAuth clients via gcloud if available (helps pick the right web client)
  let candidates = [];
  try {
    const out = execFileSync(
      'gcloud',
      [
        'alpha',
        'iap',
        'oauth-clients',
        'list',
        '--project',
        PROJECT_ID,
        '--format=json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    console.log('iap oauth-clients:', out.slice(0, 500));
  } catch (err) {
    console.log('iap oauth-clients unavailable:', err?.stderr?.toString?.()?.slice(0, 200) || err.message);
  }

  // Try Google Cloud Client Auth Config (may be restricted)
  const brands = await api(
    token,
    'GET',
    `https://oauth2.googleapis.com/v1/projects/${PROJECT_ID}/brands`,
  ).catch(() => ({ ok: false, status: 0, json: null }));
  console.log('brands probe', brands.status);

  // Identity Toolkit config (authorized domains etc.)
  const cfg = await api(
    token,
    'GET',
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`,
  );
  console.log('Auth config status', cfg.status);
  if (cfg.json) {
    console.log(
      'Auth config keys',
      Object.keys(cfg.json),
      'clientId?',
      cfg.json?.client?.apiKey ? 'has apiKey' : '',
    );
  }

  // If Google IdP points at legacy MyPeer client, try to clear custom credentials
  // by PATCHing enabled:true without clientId — often rejected; then document manual fix.
  if (currentClientId.startsWith(LEGACY_PREFIX) || (projectNumber && currentNum && currentNum !== projectNumber)) {
    console.log('WARNING: Google IdP client is not from this Firebase project.');
    console.log('Attempting to re-enable Google provider without legacy client…');

    // Some projects accept omitting clientId/clientSecret to use Firebase-managed client.
    // If the API requires them, we surface a clear manual fix.
    const patchBody = {
      enabled: true,
      // Keep name if present
      name: current.json?.name,
    };

    // First try: delete IdP config then recreate enabled without custom client
    const del = await api(token, 'DELETE', idpUrl);
    console.log('DELETE google.com IdP:', del.status, JSON.stringify(del.json));

    const createUrl =
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com`;

    // Recreate with enabled only — Firebase may attach the default web client.
    let created = await api(token, 'POST', createUrl, { enabled: true });
    console.log('POST recreate (enabled only):', created.status, JSON.stringify(created.json));

    if (!created.ok) {
      // Fallback: re-PUT previous config so we don't leave Google disabled
      if (current.ok && current.json) {
        const restore = await api(token, 'POST', createUrl, {
          enabled: true,
          clientId: current.json.clientId,
          clientSecret: current.json.clientSecret,
        });
        console.log('RESTORE previous client:', restore.status, JSON.stringify(restore.json));
      }
      console.log(`
MANUAL FIX REQUIRED (2 minutes):
1. Open https://console.firebase.google.com/project/${PROJECT_ID}/authentication/providers
2. Google → Enable
3. Under "Web SDK configuration", use the Web client from project ${PROJECT_ID}
   (NOT client starting with ${LEGACY_PREFIX})
4. Or in Google Cloud Console → APIs & Services → Credentials
   open the OAuth 2.0 Web client used by Firebase and add Authorized redirect URI:
   ${EXPECTED_REDIRECT}
   and Authorized JavaScript origins:
   https://${PROJECT_ID}.firebaseapp.com
   https://${PROJECT_ID}.web.app
`);
      process.exit(2);
    }

    const after = await api(token, 'GET', idpUrl);
    console.log('After fix google.com IdP:', after.status, JSON.stringify(after.json, null, 2));
    const afterId = after.json?.clientId || '';
    if (afterId.startsWith(LEGACY_PREFIX)) {
      console.log('Still on legacy client — manual Console fix required.');
      process.exit(2);
    }
    console.log('Google IdP looks updated.');
    return;
  }

  console.log('Google IdP client already matches this project (or no legacy prefix).');
  // Ensure enabled
  if (current.ok && current.json && current.json.enabled === false) {
    const en = await api(token, 'PATCH', `${idpUrl}?updateMask=enabled`, { enabled: true });
    console.log('Enable google.com:', en.status, JSON.stringify(en.json));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
