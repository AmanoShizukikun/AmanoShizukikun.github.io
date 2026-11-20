// Brings the games (and the tuning calculator) into the site's visual language at the source level.
// The interface layer on top of this lives in assets/css/game-skin.css (shape, type, layout);
// this tool handles what a stylesheet cannot reach: colour literals inside scripts and canvases,
// third-party URLs, and decorative emoji.
//
//   node tools/reskin-games.mjs
//
// Idempotent: a processed file carries a marker and is skipped. After re-copying files from the old
// site, run tools/patch-legacy.mjs and then this again.
//
// Colour: every literal (#rgb, #rrggbb, #rrggbbaa, 0xrrggbb, %23rrggbb, rgb()/rgba() triples) is moved
// into the site's palette by hue, keeping its lightness role:
//   cyan · blue · violet   → warm neutral of the same luminance (bright cyan lands on the ink white)
//   magenta · pink         → signal yellow          green · yellow → signal yellow
//   red · orange           → ember                  greys, black, white → untouched
// The 3D world of Cyber Race (track, cars, particles, physics) is left as it is; only its interface is moved.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'legacy/projects');
const MARK = 'nx-reskinned';

const FILES = [
  'game-center/games/snake/snake.html',
  'game-center/games/piano/piano.html',
  'game-center/games/wallclimber/wallclimber.html',
  'game-center/games/cyberrace/cyberrace.html',
  'game-center/games/cyberrace/css/cyberrace.css',
  'game-center/games/cyberrace/css/track-telemetry-analyzer.css',
  'game-center/games/cyberrace/js/ui-controller.js',
  'game-center/games/cyberrace/js/hud.js',
  'game-center/games/cyberrace/js/track-telemetry-analyzer.js',
  'game-center/css/sidebar.css',
  'game-center/js/sidebar.js',
  'game-center/js/fps-osd.js',
  'forza-tuning-calculator/forza-tuning-calculator.html',
];

// ---------- colour ----------
const SIGNAL_H = 46, EMBER_H = 21;
const toHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (l > 0.5 ? 2 - mx - mn : mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const fromHsl = (h, s, l) => {
  const f = (n) => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

export function remap(r, g, b) {
  const [h, s, l] = toHsl(r, g, b);
  if (s < 0.12 || l < 0.02 || l > 0.985) return [r, g, b];
  if (h >= 150 && h < 285) {
    // cool colours become paper-and-ink neutrals; luminance is kept so contrast relationships survive
    const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const v = Math.min(1, gam(y) * 1.03) * 255;
    return [Math.round(v), Math.round(v * 0.995), Math.round(v * 0.972)];
  }
  const hue = (h >= 345 || h < 34) ? EMBER_H : SIGNAL_H;
  // vivid accents snap to the exact signal / ember tone; tints and shades keep their lightness
  const vivid = s > 0.55 && l > 0.38 && l < 0.72;
  return fromHsl(hue, Math.max(s, 0.85), vivid ? (hue === SIGNAL_H ? 0.5 : 0.55) : l);
}
const hex2 = (n) => n.toString(16).padStart(2, '0');
const mapHex6 = (h) => { const [r, g, b] = remap(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)); return hex2(r) + hex2(g) + hex2(b); };

function recolour(src) {
  let out = src;
  // rgb()/rgba() triples
  out = out.replace(/(rgba?\(\s*)(\d{1,3})(\s*,\s*)(\d{1,3})(\s*,\s*)(\d{1,3})/gi, (m, a, r, c1, g, c2, b) => {
    const [R, G, B] = remap(+r, +g, +b);
    return `${a}${R}${c1}${G}${c2}${B}`;
  });
  // #rrggbb / #rrggbbaa / 0xrrggbb / %23rrggbb   (not HTML character references such as &#127918;)
  out = out.replace(/(^|[^&\w])(#|0x|%23)([0-9a-f]{6})([0-9a-f]{2})?(?![0-9a-z_])/gim, (m, pre, sig, h, alpha) => `${pre}${sig}${mapHex6(h)}${alpha || ''}`);
  // #rgb
  out = out.replace(/(^|[^&\w])#([0-9a-f])([0-9a-f])([0-9a-f])(?![0-9a-z_])/gim, (m, pre, r, g, b) => {
    const m6 = mapHex6(r + r + g + g + b + b);
    const short = m6[0] === m6[1] && m6[2] === m6[3] && m6[4] === m6[5];
    return `${pre}#${short ? m6[0] + m6[2] + m6[4] : m6}`;
  });
  return out;
}

// ---------- markup ----------
const EMOJI = '[\\u{1F000}-\\u{1FAFF}][\\uFE0F\\u200D]?';
function detox(html) {
  let out = html;
  // third-party font services: the skin aliases these families to the fonts shipped with the site
  out = out.replace(/[ \t]*<link[^>]*(fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*\n?/gi, '');
  // third-party script hosts → the copies vendored under /assets/vendor/
  out = out.replace(/https:\/\/unpkg\.com\/lucide@latest/g, '/assets/vendor/lucide/lucide.min.js');
  out = out.replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js/g, '/assets/vendor/three-r128/three.min.js');
  out = out.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/examples\/js\/controls\/OrbitControls\.js/g, '/assets/vendor/three-r128/OrbitControls.js');
  return out;
}
// decorative emoji in front of / behind a label go; an emoji standing alone is an icon and stays
function plain(text) {
  return text
    .replace(new RegExp(`(${EMOJI})+[ \\t]*(?=[^\\s<'"\`])`, 'gu'), '')
    .replace(new RegExp(`(?<=[^\\s>'"\`])[ \\t]*(${EMOJI})+`, 'gu'), '');
}

let done = 0, skipped = 0;
for (const rel of FILES) {
  const file = path.join(base, rel);
  if (!fs.existsSync(file)) { console.warn('missing', rel); continue; }
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(MARK)) { skipped++; continue; }
  const ext = path.extname(file);
  if (ext === '.html') src = detox(src);
  if (ext === '.html' || rel.endsWith('ui-controller.js')) src = plain(src);
  src = recolour(src);
  src = ext === '.html' ? src.replace(/<head>/i, `<head>\n    <!-- ${MARK}: colours, fonts and script hosts moved to the site's own (tools/reskin-games.mjs) -->`)
    : `/* ${MARK}: colours moved into the site palette by tools/reskin-games.mjs */\n${src}`;
  fs.writeFileSync(file, src);
  done++;
}
console.log(`reskinned ${done} files, ${skipped} already done`);
