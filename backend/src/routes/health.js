import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'p-note-api',
    phase: 1,
    timestamp: new Date().toISOString(),
  });
});

router.get('/version', (_req, res) => {
  res.json({
    version: '1.0.0-phase1',
    features: ['health-check'],
    upcoming: ['firebase-auth', 'firestore-notes', 'drive-backup'],
  });
});

export default router;
