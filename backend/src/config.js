const DEFAULT_ORIGINS = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://mynote-f1bbc.web.app',
  'https://mynote-f1bbc.firebaseapp.com',
].join(',');

/** Firebase Hosting preview channels for this project's sites. */
const PREVIEW_ORIGIN_RE =
  /^https:\/\/mynote-f1bbc--[\w-]+\.(web\.app|firebaseapp\.com)$/;

export const config = {
  port: Number(process.env.PORT) || 8080,
  allowedEmail: process.env.ALLOWED_EMAIL || 'phiraphong.yoh@gmail.com',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  gcpProjectId: process.env.GCP_PROJECT_ID || 'mynote-f1bbc',
  /** GCS bucket for full-size note attachments (empty = disabled, base64 fallback). */
  filesBucket: String(process.env.FILES_BUCKET || 'mynote-f1bbc-pnote-files').trim(),
};

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  return PREVIEW_ORIGIN_RE.test(origin);
}
