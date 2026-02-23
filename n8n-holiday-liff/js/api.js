import { CONFIG } from "./config.js";

function joinUrl(base, path) {
  const b = String(base).replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

async function requestJson(url, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function fetchSubjects({ idToken }) {
  const url = joinUrl(CONFIG.WORKER_BASE, CONFIG.SUBJECTS_URL);
  return requestJson(url, { method: "GET", token: idToken });
}

export async function createHoliday({ idToken, payload }) {
  const url = joinUrl(CONFIG.WORKER_BASE, CONFIG.CREATE_URL);
  return requestJson(url, { method: "POST", token: idToken, body: payload });
}
