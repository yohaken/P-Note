import { Router } from 'express';
import { pingDatabase } from '../store/notesStore.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'p-note-api',
    phase: 2,
    timestamp: new Date().toISOString(),
  });
});

router.get('/version', (_req, res) => {
  res.json({
    version: '2.0.0-phase2',
    features: ['health-check', 'firestore-notes'],
    upcoming: ['firebase-auth', 'health-calorie'],
  });
});

router.get('/db-status', async (_req, res) => {
  const status = await pingDatabase();
  res.status(status.ok ? 200 : 503).json(status);
});

export default router;
