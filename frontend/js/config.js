export const CONFIG = {
  APP_FOLDER_NAME: 'แคลโน้ต',
  NOTES_FILE_NAME: 'my_notes.json',
  /** Near-immediate cloud write after edits (localStorage is still sync). */
  AUTOSAVE_DELAY_MS: 280,
  EDITOR_SYNC_DELAY_MS: 450,
  UPDATE_CHECK_MS: 20000,

  /** Only this Google account may use cloud sync (also enforced in firestore.rules). */
  ALLOWED_EMAILS: ['yohaken@gmail.com'],

  // File attachments still use Cloud Run signed URLs when present.
  // Notes sync no longer uses this API — see remote.js (direct Firestore).
  API_BASE_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : '',
};

/** Bump <meta name="pnote-build"> when releasing; cache-bootstrap clears stale SW. */
export const STORAGE_KEYS = {
  ACTIVE_BUILD: 'pnote_active_build',
  LOCAL_DATA: 'pnote_local_data',
  SETTINGS: 'pnote_settings',
  /** Compact markdown memory of user note/tag habits for AI */
  USER_CONTEXT_MD: 'pnote_user_context_md',
  /** Legacy per-device space key — app now always uses SHARED_SPACE_ID. */
  SPACE_ID: 'pnote_space_id',
  /** Legacy key from removed Calorie app. */
  LEGACY_CALORIE_SPACE_ID: 'calorie_space_id',
};
