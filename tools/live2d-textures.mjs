// Web textures for the Live2D works page (/apps/live2d/).
//   npm i sharp --no-save        (sharp is only needed for this script; the site itself has no dependencies)
//   node tools/live2d-textures.mjs
// For each model it takes the used square of the texture atlas (measured from the top-left corner) and writes it
// at two sizes to assets/live2d/web/<id>-hi.webp and <id>-lo.webp. The page loads -hi on large screens and -lo
// on small ones. The mascot widget keeps using the original PNG next to the model.
// `used` must match `crop` of the model in assets/js/data/live2d.js: the page remaps the UVs by the same fraction.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'live2d');
const out = path.join(root, 'web');
fs.mkdirSync(out, { recursive: true });

//   id            atlas (relative to assets/live2d/model)                         side  used      sizes
const list = [
  ['ns-v5', 'NS-V5-Ver1.2/NS-V5-Ver1.2.4096/texture_00.png', 4096, 1, [4096, 2048]],
  ['l2d-cmt-01', 'L2D-CMT-01ver2.3_vts/L2D-CMT-01.8192/texture_00.png', 8192, 0.578125, [4096, 2048]],
  ['wl2d-01', 'WL2D-01_vts/WL2D-01.4096/texture_00.png', 4096, 0.75, [3072, 1536]],
];

sharp.cache(false);
for (const [id, src, side, used, sizes] of list) {
  const px = Math.round(side * used);
  for (const [i, size] of sizes.entries()) {
    const file = path.join(out, `${id}-${i ? 'lo' : 'hi'}.webp`);
    await sharp(path.join(root, 'model', src), { limitInputPixels: false })
      .extract({ left: 0, top: 0, width: px, height: px })
      .resize(size, size, { kernel: 'lanczos3' })
      .webp({ quality: 90, alphaQuality: 100, effort: 5, smartSubsample: true })
      .toFile(file);
    console.log(path.relative(root, file), size, `${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
}
