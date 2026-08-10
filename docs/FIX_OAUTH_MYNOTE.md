# แก้ redirect_uri_mismatch บน MyNote (กดตามนี้)

คุณเปิดถูกโปรเจกต์ **mynote-f1bbc** แล้ว แต่ยังไม่มี OAuth Client  
และยังไม่ได้ตั้ง **OAuth consent screen** — เลยยังสร้าง client ไม่ได้

## ขั้นที่ 1 — Configure consent screen

1. ในหน้า Credentials จะมีแถบเหลือง  
2. กดปุ่ม **Configure consent screen** (ด้านขวาของแถบเหลือง)  
3. เลือก **External** → **Create**  
4. App name: `P-Note`  
   User support email: อีเมลคุณ  
   Developer contact: `yohaken@gmail.com`  
5. Save and continue จนจบ (Scopes ข้ามได้, Test users เพิ่ม `yohaken@gmail.com` ถ้าถาม)

## ขั้นที่ 2 — สร้าง OAuth Web Client

1. กลับหน้า [Credentials](https://console.cloud.google.com/apis/credentials?project=mynote-f1bbc)  
2. กด **+ Create credentials** (มุมบน)  
3. เลือก **OAuth client ID**  
4. Application type: **Web application**  
5. Name: `P-Note Web`  
6. **Authorized JavaScript origins** เพิ่ม:
   - `https://mynote-f1bbc.web.app`
   - `https://mynote-f1bbc.firebaseapp.com`
   - `http://localhost:5000` (ถ้าจะเทสเครื่อง)
7. **Authorized redirect URIs** เพิ่ม:
   - `https://mynote-f1bbc.firebaseapp.com/__/auth/handler`
   - `https://mynote-f1bbc.web.app/__/auth/handler`
8. **Create** → คัดลอก **Client ID** และ **Client secret**

## ขั้นที่ 3 — ใส่ใน Firebase Auth

1. เปิด [Firebase → Authentication → Sign-in method → Google](https://console.firebase.google.com/project/mynote-f1bbc/authentication/providers)  
2. Enable = เปิด  
3. ช่อง **Web SDK configuration** วาง Client ID / Client secret จากขั้นที่ 2  
   (ต้องขึ้นต้นด้วย `570843838870-` ไม่ใช่ `470549580687-`)  
4. Save

## ขั้นที่ 4 — ลองใหม่

เปิด https://mynote-f1bbc.web.app → Sign in with Google (`yohaken@gmail.com`)
