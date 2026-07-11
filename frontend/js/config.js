export const CONFIG = {
  APP_FOLDER_NAME: 'P-Note',
  NOTES_FILE_NAME: 'my_notes.json',
  AUTOSAVE_DELAY_MS: 2000,
  EDITOR_SYNC_DELAY_MS: 450,
  UPDATE_CHECK_MS: 20000,

  // Backend API (Phase 3+ — not used while login is disabled)
  API_BASE_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://p-note-api-cwpgmqlv2q-as.a.run.app',
};

/** Bump <meta name="pnote-build"> when releasing; cache-bootstrap clears stale SW. */
export const STORAGE_KEYS = {
  ACTIVE_BUILD: 'pnote_active_build',
  LOCAL_DATA: 'pnote_local_data',
  SETTINGS: 'pnote_settings',
  /** Compact markdown memory of user note/tag habits for AI */
  USER_CONTEXT_MD: 'pnote_user_context_md',
  /** Shared sync code for Calorie + Note (one DB space). */
  SPACE_ID: 'pnote_space_id',
  /** Legacy calorie-only key — migrated into SPACE_ID. */
  LEGACY_CALORIE_SPACE_ID: 'calorie_space_id',
};
