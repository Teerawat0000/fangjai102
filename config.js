// ตั้งค่าหน้าเว็บ — แก้ไฟล์นี้ไฟล์เดียวพอ

// 1) ถ้ามีเซิร์ฟเวอร์หลังบ้าน (ที่ตอบ /api/*) ใส่ URL ตรงนี้ เช่น "https://fangjai.example.workers.dev"
//    แล้วเปลี่ยน FJ_STATIC เป็น false
window.FJ_API_BASE = "";

// 2) true = ไม่มีเซิร์ฟเวอร์ (เช่น GitHub Pages) แสดงหน้าเว็บอย่างเดียว ไม่เรียก /api
window.FJ_STATIC = true;

// 3) ข้อความบนเว็บในโหมดไม่มีเซิร์ฟเวอร์ (ถ้ามีเซิร์ฟเวอร์ ค่าจะมาจากหน้าตั้งค่าของเจ้าของแทน)
//    ตัวอย่างฟิลด์: heroText, cardConsult, cardSuggest, privacyNote, disclaimer, officerIntro,
//    categories (รายการหมวด), hotlines (รายการ {label, number})
window.FJ_SETTINGS = {};
