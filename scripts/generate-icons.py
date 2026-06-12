#!/usr/bin/env python3
"""
generate-icons.py

Liest public/logo/logo.jpeg und erzeugt:
  public/icons/icon-192.png   (192×192)
  public/icons/icon-512.png   (512×512)

Voraussetzung:
  pip install Pillow

Aufruf:
  python3 scripts/generate-icons.py
"""

import sys
import os
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

SIZES = [192, 512]

if not SRC_LOGO.exists():
    print(f"❌  Logo nicht gefunden: {SRC_LOGO}")
    sys.exit(1)

ICONS_DIR.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC_LOGO).convert("RGBA")

# Quadratisch zuschneiden (center-crop)
w, h   = img.size
side   = min(w, h)
left   = (w - side) // 2
top    = (h - side) // 2
img    = img.crop((left, top, left + side, top + side))

for size in SIZES:
    resized = img.resize((size, size), Image.LANCZOS)
    dest    = ICONS_DIR / f"icon-{size}.png"
    resized.save(dest, "PNG", optimize=True)
    print(f"✅  {dest.relative_to(ROOT)}  ({size}×{size}px)")

print("\n🎉  Icons erstellt. Bitte in public/icons/ prüfen.")