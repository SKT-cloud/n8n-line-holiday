import { CONFIG } from "./config.js";

export async function initLiff() {
  if (!window.liff) throw new Error("LIFF SDK not loaded");

  const liffId = CONFIG.getLiffId();
  await window.liff.init({ liffId });

  if (!window.liff.isLoggedIn()) {
    window.liff.login();
    return;
  }

  // ID Token (ใช้ verify ใน Worker)
  const idToken = window.liff.getIDToken();
  if (!idToken) throw new Error("missing idToken (getIDToken)");

  const profile = await window.liff.getProfile();
  return { idToken, profile };
}
