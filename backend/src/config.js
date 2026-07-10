export const config = {
  port: Number(process.env.PORT) || 8080,
  allowedEmail: process.env.ALLOWED_EMAIL || 'phiraphong.yoh@gmail.com',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5000,http://127.0.0.1:5000,https://mypeer-501909.web.app,https://mypeer-501909.firebaseapp.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  gcpProjectId: process.env.GCP_PROJECT_ID || 'mypeer-501909',
};
