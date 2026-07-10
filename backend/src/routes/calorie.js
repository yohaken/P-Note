import { Router } from 'express';
import { getSpaceCalorie, putSpaceCalorie } from '../store/calorieStore.js';

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get(
  '/spaces/:spaceId/calorie',
  asyncHandler(async (req, res) => {
    const data = await getSpaceCalorie(req.params.spaceId);
    res.json(data);
  }),
);

router.put(
  '/spaces/:spaceId/calorie',
  asyncHandler(async (req, res) => {
    const saved = await putSpaceCalorie(req.params.spaceId, req.body);
    res.json({ ok: true, updatedAt: saved.updatedAt });
  }),
);

export default router;
