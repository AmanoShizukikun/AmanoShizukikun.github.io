// Home page: maps scroll position to the timeline value `t` and drives both the WebGL scene
// and the DOM layers from it. Scroll down = forward, scroll up = rewind, stop = hold.
import { reducedMotion } from '../core/store.js';
import { world } from '../home/world.js';
import { works, hrefOf } from '../data/site.js';
import { createGlide } from '../home/glide.js';

const HELIX = [5.3, 5.72];                    // the archive helix's stretch of the timeline (HELIX.from / .to in home/scene.js)
const NAMES = ['BOUNDARY', 'SNOWFIELD', 'OBSERVER', 'SACRED TREE', 'NAGATO SAKURA', 'ARCHIVE', 'SIGNAL'];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };

export async function mount(main) {
  const hm = main.querySelector('.hm');
  if (!hm) return null;
  const layers = [...hm.querySelectorAll('.hm-layer')];
  const segs = [...hm.querySelectorAll('.hm-seg')];
  const rail = [...hm.querySelectorAll('.hm-rail a')];
  const hud = Object.fromEntries([...hm.querySelectorAll('[data-hud]')].map((el) => [el.dataset.hud, el]));
  const count = segs.length;

  // tick marks of the drafting reticle
  const ticks = hm.querySelector('.hm-ringsvg .ticks');
  if (ticks && !ticks.childElementCount) {
    let d = '';
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, r1 = i % 6 === 0 ? 84 : 88;
      d += `M${(Math.cos(a) * 92).toFixed(2)} ${(Math.sin(a) * 92).toFixed(2)}L${(Math.cos(a) * r1).toFixed(2)} ${(Math.sin(a) * r1).toFixed(2)}`;
    }
    ticks.innerHTML = `<path d="${d}"/>`;
  }

  // the world is shared with every other page; this page only drives it
  if (!(await world.ready())) { hm.classList.add('hm--static'); return null; }
  if (!main.isConnected) return null; // navigated away while loading
  hm.classList.add('hm--live');

  let bounds = [];           // [top, height] of each track segment
  let tTarget = 0, tCur = 0, lastHud = 0;
  // chapter 06: the scroll chooses the work, the helix glides to it (home/glide.js)
  const glide = createGlide(works.length);
  const workAt = (t) => clamp01((t - HELIX[0]) / (HELIX[1] - HELIX[0])) * (works.length - 1);

  const trackEl = hm.querySelector('.hm-track');
  // segment positions are read live: they change with viewport size, browser UI bars and font loading
  function layout() {
    const y0 = trackEl.getBoundingClientRect().top + scrollY;
    bounds = segs.map((s) => [y0 + s.offsetTop, s.offsetHeight]);
  }
  function readScroll() {
    layout();
    const y = scrollY;
    let t = 0;
    for (let i = 0; i < count; i++) {
      const [top, h] = bounds[i];
      if (y >= top + h) { t = i + 1; continue; }
      if (y > top) t = i + (y - top) / h;
      break;
    }
    tTarget = Math.min(count, Math.max(0, t));
  }

  function applyDom(t) {
    const ch = Math.min(count - 1, Math.floor(t));
    hm.dataset.ch = ch;
    for (let i = 0; i < layers.length; i++) {
      const el = layers[i];
      const enter = i === 0 ? 1 : smooth(i + 0.1, i + 0.34, t);
      const exit = i === count - 1 ? 0 : smooth(i + 0.74, i + 0.94, t);
      const on = enter > 0.001 && exit < 0.999;
      if (on) {
        el.style.setProperty('--in', enter.toFixed(4));
        el.style.setProperty('--out', exit.toFixed(4));
        el.style.setProperty('--lp', clamp01((t - i - 0.3) / 0.46).toFixed(4));
      }
      if (el._on !== on) { el._on = on; el.classList.toggle('is-on', on); el.inert = !on; }
    }
    rail.forEach((a, i) => a.classList.toggle('is-on', i === ch));
    hm.style.setProperty('--t', t.toFixed(4));
    hm.style.setProperty('--bars', (smooth(1.9, 2.25, t) * (1 - smooth(4.96, 5.2, t))).toFixed(4));
    hm.style.setProperty('--hud', (1 - 0.72 * smooth(1.9, 2.2, t) * (1 - smooth(5.0, 5.3, t))).toFixed(4));
    hm.style.setProperty('--reticle', (1 - smooth(0.5, 1.0, t)).toFixed(4));
  }

  // archive: the copy block follows whichever panel the carousel has turned to the front
  const focus = hm.querySelector('.hm-focus');
  const fx = focus ? Object.fromEntries([...focus.querySelectorAll('[data-f]')].map((el) => [el.dataset.f, el])) : null;
  let shownWork = -1;
  function showWork(i) {
    if (!fx || i === shownWork || !works[i]) return;
    shownWork = i;
    const w = works[i];
    fx.no.textContent = String(i + 1).padStart(2, '0');
    fx.total.textContent = `/ ${String(works.length).padStart(2, '0')}`;
    fx.kind.textContent = `${w.kind} — ${w.year}`;
    fx.title.textContent = w.title;
    fx.en.textContent = w.en;
    fx.desc.textContent = w.desc;
    fx.tech.replaceChildren(...w.tech.map((t) => Object.assign(document.createElement('i'), { textContent: t })));
    fx.link.href = hrefOf(w);
    // an entry that leaves the site opens in a new tab (the router leaves _blank links alone) and says so with ↗
    if (w.href) Object.assign(fx.link, { target: '_blank', rel: 'noopener noreferrer' });
    else { fx.link.removeAttribute('target'); fx.link.removeAttribute('rel'); }
    fx.link.querySelector('b').textContent = w.href ? '↗' : '→';
    fx.ticks.replaceChildren(...works.map((_, k) => Object.assign(document.createElement('i'), { className: k === i ? 'is-on' : '' })));
    focus.classList.remove('is-swap');
    void focus.offsetWidth;            // restart the short swap animation
    focus.classList.add('is-swap');
  }

  function writeHud(t, camera) {
    const ch = Math.min(count - 1, Math.floor(t));
    const p = camera.position;
    const f = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1).padStart(5, '0');
    hud.seq.textContent = `SEQ ${String(ch + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
    hud.name.textContent = NAMES[ch];
    hud.xyz.textContent = `X ${f(p.x)} · Y ${f(p.y)} · Z ${f(p.z)}`;
    hud.fov.textContent = `FOV ${camera.fov.toFixed(1)}`;
    hud.pct.textContent = ((t / count) * 100).toFixed(1).padStart(5, '0');
  }

  const driver = {
    frame(now, dt) {
      const k = reducedMotion() ? 1 : 1 - Math.exp(-dt * 7);
      tCur += (tTarget - tCur) * k;
      if (Math.abs(tTarget - tCur) < 0.00002) tCur = tTarget;
      applyDom(tCur);
      return { t: tCur, speed: Math.abs(tTarget - tCur), turn: glide.step(workAt(tTarget), dt) };
    },
    state(st, scene) {
      hm.style.setProperty('--poster', st.poster.toFixed(3));
      showWork(st.work);
      const now = performance.now();
      if (now - lastHud > 90) { lastHud = now; writeHud(tCur, scene.camera); }
    },
    resize: () => readScroll(),
  };

  const onScroll = () => readScroll();
  const onResize = () => readScroll();
  // Chapter jumps do not fast-forward through everything in between, and they do not cut either:
  // the timeline moves in one step and the world flies straight from the old frame to the new one.
  const LAND = [0, 0.45, 0.5, 0.5, 0.5, 0.305, 0.9];      // where in each chapter a jump lands
  let jumpId = 0;
  const onRail = (e) => {
    const a = e.target.closest('a[href^="#ch-"]');
    if (!a) return;
    e.preventDefault();
    const i = Number(a.getAttribute('href').slice(4));
    const jump = () => {
      layout();
      const [top, h] = bounds[i];
      scrollTo(0, top + h * (LAND[i] ?? 0.5));
      readScroll();
      tCur = tTarget;
      glide.reset(workAt(tTarget));
    };
    if (reducedMotion()) { jump(); return; }
    const id = ++jumpId;
    hm.classList.add('is-jump');                       // the copy steps back for the flight
    setTimeout(() => {
      if (id !== jumpId || !hm.isConnected) return;
      world.fly(world.snapshot());
      jump();
      applyDom(tCur);
      setTimeout(() => { if (id === jumpId) hm.classList.remove('is-jump'); }, 620);
    }, 160);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);
  hm.addEventListener('click', onRail);

  readScroll();
  tCur = tTarget;
  glide.reset(workAt(tTarget));
  applyDom(tCur);
  const release = world.drive(driver);

  // debugging / testing hook
  window.__home = { get t() { return tCur; }, seek(t) { layout(); const i = Math.min(count - 1, Math.floor(t)); const [top, h] = bounds[i]; scrollTo(0, top + h * (t - i)); }, get info() { return world.scene?.info; } };

  return () => {
    release();
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onResize);
    jumpId += 1;
    delete window.__home;
  };
}
