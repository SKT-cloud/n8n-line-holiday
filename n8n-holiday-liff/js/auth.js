export async function initAndRequireLogin(liffId) {
  if (!window.liff) throw new Error("LIFF SDK not loaded");

  await liff.init({ liffId });

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return null;
  }

  const profile = await liff.getProfile();
  const idToken = liff.getIDToken();

  if (!idToken) {
    // Usually happens if LIFF is not opened inside LINE app / or channel settings issue
    throw new Error("ไม่พบ idToken (เปิดผ่าน LIFF ใน LINE และเช็ก LIFF settings)");
  }

  return { ...profile, idToken };
}
