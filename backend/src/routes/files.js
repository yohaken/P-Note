import { promises as fs } from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import {
  createDownloadUrl,
  createMusclePhotoUploadUrl,
  createUploadUrl,
  deleteStoredFile,
  filesEnabled,
  FILES_MAX_BYTES,
  listMusclePhotos,
  localFilePath,
  MUSCLE_PHOTO_MAX_BYTES,
} from '../store/filesStore.js';

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Origin of this API as the browser reached it (only used to build local-dev file URLs). */
function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
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
      baseUrl: baseUrl(req),
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
      baseUrl: baseUrl(req),
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

router.get(
  '/spaces/:spaceId/muscle-photos',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await listMusclePhotos({ spaceId: req.params.spaceId }));
  }),
);

router.post(
  '/spaces/:spaceId/muscle-photos/upload-url',
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await createMusclePhotoUploadUrl({
      spaceId: req.params.spaceId,
      rowId: body.rowId,
      date: body.date,
      size: body.size,
      baseUrl: baseUrl(req),
    });
    res.json({ ...result, maxBytes: MUSCLE_PHOTO_MAX_BYTES });
  }),
);

/* Local dev only (FILES_LOCAL_DIR): stand-in for the signed GCS URLs. */
router.put(
  '/local-files/*',
  express.raw({ type: () => true, limit: FILES_MAX_BYTES }),
  asyncHandler(async (req, res) => {
    const file = localFilePath(req.params[0]);
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, req.body);
    res.status(200).end();
  }),
);

router.get(
  '/local-files/*',
  asyncHandler(async (req, res) => {
    const file = localFilePath(req.params[0]);
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.sendFile(file, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Not found' });
    });
  }),
);

export default router;
