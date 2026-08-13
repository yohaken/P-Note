# Phase 2: Firebase Auth (ทำครั้งเดียว)

โปรเจกต์: **MyNote** (`mynote-f1bbc`) — ดูคู่มือย้ายจาก MyPeer ที่ [MIGRATE_TO_MYNOTE.md](./MIGRATE_TO_MYNOTE.md)

เปิด Google Sign-In ใน Firebase — แอปจะ login เอง ไม่ต้องตั้ง OAuth redirect URI เอง

## ขั้นตอน (ประมาณ 2 นาที)

1. เปิด https://console.firebase.google.com/project/mynote-f1bbc/authentication/providers
2. กด **Google** → เปิด **Enable** → เลือก support email → **Save**
3. เปิดแท็บ **Settings** → **Authorized domains** ตรวจว่ามี:
   - `mynote-f1bbc.web.app`
   - `mynote-f1bbc.firebaseapp.com`
   - `localhost` (สำหรับทดสอบในเครื่อง)

4. **ถ้าขึ้น Error 400: `redirect_uri_mismatch`:**  
   Firebase Google Sign-In ของ MyNote ยังชี้ OAuth client เก่าจาก MyPeer (`470549580687-…`) ซึ่งรับแค่  
   `https://mypeer-501909.firebaseapp.com/__/auth/handler`  

   แก้แบบเร็ว (แนะนำ): เปิด Google Cloud Console ของโปรเจกต์ที่ถือ client นั้น (มักเป็น **mypeer-501909**) →  
   **APIs & Services → Credentials → OAuth 2.0 Client ID** ตัวที่ลงท้าย `…ehmr3mviof4enc4accjpgeooqqqibeak` → เพิ่ม:

   - Authorized redirect URIs: `https://mynote-f1bbc.firebaseapp.com/__/auth/handler`
   - Authorized JavaScript origins: `https://mynote-f1bbc.web.app` และ `https://mynote-f1bbc.firebaseapp.com`

   หรือแก้แบบสะอาด: ใน Firebase **mynote-f1bbc** → Authentication → Sign-in method → Google →  
   Web SDK configuration ให้ใช้ Web client ของโปรเจกต์ **mynote-f1bbc** เอง (ไม่ใช่ client ที่ขึ้นต้น `470549580687-`)

5. **มือถือ / Safari:** แอปใช้ `authDomain` = `mynote-f1bbc.firebaseapp.com` — ต้องมี redirect URI ตามข้อ 4

## การล็อกอินบนมือถือ

- **Desktop:** ใช้ popup (`signInWithPopup`)
- **มือถือ / PWA:** ใช้ redirect ไปหน้า Google แล้วกลับมา (`signInWithRedirect`) — popup มักถูกบล็อกบน iOS/Android
- **Session ยาว:** Firebase session เก็บใน localStorage

เสร็จแล้ว — เปิด:

**https://mynote-f1bbc.web.app/**

หรือ **https://mynote-f1bbc.firebaseapp.com/** (โฮสต์เดียวกัน)
