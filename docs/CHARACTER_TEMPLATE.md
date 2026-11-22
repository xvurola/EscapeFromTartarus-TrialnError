# Template Desain Karakter Baru — Escape From Tartarus

> **Cara Pakai:** Duplikat file ini (atau copy-paste isinya langsung ke chat), isi bagian yang relevan, lalu kirim ke AI.  
> Kamu bebas mengisi deskripsi dalam **Bahasa Indonesia** maupun **Bahasa Inggris** (teks resmi di game/Compendium akan otomatis dirapikan ke Bahasa Inggris sesuai standar `playtest/gameData.js`).  
> Bagian bertanda *(Opsional)* boleh dikosongkan—AI akan memberi saran default yang cocok dengan tema karaktermu.

---

## 1. Identitas & Konsep Dasar

- **Nama Lengkap (`name`):** *(Contoh: `Lilith: Daemonissa`, `Firefly / SAM`)*
- **Nama Pendek (`shortName`):** *(Label singkat di HUD/Compendium, contoh: `Lilith`)*
- **ID Karakter (`id`):** *(Huruf kecil tanpa spasi, contoh: `bocchi`, `maomao`)*
- **Asal / Referensi Karakter *(Opsional)*:** *(Anime/game asal untuk referensi tema visual, tagline, & SFX)*
- **Title / Archetype (`title`):** *(Contoh: `The Controller`, `The Economy Specialist`, `The Attacker`, `The All-Rounder`, `The Apothecary`)*
- **Specialty (`specialty`):** *(1 kalimat ringkas gaya bermain, contoh: `Macro-Map Control & Precision Displacement`)*
- **Lore / Ringkasan Karakter (`lore`):** *(1–2 kalimat flavor + peran karakter di papan Tartarus)*
- **Status Rilis:** `[ ] Playable langsung` / `[ ] Coming Soon (terkunci dulu)`
- **Target Rule Patch & Compendium:** *(Default: `alpha2` + `comp_beta1`)*
- **Tipe Mekanik Inti:**
  - `[ ]` Standar (12 Kartu Deck + 1 Ultimate)
  - `[ ]` Dual-Form / Transformasi (seperti Firefly/SAM — isi juga Bagian 5)
  - `[ ]` Memasang Token / Trap di papan *(sebutkan nama & fungsi tokennya)*
  - `[ ]` Punya resource / stack / status khusus *(jelaskan cara dapat & batas maksimalnya)*

---

## 2. Visual, Tema Cut-In, Audio & Aset

- **Warna Aksen Utama (`color`):** *(Nama warna atau Hex, contoh: `#ec4899` Pink / `#10b981` Emerald)*
- **Tema Cut-In *(pilih salah satu atau minta custom)*:**
  - `[ ] sonic` *(Pink — musik/gelombang)*
  - `[ ] fortune` *(Gold — kasino/kekayaan)*
  - `[ ] phantom` *(Merah + screen shake — cepat/stylish)*
  - `[ ] abyss` *(Ungu — gelap/debuff)*
  - `[ ] passive` *(Emerald — racun/alam/aura)*
  - `[ ] ultimate` *(Emas + screen shake)*
  - `[ ] Custom baru:` *(jelaskan warna & efek visual yang diinginkan)*
- **Cut-In Tagline *(Opsional — ALL CAPS, format `KATA KUNCI · SUBJUDUL`)*:**
  - Unique: `...`
  - Ultimate: `...`
- **Bentuk Ikon/Crest Sederhana *(Opsional)*:** *(Contoh: gitar, koin, topeng, daun obat, api mecha — untuk SVG badge)*
- **Vibe SFX Skill *(Opsional — dibuat via Web Audio synth)*:** *(Contoh: petikan gitar rock, gemerincing koin, piano jazz, kotak musik horor, gemuruh api/mecha, suara gelas ramuan)*
- **Status Aset Gambar:**
  - `[ ]` Portrait Cut-Out (`assets/portraits/<id>.png`) — sudah ada / belum
  - `[ ]` Menu Portrait (`assets/menu-portraits/<id>.png`) — sudah ada / belum
  - `[ ]` Chibi Pawn (`assets/chibi/<id>.png`) — sudah ada / belum
  - `[ ]` Skill Card Art (`assets/cards/characters/<id>/`) — sudah ada / pakai **auto-SVG placeholder** dulu

