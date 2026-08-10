# Phase 2: Firebase Auth (ทำครั้งเดียว)

โปรเจกต์: **pnote** — ดูคู่มือย้ายที่ [MIGRATE_TO_PNOTE.md](./MIGRATE_TO_PNOTE.md)

เปิด Google Sign-In ใน Firebase — แอปจะ login เอง ไม่ต้องตั้ง OAuth redirect URI เอง

## ขั้นตอน (ประมาณ 2 นาที)

1. เปิด https://console.firebase.google.com/project/pnote/authentication/providers
2. กด **Google** → เปิด **Enable** → เลือก support email → **Save**
3. เปิดแท็บ **Settings** → **Authorized domains** ตรวจว่ามี:
   - `pnote.web.app`
   - `pnote.firebaseapp.com`
   - `localhost` (สำหรับทดสอบในเครื่อง)

4. **มือถือ / Safari:** แอปใช้ `authDomain` = `pnote.firebaseapp.com` (โดเมน default ของ Firebase ที่ลงทะเบียน OAuth handler ไว้แล้ว) — ถ้ายังล็อกอินไม่ได้ ให้เพิ่ม redirect URI ใน Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web client ของ Firebase):
   - `https://pnote.firebaseapp.com/__/auth/handler`
   - `https://pnote.web.app/__/auth/handler` (ถ้าใช้ authDomain เป็น web.app)

## การล็อกอินบนมือถือ

- **Desktop:** ใช้ popup (`signInWithPopup`)
- **มือถือ / PWA:** ใช้ redirect ไปหน้า Google แล้วกลับมา (`signInWithRedirect`) — popup มักถูกบล็อกบน iOS/Android
- **Session ยาว:** Firebase session เก็บใน localStorage

เสร็จแล้ว — เปิด:

**https://pnote.web.app/**

หรือ **https://pnote.firebaseapp.com/** (โฮสต์เดียวกัน)
