import { CONFIG, STORAGE_KEYS } from './config.js?v=7';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

let gisReadyPromise = null;

function loadGisScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (!gisReadyPromise) {
    gisReadyPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisReadyPromise = null;
        reject(new Error('โหลด Google Sign-In ไม่สำเร็จ กรุณาลองใหม่'));
      };
      document.head.appendChild(script);
    });
  }

  return gisReadyPromise;
}

async function requestAccessToken(promptMode) {
  await loadGisScript();

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') {
          reject(new Error('การล็อกอินถูกยกเลิก'));
          return;
        }
        if (error.type === 'popup_failed_to_open') {
          reject(new Error('เปิดหน้าต่างล็อกอินไม่ได้ กรุณาอนุญาต popup แล้วลองใหม่'));
          return;
        }
        reject(new Error(error.message || 'การล็อกอินล้มเหลว'));
      },
    });

    client.requestAccessToken({ prompt: promptMode });
  });
}

export function clearSession() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

async function revokeToken(token) {
  if (!token) return;
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' });
  } catch {
    // Best-effort revoke.
  }
}

export async function signOut(accessToken) {
  await revokeToken(accessToken);
  clearSession();
}

async function verifyEmail(accessToken) {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('ไม่สามารถตรวจสอบอีเมลได้');
  }

  const { email } = await response.json();
  if (!CONFIG.ALLOWED_EMAILS.includes(email)) {
    await signOut(accessToken);
    throw new Error('Access Denied: บัญชีนี้ไม่มีสิทธิ์ใช้งาน');
  }

  return email;
}

export async function startLogin() {
  const hasSession = localStorage.getItem(STORAGE_KEYS.HAS_SESSION) === '1';
  const accessToken = await requestAccessToken(hasSession ? '' : 'consent');

  await verifyEmail(accessToken);
  localStorage.setItem(STORAGE_KEYS.HAS_SESSION, '1');
  return accessToken;
}

export async function autoLogin() {
  // GIS token popups require a user gesture, so there is no silent
  // auto-login. Returning null sends the user to the login button,
  // which resolves instantly when a Google session already exists.
  return null;
}
