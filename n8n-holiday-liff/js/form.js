import { fetchSubjectGroups, submitHoliday } from "./api.js";

function qs(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function showMsg(text, type = "") {
  const msg = qs("msg");
  msg.className = "msg" + (type ? ` msg--${type}` : "");
  msg.textContent = text || "";
}

function setSubmitting(isSubmitting) {
  const btn = qs("submitBtn");
  btn.disabled = isSubmitting;
  btn.textContent = isSubmitting ? "กำลังบันทึก…" : "บันทึก";
}

function setModeUI(mode) {
  const allDayBox = qs("allDayBox");
  const cancelBox = qs("cancelBox");

  if (mode === "cancel_subject") {
    allDayBox.classList.add("hidden");
    cancelBox.classList.remove("hidden");
  } else {
    cancelBox.classList.add("hidden");
    allDayBox.classList.remove("hidden");
  }
}

function toIsoBangkokStartEnd(startDateYYYYMMDD, endDateYYYYMMDD) {
  const start = `${startDateYYYYMMDD}T00:00:00+07:00`;
  const end = `${endDateYYYYMMDD}T23:59:59+07:00`;
  return { start_at: start, end_at: end };
}

function normalizeDayOrder(day) {
  const order = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
  const idx = order.indexOf(day);
  return idx === -1 ? 999 : idx;
}

function normalizeOption(raw, fallbackDay) {
  if (raw && (raw.id || raw.subject_id)) {
    const meta = raw.meta || {};
    const id = raw.id || raw.subject_id;

    const day = raw.day || meta.day || fallbackDay || "";
    const start = raw.start_time || meta.start_time || "";
    const end = raw.end_time || meta.end_time || "";
    const time = raw.time || (start && end ? `${start}-${end}` : "");

    const code = raw.code || meta.subject_code || "";
    const name = raw.name || meta.subject_name || "";
    const section = raw.section || meta.section || "";
    const type = raw.type || meta.type || "";

    return {
      id,
      day,
      time,
      code,
      name,
      section,
      type,
      label: raw.label || `${time} | ${code} | ${name} | ${type}`
    };
  }

  return {
    id: raw?.id || raw?.subject_id || crypto.randomUUID(),
    day: fallbackDay || "",
    time: "",
    code: "",
    name: raw?.label || "",
    section: "",
    type: "",
    label: raw?.label || ""
  };
}

function renderSubjects(groups, state, onPick) {
  const subjectsListEl = qs("subjectsList");
  subjectsListEl.innerHTML = "";

  const sortedGroups = (groups || [])
    .slice()
    .sort((a, b) => normalizeDayOrder(a.day) - normalizeDayOrder(b.day));

  for (const g of sortedGroups) {
    const dayWrap = document.createElement("div");
    dayWrap.className = "dayGroup";

    const header = document.createElement("div");
    header.className = "dayHeader";
    header.textContent = g.day || "ไม่ระบุวัน";
    dayWrap.appendChild(header);

    const options = (g.options || []).map((o) => normalizeOption(o, g.day));

    for (const opt of options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "subjectItem";
      if (state.selectedSubject?.id === opt.id) item.classList.add("isActive");

      const searchable = [
        opt.time, opt.code, opt.name, opt.type, opt.day, opt.section, opt.label
      ].filter(Boolean).join(" ").toLowerCase();
      item.dataset.search = searchable;

      item.innerHTML = `
        <div class="subjectTime">${opt.time || ""}</div>
        <div class="subjectMain">
          <div class="subjectLine1">
            <span class="subjectCode">${opt.code || ""}</span>
            <span class="subjectTypePill">${opt.type || ""}</span>
          </div>
          <div class="subjectName">${opt.name || opt.label || ""}</div>
        </div>
      `;

      item.addEventListener("click", () => onPick(opt));
      dayWrap.appendChild(item);
    }

    subjectsListEl.appendChild(dayWrap);
  }
}

function applySubjectSearch() {
  const q = qs("subjectSearch").value.trim().toLowerCase();
  const items = qs("subjectsList").querySelectorAll(".subjectItem");
  items.forEach((el) => {
    const hit = !q || (el.dataset.search || "").includes(q);
    el.style.display = hit ? "" : "none";
  });
}

function setSelectedSubjectUI(subject) {
  const box = qs("subjectSelected");
  if (!subject) {
    box.classList.add("hidden");
    box.textContent = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `
    <div><b>เลือกแล้ว ✅</b></div>
    <div>${subject.day || ""} • ${subject.time || ""}</div>
    <div><b>${subject.code || ""}</b> ${subject.name || ""} (${subject.type || ""})</div>
  `;
}

function openOverlay(id) { document.getElementById(id)?.classList.remove("hidden"); }
function closeOverlay(id) { document.getElementById(id)?.classList.add("hidden"); }

function prettyDMY(ymd) {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/* ===== time helpers ===== */
function clampInt(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
function pad2(n) {
  return String(n).padStart(2, "0");
}

/* ===== cancel-date day filter helpers ===== */
const TH_DAY_TO_JS = {
  "อาทิตย์": 0,
  "จันทร์": 1,
  "อังคาร": 2,
  "พุธ": 3,
  "พฤหัสบดี": 4,
  "ศุกร์": 5,
  "เสาร์": 6
};

function getCancelPicker() {
  // ถูกสร้างใน main.js
  return window.__cancelPicker || null;
}

export function initHolidayForm({ userId, displayName, subjectsUrl, submitUrl, onDone }) {
  qs("who").textContent = displayName ? `คุณ ${displayName}` : "ผู้ใช้ LINE";

  const modeEl = qs("mode");
  const resetBtn = qs("resetBtn");
  const titleEl = qs("title");

  const startDateEl = qs("startDate");
  const endDateEl = qs("endDate");
  const cancelDateEl = qs("cancelDate");
  const cancelDateBox = qs("cancelDateBox");
  const cancelDatePretty = document.getElementById("cancelDatePretty");

  // reminder inline
  const remNoneBtn = qs("remNoneBtn");
  const remSetBtn = qs("remSetBtn");
  const remPicker = qs("remPicker");
  const remDate = qs("remDate");
  const remDatePretty = qs("remDatePretty");
  const remHour = qs("remHour");
  const remMinute = qs("remMinute");

  const state = {
    groups: [],
    selectedSubject: null,
    submitting: false,
    reminderEnabled: false
  };

  function setReminderUI(enabled) {
    state.reminderEnabled = !!enabled;

    remNoneBtn.classList.toggle("isActive", !state.reminderEnabled);
    remSetBtn.classList.toggle("isActive", state.reminderEnabled);

    remNoneBtn.setAttribute("aria-selected", String(!state.reminderEnabled));
    remSetBtn.setAttribute("aria-selected", String(state.reminderEnabled));

    remPicker.classList.toggle("hidden", !state.reminderEnabled);

    if (state.reminderEnabled) {
      setTimeout(() => {
        remHour.focus();
        remHour.select();
      }, 0);
    }
  }

  function getReminderHHmm() {
    const hRaw = String(remHour.value ?? "").trim();
    const mRaw = String(remMinute.value ?? "").trim();
    if (!hRaw || !mRaw) return null;

    const h = clampInt(hRaw, 0, 23);
    const m = clampInt(mRaw, 0, 59);
    if (h === null || m === null) return null;

    return `${pad2(h)}:${pad2(m)}`;
  }

  function validate() {
    const btn = qs("submitBtn");
    if (state.submitting) {
      btn.disabled = true;
      return;
    }

    const modeOk =
      modeEl.value === "cancel_subject"
        ? !!(state.selectedSubject && cancelDateEl.value)
        : !!startDateEl.value;

    const reminderOk =
      !state.reminderEnabled
        ? true
        : !!(remDate.value && getReminderHHmm());

    btn.disabled = !(modeOk && reminderOk);
  }

  // ✅ ตั้ง filter ให้ปฏิทินยกคลาส เลือกได้เฉพาะวันของวิชาที่เลือก
  function applyCancelDateFilterForSubject(subject) {
    const picker = getCancelPicker();
    if (!picker) return;

    const thDay = subject?.day || "";
    const jsDow = TH_DAY_TO_JS[thDay];

    if (jsDow === undefined) {
      // ถ้าวิชาไม่มีวันชัดเจน -> ไม่ filter
      picker.set("disable", []);
      if (cancelDatePretty) cancelDatePretty.textContent = "";
      return;
    }

    picker.set("disable", [
      (date) => date.getDay() !== jsDow
    ]);

    // helper text ให้รู้ว่าเลือกได้เฉพาะวันอะไร
    if (cancelDatePretty) {
      cancelDatePretty.textContent = `เลือกได้เฉพาะวัน${thDay}เท่านั้น ✅`;
    }

    // ถ้าเคยเลือกวันที่ไว้แล้ว แต่ไม่ตรงวัน -> ล้างทันที
    if (cancelDateEl.value) {
      const d = picker.parseDate(cancelDateEl.value, "Y-m-d");
      if (d && d.getDay() !== jsDow) {
        picker.clear();
        cancelDateEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  function pickSubject(opt) {
    state.selectedSubject = opt;
    setSelectedSubjectUI(opt);

    cancelDateBox.classList.remove("hidden");

    // ✅ สำคัญ: ปรับ filter ปฏิทินยกคลาสตามวันวิชา
    applyCancelDateFilterForSubject(opt);

    renderSubjects(state.groups, state, pickSubject);
    applySubjectSearch();
    validate();
  }

  modeEl.addEventListener("change", () => {
    setModeUI(modeEl.value);
    showMsg("");
    validate();
  });

  qs("subjectSearch").addEventListener("input", applySubjectSearch);

  resetBtn.addEventListener("click", () => {
    titleEl.value = "";
    startDateEl.value = "";
    endDateEl.value = "";
    cancelDateEl.value = "";

    state.selectedSubject = null;
    setSelectedSubjectUI(null);
    cancelDateBox.classList.add("hidden");

    // ล้าง helper
    if (cancelDatePretty) cancelDatePretty.textContent = "";

    // reset cancel picker disable
    const picker = getCancelPicker();
    if (picker) picker.set("disable", []);

    // reset reminder: ไม่มีค่าเริ่มต้น
    remDate.value = "";
    remHour.value = "";
    remMinute.value = "";
    if (remDatePretty) remDatePretty.textContent = "";
    setReminderUI(false);

    if (state.groups.length) {
      renderSubjects(state.groups, state, pickSubject);
      applySubjectSearch();
    }

    showMsg("ล้างฟอร์มแล้ว ✅", "ok");
    validate();
  });

  startDateEl.addEventListener("change", validate);
  endDateEl.addEventListener("change", validate);
  cancelDateEl.addEventListener("change", validate);
  titleEl.addEventListener("input", validate);

  remNoneBtn.addEventListener("click", () => {
    setReminderUI(false);
    validate();
  });

  remSetBtn.addEventListener("click", () => {
    setReminderUI(true);
    validate();
  });

  // ✅ UX: เวลา พิมพ์ง่าย + auto jump (เวอร์ชันแก้บัคแล้ว)
  function enhanceTimeInput(inputEl, { max, onFull }) {
    let freshFocus = false;

    inputEl.addEventListener("focus", () => {
      freshFocus = true;
      setTimeout(() => inputEl.select(), 0);
    });

    inputEl.addEventListener("keydown", (e) => {
      const isDigit = e.key >= "0" && e.key <= "9";
      const isControl =
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Tab";

      if (isControl) return;

      if (!isDigit) {
        e.preventDefault();
        return;
      }

      const hasSelection = inputEl.selectionStart !== inputEl.selectionEnd;

      // เต็ม 2 ตัวแล้วและไม่ได้เลือก -> ไม่ให้พิมพ์เพิ่ม
      if (!hasSelection && String(inputEl.value || "").length >= 2) {
        e.preventDefault();
        return;
      }

      // โฟกัสใหม่ แล้วยังไม่เลือกข้อความ (บางเครื่อง select ไม่ทัน) -> ล้างก่อนตัวแรก
      if (freshFocus && !hasSelection) {
        inputEl.value = "";
      }
      freshFocus = false;
    });

    inputEl.addEventListener("input", () => {
      let v = String(inputEl.value || "").replace(/[^\d]/g, "");
      if (v.length > 2) v = v.slice(0, 2);

      if (v.length === 2) {
        const n = clampInt(v, 0, max);
        v = n === null ? "" : pad2(n);
      }

      inputEl.value = v;
      validate();

      if (inputEl.value.length === 2 && typeof onFull === "function") {
        onFull();
      }
    });

    inputEl.addEventListener("blur", () => {
      const v = String(inputEl.value || "").trim();
      if (!v) return;
      const n = clampInt(v, 0, max);
      inputEl.value = n === null ? "" : String(n);
      validate();
    });
  }

  enhanceTimeInput(remHour, {
    max: 23,
    onFull: () => {
      remMinute.focus();
      remMinute.select();
    }
  });

  enhanceTimeInput(remMinute, {
    max: 59,
    onFull: () => {}
  });

  // date picker for reminder date
  if (window.flatpickr) {
    flatpickr(remDate, {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      allowInput: false,
      disableMobile: true,
      minDate: "today",
      onReady: (_, __, instance) => {
        const lock = (el) => {
          if (!el) return;
          el.readOnly = true;
          el.setAttribute("inputmode", "none");
          el.setAttribute("autocomplete", "off");
          el.addEventListener("keydown", (e) => e.preventDefault());
          el.addEventListener("paste", (e) => e.preventDefault());
        };
        lock(instance.input);
        lock(instance.altInput);
      },
      onChange: (_, dateStr) => {
        if (remDatePretty) {
          remDatePretty.textContent = dateStr ? `เลือก: ${prettyDMY(dateStr)}` : "";
        }
        validate();
      }
    });
  }

  // submit
  qs("submitBtn").addEventListener("click", async () => {
    if (state.submitting) return;

    try {
      validate();
      if (qs("submitBtn").disabled) {
        showMsg("กรอกข้อมูลให้ครบก่อนนะ 🙂", "err");
        return;
      }

      state.submitting = true;
      setSubmitting(true);
      showMsg("กำลังบันทึก…");

      const mode = modeEl.value;
      const title = titleEl.value.trim();

      const hhmm = state.reminderEnabled ? getReminderHHmm() : null;
      const reminders = state.reminderEnabled
        ? [{ remind_at: `${remDate.value}T${hhmm}:00+07:00` }]
        : [];

      let payload;

      if (mode === "cancel_subject") {
        const date = cancelDateEl.value;
        const { start_at, end_at } = toIsoBangkokStartEnd(date, date);

        payload = {
          user_id: userId,
          type: "cancel",
          subject_id: state.selectedSubject.id,
          all_day: 1,
          start_at,
          end_at,
          title: title || `${state.selectedSubject.code} ${state.selectedSubject.name}`,
          note: null,
          reminders
        };
      } else {
        const start = startDateEl.value;
        const end = endDateEl.value || start;
        const { start_at, end_at } = toIsoBangkokStartEnd(start, end);

        payload = {
          user_id: userId,
          type: "holiday",
          subject_id: null,
          all_day: 1,
          start_at,
          end_at,
          title: title || "วันหยุด",
          note: null,
          reminders
        };
      }

      await submitHoliday({ submitUrl, payload });

      openOverlay("successOverlay");
      setTimeout(() => {
        closeOverlay("successOverlay");
        try { onDone?.(); } catch {}
      }, 900);

      showMsg("บันทึกสำเร็จ ✅", "ok");
    } catch (e) {
      showMsg(`บันทึกไม่สำเร็จ: ${String(e?.message || e)}`, "err");
    } finally {
      state.submitting = false;
      setSubmitting(false);
      validate();
    }
  });

  // load subjects
  async function loadSubjects() {
    try {
      showMsg("กำลังโหลดรายชื่อวิชา…");
      const groups = await fetchSubjectGroups({ subjectsUrl, userId });
      state.groups = Array.isArray(groups) ? groups : [];

      renderSubjects(state.groups, state, pickSubject);
      applySubjectSearch();
      showMsg("");
    } catch (e) {
      showMsg(`โหลดวิชาไม่สำเร็จ: ${String(e?.message || e)}`, "err");
    } finally {
      validate();
    }
  }

  setModeUI(modeEl.value);
  setReminderUI(false); // default = ไม่ตั้ง
  showMsg("");
  validate();
  loadSubjects();
}