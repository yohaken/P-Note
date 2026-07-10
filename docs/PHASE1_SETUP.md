# Phase 1: Foundation Setup

คู่มือตั้งค่า Google Cloud + Firebase + GitHub สำหรับ P-Note

## ลิงก์คงที่หลัง deploy

| ส่วน | URL |
|------|-----|
| แอป (ผู้ใช้) | `https://p-note.web.app` |
| แอป (สำรอง) | `https://p-note.firebaseapp.com` |
| API | `https://p-note-api-<hash>.asia-southeast1.run.app` |
| โค้ด | `https://github.com/yohaken/P-Note` |

---

## ขั้นที่ 1: Firebase Project

1. เปิด https://console.firebase.google.com
2. **Add project** → เลือก GCP project **mypoer** (หรือสร้างใหม่)
3. เปิด **Hosting** → **Get started**
4. ตั้งชื่อ site: `p-note` → ได้ URL `p-note.web.app`

---

## ขั้นที่ 2: Enable APIs

ใน [Google Cloud Console](https://console.cloud.google.com/apis/library) เปิด:

- Cloud Run API
- Cloud Build API
- Artifact Registry API
- Firebase Hosting API
- Firestore API (เตรียม Phase 3)
- Google Drive API (มีอยู่แล้ว)

---

## ขั้นที่ 3: Artifact Registry

```bash
gcloud artifacts repositories create p-note \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="P-Note Docker images"
```

---

## ขั้นที่ 4: Deploy Backend (Cloud Run)

```bash
cd backend
gcloud run deploy p-note-api \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --max-instances 1 \
  --min-instances 0 \
  --memory 256Mi \
  --set-env-vars ALLOWED_EMAIL=phiraphong.yoh@gmail.com
```

ทดสอบ:

```bash
curl https://p-note-api-XXXX.asia-southeast1.run.app/api/health
```

---

## ขั้นที่ 5: Deploy Frontend (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase use mypoer
firebase deploy --only hosting
```

เปิด `https://p-note.web.app`

---

## ขั้นที่ 6: เชื่อม GitHub → Cloud Build

1. Cloud Console → **Cloud Build** → **Repositories**
2. **Connect repository** → เลือก GitHub → `yohaken/P-Note`
3. สร้าง **Trigger**:
   - Branch: `^main$`
   - Config: `infra/cloudbuild.yaml`

หลัง push ขึ้น `main` → backend deploy อัตโนมัติ

---

## ขั้นที่ 7: อัปเดต OAuth Redirect URIs

ใน [Google Auth Platform → Clients](https://console.cloud.google.com/apis/credentials) เพิ่ม:

| ช่อง | URL |
|------|-----|
| JavaScript origins | `https://p-note.web.app` |
| JavaScript origins | `https://p-note.firebaseapp.com` |
| Redirect URIs | `https://p-note.web.app/` |
| Redirect URIs | `https://p-note.firebaseapp.com/` |

(เก็บ GitHub Pages URLs เดิมไว้ระหว่าง transition)

---

## ขั้นที่ 8: Budget Alert (แนะนำ)

Cloud Console → **Billing** → **Budgets & alerts**

- ตั้ง budget: **$1/เดือน**
- แจ้งเตือนที่ 50%, 90%, 100%

---

## ทดสอบ Phase 1

- [ ] `https://p-note.web.app` เปิดได้
- [ ] `/api/health` บน Cloud Run ตอบ `{"status":"ok"}`
- [ ] Push ขึ้น GitHub → Cloud Build trigger ทำงาน
- [ ] แอปเดิม (ล็อกอิน Google) ยังใช้ได้บน Firebase Hosting

---

## Phase ถัดไป

- **Phase 2**: Firebase Auth + API CRUD โน้ต
- **Phase 3**: Firestore + Drive backup
- **Phase 4**: ปรับ frontend เรียก API
- **Phase 5**: CI/CD เต็มรูปแบบ + ปิด GitHub Pages
