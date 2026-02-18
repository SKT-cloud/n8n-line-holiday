import { fetchSubjectGroups, submitHoliday, submitReminders } from "./api.js";

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
  // รองรับ option แบบ {subject_id,label,meta} ที่ n8n ส่งมา
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

  // fallback กันพัง
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

/* overlays */
function openOverlay(id) { document.getElementById(id)?.classList.remove("hidden"); }
function closeOverlay(id) { document.getElementById(id)?.classList.add("hidden"); }

/* ===== reminder UI helpers ===== */

function buildSummaryText(payload, selectedSubject) {
  const start = String(payload.start_at || "").slice(0, 10);
  const end = String(payload.end_at || "").slice(0, 10);
  const dateText = start === end ? start : `${start} – ${end}`;

  if (payload.type === "cancel") {
    const subj = selectedSubject
      ? `${selectedSubject.code} ${selectedSubject.name} (${selectedSubject.type})`
      : "ยกคลาส";
    return `${subj}\nวันที่: ${dateText}`;
  }
  return `วันหยุด\nวันที่: ${dateText}`;
}

// ✅ FIX: รองรับ response แบบ Object หรือ Array (ของคุณเป็น Array)
function extractHolidayId(result) {
  const r = Array.isArray(result) ? result[0] : result;
  return r?.id ?? r?.holiday_id ?? r?.data?.id ?? null;
}

function buildTimeOptions30Min(selectEl) {
  const times = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 22 && m > 0) continue;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }
  }
  selectEl.innerHTML = times.map(t => `<option value="${t}">${t}</option>`).join("");
  selectEl.value = "09:00";
}

