export const CONFIG = {
  LIFF_ID: "2009146879-xoNc2sVq",

  // GET subjects: ?user_id=Uxxxx
  N8N_SUBJECTS_URL: "https://spu-n8n.spu.ac.th/webhook-test/liff-subjects",

  // POST submit holiday/cancel
  N8N_SUBMIT_URL: "https://spu-n8n.spu.ac.th/webhook-test/liff-holiday-submit",

  // ✅ NEW: POST add reminders (ตั้งแจ้งเตือนหลังบันทึก)
  // คุณยังไม่สร้าง webhook ก็ได้ แต่ UI จะเรียกอันนี้เมื่อกด "บันทึกแจ้งเตือน"
  N8N_REMINDERS_URL: "https://spu-n8n.spu.ac.th/webhook-test/liff-holiday-reminders"
};



