// ============================================================================
// KONFIGURASI FIREBASE REALTIME DATABASE — ESCAPE FROM TARTARUS
// ============================================================================
// CARA MENGISI:
// 1. Buka Firebase Console (https://console.firebase.google.com/)
// 2. Pilih Project Anda -> Project Settings (ikon gerigi) -> Your Apps -> Web (</>)
// 3. Salin isi `firebaseConfig` dan ganti nilai placeholder di bawah ini!
// 4. Pastikan Anda sudah mengaktifkan "Realtime Database" (disarankan region Singapore).
//
// Catatan: Anda juga bisa menempelkan (paste) konfigurasi Firebase langsung di
// menu "Multiplayer Room" pada website untuk mengetes cepat sebelum mengedit file ini.

window.EFT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBigu5CGrztdZLEyQA86a42nhMT5PUR4mQ",
  authDomain: "eft-trialnerror.firebaseapp.com",
  databaseURL: "https://eft-trialnerror-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "eft-trialnerror",
  storageBucket: "eft-trialnerror.firebasestorage.app",
  messagingSenderId: "1021355164090",
  appId: "1:1021355164090:web:665b843a342eb8feecdd83",
  measurementId: "G-83PMY7WMLE"
};

window.EFT_FB_RUNTIME_KEY = "EFT_FB_RUNTIME_CONFIG";

window.EFT_GET_FIREBASE_CONFIG = function () {
  // 1. Cek jika file firebaseConfig.js sudah diisi oleh pemilik repo
  const fileCfg = window.EFT_FIREBASE_CONFIG || (typeof firebaseConfig !== "undefined" ? firebaseConfig : null);
  if (
    fileCfg &&
    typeof fileCfg.databaseURL === "string" &&
    fileCfg.databaseURL.startsWith("https://") &&
    !fileCfg.databaseURL.includes("PASTE_PROJECT_ID") &&
    fileCfg.apiKey &&
    !fileCfg.apiKey.includes("PASTE_API_KEY")
  ) {
    return fileCfg;
  }

  // 2. Cek jika pengguna sudah menempelkan config sementara lewat menu Multiplayer UI
  try {
    const raw = localStorage.getItem(window.EFT_FB_RUNTIME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.databaseURL === "string" && parsed.databaseURL.startsWith("https://")) {
        return parsed;
      }
    }
  } catch (e) {}

  return null;
};

window.EFT_SET_RUNTIME_FIREBASE_CONFIG = function (configInput) {
  let obj = configInput;
  if (typeof configInput === "string") {
    // Mendukung paste langsung blok JS `const firebaseConfig = { ... };` atau JSON murni
    const cleaned = configInput
      .replace(/const\s+firebaseConfig\s*=\s*/i, "")
      .replace(/;+\s*$/, "")
      .trim();
    // Ubah key JS tanpa tanda kutip (apiKey: "...") menjadi JSON valid
    const jsonLike = cleaned
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/,\s*}/g, "}");
    obj = JSON.parse(jsonLike);
  }
  if (!obj || !obj.databaseURL || !obj.databaseURL.startsWith("https://")) {
    throw new Error("databaseURL tidak valid. Pastikan Anda sudah membuat Realtime Database di Firebase Console.");
  }
  localStorage.setItem(window.EFT_FB_RUNTIME_KEY, JSON.stringify(obj));
  return obj;
};

window.EFT_CLEAR_RUNTIME_FIREBASE_CONFIG = function () {
  try {
    localStorage.removeItem(window.EFT_FB_RUNTIME_KEY);
  } catch (e) {}
};

window.EFT_IS_FIREBASE_READY = function () {
  if (typeof firebase === "undefined" || typeof firebase.database !== "function") {
    return false;
  }
  return window.EFT_GET_FIREBASE_CONFIG() !== null;
};
