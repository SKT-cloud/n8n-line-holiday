const $ = (s, el = document) => el.querySelector(s);

function pad2(n) { return String(n).padStart(2, "0"); }

function thaiDayToJsDow(thai) {
  const t = String(thai || "").trim();
  if (t === "อาทิตย์") return 0;
  if (t === "จันทร์") return 1;
  if (t === "อังคาร") return 2;
  if (t === "พุธ") return 3;
  if (t === "พฤ" || t === "พฤหัสบดี") return 4;
  if (t === "ศุกร์") return 5;
  if (t === "เสาร์") return 6;
  return null;
}

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function dateToYmd(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function toIsoAllDayStart(ymd) { return `${ymd}T00:00:00+07:00`; }
function toIsoAllDayEnd(ymd) { return `${ymd}T23:59:59+07:00`; }

function clampTime(h, m) {
  let hh = Number(h);
  let mm = Number(m);
  if (!Number.isFinite(hh)) hh = 0;
  if (!Number.isFinite(mm)) mm = 0;
  hh = Math.max(0, Math.min(23, hh));
  mm = Math.max(0, Math.min(59, mm));
  return [pad2(hh), pad2(mm)];
}

function toast(msg, kind = "info") {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 2600);
}

function digits2(v) { return String(v || "").replace(/\D/g, "").slice(0, 2); }

