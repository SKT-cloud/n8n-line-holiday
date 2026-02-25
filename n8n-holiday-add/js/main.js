import { initLiff } from "./auth.js";
import { fetchSubjects, submitHolidayToN8n } from "./api.js";
import { bindForm } from "./form.js";

const $ = (s) => document.querySelector(s);

function toast(msg, kind = "info") {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 2800);
}

function setStatus(text) {
  const el = $("#status");
  if (!el) return;
  el.textContent = text || "";
}

// ===== Overlay (center) =====
function showOverlay({ kind = "loading", title = "กำลังโหลดข้อมูล…", desc = "รอสักครู่น้า 🥺✨" } = {}) {
  const ov = $("#overlay");
  const ic = $("#overlayIcon");
  const ttl = $("#overlayTitle");
  const ds = $("#overlayDesc");

  if (!ov || !ic || !ttl || !ds) return;
  ov.hidden = false;
  ov.setAttribute("aria-busy", kind === "loading" ? "true" : "false");

  ic.className = `overlayIcon ${kind}`;
  ttl.textContent = title;
  ds.textContent = desc;
}

function hideOverlay() {
  const ov = $("#overlay");
  if (ov) ov.hidden = true;
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function relogin() {
  toast("เซสชันหมดอายุ กำลังพาไปล็อกอินใหม่…", "err");
  try { window.liff.logout(); } catch(_) {}
  window.liff.login({ redirectUri: location.href });
}

function daySort(d){
  const order = ["จันทร์","อังคาร","พุธ","พฤหัสบดี","พฤ","ศุกร์","เสาร์","อาทิตย์","อื่นๆ"];
  const i = order.indexOf(d);
  return i === -1 ? 999 : i;
}

function renderSubjects(items){
  // ✅ FIX: index.html ใช้ id="subjects"
  const list = $("#subjects");
  if (!list) return;

  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<div class="empty">ยังไม่มีข้อมูลวิชาในระบบ 😅</div>`;
    return;
  }

  const grouped = new Map();
  for (const it of items) {
    const day = it.day || "อื่นๆ";
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day).push(it);
  }

  [...grouped.entries()]
    .sort((a,b)=>daySort(a[0]) - daySort(b[0]))
    .forEach(([day, arr]) => {
      arr.sort((a,b) =>
        String(a.start_time||"").localeCompare(String(b.start_time||"")) ||
        String(a.subject_code||"").localeCompare(String(b.subject_code||""))
      );

      const sec = document.createElement("section");
      sec.className = "dayGroup";
      sec.innerHTML = `<div class="dayHead">${day}</div>`;

      const grid = document.createElement("div");
      grid.className = "subGrid";

      for (const s of arr) {
        const payload = {
          subject_code: s.subject_code,
          subject_name: s.subject_name,
          section: s.section,
          type: s.type,
          room: s.room,
          start_time: s.start_time,
          end_time: s.end_time,
          day: s.day,
          semester: s.semester,
          instructor: s.instructor,
        };

        const card = document.createElement("button");
        card.type = "button";
        card.className = "subCard";
        card.dataset.key = `${s.day}|${s.start_time}|${s.subject_code}|${s.section}|${s.type}`;
        card.dataset.payload = JSON.stringify(payload);

        card.innerHTML = `
          <div class="subTime">${(s.start_time||"??:??")}–${(s.end_time||"??:??")}</div>
          <div class="subCode">${s.subject_code || ""} <span class="subType">${s.type || ""}</span></div>
          <div class="subName">${s.subject_name || ""}</div>
          <div class="subMeta">${s.room ? `ห้อง ${s.room}` : ""}</div>
          <div class="subTick">✓</div>
        `;

        grid.appendChild(card);
      }

      sec.appendChild(grid);
      list.appendChild(sec);
    });
}

async function run() {
  try {
    setStatus("กำลังเปิดฟอร์ม...");
    showOverlay({ kind: "loading", title: "กำลังเปิดฟอร์ม…", desc: "เตรียมข้อมูลให้พร้อมเลยน้า ✨" });

    const { idToken, profile } = await initLiff();
    if (!idToken) return;

    const userPill = $("#userPill");
    if (userPill) userPill.textContent = profile?.displayName || "คุณ";

    // load subjects
    setStatus("กำลังโหลดตารางวิชา...");
    showOverlay({ kind: "loading", title: "กำลังโหลดข้อมูล…", desc: "ดึงรายวิชาอยู่ค่ะ รอแป๊บนึงน้า ⏳" });
    let items = [];
    try {
      items = await fetchSubjects({ idToken });
    } catch (err) {
      if (err?.code === "IDTOKEN_EXPIRED" || err?.message === "IDTOKEN_EXPIRED") {
        relogin();
        return;
      }
      console.error(err);
      toast(err?.message || String(err), "err");
      items = [];
    }

    const subjectsStatus = $("#subjectsStatus");
    if (subjectsStatus) {
      subjectsStatus.textContent = items.length ? `มี ${items.length} รายวิชา` : "ยังไม่มีข้อมูลวิชาในระบบ 😅";
    }

    renderSubjects(items);
    setStatus("");
    hideOverlay();

    bindForm({
      onSubmit: async (payload) => {
        const ok = window.confirm("ยืนยันการบันทึกใช่ไหม?\n\nกด “ตกลง” เพื่อบันทึก หรือ “ยกเลิก” เพื่อกลับไปแก้ไข");
        if (!ok) return;

        // ✅ ส่งให้ n8n ตรวจ+บันทึก+ส่ง Flex เอง
        setStatus("กำลังส่งข้อมูลให้น8n...");
        showOverlay({ kind: "loading", title: "กำลังบันทึก…", desc: "กำลังเช็คข้อมูลก่อนบันทึกให้น้า 🧠✨" });

        const ctx = (() => {
          try {
            const c = window.liff.getContext?.() || {};
            return {
              ...c,
              userId: c.userId || c?.userId || null,
              displayName: profile?.displayName || null,
              idToken, // ถ้าไม่อยากส่งให้ n8n ก็ลบได้
              ts: Date.now(),
            };
          } catch {
            return { displayName: profile?.displayName || null, idToken, ts: Date.now() };
          }
        })();

        try {
          await submitHolidayToN8n({ payload, context: ctx });
        } catch (err) {
          showOverlay({ kind: "err", title: "บันทึกไม่สำเร็จ 🥺", desc: err?.message || String(err) });
          setStatus("");
          // ให้ user อ่านก่อน แล้วค่อยปิด overlay เองโดยกด OK
          await sleep(450);
          window.alert(`บันทึกไม่สำเร็จ\n\n${err?.message || err}`);
          hideOverlay();
          return;
        }

        showOverlay({ kind: "ok", title: "บันทึกสำเร็จแล้ว ✅", desc: "ส่งไปที่ไลน์ให้เรียบร้อยน้า 💖" });
        setStatus("");
        await sleep(550);
        try { window.liff.closeWindow(); } catch(_) {}
      },
      onTokenExpired: relogin,
      onError: (err) => {
        console.error(err);
        toast(err?.message || String(err), "err");
        setStatus("");
        hideOverlay();
      }
    });

  } catch (e) {
    console.error(e);
    setStatus("");
    toast(`เปิดฟอร์มไม่สำเร็จ: ${e?.message || e}`, "err");
    showOverlay({ kind: "err", title: "เปิดฟอร์มไม่สำเร็จ 🥺", desc: e?.message || String(e) });
  }
}

document.addEventListener("DOMContentLoaded", run);