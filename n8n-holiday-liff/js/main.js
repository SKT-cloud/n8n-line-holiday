import { CONFIG } from "./config.js";
import { initAndRequireLogin } from "./auth.js";
import { initHolidayForm } from "./form.js";

function lockFlatpickr(instance){
  const lock = (el) => {
    if (!el) return;
    el.readOnly = true;
    el.setAttribute("inputmode", "none");
    el.addEventListener("keydown", (e)=>e.preventDefault());
    el.addEventListener("paste", (e)=>e.preventDefault());
  };
  lock(instance.input);
  lock(instance.altInput);
}

async function boot() {
  const loading = document.getElementById("loading");
  const app = document.getElementById("app");

  try {
    const user = await initAndRequireLogin(CONFIG.LIFF_ID);
    if (!user) return; // redirecting to login

    // show UI
    loading.classList.add("hidden");
    app.classList.remove("hidden");

    // flatpickr for dates
    flatpickr("#startDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      disableMobile: true,
      minDate: "today",
      onReady: (_, __, inst) => lockFlatpickr(inst),
      onChange: (_, dateStr) => {
        // If endDate empty, keep it empty (single day allowed)
        // But if endDate exists and is earlier, clear it.
        const end = document.getElementById("endDate");
        if (end?.value && end.value < dateStr) {
          try { end._flatpickr.clear(); } catch {}
        }
      },
    });

    flatpickr("#endDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      disableMobile: true,
      minDate: "today",
      onReady: (_, __, inst) => lockFlatpickr(inst),
    });

    // cancel date picker (we expose to form.js to auto-set suggested date)
    window.__cancelPicker = flatpickr("#cancelDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      disableMobile: true,
      minDate: "today",
      onReady: (_, __, inst) => lockFlatpickr(inst),
    });

    initHolidayForm({
      userId: user.userId,
      displayName: user.displayName,
      idToken: user.idToken,
    });
  } catch (e) {
    console.error(e);
    loading.innerHTML = `
      <div class="loading__box">
        <div class="loading__title">เปิดฟอร์มไม่สำเร็จ 🥲</div>
        <div class="loading__subtitle">${String(e?.message || e)}</div>
      </div>
    `;
  }
}

boot();
