import { Router } from 'express';
import { getSpaceNotes, putSpaceNotes } from '../store/notesStore.js';

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get(
  '/spaces/:spaceId/notes',
  asyncHandler(async (req, res) => {
    const data = await getSpaceNotes(req.params.spaceId);
    res.json(data);
  }),
);

router.put(
  '/spaces/:spaceId/notes',
  asyncHandler(async (req, res) => {
    const saved = await putSpaceNotes(req.params.spaceId, req.body);
    res.json({ ok: true, updatedAt: saved.updatedAt });
  }),
);

export default router;