---

## 3. Referensi Cepat Aturan Baku (Pengingat Saat Mendesain Kartu)

- **Deck Standar = 12 Kartu:** `5 Common` (1 kartu ×5, atau C1 ×3 + C2 ×2) + `3 Uncommon` + `2 Rare` + `1 Epic` + `1 Unique`.
- **+ 1 Ultimate:** Tidak masuk deck awal, dibeli di Merchant Shop (`default 70 TC`, bisa kustom seperti Firefly `50 TC`). Otomatis punya `[Retain]`, maks 1 di tangan, kebal random discard/steal, tidak menghabiskan kuota 2 skill/turn.
- **Keyword Resmi:**
  - `[Retain]` — tidak ikut dikocok ulang saat Cycle Reset (tiap 4 Round).
  - `[Haste]` — bisa dipakai reaktif / di luar Main Phase normal (kena cooldown 1 turn).
  - `[Activate Block Effect]` — memindahkan/teleport pemain dan langsung memicu efek tile tujuan.
- **Aturan Dasar Papan:**
  - Menang = **3 Tartarus Shards** (beli di Shard Zone seharga **100 TC**, atau Meta-Shard khusus).
  - 1 Turn = `Main Phase 1 → Roll 1 (2d6) → Main Phase 2 → Roll 2 (2d6) → End Turn`. Maks **2 Skill Card/Turn**.
  - **Spawn Protection:** Pemain yang masih di Spawn (`T0`) tidak bisa ditarget kartu lawan atau Duel.
  - **Pembulatan (`ceil`):** Semua hasil desimal (persen/pengali seperti `x1.25`, `50%`, `25%`) selalu dibulatkan **ke atas**.
  - **Tipe Tile:** `normal`, `tc_plus10`, `tc_minus5`, `card_plus1`, `card_minus1`, `pos_effect`, `neg_effect`, `event`, `versus`, `trading`, `merchant`, `warp`, `river`, `intersect` *(persimpangan = 0 langkah)*.

---

## 4. Daftar Kartu Skill (12 Kartu Deck + 1 Ultimate)

> **Tips:** Untuk setiap kartu, tuliskan angka pastinya (TC, langkah, radius, durasi), siapa targetnya, dan apa yang terjadi kalau syaratnya gagal (**Fallback / Edge Case**).

### Common (Total 5 Kartu)
*(Hapus slot C2 jika hanya pakai 1 jenis Common ×5)*

#### 1) Common 1 (`C` atau `C1`) — Jumlah: `5x` / `3x`
- **Nama Kartu:** 
- **Keyword:** *(Kosong / `[Retain]` / `[Haste]` / `[Activate Block Effect]`)*
- **Target & Jarak:** *(Contoh: Diri sendiri / 1 Lawan dalam radius 5 blok / Semua pemain / Tile Normal radius 4 blok)*
- **Efek Mekanik:** 
- **Pilihan Pemain / RNG *(jika ada)*:** *(Contoh: Pilih +1/+2/+3 langkah, atau acak 5/10 TC)*
- **Fallback / Edge Case *(jika ada)*:** *(Contoh: Jika tangan lawan kosong, efek berubah jadi -3 langkah)*

#### 2) Common 2 (`C2`) — Jumlah: `2x` *(Opsional, hanya jika Common dipecah 3+2)*
- **Nama Kartu:** 
- **Keyword:** 
- **Target & Jarak:** 
- **Efek Mekanik:** 
- **Pilihan Pemain / RNG *(jika ada)*:** 
- **Fallback / Edge Case *(jika ada)*:** 

---

### Uncommon (`UC`) — Jumlah: `3x`
- **Nama Kartu:** 
- **Keyword:** 
- **Target & Jarak:** 
- **Efek Mekanik:** 
- **Pilihan Pemain / RNG *(jika ada)*:** 
- **Durasi / Efek Token *(jika memasang trap/tile token)*:** 
- **Fallback / Edge Case *(jika ada)*:** 

