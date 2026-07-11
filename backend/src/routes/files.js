import { Router } from 'express';
import {
  createDownloadUrl,
  createUploadUrl,
  deleteStoredFile,
  filesEnabled,
  FILES_MAX_BYTES,
} from '../store/filesStore.js';

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get(
  '/spaces/:spaceId/files/status',
  asyncHandler(async (_req, res) => {
    res.json({
      enabled: filesEnabled(),
      maxBytes: FILES_MAX_BYTES,
    });
  }),
);

router.post(
  '/spaces/:spaceId/files/upload-url',
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await createUploadUrl({
      spaceId: req.params.spaceId,
      fileId: body.fileId,
      name: body.name,
      mimeType: body.mimeType,
      size: body.size,
    });
    res.json(result);
  }),
);

router.post(
  '/spaces/:spaceId/files/download-url',
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await createDownloadUrl({
      spaceId: req.params.spaceId,
      storagePath: body.storagePath,
    });
    res.json(result);
  }),
);

router.post(
  '/spaces/:spaceId/files/delete',
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await deleteStoredFile({
      spaceId: req.params.spaceId,
      storagePath: body.storagePath,
    });
    res.json(result);
  }),
);

export default router;
