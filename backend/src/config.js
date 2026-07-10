export const config = {
  port: Number(process.env.PORT) || 8080,
  allowedEmail: process.env.ALLOWED_EMAIL || 'phiraphong.yoh@gmail.com',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5000,https://p-note.web.app,https://p-note.firebaseapp.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  gcpProjectId: process.env.GCP_PROJECT_ID || 'mypoer',
};
