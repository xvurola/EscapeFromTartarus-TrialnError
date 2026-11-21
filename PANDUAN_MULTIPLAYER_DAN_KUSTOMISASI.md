# Panduan Hosting Online, Multiplayer & Mode Handphone (Vertikal) — Escape From Tartarus

Dokumen ini menjelaskan cara meng-upload game ke **Hosting Gratis** agar bisa dimainkan bersama teman dari HP atau PC mana saja, cara bermain **Multiplayer**, serta fitur **Mode Handphone (Vertikal)**.

---

## 1. Cara Menghubungkan ke GitHub & Hosting Gratis di GitHub Pages

Folder project ini sudah dilengkapi dengan konfigurasi otomatis untuk **GitHub** dan **GitHub Pages**:
- [`.gitignore`](file:///x:/Projects/.ProjectEscapeFromTartarus/.gitignore): Otomatis mengecualikan file mentah `.psd`, `.docx`, dan `.pdf` yang berukuran >100 MB agar tidak ditolak oleh GitHub (file `.psd` Anda tetap aman di komputer lokal).
- [`.nojekyll`](file:///x:/Projects/.ProjectEscapeFromTartarus/.nojekyll) & [`.github/workflows/deploy-pages.yml`](file:///x:/Projects/.ProjectEscapeFromTartarus/.github/workflows/deploy-pages.yml): Otomatis men-deploy website ke GitHub Pages setiap kali ada *push* baru.

### Langkah A — Koneksi Pertama Kali ke GitHub (Hanya Sekali):
1. Buka **[https://github.com/new](https://github.com/new)** di browser dan buat repository baru (misal beri nama `escape-from-tartarus`, pilih **Public** agar GitHub Pages gratis, lalu klik **Create repository**).
2. Salin URL repository Anda (contoh: `https://github.com/username-anda/escape-from-tartarus.git`).
3. Di folder project komputer Anda, *double-click* file **[`1_connect_github.bat`](file:///x:/Projects/.ProjectEscapeFromTartarus/1_connect_github.bat)**.
4. Paste URL repository GitHub Anda saat diminta, lalu tekan **Enter**. Script akan otomatis meng-upload seluruh file website dan gambar `.png` ke GitHub Anda.
5. **Mengaktifkan Hosting GitHub Pages:**
   - Buka halaman repository GitHub Anda di browser.
   - Klik tab **`Settings`** (di bagian atas) → pilih menu **`Pages`** (di sidebar kiri).
   - Pada bagian **Build and deployment → Source**, pilih **`GitHub Actions`** (atau pilih `Deploy from a branch` → branch `main` → folder `/ (root)` → klik `Save`).
   - Tunggu sekitar 30–60 detik, link website Anda akan aktif di:
     `https://username-anda.github.io/escape-from-tartarus/`

### Langkah B — Setiap Kali Ada Update di Folder Ini:
- Setiap kali kita melakukan perubahan UI, rules, atau kartu di folder project ini, Anda cukup *double-click* file **[`2_update_github.bat`](file:///x:/Projects/.ProjectEscapeFromTartarus/2_update_github.bat)** (atau gunakan aplikasi *GitHub Desktop*).
- Dalam 20–30 detik setelah dijalankan, website di link GitHub Pages Anda akan otomatis ter-update ke versi terbaru!

---

## 2. Alternatif Upload Cepat Tanpa Git (Netlify Drop)

Karena folder utama proyek Anda berisi file mentah Photoshop (`.psd`) sebesar **1.1 GB**, kami telah membuatkan folder khusus bernama **[`hosting-ready`](file:///x:/Projects/.ProjectEscapeFromTartarus/hosting-ready)** yang hanya berukuran **24 MB** (berisi website dan gambar `.png` yang dibutuhkan saja).

Setiap kali Anda selesai memperbarui file, cukup jalankan [`prepare_hosting_folder.bat`](file:///x:/Projects/.ProjectEscapeFromTartarus/prepare_hosting_folder.bat) untuk memperbarui folder `hosting-ready`.

### Langkah Upload Termudah (Tanpa Koding — 1 Menit via Netlify Drop):
1. Buka **[https://app.netlify.com/drop](https://app.netlify.com/drop)** di browser (daftar akun gratis jika diminta).
2. Buka Windows Explorer di komputer Anda, masuk ke `x:\Projects\.ProjectEscapeFromTartarus\`.
3. **Drag-and-drop (seret dan lepas)** folder **`hosting-ready`** ke kotak upload di halaman Netlify Drop.
4. Dalam beberapa detik, Anda akan mendapatkan link website online (contoh: `https://escape-from-tartarus.netlify.app`).
5. Kirimkan link tersebut ke teman-teman Anda — mereka bisa langsung membukanya dari **Handphone (Android/iPhone)** maupun **Laptop/PC**!

*(Alternatif lain: Anda juga bisa meng-upload folder `hosting-ready` ke **Cloudflare Pages**, **Vercel**, atau **GitHub Pages** secara gratis karena website ini murni statis dan menggunakan WebRTC PeerJS untuk koneksi Multiplayer).*

---

## 2. Cara Bermain Multiplayer Setelah Di-Hosting

1. **Host (Pembuat Room):**
   - Buka link website hosting Anda, lalu klik tombol hijau **`Multiplayer Room`** di kanan atas.
   - Pilih kursi (`Seat 1` atau `Host / All Players`), lalu klik **`Buat Room Online (Internet)`**.
   - Klik tombol **`Copy Invite Link`** yang muncul! Link undangan (contoh: `https://namagame.netlify.app/?room=EFT742`) otomatis tersalin.
   - Kirimkan link undangan tersebut ke grup WhatsApp / Discord teman Anda.
2. **Teman (Player 2, 3, 4):**
   - Ketika teman mengklik link undangan tersebut dari HP atau PC mereka, jendela Multiplayer akan terbuka otomatis dengan **Kode Room yang sudah terisi**.
   - Teman cukup memilih kursi (`Seat 2`, `Seat 3`, atau `Seat 4`) lalu menekan **`Gabung Room Online`**.

---

## 3. Kontrol di Handphone (Layar Vertikal / Portrait)

Website sudah dioptimalkan secara otomatis ketika dibuka di layar **Handphone secara vertikal (portrait)**:
- **Papan Skor 4 Pemain di Atas**: Kartu status ke-4 pemain otomatis tersusun rapi menjadi 4 kotak ringkas di bagian atas layar agar bagian tengah layar HP bebas sepenuhnya untuk peta.
- **Geser Peta (1 Jari) & Cubit Zoom (2 Jari)**:
  - Geser peta ke segala arah dengan **1 jari** (*touch drag*).
  - Cubit layar dengan **2 jari** (*pinch-to-zoom*) untuk memperbesar atau memperkecil peta.
- **Tombol Kamera Cepat (`Focus Player` & `Wide Map`)**:
  - Tekan **`Focus Player`** untuk mengunci kamera ke pion yang sedang aktif (kamera otomatis mengikuti langkah pion saat dadu dikocok).
  - Tekan **`Wide Map`** untuk melihat keseluruhan peta dalam satu layar HP.
- **Kartu Tangan di Bawah Layar**:
  - Sentuh kartu 1x untuk **menaikkan kartu tersebut ke atas** (sementara kartu lain tetap di bawah).
  - Sentuh tombol **`Use / Details`** (atau sentuh kartu yang sudah naik sekali lagi) untuk melihat detail penuh dan mengaktifkan efek kartu.
