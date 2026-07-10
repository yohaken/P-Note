# Phase 2: Firebase Auth (ทำครั้งเดียว)

เปิด Google Sign-In ใน Firebase — แอปจะ login เอง ไม่ต้องตั้ง OAuth redirect URI เอง

## ขั้นตอน (ประมาณ 2 นาที)

1. เปิด https://console.firebase.google.com/project/mypeer-501909/authentication/providers
2. กด **Google** → เปิด **Enable** → เลือก support email → **Save**
3. เปิดแท็บ **Settings** → **Authorized domains** ตรวจว่ามี:
   - `mypeer-501909.web.app`
   - `mypeer-501909.firebaseapp.com`
   - `localhost` (สำหรับทดสอบในเครื่อง)

เสร็จแล้ว — เปิด https://mypeer-501909.web.app/ กด **Sign in with Google**

## โครงสร้างหลัง Phase 2

```
คุณ → แอป (Firebase Hosting) → Firebase Auth (login)
                              → Google Drive (เก็บโน้ต)
```

Backend API ยังไม่ถูกใช้ — เก็บโน้ตตรง Drive เหมือนเดิม แต่ login ผ่าน Firebase แทน
