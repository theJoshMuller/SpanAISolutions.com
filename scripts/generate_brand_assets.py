from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import shutil
import subprocess
import tempfile
import json

ROOT = Path(__file__).resolve().parents[1]
LOGOS = ROOT / 'logos'
PUBLIC = ROOT / 'public'
BRAND = PUBLIC / 'brand'

ICON_SVG = LOGOS / 'icon.svg'
WORDMARK_SVG = LOGOS / 'logo-white-text.svg'

BRAND.mkdir(parents=True, exist_ok=True)

shutil.copy2(ICON_SVG, BRAND / 'icon.svg')
shutil.copy2(WORDMARK_SVG, BRAND / 'logo-white-text.svg')
shutil.copy2(ICON_SVG, PUBLIC / 'favicon.svg')

sizes = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'favicon-48x48.png': 48,
    'apple-touch-icon.png': 180,
    'android-chrome-192x192.png': 192,
    'android-chrome-512x512.png': 512,
}

for filename, size in sizes.items():
    subprocess.run(
        [
            'rsvg-convert',
            '-f',
            'png',
            '-w',
            str(size),
            '-h',
            str(size),
            '-a',
            '-b',
            'none',
            '-o',
            str(PUBLIC / filename),
            str(ICON_SVG),
        ],
        check=True,
    )

subprocess.run(
    [
        'magick',
        str(PUBLIC / 'favicon-16x16.png'),
        str(PUBLIC / 'favicon-32x32.png'),
        str(PUBLIC / 'favicon-48x48.png'),
        str(PUBLIC / 'favicon.ico'),
    ],
    check=True,
)

with tempfile.TemporaryDirectory() as tmpdir:
    tmp_icon = Path(tmpdir) / 'og-icon.png'
    subprocess.run(
        [
            'rsvg-convert',
            '-f',
            'png',
            '-w',
            '420',
            '-h',
            '420',
            '-a',
            '-b',
            'none',
            '-o',
            str(tmp_icon),
            str(ICON_SVG),
        ],
        check=True,
    )

    canvas = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))

    glow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((330, 45, 870, 585), fill=(144, 195, 107, 56))
    draw.ellipse((380, 95, 820, 535), fill=(255, 255, 255, 34))
    glow = glow.filter(ImageFilter.GaussianBlur(48))
    canvas.alpha_composite(glow)

    icon = Image.open(tmp_icon).convert('RGBA')
    x = (canvas.width - icon.width) // 2
    y = (canvas.height - icon.height) // 2
    canvas.alpha_composite(icon, (x, y))
    canvas.save(PUBLIC / 'og-image.png')

manifest = {
    'name': 'Span AI Solutions',
    'short_name': 'Span AI',
    'icons': [
        {
            'src': '/android-chrome-192x192.png',
            'sizes': '192x192',
            'type': 'image/png'
        },
        {
            'src': '/android-chrome-512x512.png',
            'sizes': '512x512',
            'type': 'image/png'
        }
    ],
    'theme_color': '#040806',
    'background_color': '#040806',
    'display': 'standalone'
}
(PUBLIC / 'site.webmanifest').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Generated brand assets in public/.')
