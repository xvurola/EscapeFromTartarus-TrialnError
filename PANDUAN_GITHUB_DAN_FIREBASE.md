# Panduan Lengkap: GitHub Pages + Firebase Realtime Database + Optimasi Aset

Panduan ini dirancang khusus agar mudah diikuti tanpa latar belakang pemrograman, mencakup **cara mengatur folder arsip vs website**, **cara memperkecil ukuran gambar agar ringan di RAM HP**, **cara setup Firebase Realtime Database (Gratis)**, dan **cara mempublikasikan ke GitHub Pages**.

---

## 1. Struktur Folder Baru (Arsip Editing vs Produksi Website)

Agar file `.psd` (>1 GB) tidak membebani GitHub, browser, maupun RAM komputer saat membuka project, file website kini dipisahkan ke folder yang bersih:

### Folder yang DI-UPLOAD ke GitHub Pages (Ringan & Rapi):
- [`index.html`](file:///x:/Projects/.ProjectEscapeFromTartarus/index.html) — Halaman utama website game.
- [`playtest/`](file:///x:/Projects/.ProjectEscapeFromTartarus/playtest/) — Berisi logika game (`app.js`), data kartu/rules (`gameData.js`), tema (`styles.css`), dan konfigurasi Firebase (`firebaseConfig.js`).
- [`assets/`](file:///x:/Projects/.ProjectEscapeFromTartarus/assets/) — Berisi **khusus gambar final** untuk web:
  - `assets/maps/` — `board_v2.png` dan `a3_grid.png`
  - `assets/cards/board/` — 19 kartu Positive, Negative, dan Global Event (`pos_*.png`, `neg_*.png`, `ge_*.png`)
  - `assets/cards/characters/bocchi/` — 7 kartu Bocchi
  - `assets/cards/characters/aventurine/` — 6 kartu Aventurine
  - `assets/cards/characters/lilith/` — 6 kartu Lilith
  - `assets/cards/characters/joker/` — 6 kartu Joker
- [`.github/workflows/deploy-pages.yml`](file:///x:/Projects/.ProjectEscapeFromTartarus/.github/workflows/deploy-pages.yml) & [`.nojekyll`](file:///x:/Projects/.ProjectEscapeFromTartarus/.nojekyll) — Otomatisasi GitHub Pages.

### Folder Arsip Lokal (Otomatis Diabaikan oleh [`.gitignore`](file:///x:/Projects/.ProjectEscapeFromTartarus/.gitignore)):
- `Character/`, `Board Card/`, `Map/`, `Turns/`, `Changes/`, `TempPSDs/`, serta semua file `.psd`, `.docx`, dan `.pdf` **tetap aman di komputer Anda** dan tidak akan ikut ter-upload ke GitHub.
- **Tips Manajemen File:** Jika suatu hari Anda mengedit kartu di Photoshop dan mengekspor PNG baru ke folder arsip `Character/` atau `Board Card/`, Anda cukup menjalankan `sync_web_assets.py` (atau menimpa file PNG di `assets/cards/...` dengan nama yang sama) agar website langsung memakai gambar terbaru.

---

## 2. Saran Optimasi Ukuran Gambar agar Tidak Membebani RAM HP

Saat ini, beberapa gambar hasil ekspor cetak berukuran sangat besar:
- **Peta `board_v2.png` (`4960 × 3507 px`)**: Meskipun ukuran filenya hanya 1.4 MB di harddisk, ketika dibuka oleh browser HP, gambar beresolusi 4960×3507 akan memakan sekitar **~70 MB RAM GPU** hanya untuk satu gambar!
- **Kartu Karakter (`~800 × 1160 px`, 1 MB per kartu)**: Jika puluhan kartu dibuka di galeri *Character Compendium*, total memori RAM yang terpakai di HP bisa membengkak.

### Cara Memperkecil Gambar Secara Otomatis (Offline, Tanpa Install Aplikasi):
Kami sudah menyiapkan alat kompresi offline di **[`tools/compress_assets.html`](file:///x:/Projects/.ProjectEscapeFromTartarus/tools/compress_assets.html)** (dan di kode website semua gambar kartu sudah memakai `loading="lazy" decoding="async"`).

1. Buka file **[`tools/compress_assets.html`](file:///x:/Projects/.ProjectEscapeFromTartarus/tools/compress_assets.html)** dengan cara *double-click* di browser.
2. **Untuk Peta:**
   - Pilih preset **`Peta Board — Resize PNG (Max Lebar 1920px, Nama Tetap .png)`**.
   - Tarik & lepas (*drag-and-drop*) file `assets/maps/board_v2.png` dan `a3_grid.png` → Download hasilnya dan timpa ke `assets/maps/`.
   - *Hasil:* Pemakaian RAM di HP turun drastis dari **~70 MB menjadi ~10 MB**, peta tetap tajam!
3. **Untuk Kartu Skill & Kartu Board:**
   - Pilih preset **`Kartu Skill/Board — Resize PNG (Max Tinggi 560px, Nama Tetap .png)`**.
   - Tarik & lepas seluruh gambar dari `assets/cards/` → Download hasilnya dan timpa kembali ke folder `assets/cards/` dengan nama yang sama.
   - *Hasil:* Total ukuran aset website turun dari **23.8 MB menjadi sekitar ~4–6 MB** dan loading di HP menjadi sangat cepat!
4. *(Alternatif online: Anda juga bisa menggunakan situs gratis **https://tinypng.com** atau **https://squoosh.app**).*

---

## 3. Cara Setup Firebase Realtime Database (Gratis - Spark Plan)

Firebase Spark Plan gratis menyediakan kuota **100 koneksi bersamaan** dan **10 GB transfer/bulan**, sangat cukup untuk playtest maupun website resmi multiplayer + minigame akhir cycle.

### Langkah 1: Buat Project Firebase
1. Buka **[https://console.firebase.google.com/](https://console.firebase.google.com/)** dan login dengan akun Google Anda.
2. Klik **`Create a project`** (atau **`Add project`**) → beri nama misalnya `escape-from-tartarus` → klik **Continue**.
3. Matikan *Google Analytics* (opsional, agar lebih cepat) → klik **`Create project`**.

### Langkah 2: Aktifkan Realtime Database (Pilih Server Singapore)
1. Di menu sebelah kiri Firebase Console, klik **`Build`** → **`Realtime Database`**.
2. Klik **`Create Database`**.
3. Pada bagian lokasi server (**Database location**), pilih **`Singapore (asia-southeast1)`** agar ping dari Indonesia sangat cepat (~20–40 ms) → klik **Next**.
4. Pilih **`Start in test mode`** (untuk 30 hari awal) → klik **`Enable`**.

### Langkah 3: Atur Security Rules (Agar Bisa Dipakai Seterusnya Setelah 30 Hari)
1. Masih di halaman **Realtime Database**, klik tab **`Rules`** di bagian atas.
2. Ganti seluruh isinya dengan aturan JSON aman berikut agar hanya node `rooms` yang bisa dibaca/tulis:
```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```
3. Klik **`Publish`**.

### Langkah 4: Salin `firebaseConfig` ke Website
1. Di Firebase Console, klik ikon **Gerigi (Settings)** di sebelah kiri atas (`Project Overview`) → pilih **`Project settings`**.
2. Scroll ke bawah ke bagian **`Your apps`**, klik ikon **`</>` (Web)**.
3. Beri nama panggilan app (misal `eft-web`) → klik **`Register app`**.
4. Anda akan melihat kode `const firebaseConfig = { apiKey: "...", ... };`. **Salin seluruh bagian `{ ... }` tersebut.**
5. Buka file **[`playtest/firebaseConfig.js`](file:///x:/Projects/.ProjectEscapeFromTartarus/playtest/firebaseConfig.js)** dengan Notepad / VS Code, lalu tempel (*paste*) nilai `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, dan `appId` ke dalam `window.EFT_FIREBASE_CONFIG`. Simpan file-nya!
   *(Ingin tes cepat sebelum edit file? Anda bisa klik `Multiplayer Room` di website → buka bagian `Quick Test: Paste Konfigurasi Firebase Sementara` dan tempel langsung di sana).*

---

## 4. Cara Import ke GitHub & Aktifkan Hosting GitHub Pages

1. **Buat Repository Baru di GitHub:**
   - Buka **[https://github.com/new](https://github.com/new)**.
   - Isi nama repo (misal: `escape-from-tartarus`), pilih **Public**, lalu klik **Create repository**.
   - Salin link repository (contoh: `https://github.com/username/escape-from-tartarus.git`).
2. **Upload Pertama Kali (Otomatis Skip File `.psd` & Arsip):**
   - *Double-click* file **[`1_connect_github.bat`](file:///x:/Projects/.ProjectEscapeFromTartarus/1_connect_github.bat)** di folder proyek Anda.
   - Paste link repo GitHub Anda dan tekan **Enter**.
3. **Aktifkan GitHub Pages:**
   - Buka repository Anda di GitHub → klik tab **`Settings`** → pilih menu **`Pages`** di kiri.
   - Pada bagian **Build and deployment → Source**, pilih **`GitHub Actions`**.
   - Tunggu ~30 detik sampai muncul link resmi Anda, misalnya:
     **`https://username.github.io/escape-from-tartarus/`**
4. **Update Rutin di Masa Depan:**
   - Setiap kali ada perubahan rules, penambahan minigame akhir cycle, atau kartu baru di komputer Anda, cukup *double-click* **[`2_update_github.bat`](file:///x:/Projects/.ProjectEscapeFromTartarus/2_update_github.bat)** → website GitHub Pages Anda otomatis terupdate dalam 30 detik!
