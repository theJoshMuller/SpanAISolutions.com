"""Generate all 101 email gauges, mirroring src/quiz/gauge.ts geometry."""
from __future__ import annotations

import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'quiz' / 'gauge'
STOPS = [(0, '#d64545'), (.4, '#e8a33d'), (.6, '#e3cf4f'), (.8, '#2db56f'), (1, '#9be4b9')]
SCALE = 3


def font_path() -> str:
    try:
        result = subprocess.run(['fc-match', 'Space Grotesk:bold', '--format=%{family}|%{file}'], check=True, capture_output=True, text=True).stdout.strip()
        family, path = result.split('|', 1)
        if 'space grotesk' in family.lower() and Path(path).suffix.lower() in {'.ttf', '.otf', '.ttc'}:
            return path
    except (OSError, subprocess.CalledProcessError):
        pass
    return 'DejaVuSans-Bold.ttf'


def color_at(t: float) -> tuple[int, ...]:
    for (lo, a), (hi, b) in zip(STOPS, STOPS[1:]):
        if t <= hi:
            f = (t - lo) / (hi - lo)
            return tuple(round(int(a[i:i+2], 16) * (1-f) + int(b[i:i+2], 16) * f) for i in (1, 3, 5))
    return (155, 228, 185)


def band(level: int) -> str:
    return ['Parked', 'First Gear', 'Cruising', 'Accelerating', 'Full Speed'][min(4, max(0, (level-1)//20))]


def generate() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    face = font_path()
    numeral = ImageFont.truetype(face, 76 * SCALE)
    caption = ImageFont.truetype(face, 25 * SCALE)
    for level in range(101):
        image = Image.new('RGB', (600*SCALE, 340*SCALE), '#040806')
        draw = ImageDraw.Draw(image)
        def point(x: float, y: float) -> tuple[float, float]:
            return (x*SCALE, y*SCALE)
        # Small overlapping round segments approximate the SVG's horizontal gradient.
        for step in range(1441):
            theta = math.pi * (1-step/1440)
            x, y = 300+240*math.cos(theta), 260-240*math.sin(theta)
            color = color_at(max(0, min(1, (x-60)/480)))
            draw.ellipse([point(x-12, y-12), point(x+12, y+12)], fill=color)
        theta = math.pi * (1-level/100)
        tip = (300+200*math.cos(theta), 260-200*math.sin(theta))
        dx, dy = 7*math.sin(theta), 7*math.cos(theta)
        draw.polygon([point(300-dx, 260-dy), point(*tip), point(300+dx, 260+dy)], fill='#9be4b9')
        draw.ellipse([point(287, 247), point(313, 273)], fill='#2db56f')
        draw.text(point(300, 218), str(level), font=numeral, fill='#f1f5f2', anchor='ms', stroke_width=4*SCALE, stroke_fill='#040806')
        draw.text(point(300, 316), band(level), font=caption, fill='#9be4b9', anchor='ms')
        image.resize((600, 340), Image.Resampling.LANCZOS).save(OUTPUT / f'{level}.png', optimize=True)
    print(f'Generated 101 gauges in {OUTPUT}')


if __name__ == '__main__':
    generate()
