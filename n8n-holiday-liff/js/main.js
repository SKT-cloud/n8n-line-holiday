import { CONFIG } from "./config.js";
import { initAndRequireLogin } from "./auth.js";
import { initHolidayForm } from "./form.js";

function showLoading(text) {
  const loading = document.getElementById("loading");
  const subtitle = loading.querySelector(".loading__subtitle");
  subtitle.textContent = text || "กำลังทำงาน...";
}

function showApp() {
  document.getElementById("loading").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

function initDatePickers() {
  const common = (placeholderText) => ({
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
        el.placeholder = placeholderText || el.placeholder || "";
        el.addEventListener("keydown", (e) => e.preventDefault());
        el.addEventListener("paste", (e) => e.preventDefault());
      };
      lock(instance.input);
      lock(instance.altInput);
    }
  });

  const startEl = document.getElementById("startDate");
  const endEl = document.getElementById("endDate");
  const cancelEl = document.getElementById("cancelDate");

  let endPicker = null;

  const startPicker = startEl
    ? flatpickr(startEl, {
        ...common("กรุณาเลือกวันที่เริ่ม"),
        onChange: (_, dateStr) => {
          if (endPicker) {
            endPicker.set("minDate", dateStr || "today");
            if (endPicker.input.value && endPicker.input.value < dateStr) {
              endPicker.clear();
              endPicker.input.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        }
      })
    : null;

  if (endEl) {
    endPicker = flatpickr(endEl, {
      ...common("หากหยุดวันเดียว สามารถเว้นไว้ได้"),
      minDate: startPicker?.input?.value || "today"
    });
  }

  // ✅ สำคัญ: เก็บ instance ของ cancelDate picker ไว้ให้ form.js ไปปรับ disable ได้
  if (cancelEl) {
    window.__cancelPicker = flatpickr(cancelEl, {
      ...common("กรุณาเลือกวันที่ยกคลาส"),
      onChange: () => {
        // ให้ form.js validate ได้เสมอ
        cancelEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  } else {
    window.__cancelPicker = null;
  }
}

(async () => {
  try {
    showLoading("กำลังตรวจสอบการเข้าสู่ระบบ LINE 🔐");

    const profile = await initAndRequireLogin(CONFIG.LIFF_ID);
    if (!profile) {
      showLoading("กำลังพาไปหน้า Login… ถ้าไม่เด้ง ให้เช็ก Allowed domains/Endpoint URL");
      return;
    }

    showLoading("กำลังโหลดฟอร์ม…");
    showApp();
    initDatePickers();

    initHolidayForm({
      userId: profile.userId,
      displayName: profile.displayName,
      subjectsUrl: CONFIG.N8N_SUBJECTS_URL,
      submitUrl: CONFIG.N8N_SUBMIT_URL,
      onDone: () => {
        try { liff.closeWindow(); } catch {}
      }
    });
  } catch (e) {
    const loading = document.getElementById("loading");
    loading.innerHTML = `
      <div class="loading__box">
        <div class="loading__title">เกิดข้อผิดพลาด ❌</div>
        <div class="loading__subtitle">${String(e?.message || e)}</div>
        <div style="margin-top:10px;color:#666;font-size:12px;">
          ตรวจสอบ CONFIG (LIFF_ID/URLs) และเปิดจากใน LINE LIFF
        </div>
      </div>
    `;
  }
})();