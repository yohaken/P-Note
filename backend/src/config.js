const DEFAULT_ORIGINS = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://mypeer-501909.web.app',
  'https://mypeer-501909.firebaseapp.com',
  'https://p-note.web.app',
  'https://p-note.firebaseapp.com',
].join(',');

/** Firebase Hosting preview channels for this project's sites. */
const PREVIEW_ORIGIN_RE =
  /^https:\/\/(mypeer-501909|p-note)--[\w-]+\.(web\.app|firebaseapp\.com)$/;

export const config = {
  port: Number(process.env.PORT) || 8080,
  allowedEmail: process.env.ALLOWED_EMAIL || 'phiraphong.yoh@gmail.com',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  gcpProjectId: process.env.GCP_PROJECT_ID || 'mypeer-501909',
};

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  return PREVIEW_ORIGIN_RE.test(origin);
}
