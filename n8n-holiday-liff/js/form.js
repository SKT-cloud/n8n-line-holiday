import { CONFIG } from "./config.js";

const dayOrder = ["จันทร์","อังคาร","พุธ","พฤหัสบดี","พฤ","ศุกร์","เสาร์","อาทิตย์"];

function dayRank(d){
  const i = dayOrder.indexOf(d);
  return i === -1 ? 999 : i;
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;",
  }[m]));
}

function fmtTime(t){
  if (!t) return "-";
  const m = String(t).match(/^(\d{2}:\d{2})/);
  return m ? m[1] : String(t);
}

function isoAtStartOfDay(dateStr){
  // YYYY-MM-DD -> ISO +07:00 start
  return `${dateStr}T00:00:00+07:00`;
}
function isoAtEndOfDay(dateStr){
  return `${dateStr}T23:59:59+07:00`;
}

export function initForm({ el, mode, profile, subjects, onSubmit }) {
  const $ = (id) => el.querySelector(id);

  // Header
  $("#profileName").textContent = profile?.displayName || "";
  $("#badge").textContent = mode === "edit" ? "Edit" : "Add";

  // State
  const state = {
    type: "holiday", // holiday | cancel
    subjectKey: null, // string id
    reminders: [], // {date,time}
  };

  // Build subject list (for cancel)
  const grouped = new Map();
  for (const s of subjects) {
    const day = s.day || "";
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day).push(s);
  }
  const days = Array.from(grouped.keys()).sort((a,b)=>dayRank(a)-dayRank(b));
  for (const d of days) {
    grouped.get(d).sort((a,b)=>fmtTime(a.start_time).localeCompare(fmtTime(b.start_time)));
  }

  const listEl = $("#subjectList");
  listEl.innerHTML = days.map(day => {
    const cards = grouped.get(day).map(s => {
      const key = `${s.subject_code}|${s.section}|${s.type}|${s.day}|${s.start_time}`;
      const top = `${fmtTime(s.start_time)}–${fmtTime(s.end_time)} • ${escapeHtml(s.room || "-")}`;
      const mid = `${escapeHtml(s.subject_code)} ${escapeHtml(s.type)} • sec ${escapeHtml(s.section)}`;
      const bot = `${escapeHtml(s.subject_name)}`;
      return `
        <button class="subCard" type="button" data-key="${escapeHtml(key)}"
          data-payload='${escapeHtml(JSON.stringify({
            subject_code: s.subject_code,
            section: s.section,
            type: s.type,
            day: s.day,
            start_time: s.start_time,
            end_time: s.end_time,
            room: s.room,
            subject_name: s.subject_name,
          }))}'>
          <div class="subTop">${top}</div>
          <div class="subMid">${mid}</div>
          <div class="subBot">${bot}</div>
        </button>
      `;
    }).join("");

    return `
      <section class="dayBlock">
        <div class="dayTitle">${escapeHtml(day)}</div>
        <div class="dayGrid">${cards}</div>
      </section>
    `;
  }).join("");

  // Toggle type
  const btnHoliday = $("#btnTypeHoliday");
  const btnCancel = $("#btnTypeCancel");
  const cancelBox = $("#cancelBox");
  function renderType(){
    btnHoliday.classList.toggle("isActive", state.type === "holiday");
    btnCancel.classList.toggle("isActive", state.type === "cancel");
    cancelBox.hidden = state.type !== "cancel";
  }
  btnHoliday.addEventListener("click", () => { state.type = "holiday"; renderType(); });
  btnCancel.addEventListener("click", () => { state.type = "cancel"; renderType(); });
  renderType();

  // Subject selection highlight
  function clearSelected(){
    el.querySelectorAll(".subCard.isSelected").forEach(b => b.classList.remove("isSelected"));
  }
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".subCard");
    if (!btn) return;
    clearSelected();
    btn.classList.add("isSelected");
    state.subjectKey = btn.dataset.key;
    $("#selectedSubject").textContent = btn.querySelector(".subBot")?.textContent || "";
  });

  // Reminders
  const remList = $("#remindersList");
  const addRemBtn = $("#addReminder");

  function renderReminders(){
    if (state.reminders.length === 0) {
      remList.innerHTML = `<div class="hint">ยังไม่มีการตั้งแจ้งเตือน</div>`;
      return;
    }
    remList.innerHTML = state.reminders.map((r, idx) => {
      const safeD = escapeHtml(r.date || "");
      const safeH = escapeHtml((r.time||"09:00").slice(0,2));
      const safeM = escapeHtml((r.time||"09:00").slice(3,5));
      return `
        <div class="remRow" data-idx="${idx}">
          <div class="remNo">#${idx+1}</div>
          <div class="remFields">
            <label class="field">
              <span>วันที่</span>
              <input class="input" type="date" value="${safeD}" data-k="date" />
            </label>
            <label class="field">
              <span>เวลา</span>
              <div class="timeRow">
                <input class="input time" type="number" min="0" max="23" value="${safeH}" data-k="hh" />
                <span class="timeSep">:</span>
                <input class="input time" type="number" min="0" max="59" value="${safeM}" data-k="mm" />
              </div>
            </label>
          </div>
          <button type="button" class="btnTiny" data-act="del">ลบ</button>
        </div>
      `;
    }).join("");
  }

  addRemBtn.addEventListener("click", () => {
    state.reminders.push({ date: "", time: "09:00" });
    renderReminders();
  });

  remList.addEventListener("click", (e) => {
    const row = e.target.closest(".remRow");
    if (!row) return;
    const idx = Number(row.dataset.idx);
    if (e.target?.dataset?.act === "del") {
      state.reminders.splice(idx, 1);
      renderReminders();
    }
  });

  remList.addEventListener("input", (e) => {
    const row = e.target.closest(".remRow");
    if (!row) return;
    const idx = Number(row.dataset.idx);
    const k = e.target.dataset.k;
    if (k === "date") {
      state.reminders[idx].date = e.target.value;
    }
    if (k === "hh" || k === "mm") {
      const hh = row.querySelector('[data-k="hh"]').value;
      const mm = row.querySelector('[data-k="mm"]').value;
      const HH = String(Math.max(0, Math.min(23, Number(hh)||0))).padStart(2,"0");
      const MM = String(Math.max(0, Math.min(59, Number(mm)||0))).padStart(2,"0");
      state.reminders[idx].time = `${HH}:${MM}`;
      row.querySelector('[data-k="hh"]').value = HH;
      row.querySelector('[data-k="mm"]').value = MM;
    }
  });

  renderReminders();

  // Actions
  $("#resetBtn").addEventListener("click", () => {
    $("#title").value = "";
    $("#note").value = "";
    $("#startDate").value = "";
    $("#endDate").value = "";
    state.type = "holiday";
    state.subjectKey = null;
    state.reminders = [];
    $("#selectedSubject").textContent = "";
    clearSelected();
    renderType();
    renderReminders();
  });

  el.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = $("#title").value.trim();
    const note = $("#note").value.trim();
    const start = $("#startDate").value;
    const end = $("#endDate").value || start;

    if (!start) throw new Error("กรุณาเลือกวันเริ่ม");
    if (state.type === "cancel" && !state.subjectKey) throw new Error("กรุณาเลือกวิชา");

    // Subject payload (optional)
    let subject = null;
    if (state.type === "cancel") {
      const selected = el.querySelector(".subCard.isSelected");
      if (selected) subject = JSON.parse(selected.dataset.payload);
    }

    // Reminders -> worker accepts array of ISO strings OR {days_before,time} OR {remind_at}
    // เราเลือกส่งเป็น ISO string ตาม date+time ที่ user กำหนด
    const reminders = state.reminders
      .filter(r => r.date && r.time)
      .map(r => `${r.date}T${r.time}:00+07:00`);

    const payload = {
      type: state.type,
      title: title || null,
      note: note || null,
      start_at: isoAtStartOfDay(start),
      end_at: isoAtEndOfDay(end),
      all_day: 1,
      subject: subject,
      reminders,
    };

    await onSubmit(payload);
  });
}
