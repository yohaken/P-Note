# ย้ายไป Firebase MyNote (`mynote-f1bbc`)

โค้ดใน repo ชี้ไปโปรเจกต์ **MyNote / mynote-f1bbc** แล้ว และตัดลิงก์ MyPeer (`mypeer-501909`) ออก

แอปใหม่: **https://mynote-f1bbc.web.app**

---

## สิ่งที่ต้องทำใน Console (ครั้งเดียว)

Agent เข้า Google account ของคุณไม่ได้ — ทำ 3 ข้อนี้บนเครื่องคุณ:

### 1) Web app config → วางใน `frontend/js/firebase.js` (ถ้าจะเทส Auth นอก Hosting)

1. เปิด https://console.firebase.google.com/project/mynote-f1bbc/settings/general  
2. เพิ่ม Web app (ถ้ายังไม่มี) → คัดลอก `apiKey`, `messagingSenderId`, `appId`  
3. วางลง `PROJECT_DEFAULTS` ใน `frontend/js/firebase.js`  
4. บน Firebase Hosting หลัง deploy ครั้งแรก `/__/firebase/init.json` จะให้ค่าเหล่านี้เอง

### 2) Service Account → อัปเดต GitHub Secret `GCP_SA_KEY`

บนเครื่องที่ login `gcloud` แล้ว:

```bash
gcloud auth login
gcloud config set project mynote-f1bbc
export GCP_PROJECT_ID=mynote-f1bbc
./scripts/setup-gcp-service-account.sh
gh secret set GCP_SA_KEY < pnote-gcp-sa-key.json --repo yohaken/P-Note
rm pnote-gcp-sa-key.json
```

Secret เดิมชี้ MyPeer — **ต้องเปลี่ยน** ไม่งั้น Actions deploy จะล้ม

### 3) Firebase Auth + Authorized domains

1. https://console.firebase.google.com/project/mynote-f1bbc/authentication/providers  
   → เปิด Google Sign-In  
2. Authentication → Settings → Authorized domains เพิ่ม:
   - `mynote-f1bbc.web.app`
   - `mynote-f1bbc.firebaseapp.com`
   - `localhost`

---

## Deploy

หลังอัปเดต `GCP_SA_KEY` แล้ว merge/push `main` → workflow `Deploy to Google Cloud` จะ:

1. สร้าง Firestore (Native) ใน `mynote-f1bbc`  
2. สร้าง GCS bucket `mynote-f1bbc-pnote-files`  
3. Deploy Cloud Run `p-note-api`  
4. Deploy Firebase Hosting (site `mynote-f1bbc`) — rewrite `/api/**` → Cloud Run

---

## ข้อมูลโน้ตเก่า (MyPeer)

Firestore ใน `mypeer-501909` **ไม่ย้ายอัตโนมัติ**

- ก่อนตัดจาก MyPeer: เปิดแอปเก่า → **สำรอง** JSON  
- เปิด https://mynote-f1bbc.web.app → **นำเข้า** JSON  
- หรือพึ่ง `localStorage` บนเครื่องเดิม (local-first) แล้วรอ sync ขึ้น DB ใหม่เมื่อ remote ว่าง

---

## สิ่งที่เลิกใช้แล้ว

| เดิม (MyPeer) | ใหม่ (MyNote) |
|---|---|
| `mypeer-501909` | `mynote-f1bbc` |
| https://mypeer-501909.web.app | https://mynote-f1bbc.web.app |
| Cloud Run URL ตรงๆ ใน `config.js` | same-origin `/api` ผ่าน Hosting rewrite |