function padOnBlur(el) {
  const v = digits2(el.value);
  if (!v) { el.value = ""; return ""; }
  el.value = v.length === 1 ? `0${v}` : v;
  return el.value;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtMonthTitle(d) {
  try {
    return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(d);
  } catch {
    return `${d.getMonth() + 1}/${d.getFullYear()}`;
  }
}

export function bindForm({ onSubmit, onTokenExpired, onError }) {
  const form = $("#holidayForm");

  const typeHolidayBtn = $("#typeHoliday");
  const typeCancelBtn = $("#typeCancel");

  const cancelBox = $("#cancelBox");

  const titleEl = $("#title");
  const noteEl = $("#note");

  const dateRangeHelp = $("#dateRangeHelp");
  const startDateWrap = $("#startDateWrap");
  const endDateWrap = $("#endDateWrap");
  const startEl = $("#startDate");
  const endEl = $("#endDate");

  // ✅ กันย้ายก้อนออกนอกฟอร์มแล้ว submit ไม่ติด
  const saveBtn = $("#saveBtn");
  saveBtn?.addEventListener("click", (e) => {
    if (form?.requestSubmit) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  const formTail = $("#formTail");
  const formTailHome = $("#formTailHome");
  const cancelTailAnchor = $("#cancelTailAnchor");

  const cancelCalendarWrap = $("#cancelCalendarWrap");
  const cancelDateValue = $("#cancelDateValue");
  const calPrev = $("#calPrev");
  const calNext = $("#calNext");
  const calTitle = $("#calTitle");
  const calGrid = $("#calGrid");
  const calHint = $("#calHint");

  const remindersWrap = $("#reminders");
  const addReminderBtn = $("#addReminder");
  const resetBtn = $("#resetBtn");

  const state = {
    type: "holiday",
    subjectPayload: null,
    subjectDay: null,
    allowDow: null,

    calYear: null,
    calMonth0: null,
    cancelYmd: "",

    reminders: [],
  };

  // ✅ เปลี่ยน logic ตามที่ขอ:
  // - โหมด holiday: formTail อยู่ในฟอร์ม
  // - โหมด cancel: formTail ย้ายไป "ล่างสุด" ใต้ปฏิทินทันที (แม้ยังไม่เลือกวิชา)
  function placeFormTail() {
    if (!formTail) return;

    if (state.type === "holiday") {
      if (formTailHome && formTail.parentElement !== form) {
        formTailHome.insertAdjacentElement("afterend", formTail);
      }
      return;
    }

    // cancel mode -> always bottom (ใต้ปฏิทิน / ใต้รายการวิชา)
    if (cancelTailAnchor && formTail.parentElement !== cancelBox) {
      cancelTailAnchor.insertAdjacentElement("afterend", formTail);
    }
  }

  function ensureCalendarInit() {
    const today = new Date();
    if (state.calYear === null || state.calMonth0 === null) {
      state.calYear = today.getFullYear();
      state.calMonth0 = today.getMonth();
    }
  }

  function nextAllowedFromToday() {
    if (state.allowDow === null) return null;
    const today = startOfDay(new Date());
    const dow = today.getDay();
    const add = (state.allowDow - dow + 7) % 7;
    const d = new Date(today);
    d.setDate(d.getDate() + add);
    return d;
  }

  function pickCancelYmd(ymd) {
    state.cancelYmd = ymd;
    if (cancelDateValue) cancelDateValue.value = ymd;
    renderCalendar();
  }

  function showCancelCalendar(show) {
    if (!cancelCalendarWrap) return;
    cancelCalendarWrap.style.display = show ? "block" : "none";
    if (!show) {
      state.cancelYmd = "";
      if (cancelDateValue) cancelDateValue.value = "";
    }
  }

  function renderCalendar() {
    if (!calGrid || !calTitle) return;

    const allowDow = state.allowDow;
    const today = startOfDay(new Date());
    const view = new Date(state.calYear, state.calMonth0, 1);

    calTitle.textContent = fmtMonthTitle(view);

    if (calHint) {
      calHint.textContent = (state.subjectDay && allowDow !== null)
        ? `เลือกได้เฉพาะ “${state.subjectDay}” เท่านั้น`
        : "กรุณาเลือกวิชาก่อน";
    }

    calGrid.innerHTML = "";

    const first = new Date(state.calYear, state.calMonth0, 1);
    const firstDow = first.getDay();
    const daysInMonth = new Date(state.calYear, state.calMonth0 + 1, 0).getDate();

    for (let i = 0; i < firstDow; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "calDay isMuted";
      b.textContent = "0";
      calGrid.appendChild(b);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(state.calYear, state.calMonth0, day);
      const ymd = dateToYmd(d);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calDay";
      btn.textContent = String(day);

      let disabled = false;
      if (allowDow === null) disabled = true;
      if (allowDow !== null && d.getDay() !== allowDow) disabled = true;
      if (d < today) disabled = true;

      if (disabled) btn.classList.add("isDisabled");
      if (state.cancelYmd && state.cancelYmd === ymd) btn.classList.add("isSelected");

      btn.addEventListener("click", () => {
        if (btn.classList.contains("isDisabled")) return;
        pickCancelYmd(ymd);
      });

      calGrid.appendChild(btn);
    }
  }

  calPrev?.addEventListener("click", () => {
    ensureCalendarInit();
    const d = new Date(state.calYear, state.calMonth0 - 1, 1);
    state.calYear = d.getFullYear();
    state.calMonth0 = d.getMonth();
    renderCalendar();
  });

  calNext?.addEventListener("click", () => {
    ensureCalendarInit();
    const d = new Date(state.calYear, state.calMonth0 + 1, 1);
    state.calYear = d.getFullYear();
    state.calMonth0 = d.getMonth();
    renderCalendar();
  });

  function applyTypeUI() {
    const isCancel = state.type === "cancel";

    typeHolidayBtn?.classList.toggle("isActive", !isCancel);
    typeCancelBtn?.classList.toggle("isActive", isCancel);

    typeHolidayBtn?.setAttribute("aria-selected", !isCancel ? "true" : "false");
    typeCancelBtn?.setAttribute("aria-selected", isCancel ? "true" : "false");

    if (cancelBox) cancelBox.hidden = !isCancel;

    if (startDateWrap) startDateWrap.style.display = isCancel ? "none" : "block";
    if (endDateWrap) endDateWrap.style.display = isCancel ? "none" : "block";

    if (dateRangeHelp) {
      dateRangeHelp.textContent = isCancel
        ? "โหมด “ยกคลาส” จะเลือกวันที่จากปฏิทินด้านล่าง หลังเลือกวิชา"
        : "ถ้าหยุดวันเดียว ปล่อย “วันสุดท้าย” ว่างได้ ✅";
    }

    // ✅ cancel: ปฏิทินยังไม่โชว์จนกว่าจะเลือกวิชา
    if (isCancel) {
      showCancelCalendar(!!state.subjectPayload);
      ensureCalendarInit();
      renderCalendar();
    } else {
      showCancelCalendar(false);
    }

    // ✅ ย้ายก้อนแจ้งเตือน+บันทึกไปล่างสุดทันทีเมื่อเข้า cancel
    placeFormTail();
  }

  function setType(next) {
    state.type = next;
    applyTypeUI();
  }

  typeHolidayBtn?.addEventListener("click", () => setType("holiday"));
  typeCancelBtn?.addEventListener("click", () => setType("cancel"));

  // เลือกวิชา
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".subCard");
    if (!btn) return;

    document.querySelectorAll(".subCard.isSelected").forEach((el) => el.classList.remove("isSelected"));
    btn.classList.add("isSelected");

    state.subjectPayload = JSON.parse(btn.dataset.payload || "{}");
    state.subjectDay = state.subjectPayload?.day || null;
    state.allowDow = thaiDayToJsDow(state.subjectDay);

    if (state.type !== "cancel") state.type = "cancel";

    // ✅ โชว์ปฏิทินมาแทรกระหว่าง “เลือกวิชา” กับ “แจ้งเตือน/บันทึก”
    showCancelCalendar(true);
    placeFormTail();

    const next = nextAllowedFromToday();
    if (next) {
      state.calYear = next.getFullYear();
      state.calMonth0 = next.getMonth();
      pickCancelYmd(dateToYmd(next));
      toast(`เลือกได้เฉพาะวัน${state.subjectDay} — เลือกวันถัดไปให้แล้ว ✅`, "ok");
    } else {
      ensureCalendarInit();
      renderCalendar();
    }

    // เลื่อนลงไปปฏิทิน (เพราะ user “เลือกวิชาแล้ว” ขั้นต่อไปคือ “เลือกวัน”)
    cancelCalendarWrap?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });

  // reminders render
  function renderReminders() {
    if (!remindersWrap) return;
    remindersWrap.innerHTML = "";

    if (!state.reminders.length) {
      remindersWrap.innerHTML = `<div class="empty">ยังไม่มีการตั้งแจ้งเตือน</div>`;
      return;
    }

    state.reminders.forEach((r, idx) => {
      const card = document.createElement("div");
      card.className = "remCard";

      card.innerHTML = `
        <div class="remGrid">
          <div class="remNo">#${idx + 1}</div>

          <div class="remCol">
            <div class="remCap">วันที่</div>
            <input class="input remDate" type="date" data-k="ymd" value="${r.ymd || ""}" />
          </div>

          <div class="remCol">
            <div class="remCap">เวลา</div>
            <div class="timePill">
              <input class="timeInput" inputmode="numeric" maxlength="2" placeholder="HH" data-k="hh" value="${r.hh || ""}" />
              <span class="timeColon">:</span>
              <input class="timeInput" inputmode="numeric" maxlength="2" placeholder="MM" data-k="mm" value="${r.mm || ""}" />
            </div>
          </div>

          <button type="button" class="btnDanger remDel">ลบ</button>
        </div>
        <div class="remHelp">พิมพ์ HH ครบ 2 ตัว ระบบจะเด้งไปช่อง MM อัตโนมัติ</div>
      `;

      const ymdEl = card.querySelector('[data-k="ymd"]');
      const hhEl = card.querySelector('[data-k="hh"]');
      const mmEl = card.querySelector('[data-k="mm"]');
      const delBtn = card.querySelector(".remDel");

      ymdEl?.addEventListener("change", () => (state.reminders[idx].ymd = ymdEl.value));

      const syncTime = () => {
        const hh = digits2(hhEl?.value);
        const mm = digits2(mmEl?.value);
        if (hhEl) hhEl.value = hh;
        if (mmEl) mmEl.value = mm;
        state.reminders[idx].hh = hh;
        state.reminders[idx].mm = mm;
        if (hh.length >= 2 && document.activeElement === hhEl) mmEl?.focus();
      };
      hhEl?.addEventListener("input", syncTime);
      mmEl?.addEventListener("input", syncTime);

      hhEl?.addEventListener("blur", () => {
        const hh = padOnBlur(hhEl);
        const mm = digits2(mmEl?.value);
        if (!hh && !mm) { state.reminders[idx].hh = ""; return; }
        const [H, M] = clampTime(hh || "0", mm || "0");
        hhEl.value = H;
        if (mmEl && mm) mmEl.value = pad2(Number(mm));
        state.reminders[idx].hh = hhEl.value;
        state.reminders[idx].mm = mmEl?.value || "";
      });

      mmEl?.addEventListener("blur", () => {
        const mm = padOnBlur(mmEl);
        const hh = digits2(hhEl?.value);
        if (!hh && !mm) { state.reminders[idx].mm = ""; return; }
        const [H, M] = clampTime(hh || "0", mm || "0");
        if (hhEl && hh) hhEl.value = pad2(Number(hh));
        mmEl.value = M;
        state.reminders[idx].hh = hhEl?.value || "";
        state.reminders[idx].mm = mmEl.value;
      });

      delBtn?.addEventListener("click", () => {
        state.reminders.splice(idx, 1);
        renderReminders();
      });

      remindersWrap.appendChild(card);
    });
  }

  addReminderBtn?.addEventListener("click", () => {
    state.reminders.push({ ymd: "", hh: "", mm: "" });
    renderReminders();
  });

  resetBtn?.addEventListener("click", () => {
    // ล้างช่องกรอก
    if (titleEl) titleEl.value = "";
    if (noteEl) noteEl.value = "";
    if (startEl) startEl.value = "";
    if (endEl) endEl.value = "";

    // ✅ ล้างการเลือกวิชา + state ที่เกี่ยวข้อง
    document.querySelectorAll(".subCard.isSelected").forEach((el) => el.classList.remove("isSelected"));
    state.subjectPayload = null;
    state.subjectDay = null;
    state.allowDow = null;

    // ล้างวันยกคลาส + ซ่อนปฏิทิน (เพราะยังไม่เลือกวิชาแล้ว)
    state.cancelYmd = "";
    if (cancelDateValue) cancelDateValue.value = "";
    showCancelCalendar(false);

    ensureCalendarInit();
    renderCalendar();

    // ล้างแจ้งเตือน
    state.reminders = [];
    renderReminders();

    // จัดตำแหน่ง tail ใหม่ (ถ้าอยู่โหมด cancel ก็ต้องอยู่ล่างเสมอ)
    placeFormTail();

    toast("ล้างฟอร์มแล้ว", "ok");
  });

  // init
  renderReminders();
  applyTypeUI();
  ensureCalendarInit();
  renderCalendar();

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const title = (titleEl?.value || "").trim() || null;
      const note = (noteEl?.value || "").trim() || null;

      let startYmd = "";
      let endYmd = "";

      if (state.type === "cancel") {
        if (!state.subjectPayload?.subject_code) {
          toast("กรุณาเลือกวิชา (สำหรับยกคลาส)", "err");
          return;
        }
        startYmd = state.cancelYmd || cancelDateValue?.value || "";
        if (!isYmd(startYmd)) {
          toast("กรุณาเลือกวันที่จากปฏิทิน", "err");
          return;
        }
        endYmd = startYmd;
      } else {
        startYmd = startEl?.value || "";
        endYmd = endEl?.value || "";
        if (!isYmd(startYmd)) {
          toast("กรุณาเลือกวันเริ่ม", "err");
          return;
        }
        endYmd = isYmd(endYmd) ? endYmd : startYmd;
      }

      let subject_id = null;
      let finalTitle = title;

      if (state.type === "cancel") {
        subject_id = state.subjectPayload.subject_code;
        if (!finalTitle) {
          const sc = state.subjectPayload.subject_code || "";
          const sn = state.subjectPayload.subject_name || "";
          finalTitle = `${sc} ${sn}`.trim() || "ยกคลาส";
        }
      }

      const reminders = [];
      for (const rr of state.reminders) {
        if (!isYmd(rr.ymd)) continue;
        const [hh, mm] = clampTime(rr.hh, rr.mm);
        reminders.push(`${rr.ymd}T${hh}:${mm}:00+07:00`);
      }

      const payload = {
        type: state.type,
        subject_id,
        all_day: 1,
        start_at: toIsoAllDayStart(startYmd),
        end_at: toIsoAllDayEnd(endYmd),
        title: finalTitle,
        note,
        reminders,
      };

      await onSubmit(payload);
    } catch (err) {
      if (err?.code === "IDTOKEN_EXPIRED" || err?.message === "IDTOKEN_EXPIRED") {
        onTokenExpired?.();
        return;
      }
      onError?.(err);
    }
  });
}