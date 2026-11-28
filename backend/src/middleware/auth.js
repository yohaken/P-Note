import { adminAuth } from '../firebaseAdmin.js';

export const OWNER_UID = 'pnote-owner';
export const OWNER_EMAIL = process.env.OWNER_EMAIL || 'yohaken@gmail.com';

export function isOwner(t) {
  return (
    t?.uid === OWNER_UID ||
    (t?.email === OWNER_EMAIL && t?.email_verified === true)
  );
}

export async function requireOwner(req, res, next) {
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.PNOTE_DEV_SKIP_AUTH === '1') {
    req.user = { uid: OWNER_UID };
    next();
    return;
  }

  const header = req.get('authorization') || '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const decoded = await adminAuth().verifyIdToken(match[1]);
    if (!isOwner(decoded)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
