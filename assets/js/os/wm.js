// Window manager of the WebOS.
//
//   geometry    every window has a free rectangle (`rect`) and, when it is docked, a zone (`snap`): 'max', the two
//               halves 'l' 'r' and the four quarters. The free rectangle is kept while docked, so undocking — by the
//               button, the keyboard or by dragging the title bar away — gives the window its old size back.
//   stacking    `stack` is the z-order, bottom to top; the last window of the current workspace that is not
//               minimised is the active one.
//   workspaces  a window belongs to one workspace; the others are kept alive but out of the frame.
//   overview    the windows of the workspace laid out side by side, scaled to fit; a click picks one.
//   compact     on small frames (phones) every window fills the desk and cannot be moved or resized.
//
// Pointer gestures are followed on `window`, not on the element that was pressed, so a drag that leaves the frame —
// or crosses an embedded document — still ends properly.
import { h } from './ui.js';
import { svg } from './icons.js';
import { clamp, two } from './kernel.js';

const ZONES = {
  max: [0, 0, 1, 1], l: [0, 0, 0.5, 1], r: [0.5, 0, 0.5, 1],
  tl: [0, 0, 0.5, 0.5], tr: [0.5, 0, 0.5, 0.5], bl: [0, 0.5, 0.5, 0.5], br: [0.5, 0.5, 0.5, 0.5],
};
const BAR = 34;                      // height of a title bar
const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export function createWm(os) {
  const layer = os.layers.wins;
  const snapEl = h('div', { class: 'os-snap', 'aria-hidden': 'true' });
  layer.append(snapEl);
  const wins = [];
  let stack = [], active = null, ws = 0, seq = 0, overview = false, compact = false, shown = null;
  let W = layer.clientWidth, H = layer.clientHeight;

  const emit = () => os.bus.emit('wm');
  const zoneRect = (z) => { const [x, y, w, hh] = ZONES[z]; return { x: Math.round(x * W), y: Math.round(y * H), w: Math.round(w * W), h: Math.round(hh * H) }; };
  const rectOf = (win) => (win.snap ? zoneRect(win.snap) : win.rect);
  const here = (win) => win.ws === ws && !win.min;

  function apply(win) {
    const r = rectOf(win), s = win.el.style;
    s.setProperty('--x', `${r.x}px`); s.setProperty('--y', `${r.y}px`);
    s.setProperty('--w', `${r.w}px`); s.setProperty('--h', `${r.h}px`);
    win.el.classList.toggle('is-max', win.snap === 'max');
    win.el.classList.toggle('is-snap', !!win.snap && win.snap !== 'max');
    const b = win.el.querySelector('[data-w="max"]');
    if (b) { b.innerHTML = svg(win.snap === 'max' ? 'restore' : 'max'); b.title = win.snap === 'max' ? '還原' : '最大化'; b.setAttribute('aria-label', b.title); }
  }
  const glide = (win, ms = 260) => {
    win.el.classList.add('is-glide');
    clearTimeout(win.glideT);
    win.glideT = setTimeout(() => win.el.classList.remove('is-glide'), ms);
  };
  function fit(win) {
    // a free window always keeps its title bar reachable
    const r = win.rect, o = win.opts;
    r.w = clamp(r.w, Math.min(o.minW, W), Math.max(o.minW, W));
    r.h = clamp(r.h, Math.min(o.minH, H), Math.max(o.minH, H));
    r.x = clamp(r.x, 80 - r.w, W - 80);
    r.y = clamp(r.y, 0, Math.max(0, H - BAR));
  }
  function remember(win) {
    if (compact || wins.some((x) => x.app === win.app && x !== win && x.id < win.id)) return;
    const geo = { ...os.cfg.get('geo') };
    geo[win.app] = { ...win.rect, snap: win.snap };
    os.cfg.set('geo', geo);
  }
  function order() {
    stack.forEach((win, i) => { win.el.style.zIndex = 10 + i; });
    let top = null;
    for (const win of stack) if (here(win)) top = win;
    if (active !== top) {
      active = top;
      wins.forEach((x) => x.el.classList.toggle('is-active', x === active));
    }
    emit();
  }

  // ---------------------------------------------------------------- opening and closing
  function open(opts) {
    const o = { w: 720, h: 480, minW: 320, minH: 220, ...opts };
    const id = ++seq;
    const saved = os.cfg.get('geo')[o.app];
    const twin = wins.filter((x) => x.app === o.app).length;
    const n = wins.filter((x) => x.ws === ws && !x.min).length;
    let rect, snap = null;
    if (saved && !twin && Number.isFinite(saved.x)) { rect = { x: saved.x, y: saved.y, w: saved.w, h: saved.h }; snap = ZONES[saved.snap] ? saved.snap : null; }
    else {
      const w = Math.min(o.w, W - 24), hh = Math.min(o.h, H - 24);
      rect = { x: Math.round((W - w) / 2) + ((n + twin) % 6) * 26, y: Math.round((H - hh) / 2.6) + ((n + twin) % 6) * 26, w, h: hh };
    }
    const body = h('div', { class: 'os-win__body' });
    const el = h('section', { class: 'os-win is-in', tabindex: '-1', role: 'group', 'aria-label': o.title, data: { app: o.app }, style: o.tint ? { '--tint': o.tint } : null },
      h('header', { class: 'os-win__bar' },
        h('span', { class: 'os-win__ico', html: svg(o.icon || 'max') }),
        h('b', { class: 'os-win__title' }, o.title),
        h('span', { class: 'os-win__tag' }, `${o.code || 'APP'}-${two(id)}`),
        h('span', { class: 'os-win__ctl' },
          h('button', { type: 'button', data: { w: 'min' }, title: '最小化', 'aria-label': '最小化', html: svg('min') }),
          h('button', { type: 'button', data: { w: 'max' }, title: '最大化', 'aria-label': '最大化', html: svg('max') }),
          h('button', { type: 'button', data: { w: 'close' }, title: '關閉', 'aria-label': '關閉', html: svg('close') }))),
      body,
      DIRS.map((d) => h('i', { class: 'os-win__rs', data: { rs: d } })));
    const win = {
      id, app: o.app, title: o.title, icon: o.icon, opts: o, el, body, rect, snap, ws, min: false, started: Date.now(), cleanup: [], api: null, onClose: null,
      setTitle(t) { if (t === win.title) return; win.title = t; el.querySelector('.os-win__title').textContent = t; el.setAttribute('aria-label', t); emit(); },
      close: (force) => close(win, { force }),
      focus: () => focus(win),
    };
    fit(win);
    bind(win);
    wins.push(win); stack.push(win);
    layer.append(el);
    apply(win);
    setTimeout(() => el.classList.remove('is-in'), 420);
    os.sound.play('open');
    if (overview) setOverview(false);
    order();
    el.focus({ preventScroll: true });
    return win;
  }

  async function close(win, { force = false } = {}) {
    if (win.closing) return true;
    if (!force && win.onClose) {
      win.closing = true;
      let ok = true;
      try { ok = await win.onClose(); } catch (e) { console.error(e); }
      win.closing = false;
      if (ok === false) return false;
    }
    win.closing = true;
    win.cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    wins.splice(wins.indexOf(win), 1);
    stack = stack.filter((x) => x !== win);
    win.el.classList.add('is-out');
    win.el.inert = true;
    setTimeout(() => win.el.remove(), 190);
    os.sound.play('close');
    order();
    if (overview) layoutOverview();
    if (active && !active.el.contains(document.activeElement)) active.el.focus({ preventScroll: true });
    return true;
  }

  // ---------------------------------------------------------------- focus, state
  function focus(win) {
    if (!wins.includes(win)) return;
    if (win.ws !== ws) setWs(win.ws);
    if (win.min) restore(win);
    if (stack.at(-1) !== win) { stack = stack.filter((x) => x !== win); stack.push(win); }
    order();
    if (!win.el.contains(document.activeElement)) win.el.focus({ preventScroll: true });
  }
  function minimize(win) {
    if (win.min) return;
    const r = rectOf(win), at = os.shell?.dockPoint?.(win);
    win.el.style.setProperty('--mx', `${Math.round((at ? at.x : W / 2) - r.w * 0.1)}px`);
    win.el.style.setProperty('--my', `${Math.round(at ? at.y : H)}px`);
    glide(win, 300);
    win.min = true;
    win.el.classList.add('is-min');
    win.el.inert = true;
    order();
  }
  function restore(win) {
    if (!win.min) return;
    glide(win, 300);
    win.min = false;
    win.el.classList.remove('is-min');
    win.el.inert = false;
    order();
  }
  function setSnap(win, zone) {
    if (compact) return;
    glide(win);
    win.snap = zone;
    apply(win);
    remember(win);
    emit();
  }
  const toggleMax = (win) => setSnap(win, win.snap === 'max' ? null : 'max');
  /** Arrow keys: ← → dock to a half, ↑ maximises, ↓ steps back (maximised → free → minimised). */
  function snapKey(win, key) {
    if (key === 'left') setSnap(win, win.snap === 'l' ? null : 'l');
    else if (key === 'right') setSnap(win, win.snap === 'r' ? null : 'r');
    else if (key === 'up') setSnap(win, 'max');
    else if (win.snap) setSnap(win, null); else minimize(win);
  }

  // ---------------------------------------------------------------- pointer: move
  function zoneAt(px, py) {
    const edge = 14, corner = Math.min(120, H * 0.28);
    if (px <= edge) return py < corner ? 'tl' : py > H - corner ? 'bl' : 'l';
    if (px >= W - edge) return py < corner ? 'tr' : py > H - corner ? 'br' : 'r';
    if (py <= 6) return 'max';
    return null;
  }
  function showSnap(zone) {
    if (shown === zone) return;
    shown = zone;
    if (!zone) { snapEl.classList.remove('is-on'); return; }
    const r = zoneRect(zone);
    Object.assign(snapEl.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    snapEl.classList.add('is-on');
  }
  function track(move, end) {
    os.root.classList.add('is-busy');           // embedded documents would swallow the pointer
    const up = (e) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      os.root.classList.remove('is-busy');
      end(e);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function startMove(win, e) {
    if (compact || overview) return;
    const box = layer.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const home = win.snap ? null : { ...win.rect };       // where a free window goes back to if this drag docks it
    let ox = rectOf(win).x, oy = rectOf(win).y, moved = false, zone = null;
    track((ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved) {
        if (Math.hypot(dx, dy) < 5) return;
        moved = true;
        win.el.classList.remove('is-glide');
        win.el.classList.add('is-drag');
        if (win.snap) {
          // pull a docked window off: it takes its free size back, under the pointer at the same fraction of its width
          const cur = rectOf(win), fx = (sx - box.left - cur.x) / cur.w;
          win.snap = null;
          win.rect.x = Math.round(sx - box.left - fx * win.rect.w);
          win.rect.y = Math.round(sy - box.top - Math.min(BAR / 2, sy - box.top - cur.y));
          ox = win.rect.x; oy = win.rect.y;
        }
      }
      win.rect.x = Math.round(ox + dx); win.rect.y = Math.round(oy + dy);
      fit(win);
      apply(win);
      zone = zoneAt(ev.clientX - box.left, ev.clientY - box.top);
      showSnap(zone);
    }, () => {
      win.el.classList.remove('is-drag');
      showSnap(null);
      if (!moved) return;
      if (zone) { if (home) win.rect = home; setSnap(win, zone); } else { remember(win); emit(); }
    });
  }

  // ---------------------------------------------------------------- pointer: resize
  function startResize(win, dir, e) {
    if (compact || overview) return;
    if (win.snap) { win.rect = { ...rectOf(win) }; win.snap = null; apply(win); }
    const sx = e.clientX, sy = e.clientY, o = { ...win.rect }, min = win.opts;
    win.el.classList.remove('is-glide');
    win.el.classList.add('is-drag');
    track((ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy, r = win.rect;
      if (dir.includes('e')) r.w = clamp(o.w + dx, min.minW, W - o.x);
      if (dir.includes('s')) r.h = clamp(o.h + dy, min.minH, H - o.y);
      if (dir.includes('w')) { r.w = clamp(o.w - dx, min.minW, o.x + o.w); r.x = o.x + o.w - r.w; }
      if (dir.includes('n')) { r.h = clamp(o.h - dy, min.minH, o.y + o.h); r.y = o.y + o.h - r.h; }
      r.x = Math.round(r.x); r.y = Math.round(r.y); r.w = Math.round(r.w); r.h = Math.round(r.h);
      apply(win);
    }, () => { win.el.classList.remove('is-drag'); fit(win); apply(win); remember(win); emit(); });
  }

  function barMenu(win, e) {
    const spaces = os.cfg.get('spaces');
    os.ui.menu([
      win.snap ? { label: '還原', icon: 'restore', action: () => setSnap(win, null) } : null,
      { label: '最小化', icon: 'min', hint: 'Alt M', action: () => minimize(win) },
      win.snap !== 'max' ? { label: '最大化', icon: 'max', hint: 'Alt X', action: () => setSnap(win, 'max'), disabled: compact } : null,
      { label: '貼齊', icon: 'layers', disabled: compact, sub: [
        { label: '左半', action: () => setSnap(win, 'l') }, { label: '右半', action: () => setSnap(win, 'r') }, '-',
        { label: '左上', action: () => setSnap(win, 'tl') }, { label: '右上', action: () => setSnap(win, 'tr') },
        { label: '左下', action: () => setSnap(win, 'bl') }, { label: '右下', action: () => setSnap(win, 'br') },
      ] },
      spaces.length > 1 ? { label: '移到工作區', icon: 'spaces', sub: spaces.map((s, i) => ({ label: `${two(i + 1)}　${s.name}`, checked: i === win.ws, action: () => sendTo(win, i) })) } : null,
      '-',
      { label: '關閉', icon: 'close', hint: 'Alt W', danger: true, action: () => close(win) },
    ], { x: e.clientX, y: e.clientY });
  }

  function bind(win) {
    const { el } = win;
    el.addEventListener('pointerdown', (e) => {
      if (overview) return;
      if (active !== win) focus(win);
      const rs = e.target.dataset?.rs;
      if (rs && e.button === 0) { e.preventDefault(); startResize(win, rs, e); return; }
      if (e.button === 0 && e.target.closest('.os-win__bar') && !e.target.closest('button')) startMove(win, e);
    }, true);
    el.addEventListener('click', (e) => {
      if (overview) { e.preventDefault(); e.stopPropagation(); if (e.target.closest('[data-w="close"]')) close(win); else { setOverview(false); focus(win); } return; }
      const b = e.target.closest('[data-w]');
      if (!b) return;
      if (b.dataset.w === 'min') minimize(win); else if (b.dataset.w === 'max') toggleMax(win); else close(win);
    }, true);
    const bar = el.querySelector('.os-win__bar');
    bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) toggleMax(win); });
    bar.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!overview) barMenu(win, e); });
  }

  // ---------------------------------------------------------------- workspaces
  function setWs(i, { quiet = false } = {}) {
    const n = os.cfg.get('spaces').length;
    i = clamp(i, 0, n - 1);
    if (i === ws) return;
    const dir = i > ws ? 1 : -1, from = ws;
    ws = i;
    for (const win of wins) {
      const s = win.el.style;
      if (win.ws === from) { s.setProperty('--off', `${-dir * 90}px`); glide(win, 320); win.el.classList.add('is-away'); win.el.inert = true; }
      else if (win.ws === i) {
        s.setProperty('--off', `${dir * 90}px`);
        void win.el.offsetWidth;
        glide(win, 320);
        win.el.classList.remove('is-away');
        win.el.inert = win.min;
      }
    }
    if (!quiet) os.sound.play('space');
    order();
    os.bus.emit('ws', { ws, from, dir });
    if (overview) layoutOverview();
  }
  function sendTo(win, i) {
    if (i === win.ws) return;
    win.ws = i;
    const away = i !== ws;
    win.el.style.setProperty('--off', `${(i > ws ? 1 : -1) * 90}px`);
    glide(win, 320);
    win.el.classList.toggle('is-away', away);
    win.el.inert = away || win.min;
    order();
    if (overview) layoutOverview();
  }
  /** A workspace was removed: its windows move to the one before it, later ones shift down. */
  function dropWs(i) {
    for (const win of wins) {
      if (win.ws === i) { win.ws = Math.max(0, i - 1); } else if (win.ws > i) win.ws -= 1;
    }
    const n = os.cfg.get('spaces').length;
    const next = clamp(ws > i ? ws - 1 : ws, 0, n - 1);
    ws = -1;
    for (const win of wins) { const away = win.ws !== next; win.el.classList.toggle('is-away', away); win.el.inert = away || win.min; }
    ws = next;
    order();
    os.bus.emit('ws', { ws, from: ws, dir: 0 });
  }

  // ---------------------------------------------------------------- overview
  function layoutOverview() {
    const list = stack.filter(here).reverse();
    layer.classList.toggle('is-empty', !list.length);
    if (!list.length) return;
    const top = 112, pad = 28, gap = 26;
    const aw = W - pad * 2, ah = H - top - pad;
    let best = { s: 0, cols: 1 };
    for (let cols = 1; cols <= list.length; cols++) {
      const rows = Math.ceil(list.length / cols);
      const cw = (aw - gap * (cols - 1)) / cols, ch = (ah - gap * (rows - 1)) / rows;
      const s = Math.min(1, ...list.map((win) => { const r = rectOf(win); return Math.min(cw / r.w, ch / r.h); }));
      if (s > best.s) best = { s, cols, rows, cw, ch };
    }
    list.forEach((win, k) => {
      const r = rectOf(win), col = k % best.cols, row = Math.floor(k / best.cols);
      const inRow = Math.min(best.cols, list.length - row * best.cols);
      const x0 = pad + (aw - (inRow * best.cw + (inRow - 1) * gap)) / 2;
      const cx = x0 + col * (best.cw + gap) + best.cw / 2, cy = top + row * (best.ch + gap) + best.ch / 2;
      const s = win.el.style;
      s.setProperty('--os', best.s.toFixed(4));
      s.setProperty('--ox', `${Math.round(cx - (r.w * best.s) / 2)}px`);
      s.setProperty('--oy', `${Math.round(cy - (r.h * best.s) / 2)}px`);
    });
  }
  function setOverview(on) {
    on = !!on && !compact;
    if (on === overview) return;
    overview = on;
    os.ui.closeMenu();
    if (on) layoutOverview();
    wins.forEach((win) => glide(win, 380));
    os.root.classList.toggle('is-overview', on);
    os.bus.emit('overview', on);
    emit();
  }

  // ---------------------------------------------------------------- the frame changed
  const ro = new ResizeObserver(() => {
    W = layer.clientWidth; H = layer.clientHeight;
    const small = W < 720 || H < 400;
    if (small !== compact) {
      compact = small;
      os.root.toggleAttribute('data-compact', compact);
      if (compact && overview) setOverview(false);
      os.bus.emit('compact', compact);
    }
    wins.forEach((win) => { fit(win); apply(win); });
    if (overview) layoutOverview();
  });
  ro.observe(layer);
  // a click inside an embedded document never reaches this document: when the focus lands in a frame, the window
  // that holds it comes to the front
  const onBlur = () => setTimeout(() => {
    const a = document.activeElement;
    if (a && a.tagName === 'IFRAME') { const win = wins.find((x) => x.el.contains(a)); if (win && win !== active) focus(win); os.ui.closeMenu(); os.bus.emit('frame-focus'); }
  });
  addEventListener('blur', onBlur);

  let hidden = null;      // windows put away by "show desktop"
  return {
    open, close, focus, minimize, restore, toggleMax, setSnap, snapKey, setWs, sendTo, dropWs, setOverview,
    get wins() { return wins; },
    get active() { return active; },
    get ws() { return ws; },
    get overview() { return overview; },
    get compact() { return compact; },
    get size() { return { w: W, h: H }; },
    byApp: (app) => wins.filter((x) => x.app === app),
    count: (i) => wins.filter((x) => x.ws === i).length,
    blur() { /* the desktop was pressed: no window is active until one is picked */ if (active) { active.el.classList.remove('is-active'); active = null; emit(); } },
    /** Next (or previous) window of this workspace. */
    cycle(d = 1) {
      const list = stack.filter((x) => x.ws === ws);
      if (!list.length) return;
      if (!active || list.length < 2) { focus(list.at(-1)); return; }
      if (d > 0) {
        // the active window goes to the bottom of the pile, the one under it comes up
        const next = list.filter((x) => x !== active).at(-1);
        stack = [active, ...stack.filter((x) => x !== active)];
        focus(next);
      } else focus(list[0]);
    },
    showDesktop() {
      const open = wins.filter(here);
      if (open.length) { hidden = open; open.forEach(minimize); }
      else if (hidden) { hidden.filter((x) => wins.includes(x) && x.ws === ws).forEach(restore); hidden = null; }
    },
    async closeAll() { for (const win of [...wins]) await close(win, { force: true }); },
    dispose() { ro.disconnect(); removeEventListener('blur', onBlur); wins.splice(0).forEach((win) => { win.cleanup.splice(0).forEach((fn) => { try { fn(); } catch { /* going away */ } }); win.el.remove(); }); stack = []; },
  };
}
