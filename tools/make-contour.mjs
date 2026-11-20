// Draws assets/img/os/contour.svg: the isolines of a smooth noise field (a survey map of nowhere in particular).
// The WebOS uses it as a mask, so the lines take whatever colour the panel gives them.
//   node tools/make-contour.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const W = 1600, H = 900, STEP = 16, LEVELS = 11;
let seed = 20261117;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// value noise, two octaves, on a coarse lattice
const GX = 12, GY = 8;
const lattice = (n, m) => Array.from({ length: (n + 2) * (m + 2) }, rnd);
const A = lattice(GX, GY), B = lattice(GX * 2, GY * 2);
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function sample(grid, n, m, u, v) {
  const x = u * n, y = v * m, x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  const at = (i, j) => grid[j * (n + 2) + i];
  const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const field = (x, y) => sample(A, GX, GY, x / W, y / H) * 0.72 + sample(B, GX * 2, GY * 2, x / W, y / H) * 0.28;

const cols = W / STEP, rows = Math.ceil(H / STEP);
const val = [];
for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) val.push(field(i * STEP, Math.min(H, j * STEP)));
const V = (i, j) => val[j * (cols + 1) + i];
const key = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

let d = '';
for (let l = 1; l <= LEVELS; l++) {
  const iso = l / (LEVELS + 1) * 0.74 + 0.13;
  const segs = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), e = V(i, j + 1);
    const x = i * STEP, y = j * STEP, lerp = (p, q) => (iso - p) / (q - p);
    const top = () => [x + lerp(a, b) * STEP, y], right = () => [x + STEP, y + lerp(b, c) * STEP], bottom = () => [x + lerp(e, c) * STEP, y + STEP], left = () => [x, y + lerp(a, e) * STEP];
    const code = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (e > iso ? 1 : 0);
    const add = (p, q) => segs.push([p, q]);
    switch (code) {
      case 1: case 14: add(left(), bottom()); break;
      case 2: case 13: add(bottom(), right()); break;
      case 3: case 12: add(left(), right()); break;
      case 4: case 11: add(top(), right()); break;
      case 6: case 9: add(top(), bottom()); break;
      case 7: case 8: add(left(), top()); break;
      case 5: add(left(), top()); add(bottom(), right()); break;
      case 10: add(left(), bottom()); add(top(), right()); break;
      default:
    }
  }
  // chain the segments into polylines
  const ends = new Map();
  const push = (k, s) => { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(s); };
  segs.forEach((s) => { push(key(s[0]), s); push(key(s[1]), s); });
  const used = new Set();
  const walk = (start, from) => {
    const line = [from];
    let s = start, at = from;
    while (s && !used.has(s)) {
      used.add(s);
      at = key(s[0]) === key(at) ? s[1] : s[0];
      line.push(at);
      s = (ends.get(key(at)) || []).find((n) => !used.has(n));
    }
    return line;
  };
  for (const s of segs) {
    if (used.has(s)) continue;
    const fwd = walk(s, s[0]);
    const next = (ends.get(key(s[0])) || []).find((n) => !used.has(n));
    const back = next ? walk(next, s[0]) : [];
    const line = [...back.reverse().slice(0, -1), ...fwd];
    if (line.length < 4) continue;
    d += `M${line.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join('L')}`;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><path d="${d}" fill="none" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>\n`;
const out = fileURLToPath(new URL('../assets/img/os/contour.svg', import.meta.url));
writeFileSync(out, svg);
console.log(`contour.svg  ${(svg.length / 1024).toFixed(1)} KB`);
