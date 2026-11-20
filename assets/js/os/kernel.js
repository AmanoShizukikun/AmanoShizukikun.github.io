// WebOS kernel: the message bus, the system configuration and the sound synthesiser.
// Nothing here touches the DOM beyond one AudioContext.
import { quality } from '../core/store.js';
import { APPS, CATS } from './apps.js';

// ---------------------------------------------------------------- small helpers
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const two = (n) => String(n).padStart(2, '0');
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const bytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);
export const span = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
};

// ---------------------------------------------------------------- bus
export function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type)?.delete(fn);
    },
    emit(type, data) {
      map.get(type)?.forEach((fn) => { try { fn(data); } catch (e) { console.error(`[os] listener of "${type}" failed`, e); } });
    },
    clear() { map.clear(); },
  };
}

// ---------------------------------------------------------------- configuration
// One JSON object under one localStorage key. Reads never fail: a key that is missing (or of the wrong kind) is
// its default. `cfg.set` emits "cfg" with the key that changed.
const KEY = 'nxos';
export const SCENES = {
  boundary: { name: '邊界', en: 'EVERNIGHT BOUNDARY', t: 0.34 },
  snow: { name: '常雪原', en: 'THE SNOWFIELD', t: 1.34 },
  gate: { name: '觀測者', en: 'OBSERVER', t: 2.26 },
  tree: { name: '神樹', en: 'THE SACRED TREE', t: 3.58 },
  signal: { name: '訊號', en: 'SIGNAL', t: 6.62 },
};
export const WALLS = [
  { id: 'night', name: '紫藤夜', file: 'wall-night' },
  { id: 'blade', name: '破曉', file: 'wall-blade' },
  { id: 'ember', name: '餘燼', file: 'wall-ember' },
  { id: 'party', name: '二週年', file: 'wall-party' },
];
export const ACCENTS = [['#ffc400', '訊號黃'], ['#ff6a1a', '餘燼橙'], ['#ff7fa8', '櫻'], ['#b79cff', '紫藤'], ['#7fd4c1', '苔'], ['#ecebe5', '白']];

const DEFAULTS = () => ({
  wall: 'live',                 // 'live' | 'img:<id>' | 'file:<node id>' | 'solid'
  spaces: [{ name: '觀測者', scene: 'gate' }, { name: '神樹', scene: 'tree' }, { name: '常雪原', scene: 'snow' }, { name: '訊號', scene: 'signal' }],
  accent: '#ffc400',
  tone: 'dark',                 // 'dark' | 'light'  (panels and windows; the world behind is always dark)
  glass: quality() !== 'low',   // blur what is behind panels and windows (off by default where the site itself renders at low quality)
  bright: 100,                  // 50–100
  night: false, nightK: 40,     // night light and its strength (10–80)
  barAlign: 'left',             // 'left' | 'center'
  barSize: 'm',                 // 'm' | 's'
  sound: false, vol: 70, mute: false,
  dnd: false,                   // do not disturb: notifications go to the centre without a toast
  focus: false,                 // fill the window: hide the site's header while the system is open
  widget: true,                 // the telemetry block on the desktop
  seconds: false,
  hour12: false,
  pins: ['files', 'sakura', 'browser', 'terminal', 'notes', 'settings'],
  desk: {},                     // node id → [col, row]
  geo: {},                      // app id → { x, y, w, h, max }
  app: {},                      // per-application state
  seen: false,                  // the welcome notification has been shown
  startStyle: 'menu',           // the start button opens: 'menu' (普通, the start menu) | 'tiles' (平板, the full-screen start screen)
  tiles: CATS.map(([id, name]) => ({ id, name, apps: APPS.filter((a) => a.cat === id).map((a) => a.id) })),   // start screen: groups of tiles, in the visitor's own order
  startPins: ['files', 'sakura', 'browser', 'notes', 'gallery', 'media', 'arcade', 'settings'],
  allView: 'list',              // "all applications" in the start menu: 'list' | 'grid'
  tileSize: { files: 'w', sakura: 'l', browser: 'w', gallery: 'w', media: 'w', arcade: 'w', settings: 'w' },   // start screen: app id → 's' | 'w' | 'l'
  widgets: [{ id: 'w1', type: 'clock', size: 2 }, { id: 'w2', type: 'perf', size: 2 }, { id: 'w3', type: 'cal', size: 3 }, { id: 'w4', type: 'memo', size: 2 }, { id: 'w5', type: 'storage', size: 1 }],
  hubCol: true,                 // the start screen shows the widget column
  recent: [],                   // ids of the files that were opened last
  memo: '',                     // the text of the note widget
  calOpen: true,                // the month in the clock panel is unfolded
  focusMin: 30,                 // length of a focus session, in minutes
});

