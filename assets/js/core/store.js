// Persistent user settings (localStorage) with change notifications.
// 'theme' and 'live2dEnabled' reuse the keys of the previous site so embedded legacy apps stay in sync
// ('live2dEnabled' switches the mascot, shell/mascot.js).

const DEFAULTS = {
  theme: 'dark',                // 'dark' | 'light'
  live2dEnabled: 'false',       // 'true' | 'false'
  nxMotion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full', // 'full' | 'reduced'
  nxQuality: 'auto',            // 'auto' | 'high' | 'low'
  nxFps: 'false',               // 'true' | 'false'   frame-rate monitor (shell/osd.js)
  nxOsdMode: 'fps',             // 'fps' | 'adv' | 'full'
  nxOsdPos: '',                 // 'x,y' once the monitor has been dragged
  nxSide: 'true',               // 'true' | 'false'   the game centre's side rail (shell/sidebar.js)
  nxSideWide: 'false',          // 'true' | 'false'   … with labels
  nxMascotModel: '',            // id of the model on duty (shell/mascot.js); '' = the first one
  nxMascotPos: '',              // 'x,y' as fractions of the free space once she has been dragged; '' = bottom right
  nxMascotSize: '',             // height of the figure in CSS px; '' = by screen size
  nxMascotMin: 'false',         // 'true' | 'false'   stepped aside (a tab on the edge brings her back)
  nxMusicVol: '80',             // 0–100              music player (pages/music.js)
  nxMusicMute: 'false',         // 'true' | 'false'
  nxMusicRepeat: 'all',         // 'all' | 'one'
};

const listeners = new Map();

function read(key) {
  try { return localStorage.getItem(key) ?? DEFAULTS[key]; } catch { return DEFAULTS[key]; }
}

export const store = {
  get: read,
  bool: (key) => read(key) === 'true',
  set(key, value) {
    const v = String(value);
    try { localStorage.setItem(key, v); } catch { /* private mode: keep in-memory only */ DEFAULTS[key] = v; }
    (listeners.get(key) || []).forEach((fn) => fn(v));
  },
  on(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key).delete(fn);
  },
};

// Resolved render quality for WebGL pages.
export function quality() {
  const q = read('nxQuality');
  if (q !== 'auto') return q;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  return small || weak ? 'low' : 'high';
}

export const reducedMotion = () => read('nxMotion') === 'reduced';
