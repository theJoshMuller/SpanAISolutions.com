from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
LOGOS = ROOT / 'logos'
PUBLIC = ROOT / 'public'
BRAND = PUBLIC / 'brand'

ICON_SVG = LOGOS / 'icon.svg'
BLACK_WORDMARK_SVG = LOGOS / 'logo-black-text.svg'
EMAIL_SIGNATURE_SVG = LOGOS / 'logo-email-sig.svg'
WORDMARK_SVG = LOGOS / 'logo-white-text.svg'

BRAND.mkdir(parents=True, exist_ok=True)

shutil.copy2(ICON_SVG, BRAND / 'icon.svg')
shutil.copy2(BLACK_WORDMARK_SVG, BRAND / 'logo-black-text.svg')
shutil.copy2(EMAIL_SIGNATURE_SVG, BRAND / 'logo-email-sig.svg')
shutil.copy2(WORDMARK_SVG, BRAND / 'logo-white-text.svg')
shutil.copy2(ICON_SVG, PUBLIC / 'favicon.svg')


def render_svg(svg_path: Path, max_width: int, max_height: int) -> Image.Image:
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        subprocess.run(
            [
                'rsvg-convert',
                '-f',
                'png',
                '-w',
                str(max_width),
                '-h',
                str(max_height),
                '-a',
                '-b',
                'none',
                '-o',
                str(tmp_path),
                str(svg_path),
            ],
            check=True,
        )
        return Image.open(tmp_path).convert('RGBA').copy()
    finally:
        tmp_path.unlink(missing_ok=True)


def render_square_icon(svg_path: Path, size: int) -> Image.Image:
    rendered = render_svg(svg_path, size, size)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    x = (size - rendered.width) // 2
    y = (size - rendered.height) // 2
    canvas.alpha_composite(rendered, (x, y))
    return canvas


png_sizes = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'favicon-48x48.png': 48,
    'apple-touch-icon.png': 180,
    'android-chrome-192x192.png': 192,
    'android-chrome-512x512.png': 512,
}

for filename, size in png_sizes.items():
    render_square_icon(ICON_SVG, size).save(PUBLIC / filename)

render_square_icon(ICON_SVG, 256).save(
    PUBLIC / 'favicon.ico',
    format='ICO',
    sizes=[(16, 16), (32, 32), (48, 48)],
)

canvas = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
glow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(glow)
draw.ellipse((330, 45, 870, 585), fill=(144, 195, 107, 56))
draw.ellipse((380, 95, 820, 535), fill=(255, 255, 255, 34))
glow = glow.filter(ImageFilter.GaussianBlur(48))
canvas.alpha_composite(glow)

icon = render_svg(ICON_SVG, 520, 520)
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
            'type': 'image/png',
        },
        {
            'src': '/android-chrome-512x512.png',
            'sizes': '512x512',
            'type': 'image/png',
        },
    ],
    'theme_color': '#040806',
    'background_color': '#040806',
    'display': 'standalone',
}
(PUBLIC / 'site.webmanifest').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Generated brand assets in public/.')
