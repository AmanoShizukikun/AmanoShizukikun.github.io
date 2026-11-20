// Prepares the copied legacy applications (legacy/projects/**) for running inside the shell.
// Idempotent: safe to run again after re-copying files from the old site.
//   node tools/patch-legacy.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAG = '<script src="/assets/js/embed.js"></script>';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let patched = 0;
for (const file of walk(path.join(root, 'legacy/projects'))) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(TAG)) continue;
  const m = /<meta\s+charset=[^>]*>/i.exec(html);
  if (!m) { console.warn('no <meta charset> in', file); continue; }
  html = html.slice(0, m.index + m[0].length) + '\n    ' + TAG + html.slice(m.index + m[0].length);
  fs.writeFileSync(file, html);
  patched++;
}

// The shell owns the one and only Live2D widget; legacy pages get a no-op manager.
fs.writeFileSync(path.join(root, 'legacy/assets/js/live2d-manager.js'), `// Stub: Live2D now lives in the persistent shell (assets/js/shell/mascot.js).
window.live2dManager = {
  load: async () => false, show: async () => false, hide: async () => false,
  isAvailable: () => false, setQuitVisible: (v) => v, isQuitVisible: () => true,
};
`);
console.log('patched', patched, 'legacy documents');
