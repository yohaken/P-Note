# ย้ายไป Firebase `pnote`

โค้ดใน repo ชี้ไปโปรเจกต์ **pnote** แล้ว และตัดลิงก์ MyNote (`mynote-f1bbc`) / MyPeer ออกจากค่า default

แอปใหม่: **https://pnote.web.app**

---

## สิ่งที่ต้องทำใน Console (ครั้งเดียว)

Agent เข้า Google account ของคุณไม่ได้ — ทำ 3 ข้อนี้บนเครื่องคุณ:

### 1) Web app config → วางใน `frontend/js/firebase.js` (ถ้าจะเทส Auth นอก Hosting)

1. เปิด https://console.firebase.google.com/project/pnote/settings/general  
2. เพิ่ม Web app (ถ้ายังไม่มี) → คัดลอก `apiKey`, `messagingSenderId`, `appId`  
3. วางลง `PROJECT_DEFAULTS` ใน `frontend/js/firebase.js`  
4. บน Firebase Hosting หลัง deploy ครั้งแรก `/__/firebase/init.json` จะให้ค่าเหล่านี้เอง

### 2) Service Account → อัปเดต GitHub Secret `GCP_SA_KEY`

บนเครื่องที่ login `gcloud` แล้ว:

```bash
gcloud auth login
gcloud config set project pnote
export GCP_PROJECT_ID=pnote
./scripts/setup-gcp-service-account.sh
gh secret set GCP_SA_KEY < pnote-gcp-sa-key.json --repo yohaken/P-Note
rm pnote-gcp-sa-key.json
```

Secret เดิมชี้ MyNote — **ต้องเปลี่ยน** ไม่งั้น Actions deploy จะล้ม

### 3) Firebase Auth + Authorized domains

1. https://console.firebase.google.com/project/pnote/authentication/providers  
   → เปิด Google Sign-In  
2. Authentication → Settings → Authorized domains เพิ่ม:
   - `pnote.web.app`
   - `pnote.firebaseapp.com`
   - `localhost`

---

## Deploy

หลังอัปเดต `GCP_SA_KEY` แล้ว merge/push `main` → workflow `Deploy to Google Cloud` จะ:

1. สร้าง Firestore (Native) ใน `pnote`  
2. สร้าง GCS bucket `pnote-pnote-files`  
3. Deploy Cloud Run `p-note-api`  
4. Deploy Firebase Hosting (site `pnote`) — rewrite `/api/**` → Cloud Run

---

## ข้อมูลโน้ตเก่า (MyNote / MyPeer)

Firestore ในโปรเจกต์เก่ **ไม่ย้ายอัตโนมัติ**

- ก่อนตัดจากแอปเก่า: เปิดแอป → **สำรอง** JSON  
- เปิด https://pnote.web.app → **นำเข้า** JSON  
- หรือพึ่ง `localStorage` บนเครื่องเดิม (local-first) แล้วรอ sync ขึ้น DB ใหม่เมื่อ remote ว่าง

---

## สิ่งที่เลิกใช้แล้ว

| เดิม | ใหม่ |
|---|---|
| `mynote-f1bbc` (MyNote) | `pnote` |
| https://mynote-f1bbc.web.app | https://pnote.web.app |