export function createConfig(bus) {
  const base = DEFAULTS();
  let data = {};
  try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw && typeof raw === 'object') data = raw; } catch { /* first run, or private mode */ }
  let timer = 0, broken = false;
  const flush = () => {
    timer = 0;
    try { localStorage.setItem(KEY, JSON.stringify(data)); broken = false; } catch (e) {
      if (!broken) { broken = true; bus.emit('cfg:error', e); }
    }
  };
  const same = (a, b) => typeof a === typeof b && Array.isArray(a) === Array.isArray(b);
  const cfg = {
    get(key) {
      const v = data[key], d = base[key];
      return v === undefined || (d !== undefined && !same(v, d)) ? d : v;
    },
    set(key, value) {
      data[key] = value;
      if (!timer) timer = setTimeout(flush, 120);
      bus.emit('cfg', key);
      bus.emit(`cfg:${key}`, value);
    },
    /** State of one application: `app('notes').get('wrap', true)`. */
    app(id) {
      return {
        get(k, fallback) { const a = cfg.get('app')[id]; return a && a[k] !== undefined ? a[k] : fallback; },
        set(k, v) { const all = { ...cfg.get('app') }; all[id] = { ...(all[id] || {}), [k]: v }; cfg.set('app', all); },
      };
    },
    reset() { data = {}; flush(); Object.keys(base).forEach((k) => { bus.emit('cfg', k); bus.emit(`cfg:${k}`, base[k]); }); },
    flush() { if (timer) { clearTimeout(timer); flush(); } },
    size() { try { return (localStorage.getItem(KEY) || '').length * 2; } catch { return 0; } },
  };
  return cfg;
}

// ---------------------------------------------------------------- sound
// Interface sounds are synthesised (two oscillators and an envelope): no audio files. They are off until the
// visitor switches them on, and nothing sounds before the first gesture (the browser would refuse it anyway).
const TONES = {
  tick: [[1320, 0, 0.035, 0.18, 'square']],
  open: [[392, 0, 0.09, 0.22, 'triangle'], [784, 0.05, 0.12, 0.2, 'triangle']],
  close: [[784, 0, 0.07, 0.2, 'triangle'], [392, 0.05, 0.1, 0.18, 'triangle']],
  note: [[880, 0, 0.1, 0.24, 'sine'], [1318.5, 0.09, 0.2, 0.22, 'sine']],
  error: [[196, 0, 0.14, 0.3, 'sawtooth'], [174.6, 0.12, 0.2, 0.28, 'sawtooth']],
  login: [[523.3, 0, 0.3, 0.2, 'sine'], [784, 0.12, 0.34, 0.2, 'sine'], [1046.5, 0.26, 0.6, 0.18, 'sine']],
  space: [[220, 0, 0.3, 0.16, 'sine'], [330, 0.04, 0.3, 0.12, 'sine']],
  trash: [[300, 0, 0.08, 0.2, 'square'], [180, 0.06, 0.14, 0.2, 'square']],
};
export function createSound(cfg) {
  let ctx = null;
  const level = () => (cfg.get('mute') ? 0 : cfg.get('vol') / 100);
  return {
    /** 0–1: what a media element should multiply its own volume by. */
    level,
    play(name) {
      if (!cfg.get('sound') || !TONES[name] || level() <= 0) return;
      try {
        ctx ||= new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const t0 = ctx.currentTime + 0.01;
        for (const [freq, at, len, gain, type] of TONES[name]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = type; o.frequency.value = freq;
          g.gain.setValueAtTime(0, t0 + at);
          g.gain.linearRampToValueAtTime(gain * 0.5 * level(), t0 + at + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
          o.connect(g).connect(ctx.destination);
          o.start(t0 + at); o.stop(t0 + at + len + 0.02);
        }
      } catch { /* no audio device */ }
    },
    dispose() { try { ctx?.close(); } catch { /* already closed */ } ctx = null; },
  };
}