---

### Rare (`R`) — Jumlah: `2x`
- **Nama Kartu:** 
- **Keyword:** 
- **Target & Jarak:** 
- **Efek Mekanik:** 
- **Pilihan Pemain / RNG *(jika ada)*:** 
- **Durasi *(jika buff/debuff)*:** 
- **Fallback / Edge Case *(jika ada)*:** 

---

### Epic (`E`) — Jumlah: `1x`
- **Nama Kartu:** 
- **Keyword:** 
- **Target & Jarak:** 
- **Efek Mekanik:** 
- **Pilihan Pemain / RNG *(jika ada)*:** 
- **Durasi *(jika efek berdurasi)*:** 
- **Fallback / Edge Case *(jika ada)*:** 

---

### Unique (`Uq`) — Jumlah: `1x` *(Biasanya Passive 1 Cycle)*
- **Nama Kartu:** 
- **Keyword:** 
- **Durasi:** *(Default: `1 Cycle` / 4 Round — sebutkan jika berbeda)*
- **Trigger (Kapan Aktif):** *(Contoh: Saat mendarat di Normal Tile / Saat dilewati lawan / Saat menerima TC / Saat lawan dalam radius 4 blok memainkan kartu)*
- **Efek Mekanik:** 
- **Batasan / Edge Case:** *(Contoh: Tidak berlaku pada TC dari skill sendiri / Maks 1x per turn / Kebal Ultimate atau tidak)*

---

### Ultimate (`ULT`) — Harga Shop: `70 TC` *(ubah jika custom)*
- **Nama Kartu:** 
- **Keyword:** `[Retain]` *(bawaan Ultimate)* + *(keyword tambahan jika ada)*
- **Batas Penggunaan *(jika ada)*:** *(Contoh: Normal bisa dibeli ulang tiap habis, atau maks 1x/game seperti Joker Meta-Shard)*
- **Target & Jarak:** 
- **Efek Mekanik:** 
- **Pilihan Pemain / RNG *(jika ada)*:** 
- **Fallback / Edge Case:** 

---

## 5. Mode Kedua / Transformasi *(Opsional — Hanya untuk Karakter Dual-Form)*

- **Nama Form Kedua:** 
- **Cara Masuk Form Kedua:** *(Biasanya lewat Ultimate Form 1)*
- **Cara Kembali ke Form Pertama:** *(Via Ultimate Form 2 / setelah X Turn / setelah 1 Cycle)*
- **Perubahan Atribut/Visual:** *(Warna aksen baru, aset chibi/portrait baru, apakah hand langsung diganti/di-reshuffle?)*
- **Deck Form Kedua (12 Kartu + 1 Ultimate):** *(Gunakan format yang sama seperti Bagian 4)*

---

## 6. Strategi, Balance & Perilaku Bot AI *(Opsional)*

- **Win Condition / Gaya Menang:** *(Bagaimana karakter ini idealnya mengejar 3 Shards?)*
- **Kekuatan Utama:** 
- **Kelemahan / Counterplay:** 
- **Aturan Prioritas Bot AI:** *(Kapan bot sebaiknya menahan atau memakai kartu tertentu? Misal: simpan Ultimate saat lawan punya >80 TC, atau pasang trap dekat Shard Zone)*

---

## Contoh Pengisian Singkat (Referensi Level Detail)

> **Contoh Kartu Rare (`R` ×2) — Mind Deviation (Lilith):**
> - **Keyword:** `-`
> - **Target & Jarak:** 1 Lawan mana saja (Global, tidak bisa target pemain di Spawn).
> - **Efek Mekanik:** Pada lemparan dadu pertama di giliran berikutnya (`Roll 1`), target dipaksa bergerak **mundur** sesuai hasil dadu.
> - **Durasi:** Berlaku untuk 1 lemparan pertama di turn target berikutnya.
> - **Fallback / Edge Case:** Jika target mentok di persimpangan mundur, pemain tetap memilih jalur mundur yang valid; tidak memblokir `Roll 2`.
