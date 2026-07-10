# พัฒนา + ใช้จริงนอกสถานที่

โครงสร้างและ Firestore **เดิม** — ไม่แยกโปรเจกต์

| โหมด | Branch | URL | ข้อมูล |
|------|--------|-----|--------|
| **ใช้งานจริง** | `main` | https://p-note.web.app | space id จริง |
| **ทดลองฟีเจอร์** | `dev` | Firebase Preview (ดู Actions) | space id คนละตัว เช่น `sp-dev-test` |

## ท่อ

```
push → main  → Deploy to Google Cloud  → prod (Hosting + Cloud Run)
push → dev   → Deploy Preview (dev)    → preview Hosting เท่านั้น
                 ↳ ชี้ API / Firestore ชุดเดียวกับ prod
```

## วิธีใช้

1. งานระหว่างทางทำบน branch `dev` แล้ว `git push`
2. เปิด GitHub → **Actions** → **Deploy Preview (dev)** → ดู URL ใน Summary
3. เปิด URL บนมือถือ → Settings → ใส่ sync code **ทดสอบ** (อย่าใช้ของจริง)
4. ของใช้ประจำยังเปิด https://p-note.web.app ตามเดิม
5. พอฟีเจอร์นิ่ง → merge `dev` → `main` → prod อัปเดตเอง

ไม่ต้องติดตั้ง `gcloud` / `firebase` บนเครื่อง — ใช้ secret `GCP_SA_KEY` ที่มีอยู่แล้ว
