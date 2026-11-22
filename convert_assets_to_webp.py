#!/usr/bin/env python3
"""
Mengonversi seluruh aset .png di folder produksi `assets/` menjadi .webp
terkompresi dengan dimensi optimal untuk web/aplikasi, serta menghapus aset
Print View lama (`assets/maps/`) yang tidak lagi digunakan.

Cara menjalankan:
    pip install Pillow
    python convert_assets_to_webp.py
"""
import os
import shutil
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow belum terpasang. Jalankan perintah berikut terlebih dahulu:")
    print("    pip install Pillow")
    sys.exit(1)

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(ROOT, "assets")
UNUSED_MAPS_DIR = os.path.join(ASSETS_DIR, "maps")

# Batas lebar maksimum (px) & kualitas WebP per kategori agar tajam namun ringan
CATEGORY_RULES = {
    "cards": (520, 82),
    "portraits": (720, 84),
    "menu-portraits": (480, 84),
    "chibi": (256, 85),
}
DEFAULT_RULE = (720, 82)


def get_rule_for_path(rel_path):
    parts = rel_path.replace("\\", "/").split("/")
    for part in parts:
        if part in CATEGORY_RULES:
            return CATEGORY_RULES[part]
    return DEFAULT_RULE


def main():
    if not os.path.isdir(ASSETS_DIR):
        print(f"Folder tidak ditemukan: {ASSETS_DIR}")
        sys.exit(1)

    removed_maps_bytes = 0
    if os.path.isdir(UNUSED_MAPS_DIR):
        for dirpath, _, filenames in os.walk(UNUSED_MAPS_DIR):
            for fname in filenames:
                removed_maps_bytes += os.path.getsize(os.path.join(dirpath, fname))
        shutil.rmtree(UNUSED_MAPS_DIR)
        print(f"[Hapus Print View] assets/maps/ dihapus ({removed_maps_bytes / (1024 * 1024):.2f} MB)")

    converted = 0
    total_before = removed_maps_bytes
    total_after = 0
    errors = []

    for dirpath, _, filenames in os.walk(ASSETS_DIR):
        for fname in sorted(filenames):
            if not fname.lower().endswith(".png"):
                continue
            src = os.path.join(dirpath, fname)
            dst = os.path.splitext(src)[0] + ".webp"
            rel = os.path.relpath(src, ASSETS_DIR)
            max_w, quality = get_rule_for_path(rel)

            try:
                before_sz = os.path.getsize(src)
                with Image.open(src) as im:
                    if im.mode not in ("RGB", "RGBA"):
                        im = im.convert("RGBA")
                    w, h = im.size
                    if w > max_w:
                        new_h = max(1, int(round(h * (max_w / float(w)))))
                        im = im.resize((max_w, new_h), Image.Resampling.LANCZOS)
                    im.save(dst, "WEBP", quality=quality, method=6)

                after_sz = os.path.getsize(dst)
                os.remove(src)
                total_before += before_sz
                total_after += after_sz
                converted += 1
                pct = (1 - (after_sz / before_sz)) * 100 if before_sz else 0
                print(f"  OK  {rel} -> .webp  ({before_sz / 1024:.0f} KB -> {after_sz / 1024:.0f} KB, -{pct:.0f}%)")
            except Exception as exc:
                errors.append((rel, str(exc)))

    saved_mb = (total_before - total_after) / (1024 * 1024)
    pct_total = (1 - (total_after / total_before)) * 100 if total_before else 0

    print("=" * 68)
    print(f"Konversi selesai! {converted} file .png diubah ke .webp.")
    print(f"Ukuran sebelum : {total_before / (1024 * 1024):.2f} MB")
    print(f"Ukuran sesudah : {total_after / (1024 * 1024):.2f} MB")
    print(f"Total hemat    : {saved_mb:.2f} MB (-{pct_total:.1f}%)")
    if errors:
        print(f"Gagal ({len(errors)}):")
        for r, e in errors:
            print(f"  - {r}: {e}")
    print("=" * 68)


if __name__ == "__main__":
    main()
