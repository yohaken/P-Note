import express from 'express';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { corsMiddleware, corsPublic } from './middleware/cors.js';
import healthRoutes from './routes/health.js';
import authRoutes, { clientKey } from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import filesRoutes from './routes/files.js';

const app = express();

app.set('trust proxy', 1);

const PUBLIC = new Set(['/api/health', '/api/version', '/api/db-status', '/api/auth/pin']);
app.use((req, res, next) => (PUBLIC.has(req.path) ? corsPublic : corsMiddleware)(req, res, next));
app.use(express.json({ limit: '2mb' }));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => clientKey(req),
  }),
);

app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', notesRoutes);
app.use('/api', filesRoutes);
app.get('/health', (_req, res) => {
  res.redirect(307, '/api/health');
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`P-Note API listening on port ${config.port}`);
});
// Google's front end reuses idle connections longer than Node's 5s default; closing first yields 502s.
server.keepAliveTimeout = 620 * 1000;
server.headersTimeout = 630 * 1000;
