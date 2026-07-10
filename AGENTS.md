# P-Note

Personal notes PWA. Static frontend (`frontend/`) plus an Express API (`backend/`) on Cloud Run. Notes are stored server-side in **Firestore** (a cloud database) keyed by an anonymous per-device "space id" — no login yet. localStorage is only an offline cache.

## Cursor Cloud specific instructions

### Services

| Service | Location | Run command | Notes |
|---|---|---|---|
| Backend API | `backend/` | `cd backend && npm run dev` | Express, `node --watch`, `:8080`. Endpoints: `GET /api/health`, `/api/version`, `/api/db-status`, `GET/PUT /api/spaces/:spaceId/notes` (Firestore). For local dev, start the Firestore emulator and run with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8090` — no GCP credentials needed. Emulator: `npx firebase-tools@13 emulators:start --only firestore --project mypeer-501909` (Java required; a minimal `firebase.json` with `emulators.firestore.port` is enough, e.g. in a scratch dir). |
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
- **`js/update.js`** polls `index.html` every ~20s (and when the tab becomes visible) for a newer `pnote-build`; shows a brief toast then purges caches and reloads. Works when the PWA shortcut stays open in the background. Manual **↻** FAB bottom-right calls the same refresh path. Polling is disabled on `localhost`.
- **`js/cache.js`** registers `sw.js?v=N` after bootstrap. Login is disabled for now — no auth modules loaded.
- Notes are stored in **Firestore** (`spaces/{spaceId}` doc holds the v4 payload). `frontend/js/remote.js` handles the anonymous `pnote_space_id` (sync code, settable in Settings ⚙ to share a space across devices — no login). `localStorage` (`pnote_local_data`) is only an offline cache; on load the app fetches remote, and migrates existing local notes into the DB when the remote space is empty. Export/import JSON via **สำรอง / นำเข้า** still works.
- Production Firestore must exist in project `mypeer-501909` (Native mode). The deploy workflow best-effort-creates it; if the DB is missing or the Cloud Run SA lacks `roles/datastore.user`, `/api/db-status` returns 503 and the app runs offline (localStorage only).
- Home page is **notes-first** (no calendar on list view; schedule field remains in editor).
- **Bar names (use these Thai names when talking with the user):**
  | ชื่อเรียก | คืออะไร | ที่อยู่ |
  |---|---|---|
  | **กำหนดเวลา** | จัดเรียง: ล่าสุด / ตามกำหนด / อิสระ | movable bar `data-bar="sort"` |
  | **ความสำคัญ** | กรอง: สำคัญเร่งด่วน / สำคัญ / เร่งด่วน / ทั่วไป | movable bar `data-bar="priority"` |
  | **แท็ก** | กรองตามแท็ก | movable bar `data-bar="tag"` |
  | **กลุ่มงาน** | งาน / ทำแล้ว / ถังขยะ | left drawer ☰ |
- On empty storage, app tries **legacy localStorage recovery** and optional `./data/notes-import.json`. Settings ⚙: paste JSON import or **กู้คืนในเครื่อง**.
