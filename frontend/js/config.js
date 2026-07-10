export const CONFIG = {
  APP_FOLDER_NAME: 'P-Note',
  NOTES_FILE_NAME: 'my_notes.json',
  AUTOSAVE_DELAY_MS: 1500,

  // Backend API (Phase 3+ — not used while login is disabled)
  API_BASE_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://p-note-api-cwpgmqlv2q-as.a.run.app',
};

/** Bump <meta name="pnote-build"> in index.html when releasing; cache-bootstrap clears stale SW. */
export const STORAGE_KEYS = {
  ACTIVE_BUILD: 'pnote_active_build',
  LOCAL_DATA: 'pnote_local_data',
  SETTINGS: 'pnote_settings',
};
