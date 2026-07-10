import express from 'express';
import { config } from './config.js';
import { corsMiddleware } from './middleware/cors.js';
import healthRoutes from './routes/health.js';
import notesRoutes from './routes/notes.js';

const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: '8mb' }));

app.use('/api', healthRoutes);
app.use('/api', notesRoutes);
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

app.listen(config.port, () => {
  console.log(`P-Note API listening on port ${config.port}`);
});
