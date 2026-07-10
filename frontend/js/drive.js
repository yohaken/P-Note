import { CONFIG, STORAGE_KEYS } from './config.js?v=39';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function driveRequest(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(accessToken),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // Token expired/revoked — drop it so the next load re-authenticates.
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Drive API error (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function folderQuery() {
  const q = [
    `name='${CONFIG.APP_FOLDER_NAME}'`,
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
  ].join(' and ');
  return `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
}

function fileQuery(folderId) {
  const q = [
    `name='${CONFIG.NOTES_FILE_NAME}'`,
    `'${folderId}' in parents`,
    'trashed=false',
  ].join(' and ');
  return `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&spaces=drive`;
}

async function ensureAppFolder(accessToken) {
  const cached = localStorage.getItem(STORAGE_KEYS.FOLDER_ID);
  if (cached) {
    return cached;
  }

  const result = await driveRequest(accessToken, folderQuery());
  if (result.files?.length) {
    const folderId = result.files[0].id;
    localStorage.setItem(STORAGE_KEYS.FOLDER_ID, folderId);
    return folderId;
  }

  const created = await driveRequest(accessToken, `${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: CONFIG.APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  localStorage.setItem(STORAGE_KEYS.FOLDER_ID, created.id);
  return created.id;
}

async function findNotesFile(accessToken, folderId) {
  const result = await driveRequest(accessToken, fileQuery(folderId));
  return result.files?.[0] || null;
}

function emptyNotesPayload() {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    tags: [],
    notes: [],
  };
}

async function createNotesFile(accessToken, folderId) {
  const metadata = {
    name: CONFIG.NOTES_FILE_NAME,
    parents: [folderId],
    mimeType: 'application/json',
  };
  const content = JSON.stringify(emptyNotesPayload(), null, 2);

  const boundary = `pnote_${Date.now()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const created = await driveRequest(
    accessToken,
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );

  localStorage.setItem(STORAGE_KEYS.FILE_ID, created.id);
  localStorage.setItem(STORAGE_KEYS.MODIFIED_TIME, created.modifiedTime);
  return { fileId: created.id, modifiedTime: created.modifiedTime, data: emptyNotesPayload() };
}

export async function getFileMetadata(accessToken, fileId) {
  return driveRequest(
    accessToken,
    `${DRIVE_API}/files/${fileId}?fields=id,modifiedTime,name`,
  );
}

export async function loadNotes(accessToken) {
  const folderId = await ensureAppFolder(accessToken);
  let fileId = localStorage.getItem(STORAGE_KEYS.FILE_ID);
  let fileMeta = null;

  if (fileId) {
    try {
      fileMeta = await getFileMetadata(accessToken, fileId);
    } catch {
      fileId = null;
      localStorage.removeItem(STORAGE_KEYS.FILE_ID);
    }
  }

  if (!fileId) {
    const found = await findNotesFile(accessToken, folderId);
    if (!found) {
      return createNotesFile(accessToken, folderId);
    }
    fileId = found.id;
    fileMeta = found;
    localStorage.setItem(STORAGE_KEYS.FILE_ID, fileId);
  }

  const raw = await driveRequest(
    accessToken,
    `${DRIVE_API}/files/${fileId}?alt=media`,
  );

  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    data = emptyNotesPayload();
  }

  if (!Array.isArray(data.notes)) {
    data = emptyNotesPayload();
  }

  const modifiedTime = fileMeta?.modifiedTime || new Date().toISOString();
  localStorage.setItem(STORAGE_KEYS.MODIFIED_TIME, modifiedTime);

  return { fileId, modifiedTime, data };
}

export async function saveNotes(accessToken, fileId, notesData, knownModifiedTime) {
  const remote = await getFileMetadata(accessToken, fileId);

  if (knownModifiedTime && remote.modifiedTime !== knownModifiedTime) {
    const conflictError = new Error('ข้อมูลบน Drive ถูกแก้ไขจากที่อื่น');
    conflictError.name = 'ConflictError';
    conflictError.remoteModifiedTime = remote.modifiedTime;
    throw conflictError;
  }

  notesData.updatedAt = new Date().toISOString();
  const content = JSON.stringify(notesData, null, 2);

  const updated = await driveRequest(
    accessToken,
    `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media&fields=id,modifiedTime`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: content,
    },
  );

  localStorage.setItem(STORAGE_KEYS.MODIFIED_TIME, updated.modifiedTime);
  return updated.modifiedTime;
}