function nowBangkokYMD() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDMY(ymd) {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export function initHolidayForm({ userId, displayName, subjectsUrl, submitUrl, remindersUrl, onDone }) {
  qs("who").textContent = displayName ? `คุณ ${displayName}` : "ผู้ใช้ LINE";

  const modeEl = qs("mode");
  const resetBtn = qs("resetBtn");
  const titleEl = qs("title");

  const startDateEl = qs("startDate");
  const endDateEl = qs("endDate");
  const cancelDateEl = qs("cancelDate");
  const cancelDateBox = qs("cancelDateBox");

  // reminder overlays
  const askCloseBtn = document.getElementById("reminderCloseBtn");
  const askSetBtn = document.getElementById("reminderSetBtn");
  const pickBackBtn = document.getElementById("reminderPickBackBtn");
  const pickSaveBtn = document.getElementById("reminderPickSaveBtn");
  const askSummaryEl = document.getElementById("reminderAskSummary");

  const remOptEl = document.getElementById("reminderOptions");
  const remCustomBox = document.getElementById("reminderCustomBox");
  const remCustomDate = document.getElementById("reminderCustomDate");
  const remCustomDatePretty = document.getElementById("reminderCustomDatePretty");
  const remCustomTime = document.getElementById("reminderCustomTime");
  const remPickMsg = document.getElementById("reminderPickMsg");

  const state = {
    groups: [],
    selectedSubject: null,
    submitting: false,
    lastSaved: null // { holidayId, payload }
  };

  function setRemMsg(text, type = "") {
    if (!remPickMsg) return;
    remPickMsg.className = "msg" + (type ? ` msg--${type}` : "");
    remPickMsg.textContent = text || "";
  }

  function validate() {
    const btn = qs("submitBtn");
    if (state.submitting) {
      btn.disabled = true;
      return;
    }
    if (modeEl.value === "cancel_subject") {
      btn.disabled = !(state.selectedSubject && cancelDateEl.value);
    } else {
      btn.disabled = !startDateEl.value;
    }
  }

  function pickSubject(opt) {
    state.selectedSubject = opt;
    setSelectedSubjectUI(opt);
    cancelDateBox.classList.remove("hidden");

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

  /* ===== reminder presets (Google Calendar style) ===== */
  const PRESETS = [
    { key: "d0_0900", label: "วันเริ่ม 09:00", hint: "วันเดียวกับกำหนดการ", days_before: 0, time: "09:00" },
    { key: "d1_0900", label: "1 วันก่อน 09:00", hint: "แนะนำสำหรับส่วนใหญ่", days_before: 1, time: "09:00", default: true },
    { key: "d1_1700", label: "1 วันก่อน 17:00", hint: "เตือนช่วงเย็น", days_before: 1, time: "17:00" },
    { key: "d2_0900", label: "2 วันก่อน 09:00", hint: "เผื่อวางแผนล่วงหน้า", days_before: 2, time: "09:00" },
    { key: "custom", label: "กำหนดเอง", hint: "เลือกวัน + เวลา เอง" }
  ];

  function renderReminderOptions() {
    if (!remOptEl) return;

    remOptEl.innerHTML = PRESETS.map(p => {
      const checked = p.default ? "checked" : "";
      return `
        <div class="remItem">
          <div class="remLeft">
            <input type="checkbox" class="remCk" data-key="${p.key}" ${checked} />
            <div class="remText">
              <div class="remLabel">${p.label}</div>
              <div class="remHint">${p.hint}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const onChange = () => {
      const customChecked = !!remOptEl.querySelector('.remCk[data-key="custom"]')?.checked;
      remCustomBox?.classList.toggle("hidden", !customChecked);

      // ถ้าเลือก custom ต้องมีวัน+เวลา
      if (pickSaveBtn) {
        if (!customChecked) pickSaveBtn.disabled = false;
        else pickSaveBtn.disabled = !(remCustomDate?.value && remCustomTime?.value);
      }
    };

    remOptEl.querySelectorAll(".remCk").forEach(ck => ck.addEventListener("change", onChange));
    onChange();
  }

  function initCustomReminderInputs() {
    if (!remCustomTime || !remCustomDate) return;

    buildTimeOptions30Min(remCustomTime);

    // init flatpickr สำหรับ custom date (readonly)
    if (window.flatpickr) {
      flatpickr(remCustomDate, {
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
          if (remCustomDatePretty) {
            remCustomDatePretty.textContent = dateStr ? `เลือก: ${prettyDMY(dateStr)}` : "";
          }
          const customChecked = !!remOptEl?.querySelector('.remCk[data-key="custom"]')?.checked;
          if (pickSaveBtn) pickSaveBtn.disabled = customChecked ? !(remCustomDate.value && remCustomTime.value) : false;
        }
      });
    }

    // default date = วันนี้
    if (!remCustomDate.value) {
      remCustomDate.value = nowBangkokYMD();
      if (remCustomDatePretty) remCustomDatePretty.textContent = `เลือก: ${prettyDMY(remCustomDate.value)}`;
    }

    remCustomTime.addEventListener("change", () => {
      const customChecked = !!remOptEl?.querySelector('.remCk[data-key="custom"]')?.checked;
      if (pickSaveBtn) pickSaveBtn.disabled = customChecked ? !(remCustomDate.value && remCustomTime.value) : false;
    });
  }

  function collectReminders() {
    const keys = Array.from(remOptEl?.querySelectorAll(".remCk") || [])
      .filter(el => el.checked)
      .map(el => el.getAttribute("data-key"));

    const reminders = [];

    for (const key of keys) {
      if (key === "custom") continue;
      const p = PRESETS.find(x => x.key === key);
      if (!p) continue;
      reminders.push({ days_before: p.days_before, time: p.time });
    }

    if (keys.includes("custom")) {
      const d = remCustomDate?.value;
      const t = remCustomTime?.value;
      if (d && t) reminders.push({ remind_at: `${d}T${t}:00+07:00` });
    }

    return reminders;
  }

  /* ===== submit holiday ===== */
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
          reminders: []
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
          reminders: []
        };
      }

      const res = await submitHoliday({ submitUrl, payload });

      const holidayId = extractHolidayId(res); // ✅ FIXED
      state.lastSaved = { holidayId, payload };

      // show check animation
      openOverlay("successOverlay");

      // ask reminders after animation
      setTimeout(() => {
        closeOverlay("successOverlay");

        if (askSummaryEl) askSummaryEl.textContent = buildSummaryText(payload, state.selectedSubject);
        openOverlay("reminderAskOverlay");

        if (askCloseBtn) {
          askCloseBtn.onclick = () => {
            closeOverlay("reminderAskOverlay");
            try { onDone?.(); } catch {}
          };
        }

        if (askSetBtn) {
          askSetBtn.onclick = () => {
            closeOverlay("reminderAskOverlay");
            setRemMsg("");
            renderReminderOptions();
            initCustomReminderInputs();
            openOverlay("reminderPickOverlay");
          };
        }
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

  // reminder pick actions
  if (pickBackBtn) {
    pickBackBtn.onclick = () => {
      closeOverlay("reminderPickOverlay");
      openOverlay("reminderAskOverlay");
    };
  }

  if (pickSaveBtn) {
    pickSaveBtn.onclick = async () => {
      try {
        setRemMsg("กำลังบันทึกแจ้งเตือน…");
        pickSaveBtn.disabled = true;

        const holidayId = state.lastSaved?.holidayId;
        if (!holidayId) {
          throw new Error("ไม่มี holiday id จาก webhook submit (ตอนนี้คุณตอบกลับมาเป็น array แล้วแก้แล้ว แต่ยังไม่เจอ id)");
        }

        const reminders = collectReminders();
        if (!reminders.length) {
          setRemMsg("ไม่ได้เลือกแจ้งเตือน ✅", "ok");
          setTimeout(() => {
            closeOverlay("reminderPickOverlay");
            try { onDone?.(); } catch {}
          }, 600);
          return;
        }

        await submitReminders({
          remindersUrl,
          payload: { user_id: userId, holiday_id: holidayId, reminders }
        });

        setRemMsg("บันทึกแจ้งเตือนสำเร็จ ✅", "ok");
        setTimeout(() => {
          closeOverlay("reminderPickOverlay");
          try { onDone?.(); } catch {}
        }, 700);
      } catch (e) {
        setRemMsg(`ตั้งแจ้งเตือนไม่สำเร็จ: ${String(e?.message || e)}`, "err");
        pickSaveBtn.disabled = false;
      }
    };
  }

  /* ===== load subjects ===== */
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
  showMsg("");
  validate();
  loadSubjects();
}
