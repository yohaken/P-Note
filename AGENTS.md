# P-Note

Personal notes PWA. Static frontend (`frontend/`) plus an Express API (`backend/`) on Cloud Run. Notes are stored server-side in **Firestore** (a cloud database) keyed by an anonymous per-device "space id" — no login yet. **Local-first:** `localStorage` is painted immediately on open; Firestore sync warms in the background.

## Cursor Cloud specific instructions

### Services

| Service | Location | Run command | Notes |
|---|---|---|---|
| Backend API | `backend/` | `cd backend && npm run dev` | Express, `node --watch`, `:8080`. Endpoints: `GET /api/health`, `/api/version`, `/api/db-status`, `GET/PUT /api/spaces/:spaceId/notes` (Firestore). For local dev, start the Firestore emulator and run with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8090` — no GCP credentials needed. Emulator: `npx firebase-tools@13 emulators:start --only firestore --project mynote-f1bbc` (Java required; a minimal `firebase.json` with `emulators.firestore.port` is enough, e.g. in a scratch dir). |
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

- **Single bump point:** `<meta name="pnote-build" content="N">` in `frontend/note.html` — also update `?v=N` on `cache-bootstrap.js`, `app.js`, `css/pnote.css`, and script tags. `frontend/index.html` only redirects to `note.html`.
- **`js/cache-bootstrap.js`** runs before modules: if `localStorage.pnote_active_build !== meta build`, it unregisters all service workers, deletes all Cache Storage, saves the new build id, and reloads once. This is the permanent in-app cache flush (not a one-off hack).
- **`js/update-watch.js`** polls the current HTML every ~20s (and when the tab becomes visible) for a newer `pnote-build`; shows a brief toast then purges caches and reloads. Polling is disabled on `localhost`.
- Notes are stored in **Firestore** (`spaces/{spaceId}` doc holds the payload). All devices use one fixed shared space (`sp-pnote-shared` in `frontend/js/remote.js`) — no sync code. On first open after the change, any previous per-device space id is merged into the shared doc once. **Local-first:** on load the app paints from `localStorage` (`pnote_local_data`) immediately, then syncs Firestore in the background (merge by per-note `updatedAt`); also soft-resyncs when the tab becomes visible / online again. Migrates local notes into the DB when the remote space is empty. Export/import JSON via **สำรอง / นำเข้า** still works.
- Production Firebase/GCP project is **MyNote** (`mynote-f1bbc`). Live app: https://mynote-f1bbc.web.app — no longer linked to MyPeer (`mypeer-501909`). Production Firestore must exist in `mynote-f1bbc` (Native mode). The deploy workflow best-effort-creates it; if the DB is missing or the Cloud Run SA lacks `roles/datastore.user`, `/api/db-status` returns 503 and the app runs offline (localStorage only). Hosting rewrites `/api/**` to Cloud Run `p-note-api` (same project).
- Home page is `note.html` with modes: งานหลัก / Note / ปฏิทิน / **แคลอรี่** (spreadsheet day log). Schedule field remains in the editor.
- **แคลอรี่** (build 160+): payload `calorie` on the shared Firestore space (v8). Day rows with meals as `kcal,protein`; derived Add cal / prot / p-rm / balance / bl-kg / bsum / %bl. Switch via dock **แคล** or mode menu.
- **Bar names (use these Thai names when talking with the user):**
  | ชื่อเรียก | คืออะไร | ที่อยู่ |
  |---|---|---|
  | **กำหนดเวลา** | จัดเรียง: ล่าสุด / ตามกำหนด / อิสระ | movable bar `data-bar="sort"` |
  | **ความสำคัญ** | กรอง: สำคัญเร่งด่วน / สำคัญ / เร่งด่วน / ทั่วไป | movable bar `data-bar="priority"` |
  | **แท็ก** | กรองตามแท็ก | movable bar `data-bar="tag"` |
  | **กลุ่มงาน** | งาน / ทำแล้ว / ถังขยะ | left drawer ☰ |
  | **แคลอรี่** | แผ่นงานแคล/โปรตีนรายวัน | mode `calorie` · `#calorie-view` |
  | **เพิ่ม** | สร้างโน้ต / เพิ่มวัน (โหมดแคล) | `#add-note-btn` |
- On empty storage, app tries **legacy localStorage recovery** and optional `./data/notes-import.json`. Settings ⚙: paste JSON import or **กู้คืนในเครื่อง**.
