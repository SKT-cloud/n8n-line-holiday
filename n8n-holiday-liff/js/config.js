export const CONFIG = {
  // ✅ ใส่ LIFF ID ของคุณ
  LIFF_ID: "YOUR_LIFF_ID",

  // ✅ Base URL ของ Cloudflare Worker (ที่มี /liff/subjects และ /liff/holidays/create)
  WORKER_BASE: "https://YOUR-WORKER.your-domain.workers.dev",

  // endpoints (ไม่ต้องแก้ถ้าใช้ตาม worker ด้านล่าง)
  SUBJECTS_URL: "/liff/subjects",
  CREATE_URL: "/liff/holidays/create",

  // (optional) ถ้าต้องการให้บอทส่ง Flex ยืนยันผ่าน n8n ตอนบันทึกสำเร็จ (ไม่จำเป็น)
  // N8N_CONFIRM_URL: "https://spu-n8n.spu.ac.th/webhook-test/liff-submit"
};
