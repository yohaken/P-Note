import { CONFIG, STORAGE_KEYS } from './config.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkcePair() {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

export function getStoredRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
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
  await revokeToken(accessToken || getStoredRefreshToken());
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
  if (email !== CONFIG.ALLOWED_EMAIL) {
    await signOut(accessToken);
    throw new Error('Access Denied: บัญชีนี้ไม่มีสิทธิ์ใช้งาน');
  }

  return email;
}

async function exchangeToken(body) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'การยืนยันตัวตนล้มเหลว');
  }

  return data;
}

export async function startLogin() {
  const { verifier, challenge } = await createPkcePair();
  localStorage.setItem(STORAGE_KEYS.PKCE_VERIFIER, verifier);

  const params = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID,
    redirect_uri: CONFIG.REDIRECT_URI,
    response_type: 'code',
    scope: CONFIG.SCOPES,
    access_type: 'offline',
    prompt: getStoredRefreshToken() ? 'select_account' : 'consent',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${AUTH_URL}?${params}`;
}

export async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    throw new Error(`การล็อกอินถูกยกเลิก: ${error}`);
  }

  if (!code) {
    return null;
  }

  const verifier = localStorage.getItem(STORAGE_KEYS.PKCE_VERIFIER);
  if (!verifier) {
    throw new Error('ไม่พบ PKCE verifier กรุณาล็อกอินใหม่');
  }

  const tokens = await exchangeToken({
    client_id: CONFIG.CLIENT_ID,
    code,
    redirect_uri: CONFIG.REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });

  localStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);

  if (tokens.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
  }

  await verifyEmail(tokens.access_token);
  window.history.replaceState({}, document.title, CONFIG.REDIRECT_URI);
  return tokens.access_token;
}

export async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const tokens = await exchangeToken({
      client_id: CONFIG.CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    await verifyEmail(tokens.access_token);
    return tokens.access_token;
  } catch {
    clearSession();
    return null;
  }
}

export async function autoLogin() {
  const callbackToken = await handleAuthCallback();
  if (callbackToken) {
    return callbackToken;
  }

  return refreshAccessToken();
}
