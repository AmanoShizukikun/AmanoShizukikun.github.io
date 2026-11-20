# Turns the generated pictures of the world page into what the site serves (assets/img/lore/).
#   python tools/lore-art.py <folder with the PNG originals> [preview.jpg]
# Needs Pillow. The originals are not part of the project; they are named
#   nx2-<character id>.png        full-body figure, transparent background, 2:3
#   nx2-scene-<scene id>.png      painting, about 16:9
# and become
#   cast-<id>.webp   the figure as it is (1024 × 1536, with alpha)
#   face-<id>.webp   a square cut of the head, found from the figure's own outline (for the row of faces)
#   scene-<id>.webp  1600 × 900
import glob, os, sys
from PIL import Image

src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img', 'lore')
os.makedirs(out, exist_ok=True)
done = []
# head centre (x, y) and side of the square, in pixels of the original, for the figures the outline gets wrong
FACE = {'akane': (430, 215, 300), 'midori': (512, 285, 280)}

only = sys.argv[3:]                        # optional: only these names
for path in sorted(glob.glob(os.path.join(src, 'nx2-*.png'))):
    name = os.path.basename(path)[4:-4]
    if only and name not in only:
        continue
    im = Image.open(path)
    if name.startswith('scene-'):
        im = im.convert('RGB')
        w, h = im.size
        ch = min(h, round(w * 9 / 16)); cw = round(ch * 16 / 9)
        x, y = (w - cw) // 2, (h - ch) // 2
        im = im.crop((x, y, x + cw, y + ch)).resize((1600, 900), Image.LANCZOS)
        im.save(os.path.join(out, name + '.webp'), 'WEBP', quality=84, method=6)
        done.append((name, im))
        continue
    im = im.convert('RGBA')
    im.save(os.path.join(out, f'cast-{name}.webp'), 'WEBP', quality=90, method=4)
    # the head: the top of the outline, centred on where the outline is in its upper rows
    a = im.getchannel('A')
    l, t, r, b = a.getbbox()
    hgt = b - t
    band = a.crop((l, t, r, t + max(8, round(hgt * 0.13))))
    cols = [sum(band.getpixel((x, y)) for y in range(0, band.height, 4)) for x in range(band.width)]
    total = sum(cols) or 1
    cx = l + sum(x * c for x, c in enumerate(cols)) / total
    side = round(hgt * 0.2)
    x0 = round(cx - side / 2); y0 = max(0, t - round(side * 0.06))
    if name in FACE:                        # where the outline misleads (a hammer on the shoulder, a staff): by hand
        fx, fy, side = FACE[name]
        x0, y0 = round(fx - side / 2), round(fy - side / 2)
    face = im.crop((x0, y0, x0 + side, y0 + side)).resize((192, 192), Image.LANCZOS)
    face.save(os.path.join(out, f'face-{name}.webp'), 'WEBP', quality=88, method=4)
    done.append((name, im, face))

print(len(done), 'pictures →', os.path.normpath(out))
if len(sys.argv) > 2 and sys.argv[2] and done:
    figs = [d for d in done if len(d) == 3]; scenes = [d for d in done if len(d) == 2]
    W = max(len(figs) * 230, len(scenes[:6]) * 330, 1)
    sheet = Image.new('RGB', (W, 345 + 120 + (190 * ((len(scenes) + 5) // 6) if scenes else 0)), (88, 88, 94))
    for i, (n, im, face) in enumerate(figs):
        t = Image.alpha_composite(Image.new('RGBA', im.size, (88, 88, 94, 255)), im).convert('RGB'); t.thumbnail((230, 345)); sheet.paste(t, (i * 230, 0))
        f = Image.alpha_composite(Image.new('RGBA', face.size, (40, 40, 44, 255)), face).convert('RGB'); f.thumbnail((110, 110)); sheet.paste(f, (i * 230 + 60, 350))
    for i, (n, im) in enumerate(scenes):
        t = im.copy(); t.thumbnail((330, 186)); sheet.paste(t, ((i % 6) * 330, 470 + (i // 6) * 190))
    sheet.save(sys.argv[2], quality=84)
