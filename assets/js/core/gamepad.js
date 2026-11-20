// One gamepad reader for the shell (standard mapping).
// It turns the polled state of the first connected pad into events, so pages never poll themselves:
//   { type: 'press',   key, repeat }   a button went down; directions repeat while held
//   { type: 'release', key, held }     a button came up after `held` ms
//   { type: 'hold',    key, ms }       every frame while VIEW is held (used for "hold to leave a game")
// Keys: a b x y lb rb lt rt view start up down left right  (the left stick counts as the d-pad).
// It also tracks which device the visitor used last — html[data-input="pad" | "keys"] — so on-screen
// hints can show the right glyphs.
// The games themselves (inside the app frame) read the pad on their own; see assets/js/pad-bridge.js.

const BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, view: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
const DIR = { up: 1, down: 1, left: 1, right: 1 };
const DEAD = 0.55, FIRST = 380, AGAIN = 130;

const subs = new Set();
const modeSubs = new Set();
const html = document.documentElement;
let timer = 0, was = {}, since = {}, next = {}, mode = 'keys';

const first = () => {
  try { for (const p of navigator.getGamepads?.() || []) if (p && p.connected !== false) return p; } catch { /* blocked by permissions policy */ }
  return null;
};
const emit = (e) => subs.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });
function setMode(m) {
  if (m === mode) return;
  mode = m;
  html.dataset.input = m;
  modeSubs.forEach((fn) => fn(m));
}

// Polled on a timer, not on animation frames: a short tap must not be lost when frames are slow.
function tick() {
  if (document.hidden) return;
  const now = performance.now();
  const p = first();
  if (!p) { was = {}; return; }
  const s = {};
  for (const k in BTN) { const b = p.buttons[BTN[k]]; s[k] = !!b && (b.pressed || b.value > 0.5); }
  const x = p.axes[0] || 0, y = p.axes[1] || 0;
  if (y < -DEAD) s.up = true; else if (y > DEAD) s.down = true;
  if (x < -DEAD) s.left = true; else if (x > DEAD) s.right = true;
  for (const k in s) {
    if (s[k] && !was[k]) { setMode('pad'); since[k] = now; next[k] = now + FIRST; emit({ type: 'press', key: k, repeat: false }); }
    else if (s[k] && DIR[k] && now >= next[k]) { next[k] = now + AGAIN; emit({ type: 'press', key: k, repeat: true }); }
    else if (!s[k] && was[k]) emit({ type: 'release', key: k, held: now - since[k] });
  }
  if (s.view) emit({ type: 'hold', key: 'view', ms: now - since.view });
  was = s;
}

const start = () => { if (!timer) timer = setInterval(tick, 16); };
addEventListener('gamepadconnected', start);
addEventListener('gamepaddisconnected', () => { if (!first()) { clearInterval(timer); timer = 0; was = {}; setMode('keys'); } });
if (first()) start();

// keyboard or mouse use switches the hints back
addEventListener('keydown', () => setMode('keys'), true);
addEventListener('pointerdown', () => setMode('keys'), true);
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) setMode('keys'); }, { capture: true, passive: true });
html.dataset.input = mode;

export const pad = {
  get mode() { return mode; },
  get connected() { return !!first(); },
  /** Subscribe to pad events; returns the unsubscribe function. */
  on(fn) { subs.add(fn); return () => subs.delete(fn); },
  onMode(fn) { modeSubs.add(fn); return () => modeSubs.delete(fn); },
};
