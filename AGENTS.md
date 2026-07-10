# P-Note

Personal notes PWA. Static frontend (`frontend/`) synced to Google Drive via Firebase Auth, plus a small Express API (`backend/`) deployed to Cloud Run.

## Cursor Cloud specific instructions

### Services

| Service | Location | Run command | Notes |
|---|---|---|---|
| Backend API | `backend/` | `cd backend && npm run dev` | Express, `node --watch`, listens on `:8080`. Health: `GET /api/health`, also `GET /api/version`. Uses `.env` (copy from `backend/.env.example`); all vars have sensible defaults so it runs without `.env`. |
| Frontend PWA | `frontend/` | serve statically on port 5000, e.g. `python3 -m http.server 5000` (run from `frontend/`) | No build step — plain static ES modules. |

### Non-obvious caveats

- The frontend MUST be accessed via the `localhost` hostname. `frontend/js/config.js` only points the app at the local backend (`http://localhost:8080`) when `location.hostname === 'localhost'`; otherwise it targets the deployed Cloud Run URL. Port `5000` is already in the backend's allowed CORS origins.
- Firebase config falls back to a hardcoded config in `frontend/js/firebase.js` when `/__/firebase/init.json` 404s (i.e. when not served by Firebase Hosting), so local static serving works.
- The full note-taking flow requires a real Google sign-in (Firebase Auth + `drive.file` scope) restricted to the emails in `frontend/js/config.js` (`ALLOWED_EMAILS`). Clicking "Sign in with Google" launches the real Google OAuth popup, but completing login/notes sync needs a real allowed Google account — it cannot be exercised headlessly without credentials.

### Lint / test / build

- No linter and no unit-test framework are configured. `backend/package.json` only has `start`/`dev`; there is no `npm test`.
- The only automated tests are Playwright scripts: `scripts/test-hello-world.mjs` (verifies the "hello world" banner across visitor states) and `scripts/test-login-flow.mjs` (verifies the Google sign-in popup loads). They default to the deployed site; set `TEST_URL=http://localhost:5000/` to run against the local frontend. They need Playwright installed with a Chromium browser; because `scripts/` has no `package.json`, Node resolves `playwright` from a parent `node_modules`.
- The frontend "build" for production is just `firebase deploy --only hosting`; there is nothing to compile locally.

### Frontend caching (built into app)

- **Single bump point:** `<meta name="pnote-build" content="N">` in `frontend/index.html` — also update `?v=N` on `cache-bootstrap.js`, `app.js`, `css/style.css`, all `./js/*.js?v=N` imports, and `CACHE_NAME` in `frontend/sw.js` (`pnote-vN`).
- **`js/cache-bootstrap.js`** runs before modules: if `localStorage.pnote_active_build !== meta build`, it unregisters all service workers, deletes all Cache Storage, saves the new build id, and reloads once. This is the permanent in-app cache flush (not a one-off hack).
- **`js/cache.js`** registers `sw.js?v=N` after bootstrap. Login is disabled for now — no auth modules loaded.
- Notes live in `localStorage` key `pnote_local_data` (v2 schema with tags). Export/import JSON via **สำรอง / นำเข้า** in the header.
