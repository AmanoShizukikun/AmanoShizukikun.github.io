// Identity layer.
// The site is published under an alias. The real identity ships only as ciphertext
// (assets/data/identity.sealed.json, written by tools/seal.mjs): AES-256-GCM under a key derived with
// PBKDF2-SHA256 from a phrase that is not secret (core/seal-key.js). It keeps the real identity out of the
// plain text of the site, nothing more. Clicking the profile avatar ten times in a row (shell/unlock.js), or
// arriving by a link that carries #key=… (older links had an access code there; any value works now),
// decrypts it locally and swaps every element marked `data-id`. A device that opened it stays open.
//
//   data-id="field"            text of the element ← identity[field]
//   data-id-part="0|1"         with data-id: first word / the rest (for two-line titles)
//   data-id-href="prefix"      also sets href = prefix + value   (e.g. "mailto:")
//   data-id-src="field"        <img> whose picture ← identity[field] (a data: URL sealed with the rest)
//   data-id-show="real|alias"  element is only visible in that state (CSS, via html[data-identity])
//   data-id-rows               container that receives identity.rows as <div><dt><dd> pairs
//   data-id-links              container that receives identity.links as <a> elements
import { reducedMotion } from './store.js';
import { SEAL_PHRASE } from './seal-key.js';

const SEALED = '/assets/data/identity.sealed.json';
const KEY = 'nxAccess';          // set once this device has opened the identity
const CACHE = 'nxIdentity';      // what it decrypted to, so a returning visitor never sees the alias flash by
const GLYPH = '▚▞▙▟▛▜█▓▒░#/<>+=01';

let data = null;
const subs = new Set();
const orig = new WeakMap();      // element → alias text / href
const anim = new WeakMap();      // element → running scramble
const html = document.documentElement;
html.dataset.identity = 'alias';

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Decrypts the sealed identity. Throws an Error with .code = 'denied' | 'unavailable'. */
async function open() {
  const fail = (c, m) => Object.assign(new Error(m), { code: c });
  if (!globalThis.crypto?.subtle) throw fail('unavailable', 'Web Crypto needs a secure context (https or localhost)');
  let box;
  try {
    const r = await fetch(SEALED, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    box = await r.json();
  } catch { throw fail('unavailable', 'sealed identity not found'); }
  const t0 = performance.now();
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(SEAL_PHRASE), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(box.salt), iterations: box.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const kdfMs = performance.now() - t0;
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(box.iv) }, key, bytes(box.data)); } catch { throw fail('denied', 'authentication tag mismatch'); }
  return { json: JSON.parse(new TextDecoder().decode(plain)), kdfMs, iter: box.iter, size: plain.byteLength };
}

function scramble(el, to) {
  cancelAnimationFrame(anim.get(el));
  if (reducedMotion()) { el.textContent = to; return; }
  const from = el.textContent, n = Math.max(from.length, to.length), t0 = performance.now(), dur = 520 + n * 34;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    let out = '';
    for (let i = 0; i < n; i++) {
      const at = (i / n) * 0.55;
      if (k >= at + 0.45) out += to[i] ?? '';
      else if (k >= at) out += GLYPH[(Math.random() * GLYPH.length) | 0];
      else out += from[i] ?? '';
    }
    el.textContent = k < 1 ? out : to;
    if (k < 1) anim.set(el, requestAnimationFrame(tick));
  };
  anim.set(el, requestAnimationFrame(tick));
}

const part = (value, p) => {
  if (p == null) return value;
  const i = value.indexOf(' ');
  return p === '0' ? (i < 0 ? value : value.slice(0, i)) : (i < 0 ? '' : value.slice(i + 1));
};

function apply(root = document, animate = false) {
  root.querySelectorAll('[data-id]').forEach((el) => {
    if (!orig.has(el)) orig.set(el, { text: el.textContent, href: el.getAttribute('href') });
    const o = orig.get(el), v = data?.[el.dataset.id];
    const to = v != null ? part(String(v), el.dataset.idPart) : o.text;
    if (el.dataset.idHref != null) { if (v != null) el.setAttribute('href', el.dataset.idHref + v); else if (o.href != null) el.setAttribute('href', o.href); }
    if (el.textContent === to && !anim.get(el)) return;
    if (animate) scramble(el, to); else { cancelAnimationFrame(anim.get(el)); el.textContent = to; }
  });
  root.querySelectorAll('[data-id-src]').forEach((img) => {
    if (!orig.has(img)) orig.set(img, { src: img.getAttribute('src'), alt: img.getAttribute('alt') });
    const o = orig.get(img), v = data?.[img.dataset.idSrc];
    const src = v || o.src, alt = v ? `${data.nameZh || data.name || ''}的照片` : o.alt;
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    img.setAttribute('alt', alt);
  });
  root.querySelectorAll('[data-id-rows]').forEach((box) => {
    box.replaceChildren(...(data?.rows || []).map(([k, v]) => {
      const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = k; dd.textContent = v; row.append(dt, dd);
      return row;
    }));
  });
  root.querySelectorAll('[data-id-links]').forEach((box) => {
    box.replaceChildren(...(data?.links || []).filter(([, href]) => /^(https?:|mailto:|\/)/.test(href)).map(([label, href]) => {
      const a = document.createElement('a');
      a.textContent = label; a.href = href;
      if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      return a;
    }));
  });
}

function set(next, animate) {
  data = next;
  html.dataset.identity = data ? 'real' : 'alias';
  apply(document, animate);
  subs.forEach((fn) => fn(data));
}

export const identity = {
  get unlocked() { return !!data; },
  get data() { return data; },
  /** Decrypt and show the real identity. Resolves to { kdfMs, iter, size }; rejects with .code 'denied' | 'unavailable'. */
  async unlock({ animate = true } = {}) {
    const r = await open();
    try { localStorage.setItem(KEY, '1'); localStorage.setItem(CACHE, JSON.stringify(r.json)); } catch { /* private mode */ }
    set(r.json, animate);
    return r;
  },
  lock() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(CACHE); } catch { /* private mode */ }
    set(null, true);
  },
  /** Before the first view mounts: a device that unlocked earlier shows the real identity from the first frame. */
  resume() {
    if (/^#key=/.test(location.hash)) return;
    try {
      const cached = localStorage.getItem(CACHE);
      if (cached && localStorage.getItem(KEY)) set(JSON.parse(cached), false);
    } catch { /* private mode / damaged cache */ }
  },
  /** Page load: a link carrying #key=…, or a device that opened it before. Returns 'link' | 'stored' | null. */
  async restore() {
    const link = /^#key=/.test(location.hash);
    if (link) history.replaceState(history.state, '', location.pathname + location.search);
    let stored = false;
    try { stored = !!localStorage.getItem(KEY); } catch { /* private mode */ }
    if (!link && !stored) return null;
    // opened again quietly on every load: the sealed file may have been re-issued since
    try { await this.unlock({ animate: link }); return link ? 'link' : 'stored'; } catch (e) {
      if (e.code === 'denied' && !link) this.lock();
      return null;
    }
  },
  /** Re-apply to a freshly mounted view. */
  apply,
  /** The alias in a document title is replaced as well. */
  title(t) {
    if (!data) return t;
    let out = t;
    if (data.nameZh) out = out.replace(/天野靜樹(\s*Amano Shizuki)?/g, data.nameZh);
    return out;
  },
  on(fn) { subs.add(fn); return () => subs.delete(fn); },
};
