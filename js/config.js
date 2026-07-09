export const CONFIG = {
  CLIENT_ID: '470549580687-ca7vl7cechdq430510e6jc6ch3b0ptr1.apps.googleusercontent.com',
  ALLOWED_EMAIL: 'phiraphong.yoh@gmail.com',
  REDIRECT_URI: 'https://yohaken.github.io/P-Note/',
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ].join(' '),
  APP_FOLDER_NAME: 'P-Note',
  NOTES_FILE_NAME: 'my_notes.json',
  AUTOSAVE_DELAY_MS: 1500,
};

export const STORAGE_KEYS = {
  REFRESH_TOKEN: 'pnote_refresh_token',
  FILE_ID: 'pnote_file_id',
  FOLDER_ID: 'pnote_folder_id',
  MODIFIED_TIME: 'pnote_modified_time',
  PKCE_VERIFIER: 'pnote_pkce_verifier',
};
