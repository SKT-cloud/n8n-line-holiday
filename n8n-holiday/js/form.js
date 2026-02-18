import { buildHolidayPayload, buildCancelPayload, toIsoBangkokStartEnd } from "./api.js";

function qs(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
}

function showMsg(text, type = "info") {
  const msg = qs("msg");
  msg.className = `msg msg--${type}`;
  msg.textContent = text || "";
}

function setSubmitting(isSubmitting) {
  const btn = qs("submitBtn");
  btn.disabled = isSubmitting;
  btn.dataset.loading = isSubmitting ? "1" : "0";
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

function normalizeDayOrder(day) {
  const order = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
  const idx = order.indexOf(day);
  return idx === -1 ? 999 : idx;
}

// ---- Subjects Block Picker ----
function renderSubjects(groups, onPick, state) {
  const subjectsListEl = qs("subjectsList");
  subjectsListEl.innerHTML = "";

  groups
    .slice()
    .sort((a, b) => normalizeDayOrder(a.day) - normalizeDayOrder(b.day))
    .forEach((g) => {
      const dayWrap = document.createElement("div");
      dayWrap.className = "dayGroup";

      const dayTitle = document.createElement("div");
      dayTitle.className = "dayTitle";
      dayTitle.textContent = g.day;

      dayWrap.appendChild(dayTitle);

      (g.options || []).forEach((opt) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "subjectItem";
        item.dataset.subjectId = opt.id;

        const isSelected = state.selectedSubject?.id === opt.id;
        if (isSelected) item.classList.add("is-selected");

        // ให้ข้อมูลที่ค้นหาได้แน่น ๆ
        const searchable = [
          opt.time,
          opt.code,
          opt.name,
          opt.type,
          opt.day,
          opt.section
        ].filter(Boolean).join(" ").toLowerCase();
        item.dataset.search = searchable;

        item.innerHTML = `
          <div class="subjectRow">
            <div class="subjectTime">${opt.time || ""}</div>
            <div class="subjectMain">
              <div class="subjectCode">${opt.code || ""}</div>
              <div class="subjectName">${opt.name || ""}</div>
            </div>
            <div class="subjectType">${opt.type || ""}</div>
          </div>
        `;

        item.addEventListener("click", () => onPick(opt));
        dayWrap.appendChild(item);
      });

      subjectsListEl.appendChild(dayWrap);
    });
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
    <div class="selected__title">เลือกแล้ว ✅</div>
    <div class="selected__line">${subject.day || ""} • ${subject.time || ""}</div>
    <div class="selected__line"><b>${subject.code || ""}</b> ${subject.name || ""} (${subject.type || ""})</div>
  `;
}

// ---- Main ----
export function initHolidayForm({ userId, displayName, subjectsUrl, submitUrl, onDone }) {
  const who = qs("who");
  who.textContent = displayName ? `คุณ ${displayName}` : "ผู้ใช้ LINE";

  const modeEl = qs("mode");
  const resetBtn = qs("resetBtn");

  const startDateEl = qs("startDate");
  const endDateEl = qs("endDate");
  const cancelDateEl = qs("cancelDate");
  const cancelDateBox = qs("cancelDateBox");
  const titleEl = qs("title");

  const state = {
    groups: [],
    selectedSubject: null,
    submitting: false,
  };

  // UI init
  setModeUI(modeEl.value);
  showMsg("", "info");

  modeEl.addEventListener("change", () => {
    setModeUI(modeEl.value);
    showMsg("", "info");
    validate();
  });

  resetBtn.addEventListener("click", () => {
    titleEl.value = "";
    startDateEl.value = "";
    endDateEl.value = "";
    cancelDateEl.value = "";

    state.selectedSubject = null;
    setSelectedSubjectUI(null);
    cancelDateBox.classList.add("hidden");

    // รีเรนเดอร์เพื่อเคลียร์ highlight
    if (state.groups.length) {
      renderSubjects(state.groups, pickSubject, state);
      applySubjectSearch();
    }

    showMsg("ล้างฟอร์มแล้ว ✅", "info");
    validate();
  });

  qs("subjectSearch").addEventListener("input", () => applySubjectSearch());

  function pickSubject(opt) {
    state.selectedSubject = opt;
    setSelectedSubjectUI(opt);

    // highlight selected
    renderSubjects(state.groups, pickSubject, state);
    applySubjectSearch();

    cancelDateBox.classList.remove("hidden");
    validate();
  }

  async function loadSubjects() {
    try {
      showMsg("กำลังโหลดรายชื่อวิชา…", "info");
      const res = await fetch(`${subjectsUrl}?user_id=${encodeURIComponent(userId)}`, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!res.ok) throw new Error(`โหลดวิชาไม่สำเร็จ (${res.status})`);
      const data = await res.json();

      state.groups = Array.isArray(data) ? data : [];
      renderSubjects(state.groups, pickSubject, state);
      applySubjectSearch();

      showMsg("", "info");
    } catch (e) {
      showMsg(`โหลดวิชาไม่สำเร็จ: ${String(e.message || e)}`, "error");
      // ให้ยังใช้งาน all_day ได้ต่อ
    } finally {
      validate();
    }
  }

  function validate() {
    const btn = qs("submitBtn");
    const mode = modeEl.value;

    if (state.submitting) {
      btn.disabled = true;
      return;
    }

    if (mode === "cancel_subject") {
      const ok = !!state.selectedSubject && !!cancelDateEl.value;
      btn.disabled = !ok;
      return;
    }

    // all_day
    const ok = !!startDateEl.value;
    btn.disabled = !ok;
  }

  startDateEl.addEventListener("change", validate);
  endDateEl.addEventListener("change", validate);
  cancelDateEl.addEventListener("change", validate);
  titleEl.addEventListener("input", validate);

  // ---- Submit handler (จุดที่คุณบอก “ต่อไปตอนกดบันทึก()”) ----
  qs("submitBtn").addEventListener("click", async () => {
    if (state.submitting) return;

    try {
      validate();
      if (qs("submitBtn").disabled) {
        showMsg("กรอกข้อมูลให้ครบก่อนนะ 🙂", "error");
        return;
      }

      state.submitting = true;
      setSubmitting(true);
      showMsg("กำลังบันทึก…", "info");

      const mode = modeEl.value;
      const title = titleEl.value.trim() || null;

      let payload;

      if (mode === "cancel_subject") {
        const date = cancelDateEl.value;
        const { start_at, end_at } = toIsoBangkokStartEnd(date, date);

        payload = {
          user_id: userId,
          type: "cancel",
          subject_id: state.selectedSubject.id, // composite id
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

      // POST
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { }

      if (!res.ok) {
        const errMsg = json?.message || json?.error || text || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      document.getElementById("successOverlay").classList.remove("hidden");

      setTimeout(() => {
        try { liff.closeWindow(); } catch { }
      }, 1200);


      // ปิดหน้าหลังสำเร็จ (ให้เห็นข้อความแป๊บหนึ่ง)
      setTimeout(() => {
        try { onDone?.(); } catch { }
      }, 500);

    } catch (e) {
      showMsg(`บันทึกไม่สำเร็จ: ${String(e.message || e)}`, "error");
    } finally {
      state.submitting = false;
      setSubmitting(false);
      validate();
    }
  });

  // init load (โหลดวิชาสำหรับ cancel)
  loadSubjects();
  validate();
}
