import { fetchSubjects, createHoliday } from "./api.js";

const dayOrder = ["จันทร์","อังคาร","พุธ","พฤหัสบดี","พฤ","ศุกร์","เสาร์","อาทิตย์"];
function dayIndexTH(d){
  const i = dayOrder.indexOf(d);
  if (i !== -1) return i;
  // accept short form "พฤ"
  if (d === "พฤ") return dayOrder.indexOf("พฤ");
  return -1;
}

function pad2(n){ return String(n).padStart(2,"0"); }

function todayYMD(){
  const now = new Date();
  const y = now.getFullYear();
  const m = pad2(now.getMonth()+1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

function ymdToThai(ymd){
  if(!ymd) return "-";
  const [y,m,d] = String(ymd).split("-");
  if(!y||!m||!d) return "-";
  return `${d}/${m}/${y}`;
}

function nextDateForDayIndex(targetIdx){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for(let add=0; add<21; add++){
    const d = new Date(start);
    d.setDate(start.getDate()+add);
    // JS: 0=Sun ... 6=Sat
    const js = d.getDay();
    const th = js===0 ? 6 : js-1; // Mon->0
    if (th === targetIdx) {
      return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    }
  }
  return null;
}

function setMsg(el, text, kind){
  el.className = "msg" + (kind ? ` msg--${kind}` : "");
  el.textContent = text || "";
}

function groupByDay(items){
  const map = new Map();
  for(const it of items){
    const day = it.day || "-";
    if(!map.has(day)) map.set(day, []);
    map.get(day).push(it);
  }
  // keep weekday order if possible
  const keys = Array.from(map.keys()).sort((a,b)=>{
    const ia = dayIndexTH(a); const ib = dayIndexTH(b);
    if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return keys.map(k => ({ day:k, items: map.get(k) }));
}

function buildSubjectText(it){
  const time = `${it.start_time}-${it.end_time}`;
  const code = it.subject_code || "";
  const type = it.type || "";
  const name = it.subject_name || "";
  return { time, code, type, name };
}

export function initHolidayForm({ userId, displayName, idToken }) {
  // header
  const who = document.getElementById("who");
  if (who) who.textContent = displayName ? `คุณ ${displayName}` : "";

  const msgEl = document.getElementById("msg");
  const titleEl = document.getElementById("title");
  const noteEl = document.getElementById("note");

  const modeEl = document.getElementById("mode");
  const allDayBox = document.getElementById("allDayBox");
  const cancelBox = document.getElementById("cancelBox");

  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const cancelDateBox = document.getElementById("cancelDateBox");
  const cancelDateEl = document.getElementById("cancelDate");
  const cancelPrettyEl = document.getElementById("cancelDatePretty");

  const subjectSearchEl = document.getElementById("subjectSearch");
  const subjectsListEl = document.getElementById("subjectsList");
  const subjectsLoadingEl = document.getElementById("subjectsLoading");
  const selectedEl = document.getElementById("subjectSelected");

  // reminders
  const remNoneBtn = document.getElementById("remNoneBtn");
  const remSetBtn = document.getElementById("remSetBtn");
  const remPicker = document.getElementById("remPicker");
  const remList = document.getElementById("remList");
  const remAddBtn = document.getElementById("remAddBtn");

  // actions
  const resetBtn = document.getElementById("resetBtn");
  const submitBtn = document.getElementById("submitBtn");

  const state = {
    mode: modeEl?.value || "all_day",
    subjects: [],
    selectedSubject: null,
    cancelDate: "",
    remindersEnabled: false,
    reminders: [], // {date:'YYYY-MM-DD', hour:'09', minute:'00', fp?:instance}
  };

  const ensureOneReminder = () => {
    if (state.reminders.length === 0) {
      state.reminders.push({ date: "", hour: "09", minute: "00", fp: null });
    }
  };

  const setMode = (mode) => {
    state.mode = mode;
    if (mode === "all_day") {
      allDayBox.classList.remove("hidden");
      cancelBox.classList.add("hidden");
      state.selectedSubject = null;
      selectedEl.classList.add("hidden");
      cancelDateBox.classList.add("hidden");
      submitBtn.disabled = false;
    } else {
      allDayBox.classList.add("hidden");
      cancelBox.classList.remove("hidden");
      // need subject selection to enable submit
      submitBtn.disabled = !state.selectedSubject;
    }
    validate();
  };

  const setRemindersEnabled = (enabled) => {
    state.remindersEnabled = enabled;
    remNoneBtn.classList.toggle("isActive", !enabled);
    remSetBtn.classList.toggle("isActive", enabled);
    remPicker.classList.toggle("hidden", !enabled);

    if (enabled) {
      ensureOneReminder();
      renderReminders();
    } else {
      // destroy flatpickr instances
      for (const r of state.reminders) {
        try { r.fp?.destroy?.(); } catch {}
        r.fp = null;
      }
    }
    validate();
  };

  const renderSubjects = (items, filterText="") => {
    const q = String(filterText||"").trim().toLowerCase();
    subjectsListEl.innerHTML = "";

    const filtered = !q ? items : items.filter((it)=>{
      const hay = `${it.day} ${it.start_time}-${it.end_time} ${it.subject_code} ${it.subject_name} ${it.type} ${it.room}`.toLowerCase();
      return hay.includes(q);
    });

    const groups = groupByDay(filtered);

    for (const g of groups) {
      const wrap = document.createElement("div");
      wrap.className = "dayGroup";

      const h = document.createElement("div");
      h.className = "dayHeader";
      h.textContent = g.day;
      wrap.appendChild(h);

      for (const it of g.items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "subjectItem" + (state.selectedSubject?.id === it.id ? " isActive" : "");

        const t = buildSubjectText(it);

        const left = document.createElement("div");
        left.className = "subjectTime";
        left.textContent = t.time;

        const main = document.createElement("div");
        main.className = "subjectMain";

        const l1 = document.createElement("div");
        l1.className = "subjectLine1";

        const code = document.createElement("div");
        code.className = "subjectCode";
        code.textContent = t.code;

        const type = document.createElement("div");
        type.className = "subjectTypePill";
        type.textContent = t.type || "-";

        l1.append(code, type);

        const name = document.createElement("div");
        name.className = "subjectName";
        name.textContent = t.name;

        main.append(l1, name);
        btn.append(left, main);

        btn.addEventListener("click", () => {
          state.selectedSubject = it;
          submitBtn.disabled = false;

          // update active highlight
          for (const el of subjectsListEl.querySelectorAll(".subjectItem")) el.classList.remove("isActive");
          btn.classList.add("isActive");

          // show selected summary
          selectedEl.classList.remove("hidden");
          selectedEl.innerHTML = `
            <div style="font-weight:900;">เลือกแล้ว ✅</div>
            <div style="margin-top:2px;">
              ${it.day} • ${it.start_time}-${it.end_time}<br/>
              <b>${it.subject_code}</b> ${it.subject_name} (${it.type})
            </div>
          `;

          // show cancel date box + suggest next date for that weekday
          cancelDateBox.classList.remove("hidden");
          const idx = dayIndexTH(it.day);
          const suggest = idx>=0 ? nextDateForDayIndex(idx) : null;
          if (suggest && window.__cancelPicker) {
            window.__cancelPicker.set("minDate", "today");
            window.__cancelPicker.setDate(suggest, true);
            state.cancelDate = suggest;
            if (cancelPrettyEl) cancelPrettyEl.textContent = `แนะนำ: ${ymdToThai(suggest)} (${it.day}) ✅`;
          } else {
            if (cancelPrettyEl) cancelPrettyEl.textContent = `เลือกได้เฉพาะวัน ${it.day} เท่านั้น ✅`;
          }
          validate();
        });

        wrap.appendChild(btn);
      }

      subjectsListEl.appendChild(wrap);
    }

    if (filtered.length === 0) {
      subjectsListEl.innerHTML = `<div style="padding:10px;color:#64748b;font-size:13px;">ไม่พบวิชาที่ค้นหา</div>`;
    }
  };

  const renderReminders = () => {
    remList.innerHTML = "";

    state.reminders.forEach((r, idx) => {
      const row = document.createElement("div");
      row.className = "remRow";

      const head = document.createElement("div");
      head.className = "remRowHead";

      const title = document.createElement("div");
      title.className = "remRowTitle";
      title.textContent = `แจ้งเตือน #${idx+1}`;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn--ghost btn--sm";
      del.textContent = "ลบ";
      del.disabled = state.reminders.length === 1;
      del.addEventListener("click", ()=>{
        // destroy picker
        try { r.fp?.destroy?.(); } catch {}
        state.reminders.splice(idx, 1);
        renderReminders();
        validate();
      });

      head.append(title, del);

      const body = document.createElement("div");
      body.className = "remRowBody";

      // date
      const dateField = document.createElement("div");
      dateField.className = "remField";
      dateField.innerHTML = `<label>วันที่</label>`;
      const dateInput = document.createElement("input");
      dateInput.type = "text";
      dateInput.readOnly = true;
      dateInput.placeholder = "เลือกวันที่แจ้งเตือน";
      dateField.appendChild(dateInput);

      // time
      const timeField = document.createElement("div");
      timeField.className = "remField";
      timeField.innerHTML = `<label>เวลา</label>`;
      const timeRow = document.createElement("div");
      timeRow.className = "timeRow";

      const hour = document.createElement("input");
      hour.type = "number";
      hour.min = "0";
      hour.max = "23";
      hour.inputMode = "numeric";
      hour.value = r.hour ?? "09";

      const sep = document.createElement("div");
      sep.className = "timeSep";
      sep.textContent = ":";

      const minute = document.createElement("input");
      minute.type = "number";
      minute.min = "0";
      minute.max = "59";
      minute.inputMode = "numeric";
      minute.value = r.minute ?? "00";

      const clamp = (el, max) => {
        let v = parseInt(el.value, 10);
        if (Number.isNaN(v)) v = 0;
        if (v < 0) v = 0;
        if (v > max) v = max;
        el.value = pad2(v);
        return el.value;
      };

      hour.addEventListener("blur", ()=>{ r.hour = clamp(hour, 23); validate(); });
      minute.addEventListener("blur", ()=>{ r.minute = clamp(minute, 59); validate(); });

      timeRow.append(hour, sep, minute);
      timeField.appendChild(timeRow);

      body.append(dateField, timeField);

      row.append(head, body);
      remList.appendChild(row);

      // init flatpickr per row
      if (r.fp) {
        try { r.fp.destroy(); } catch {}
        r.fp = null;
      }
      r.fp = flatpickr(dateInput, {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d/m/Y",
        allowInput: false,
        disableMobile: true,
        minDate: "today",
        onReady: (_, __, instance) => {
          // lock typing
          const lock = (el) => {
            if (!el) return;
            el.readOnly = true;
            el.setAttribute("inputmode", "none");
            el.addEventListener("keydown", (e)=>e.preventDefault());
            el.addEventListener("paste", (e)=>e.preventDefault());
          };
          lock(instance.input);
          lock(instance.altInput);
        },
        onChange: (_, dateStr) => {
          r.date = dateStr || "";
          validate();
        },
      });

      // restore
      if (r.date) r.fp.setDate(r.date, true);
    });
  };

  const validate = () => {
    setMsg(msgEl, "", "");
    let ok = true;

    if (state.mode === "all_day") {
      if (!startDateEl?.value) ok = false;
    } else {
      if (!state.selectedSubject) ok = false;
      if (!state.cancelDate) ok = false;
    }

    if (state.remindersEnabled) {
      if (state.reminders.length === 0) ok = false;
      for (const r of state.reminders) {
        if (!r.date) ok = false;
        const hh = String(r.hour || "").padStart(2, "0");
        const mm = String(r.minute || "").padStart(2, "0");
        if (!/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm)) ok = false;
      }
    }

    submitBtn.disabled = !ok;
    return ok;
  };

  const buildPayload = () => {
    const title = String(titleEl.value || "").trim() || null;
    const note = String(noteEl.value || "").trim() || null;

    let type = "holiday";
    let subject_id = null;

    let start_at, end_at;

    if (state.mode === "all_day") {
      type = "holiday";
      const start = startDateEl.value;
      const end = endDateEl.value || start;
      // store as Bangkok tz fixed (00:00 to 23:59)
      start_at = `${start}T00:00:00+07:00`;
      end_at   = `${end}T23:59:59+07:00`;
    } else {
      type = "cancel";
      subject_id = state.selectedSubject?.id ?? null;
      const d = state.cancelDate;
      start_at = `${d}T00:00:00+07:00`;
      end_at   = `${d}T23:59:59+07:00`;
    }

    const reminders = [];
    if (state.remindersEnabled) {
      for (const r of state.reminders) {
        if (!r.date) continue;
        const hh = pad2(parseInt(r.hour, 10) || 0);
        const mm = pad2(parseInt(r.minute, 10) || 0);
        reminders.push({ remind_at: `${r.date}T${hh}:${mm}:00+07:00` });
      }
    }

    return {
      type,
      subject_id,
      all_day: 1,
      start_at,
      end_at,
      title,
      note,
      reminders,
    };
  };

  const resetForm = () => {
    titleEl.value = "";
    noteEl.value = "";
    modeEl.value = "all_day";
    setMode("all_day");

    try { document.getElementById("startDate")._flatpickr?.clear?.(); } catch {}
    try { document.getElementById("endDate")._flatpickr?.clear?.(); } catch {}
    try { window.__cancelPicker?.clear?.(); } catch {}
    state.cancelDate = "";

    state.selectedSubject = null;
    selectedEl.classList.add("hidden");
    cancelDateBox.classList.add("hidden");

    // reminders
    setRemindersEnabled(false);
    state.reminders = [];

    validate();
  };

  // ===== Events =====
  modeEl.addEventListener("change", ()=> setMode(modeEl.value));

  remNoneBtn.addEventListener("click", ()=> setRemindersEnabled(false));
  remSetBtn.addEventListener("click", ()=> setRemindersEnabled(true));

  remAddBtn.addEventListener("click", ()=>{
    state.reminders.push({ date:"", hour:"09", minute:"00", fp:null });
    renderReminders();
    validate();
  });

  resetBtn.addEventListener("click", resetForm);

  if (cancelDateEl) {
    cancelDateEl.addEventListener("change", ()=>{
      // flatpickr updates input value in Y-m-d
      state.cancelDate = cancelDateEl.value || "";
      // validate day matches subject day
      if (state.selectedSubject) {
        const idx = dayIndexTH(state.selectedSubject.day);
        if (idx >= 0 && state.cancelDate) {
          const d = new Date(state.cancelDate + "T00:00:00");
          const js = d.getDay();
          const th = js===0 ? 6 : js-1;
          if (th !== idx) {
            setMsg(msgEl, `เลือกได้เฉพาะวัน ${state.selectedSubject.day} เท่านั้นนะ 🥲`, "err");
            state.cancelDate = "";
            try { window.__cancelPicker?.clear?.(); } catch {}
          }
        }
      }
      validate();
    });
  }

  if (subjectSearchEl) {
    subjectSearchEl.addEventListener("input", ()=>{
      renderSubjects(state.subjects, subjectSearchEl.value);
    });
  }

  submitBtn.addEventListener("click", async ()=>{
    if (!validate()) return;
    submitBtn.disabled = true;
    setMsg(msgEl, "กำลังบันทึก…", "");

    try{
      const payload = buildPayload();
      const data = await createHoliday({ idToken, payload });

      setMsg(msgEl, "บันทึกสำเร็จ ✅", "ok");

      // ปิดหน้าต่าง LIFF ได้ ถ้าต้องการ
      setTimeout(()=>{ try { liff.closeWindow(); } catch {} }, 700);
      return data;
    }catch(e){
      setMsg(msgEl, `บันทึกไม่สำเร็จ: ${String(e?.message||e)}`, "err");
      validate();
    }
  });

  // ===== Init =====
  (async ()=>{
    // init mode + reminders
    setMode(state.mode);
    setRemindersEnabled(false);

    // load subjects (for cancel_subject mode)
    try{
      subjectsLoadingEl.classList.remove("hidden");
      const data = await fetchSubjects({ idToken });
      state.subjects = Array.isArray(data.items) ? data.items : [];
      subjectsLoadingEl.textContent = state.subjects.length ? "เลือกวิชาที่จะยกคลาสได้เลย ✅" : "ไม่พบข้อมูลวิชา";
      renderSubjects(state.subjects, "");
    }catch(e){
      subjectsLoadingEl.textContent = `โหลดวิชาไม่สำเร็จ: ${String(e?.message||e)}`;
    }
  })();
}
