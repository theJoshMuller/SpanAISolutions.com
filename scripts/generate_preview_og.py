"""Generate the private-preview social card from the existing, unchanged wordmark."""
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
font_file = '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf'
canvas = Image.new('RGB', (1200, 630), '#040806')
draw = ImageDraw.Draw(canvas)
for radius in range(350, 20, -8):
    alpha = int(28 * (1 - radius / 360))
    draw.ellipse((910-radius, 100-radius, 910+radius, 100+radius), outline=(8, 17+alpha, 13))
draw.rectangle((80, 80, 85, 134), fill='#90c36b')
with tempfile.TemporaryDirectory() as folder:
    logo = Path(folder) / 'logo.png'
    subprocess.run(['rsvg-convert', '-w', '700', '-h', '76', '-o', str(logo), str(ROOT / 'public/brand/logo-white-text.svg')], check=True)
    mark = Image.open(logo).convert('RGBA')
    canvas.paste(mark, (80, 140), mark)
font = ImageFont.truetype(font_file, 64)
draw.text((80, 330), 'Bridging the gap between', font=font, fill='#f3f7f3')
draw.text((80, 410), 'you and your goals.', font=font, fill='#f3f7f3')
draw.text((83, 540), 'Custom AI solutions  ·  Consulting  ·  Voice agents', font=ImageFont.truetype(font_file, 24), fill='#9be4b9')
canvas.save(ROOT / 'public/og-image.png', optimize=True)
print('Wrote', ROOT / 'public/og-image.png', canvas.size)
