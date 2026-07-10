export const CONFIG = {
  ALLOWED_EMAILS: ['phiraphong.yoh@gmail.com', 'yohaken@gmail.com'],
  APP_FOLDER_NAME: 'P-Note',
  NOTES_FILE_NAME: 'my_notes.json',
  AUTOSAVE_DELAY_MS: 1500,

  // Backend API (Phase 3+)
  API_BASE_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://p-note-api-cwpgmqlv2q-as.a.run.app',
};

export const STORAGE_KEYS = {
  FILE_ID: 'pnote_file_id',
  FOLDER_ID: 'pnote_folder_id',
  MODIFIED_TIME: 'pnote_modified_time',
};
