// Seals the real identity, so it is not in the plain text of the published site.
//
//   node tools/seal.mjs
//
// Reads   private/identity.json            plain text, NEVER published (private/ is in .gitignore)
// Writes  assets/data/identity.sealed.json AES-256-GCM ciphertext
//
// The key comes from a phrase that is not secret (assets/js/core/seal-key.js), so this keeps the identity out
// of the page source and search engines, not away from anyone who wants it: the profile opens it for whoever
// clicks the avatar ten times in a row. The browser side is assets/js/core/identity.js.
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SEAL_PHRASE } from '../assets/js/core/seal-key.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'private/identity.json');
const OUT = path.join(root, 'assets/data/identity.sealed.json');
const ITER = 20000;              // the phrase is public: iterations only cost the visitor time, so few of them

const b64 = (buf) => Buffer.from(buf).toString('base64');

const TEMPLATE = {
  name: 'YOUR NAME',
  nameZh: '你的姓名',
  role: 'AI Developer / System Architect',
  education: '國立勤益科技大學 資訊工程系 畢業',
  email: 'you@example.com',
  rows: [['LOCATION', 'Taiwan'], ['PHONE', '09xx-xxx-xxx']],
  links: [['LinkedIn', 'https://www.linkedin.com/in/your-id']],
};

fs.mkdirSync(path.dirname(SRC), { recursive: true });
if (!fs.existsSync(SRC)) {
  fs.writeFileSync(SRC, JSON.stringify(TEMPLATE, null, 2) + '\n');
  console.log('created private/identity.json with placeholder values — edit it, then run this again.');
}
const identity = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// `photo`: a picture file next to identity.json (e.g. "photo.webp"). It is sealed inline as a data: URL, so the
// real photo never sits on the site as a picture of its own that anyone (or any search engine) can open.
if (identity.photo && !identity.photo.startsWith('data:')) {
  const file = path.join(path.dirname(SRC), identity.photo);
  const type = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }[path.extname(file).toLowerCase()];
  if (!type || !fs.existsSync(file)) { console.error(`photo: expected a .webp/.jpg/.png file at private/${identity.photo}`); process.exit(1); }
  identity.photo = `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(SEAL_PHRASE), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(identity)));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ v: 2, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) }, null, 2) + '\n');

console.log(`sealed ${Object.keys(identity).length} fields → assets/data/identity.sealed.json`);
console.log('opens with   → ten clicks on the profile avatar (or any link ending in #key=…)');
