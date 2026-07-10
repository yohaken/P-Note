# Phase 2: Firebase Auth (ทำครั้งเดียว)

เปิด Google Sign-In ใน Firebase — แอปจะ login เอง ไม่ต้องตั้ง OAuth redirect URI เอง

## ขั้นตอน (ประมาณ 2 นาที)

1. เปิด https://console.firebase.google.com/project/mypeer-501909/authentication/providers
2. กด **Google** → เปิด **Enable** → เลือก support email → **Save**
3. เปิดแท็บ **Settings** → **Authorized domains** ตรวจว่ามี:
   - `mypeer-501909.web.app`
   - `mypeer-501909.firebaseapp.com`
   - `p-note.web.app` (ถ้าใช้โดเมนนี้)
   - `localhost` (สำหรับทดสอบในเครื่อง)

4. **มือถือ / Safari (สำคัญ):** แอปตั้ง `authDomain` ให้ตรงกับโดเมนที่เปิดอยู่ (เช่น `mypeer-501909.web.app`) เพื่อให้ `/__/auth/handler` อยู่ same-origin — ถ้ายังล็อกอินไม่ได้ ให้เพิ่ม redirect URI ใน Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web client ของ Firebase):
   - `https://mypeer-501909.web.app/__/auth/handler`
   - `https://p-note.web.app/__/auth/handler` (ถ้าใช้)

## การล็อกอินบนมือถือ

- **Desktop:** ใช้ popup (`signInWithPopup`)
- **มือถือ / PWA:** ใช้ redirect ไปหน้า Google แล้วกลับมา (`signInWithRedirect`) — popup มักถูกบล็อกบน iOS/Android
- **Session ยาว:** Firebase session เก็บใน localStorage; token Drive แคช ~55 นาที — ถ้าหมดอายุต้องกด "Sign in with Google" อีกครั้ง (ไม่เด้ง popup เองตอนเปิดแอป)

เสร็จแล้ว — เปิดลิงก์ตรงนี้ (อย่าใช้ p-note.web.app — โดเมนนั้นไม่ได้เชื่อมแล้ว):

**https://mypeer-501909.web.app/**

หรือ **https://mypeer-501909.firebaseapp.com/** (โฮสต์เดียวกัน)

## โครงสร้างหลัง Phase 2

```
คุณ → แอป (Firebase Hosting) → Firebase Auth (login)
                              → Google Drive (เก็บโน้ต)
```

Backend API ยังไม่ถูกใช้ — เก็บโน้ตตรง Drive เหมือนเดิม แต่ login ผ่าน Firebase แทน
