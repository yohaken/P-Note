# QA — Desktop (MacBook/PC) note save quirks

Viewport tested: Chromium **1280×800** @ `http://localhost:5000/note.html`

## Root cause

บนเดสก์ท็อป การสร้าง/แก้โน้ตใช้ **AI modal** เท่านั้น (ไม่เข้า `#editor-view`)  
→ ไม่มี autosave ตอนพิมพ์ · มือถือมักกดปุ่มชัดกว่า · PC มักคลิกนอกกล่อง / ดับเบิลคลิก / ใช้ IME Enter

## Bugs found → fixed (build 126)

| ID | อาการ (ก่อนแก้) | แก้ |
|---|---|---|
| DESKTOP-1 | คลิกนอก modal / Esc ทิ้งข้อความเงียบ | ถามยืนยันถ้าฟอร์ม dirty |
| DESKTOP-2 | ดับเบิลคลิก สร้าง/บันทึก → โน้ตซ้ำ | `aiNoteBusy` + disable ปุ่มระหว่างบันทึก |
| DESKTOP-3 | Enter ตอนพิมพ์ไทย (IME) ในเช็กลิสต์รีเรนเดอร์/เพี้ยน | ข้าม Enter ถ้า `isComposing` / keyCode 229 |
| DESKTOP-4 | คลิกขวาไม่เปิดเมนู (ต้องค้างเมาส์) | right-click เปิดเมนูเดียวกับ long-press |

## Retest result

ทั้งหมด **PASS** (Playwright desktop)

## ยังต่างจากมือถือ (รับได้)

- ไม่มี autosave ระหว่างพิมพ์ใน modal — ต้องกด **สร้าง/บันทึก**
- Swipe ปิด modal เป็น touch-only (Esc / คลิกนอกแทนบน PC)
