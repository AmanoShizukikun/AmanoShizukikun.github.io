// Frame-rate monitor (設定 → 幀率顯示, or the game centre's side rail).
// A small panel that can be dragged anywhere; three modes, as in the old game centre:
//   FPS   the frame rate only            ADV   + frame time and a frame-time graph
//   FULL  + 1% low, JS heap, clock
// It measures the top document's animation frames. A game inside the app frame is same-origin and shares
// the same main thread and frame cadence, so the reading holds for it too.
import { store } from '../core/store.js';

const MODES = ['fps', 'adv', 'full'];
const KEEP = 200;       // frame times kept for the 1% low and the graph

export function initOsd(root) {
  const osd = root.querySelector('.nx-osd');
  const out = Object.fromEntries([...osd.querySelectorAll('[data-o]')].map((el) => [el.dataset.o, el]));
  const ctx = out.graph.getContext('2d');
  const times = [];
  let raf = 0, last = 0, mark = 0, frames = 0;

  const setMode = (m) => {
    if (!MODES.includes(m)) m = 'fps';
    osd.dataset.mode = m;
    osd.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
    clamp();
  };
  osd.querySelector('.nx-osd__modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (b) store.set('nxOsdMode', b.dataset.m);
  });

  function draw() {
    const w = out.graph.width, h = out.graph.height, n = Math.min(times.length, 90);
    ctx.clearRect(0, 0, w, h);
    if (n < 2) return;
    const part = times.slice(-n), top = Math.max(34, ...part);
    ctx.strokeStyle = 'rgba(236,235,229,0.18)';
    ctx.lineWidth = 1;
    const y60 = h - (16.67 / top) * h;
    ctx.beginPath(); ctx.moveTo(0, y60 + 0.5); ctx.lineTo(w, y60 + 0.5); ctx.stroke();
    ctx.strokeStyle = '#ffc400';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    part.forEach((t, i) => { const x = (i / (n - 1)) * w, y = h - Math.min(1, t / top) * (h - 2) - 1; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const d = now - last;
    last = now;
    if (d > 0 && d < 500) { times.push(d); if (times.length > KEEP) times.shift(); }
    frames += 1;
    if (now - mark < 500) return;
    const fps = (frames * 1000) / (now - mark);
    frames = 0; mark = now;
    out.fps.textContent = String(Math.round(fps));
    const mode = osd.dataset.mode;
    if (mode === 'fps' || !times.length) return;
    const recent = times.slice(-30);
    out.ms.textContent = `${(recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(1)} ms`;
    draw();
    if (mode !== 'full') return;
    const worst = [...times].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(times.length / 100)));
    out.low.textContent = `${Math.round(1000 / (worst.reduce((a, b) => a + b, 0) / worst.length))} FPS`;
    const mem = performance.memory;
    out.heap.textContent = mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '—';
    out.time.textContent = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  }

  // drag by the title strip; the position is kept per device
  function place(x, y) {
    const r = osd.getBoundingClientRect();
    x = Math.max(4, Math.min(innerWidth - r.width - 4, x));
    y = Math.max(4, Math.min(innerHeight - r.height - 4, y));
    osd.style.left = `${x}px`; osd.style.top = `${y}px`;
    return [Math.round(x), Math.round(y)];
  }
  function clamp() {
    if (osd.hidden || !osd.style.left) return;
    place(parseFloat(osd.style.left), parseFloat(osd.style.top));
  }
  const head = osd.querySelector('.nx-osd__head');
  let grab = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || e.button > 0) return;
    const r = osd.getBoundingClientRect();
    grab = [e.clientX - r.left, e.clientY - r.top];
    head.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  head.addEventListener('pointermove', (e) => { if (grab) place(e.clientX - grab[0], e.clientY - grab[1]); });
  const drop = (e) => {
    if (!grab) return;
    const at = place(e.clientX - grab[0], e.clientY - grab[1]);
    grab = null;
    store.set('nxOsdPos', at.join(','));
  };
  head.addEventListener('pointerup', drop);
  head.addEventListener('pointercancel', () => { grab = null; });
  addEventListener('resize', clamp);

  const setOn = (v) => {
    const on = v === 'true';
    cancelAnimationFrame(raf);
    osd.hidden = !on;
    if (!on) return;
    const pos = (store.get('nxOsdPos') || '').split(',').map(Number);
    if (pos.length === 2 && pos.every(Number.isFinite)) place(pos[0], pos[1]);
    times.length = 0; frames = 0; last = mark = performance.now();
    raf = requestAnimationFrame(tick);
  };
  setMode(store.get('nxOsdMode'));
  store.on('nxOsdMode', setMode);
  setOn(store.get('nxFps'));
  store.on('nxFps', setOn);
}
