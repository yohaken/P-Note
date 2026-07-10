import express from 'express';
import { config } from './config.js';
import { corsMiddleware } from './middleware/cors.js';
import healthRoutes from './routes/health.js';

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.use('/api', healthRoutes);
app.get('/health', (_req, res) => {
  res.redirect(307, '/api/health');
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`P-Note API listening on port ${config.port}`);
});
