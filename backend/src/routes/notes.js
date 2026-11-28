import { Router } from 'express';
import { requireOwner } from '../middleware/auth.js';
import { getSpaceNotes } from '../store/notesStore.js';

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Path-scoped so this router does not 401 /spaces/.../files before filesRoutes.
router.use('/spaces/:spaceId/notes', requireOwner);

router.get(
  '/spaces/:spaceId/notes',
  asyncHandler(async (req, res) => {
    const data = await getSpaceNotes(req.params.spaceId);
    res.json(data);
  }),
);

export default router;
