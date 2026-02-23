import { CONFIG } from "./config.js";

async function requestJson(path, { method="GET", idToken, body } = {}) {
  const url = CONFIG.joinUrl(CONFIG.WORKER_BASE, path);
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function fetchSubjects({ idToken }) {
  // ✅ Worker: GET /liff/subjects
  const data = await requestJson("/liff/subjects", { method: "GET", idToken });
  return data.items || [];
}

export async function createHoliday({ idToken, payload }) {
  // ✅ Worker: POST /liff/holidays/create
  return requestJson("/liff/holidays/create", { method: "POST", idToken, body: payload });
}
