# P-Note

โน้ตส่วนตัว (SPA) ที่ซิงค์ข้อมูลผ่าน Google Drive

## ฟีเจอร์

- ล็อกอินด้วย Google OAuth 2.0 (PKCE)
- จำกัดสิทธิ์เฉพาะ `phiraphong.yoh@gmail.com`
- Auto-login ด้วย refresh token ใน localStorage
- บันทึกโน้ตเป็น `my_notes.json` บน Google Drive
- Autosave + ป้องกันข้อมูลทับซ้อน (conflict detection)
- PWA รองรับ Add to Home Screen บน iPhone

## Deploy บน GitHub Pages

1. ไปที่ repo **Settings → Pages**
2. Source: branch `main`, folder `/ (root)`
3. เปิด `https://yohaken.github.io/P-Note/`

## Google Cloud Setup

1. Enable **Google Drive API**
2. OAuth consent screen (External) + scopes:
   - `drive.file`
   - `userinfo.email`
3. Test user: `phiraphong.yoh@gmail.com`
4. OAuth Client ID (Web application):
   - JavaScript origins: `https://yohaken.github.io`
   - Redirect URIs: `https://yohaken.github.io/P-Note/`

## โครงสร้าง

```
├── index.html
├── css/style.css
├── js/
│   ├── config.js    # Client ID, allowed email
│   ├── auth.js      # OAuth + auto-login
│   ├── drive.js     # Drive API
│   ├── sync.js      # Save queue + conflict
│   ├── notes.js     # Note helpers
│   └── app.js       # UI logic
├── manifest.json
├── sw.js
└── icons/
```

## การใช้งาน

1. เปิดแอป → กด Sign in with Google
2. ล็อกอินด้วย `phiraphong.yoh@gmail.com`
3. สร้าง/แก้ไขโน้ต — บันทึกอัตโนมัติทุก 1.5 วินาที
4. บน iPhone: Safari → Share → Add to Home Screen
