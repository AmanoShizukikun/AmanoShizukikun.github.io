// WebOS page: mounts the system (assets/js/os/) and lends it the world as a live wallpaper.
//
// On the rest of the site the scroll position drives the world. Here the system does: every workspace is a place
// on the home timeline, switching workspace is a flight between two of them, the pointer shifts the lens a little
// (parallax), and the camera steps back while the lock screen or the overview is up.
import { world } from '../home/world.js';
import { reducedMotion } from '../core/store.js';
import { router } from '../core/router.js';
import { identity } from '../core/identity.js';

let cssReady = null;
function loadCss() {
  // the system's own sheets (frame, panels, applications) — none is needed anywhere else on the site
  cssReady ||= Promise.all(['webos', 'webos-shell', 'webos-apps'].map((name) => new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/assets/css/${name}.css`;
    link.onload = link.onerror = () => resolve();
    document.head.append(link);
  })));
  return cssReady;
}

export async function mount(main) {
  const root = main.querySelector('[data-os]');
  if (!root) return null;
  const html = document.documentElement;
  const say = (text) => { const p = root.querySelector('[data-os-msg]'); if (p) p.textContent = text; };

  // the system's own browser pointed at this page: one system per tab is enough
  let framed = false;
  try { framed = window.top !== window.self; } catch { framed = true; }
  if (framed) { say('WebOS 已經在外層執行中，這裡不再開第二個。'); return null; }

  let dead = false, sys = null, release = null;
  html.classList.add('nx-os');

  // ---------------- the world as wallpaper
  let t = 2.26, pull = 0.34, pullTo = 0.34, px = 0, py = 0, sx = 0, sy = 0;
  const driver = {
    frame(now, dt) {
      const still = reducedMotion();
      pull += (pullTo - pull) * (still ? 1 : 1 - Math.exp(-dt * 2.6));
      const k = 1 - Math.exp(-dt * 3.2);
      sx += (px - sx) * k; sy += (py - sy) * k;
      // the place breathes: a very slow drift along the timeline keeps its machinery turning
      const drift = still ? 0 : Math.sin(now / 9000) * 0.012;
      // the system has its own appearance settings; the place behind it is always the dark grade
      return { t: t + drift, speed: 0, shift: still ? 0 : -sx * 0.012, lift: still ? 0 : sy * 0.008, pull, light: 0, calm: true };
    },
  };
  const onMove = (e) => { px = (e.clientX / innerWidth - 0.5) * 2; py = (e.clientY / innerHeight - 0.5) * 2; };
  addEventListener('pointermove', onMove, { passive: true });

  const [scene] = await Promise.all([world.ready(), loadCss()]);
  const stage = {
    available: !!scene,
    setLive(on) {
      if (on && !release && scene) release = world.drive(driver);
      else if (!on && release) { release(); release = null; }
    },
    /** Move to another place on the timeline — a flight when `fly`, a cut otherwise. */
    go(to, fly) {
      if (fly && release && !reducedMotion() && Math.abs(to - t) > 0.001) world.fly(world.snapshot(), 1350);
      t = to;
    },
    depth(v) { pullTo = v; },
    read() { const s = release ? world.snapshot() : null; return s ? { x: s.px, y: s.py, z: s.pz } : null; },
  };
  const cleanup = () => {
    dead = true;
    removeEventListener('pointermove', onMove);
    try { sys?.dispose(); } catch (e) { console.error(e); }
    release?.(); release = null;
    html.classList.remove('nx-os');
  };
  if (!main.isConnected) { cleanup(); return null; }

  try {
    const { createOS } = await import('../os/os.js');
    if (dead || !main.isConnected) { cleanup(); return null; }
    sys = await createOS(root, {
      build: main.dataset.build || 'dev',
      stage,
      identity: (el) => identity.apply(el),
      exit: () => router.back(main.dataset.back || '/works/'),
    });
    if (dead) sys.dispose();
    // on the preview server only: a handle on the running system for the console
    else if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.nxos = sys.os;
  } catch (e) {
    console.error('[webos] the system failed to start', e);
    if (!root.querySelector('.os-boot')) root.innerHTML = '<div class="os-pre"><p data-os-msg></p></div>';
    say('系統無法啟動。請重新整理頁面再試一次。');
  }
  return cleanup;
}
