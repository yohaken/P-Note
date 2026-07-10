# P-Note

โน้ตส่วนตัว — Frontend + Backend บน Google Cloud

## ลิงก์

| | URL |
|---|-----|
| **แอป (prod)** | https://p-note.web.app |
| **Preview (dev)** | push branch `dev` → ดู URL ใน Actions |
| **GitHub** | https://github.com/yohaken/P-Note |
| **API Health** | `GET /api/health` |

คู่มือพัฒนา + ใช้จริงนอกสถานที่: **[docs/DEV_PREVIEW.md](docs/DEV_PREVIEW.md)**

## สถาปัตยกรรม

```
GitHub main → Actions → Cloud Run (API) + Firebase Hosting (prod)
GitHub dev  → Actions → Firebase Hosting preview (API/DB ชุดเดียวกับ prod)
                              ↓
                         Firestore
```

## โครงสร้าง Repo

```
P-Note/
├── frontend/          # PWA หน้าบ้าน
│   ├── index.html
│   ├── css/
│   ├── js/
│   ├── manifest.json
│   └── sw.js
├── backend/           # Cloud Run API
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── infra/             # Cloud Build configs
│   ├── cloudbuild.yaml
│   └── cloudbuild-full.yaml
├── docs/
│   └── PHASE1_SETUP.md
├── firebase.json
└── .firebaserc
```

## Phase 1 — Foundation (ปัจจุบัน)

- [x] แยก frontend / backend / infra
- [x] Backend skeleton (health check)
- [x] Firebase Hosting config
- [x] Cloud Build config
- [ ] Deploy ขึ้น Google Cloud (ทำตามคู่มือ)

### เริ่มต้น

- ตั้งค่า Google Cloud: **[docs/PHASE1_SETUP.md](docs/PHASE1_SETUP.md)**
- **เชื่อม API อัตโนมัติ:** **[docs/GOOGLE_API_AUTOMATION.md](docs/GOOGLE_API_AUTOMATION.md)** ← อ่านนี้เพื่อให้ deploy อัตโนมัติ

### รัน Backend ในเครื่อง

```bash
cd backend
cp .env.example .env
npm install
npm run dev
# ทดสอบ: curl http://localhost:8080/api/health
```

### Deploy Frontend

```bash
firebase login
firebase deploy --only hosting
```

## Roadmap

| Phase | เนื้อหา | สถานะ |
|-------|---------|--------|
| 1 | Foundation — โครงสร้าง + config | กำลังทำ |
| 2 | Backend API + Firebase Auth | ถัดไป |
| 3 | Firestore + Drive backup | วางแผนแล้ว |
| 4 | Frontend refactor | วางแผนแล้ว |
| 5 | CI/CD + Production | วางแผนแล้ว |

## ค่าใช้จ่าย

ฟรีทั้งหมดสำหรับ personal use (Firebase Hosting, Cloud Run, Firestore free tier)
