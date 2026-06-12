#!/usr/bin/env python3
# Hinweis: Falls Pillow-Fehler → Skript mit dem venv-Python ausführen:
#   .venv/bin/python3 scripts/generate-icons.py
"""
generate-icons.py

Erzeugt aus public/logo/logo.jpeg:
  public/icons/icon-192.png        (192×192, quadratisch)
  public/icons/icon-512.png        (512×512, quadratisch)
  public/logo/logo-300w.webp       (300×77, für Navbar 1×)
  public/logo/logo-600w.webp       (600×154, für Navbar 2× Retina)
  public/logo/logo-footer-104w.webp  (104×27, für Footer 1×)
  public/logo/logo-footer-208w.webp  (208×54, für Footer 2× Retina)

Voraussetzung:
  pip install Pillow

Aufruf:
  .venv/bin/python3 scripts/generate-icons.py
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("❌  Pillow nicht installiert. Bitte ausführen:")
    print("    pip install Pillow")
    sys.exit(1)

ROOT      = Path(__file__).parent.parent
SRC_LOGO  = ROOT / "public" / "logo" / "logo.jpeg"
ICONS_DIR = ROOT / "public" / "icons"
LOGO_DIR  = ROOT / "public" / "logo"

if not SRC_LOGO.exists():
    print(f"❌  Logo nicht gefunden: {SRC_LOGO}")
    sys.exit(1)

ICONS_DIR.mkdir(parents=True, exist_ok=True)

# ── PWA Icons (quadratisch) ─────────────────────────────────────────────────
img_rgba = Image.open(SRC_LOGO).convert("RGBA")
w, h   = img_rgba.size
side   = min(w, h)
left   = (w - side) // 2
top    = (h - side) // 2
img_sq = img_rgba.crop((left, top, left + side, top + side))

for size in [192, 512]:
    resized = img_sq.resize((size, size), Image.LANCZOS)
    dest    = ICONS_DIR / f"icon-{size}.png"
    resized.save(dest, "PNG", optimize=True)
    print(f"✅  {dest.relative_to(ROOT)}  ({size}×{size}px)")

# ── Logo WebP-Versionen für Navbar + Footer ──────────────────────────────────
# Das Original-JPEG hat 448×115 px (Seitenverhältnis ~3.9:1)
# Navbar zeigt ~300×77 px (CSS: height 44px → width auto)
# Footer zeigt ~200×51 px (CSS: height 52px → width auto)

img_rgb = Image.open(SRC_LOGO).convert("RGB")
orig_w, orig_h = img_rgb.size

logo_variants = [
    # (Breite, Qualität, Dateiname, Beschreibung)
    (300,  72, "logo-300w.webp",          "Navbar 1×"),
    (600,  75, "logo-600w.webp",          "Navbar 2× Retina"),
    (200,  72, "logo-footer-200w.webp",   "Footer 1×"),
    (400,  75, "logo-footer-400w.webp",   "Footer 2× Retina"),
]

for target_w, quality, filename, label in logo_variants:
    target_h = round(orig_h * target_w / orig_w)
    resized  = img_rgb.resize((target_w, target_h), Image.LANCZOS)
    dest     = LOGO_DIR / filename
    resized.save(dest, "WEBP", quality=quality, method=6)
    size_kb  = dest.stat().st_size / 1024
    print(f"✅  {dest.relative_to(ROOT)}  ({target_w}×{target_h}px, {size_kb:.1f} KiB) — {label}")

print("\n🎉  Alle Dateien erstellt.")