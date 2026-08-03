# QA Checklist — Cream compact · โน้ตหน้าแรก · ไม่มีไอคอน

Local: `http://localhost:5000/note.html` · Live: https://mypeer-501909.web.app/note.html  
(โปรดักชัน `/` → `note.html` ผ่าน Firebase; python `http.server` ไม่ redirect)

## A. โหลดหน้าแรก

- [x] A1 เปิดโน้ต (ไม่มีหน้าสุขภาพ/แคลอรี่แล้ว)
- [x] A2 โหลดได้ (build 124 live / 125 next)
- [x] A3 ค้นหาโน้ต… บนหน้าแรก
- [x] A4 ครีม `#f7f3ec`
- [x] A5 ตัวกรองข้อความล้วน
- [x] A6 FAB เล็ก

## B. ลิสต์ / หน้างาน

- [x] B1 empty หรือลิสต์
- [x] B2 ตัด emoji หัวข้อ
- [x] B3 compact
- [x] B4 แท็ก / due
- [x] B5 สร้างจากจดว่าง → ลิสต์

## C. ค้นหา

- [x] C1–C2 กรอง / ไม่พบ

## D. กลุ่มงาน / แผ่นงาน

- [x] D1 drawer ข้อความล้วน
- [x] D2 ไม่มีเมนูสลับแผ่นงานสุขภาพ/แคลอรี่
- [x] D3 index.html redirect ไป note.html

## E. สร้าง / แก้ / ลบ

- [x] E1 AI modal เปิดได้
- [x] E2 ไม่บังคับ emoji
- [x] E3 บันทึกโผล่ลิสต์
- [x] E4 ลบ: ค้างการ์ด → ลบ → อยู่ในถังขยะ (ไม่มี confirm — มี undo toast)
- [x] E4b แตะโน้ต → ฟอร์มแก้ไข AI → ปุ่ม **ลบ** (build 125)

## F. ธีม / ความหนาแน่น

- [x] F1 มืด = ดำ / สว่าง = ครีม
- [x] F2 density slider → `--card-density`

## G. Regression

- [x] G1 หน้างานจริง
- [x] G2 แอปเป็นโน้ตอย่างเดียว
- [x] G3 live build 124+ (ครีม + ค้นหา)

---

## Bug log

| # | อาการ | สถานะ |
|---|--------|--------|
| 1 | computer-use คลิก FAB พลาด | ไม่ใช่บั๊ก — Playwright ผ่าน |
| 2 | `#editor-view` ลบเข้าไม่ได้ (แตะเปิด AI modal) | แก้: ปุ่มลบในฟอร์มแก้ไข AI (b125) |
| 3 | GitHub Pages workflow fail | unrelated — ใช้ Firebase Hosting |

## เฟสที่ทำครบแล้ว
1. ครีม compact + ค้นหาหน้าแรก + ตัดไอคอน  
2. QA A–G จนหน้างานจริง  
3. D3/E4/F + ปุ่มลบในแก้ไข AI  
