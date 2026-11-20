// Nagato Sakura Project: the page lives on chapter 05 of the home timeline.
// Scroll position is the timeline: the first screen gathers the particles into her figure, the copy is read
// in front of it, and the last screen flips the frame to the yellow poster. Forward, hold and rewind all
// follow the scroll; nothing plays by itself. (Markup: src/pages/sakura.mjs, content: data/sakura.js.)
//
// Interactive parts (they work without WebGL as well):
//   01 dispatch   pick a sentence → the diagram shows which module she hands it to
//   02 core       pick a component of the block → what it does and which generation uses it
//   03 restore    drag the divider across a picture before / after the model; switch model, zoom
//   04 jobs       wide screens: the row of modules travels sideways as the section is scrolled through
import { world } from '../home/world.js';
import { reducedMotion } from '../core/store.js';
import { routes, core, models } from '../data/sakura.js';

// timeline (see CAM / STAGE and the figure keys in home/scene.js)
const T_GATHER = 4.13;      // particles on their way in
const T_FORM = 4.44;        // the figure, sharp and in full colour
const T_HOLD = 4.54;        // … held while the page is read
const T_POSTER = 4.76;      // the frame as a poster
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export async function mount(main) {
  const ns = main.querySelector('.ns');
  if (!ns) return null;
  const $ = (name) => ns.querySelector(`[data-ns="${name}"]`);
  const secs = [...ns.querySelectorAll('[data-sec]')];
  const rail = [...ns.querySelectorAll('.ns-rail a')];
  const off = [];
  const on = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); off.push(() => target.removeEventListener(type, fn, opt)); };

  // rail: scroll to the section instead of changing the address
  on(ns, 'click', (e) => {
    const a = e.target.closest('.ns-rail a');
    if (!a) return;
    e.preventDefault();
    ns.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });

  // ---------------- 01 dispatch ----------------
  const route = $('route'), log = $('route-log');
  const setRoute = (i) => {
    const r = routes[i];
    route.querySelectorAll('[data-route]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.route) === i)));
    route.querySelectorAll('[data-node], [data-line]').forEach((n) => {
      const id = n.dataset.node || n.dataset.line;
      n.classList.toggle('is-to', id === r.to);
      n.classList.toggle('is-via', r.via.includes(id));
    });
    log.replaceChildren(...r.steps.map(([tag, text], k) => { const li = el('li'); li.style.setProperty('--d', `${k * 0.16}s`); li.append(el('b', null, tag), el('span', null, text)); return li; }));
    // replay the trace for this choice
    route.classList.remove('is-run'); void route.offsetWidth; route.classList.add('is-run');
  };
  on(route, 'click', (e) => { const b = e.target.closest('[data-route]'); if (b) setRoute(Number(b.dataset.route)); });
  setRoute(0);
  route.classList.remove('is-run');     // the first one is simply shown

  // ---------------- 02 core ----------------
  const stack = $('stack'), note = $('part-note');
  const setPart = (i) => {
    const p = core.parts[i];
    stack.querySelectorAll('[data-part]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.part) === i)));
    note.textContent = p.note;
    ns.querySelectorAll('[data-gen]').forEach((g) => g.classList.toggle('is-used', p.in.includes(g.dataset.gen)));
  };
  on(stack, 'click', (e) => { const b = e.target.closest('[data-part]'); if (b) setPart(Number(b.dataset.part)); });
  on(stack, 'pointerover', (e) => { const b = e.target.closest?.('[data-part]'); if (b && e.pointerType === 'mouse') setPart(Number(b.dataset.part)); });
  on(stack, 'focusin', (e) => { const b = e.target.closest?.('[data-part]'); if (b) setPart(Number(b.dataset.part)); });
  setPart(0);

  // ---------------- 03 restoration: before / after ----------------
  const cmp = $('cmp'), stage = $('cmp-stage'), range = $('cmp-range');
  const tabs = [...cmp.querySelectorAll('[data-model]')];
  const setX = (pct) => { const v = Math.min(100, Math.max(0, pct)); stage.style.setProperty('--x', `${v.toFixed(2)}%`); range.value = String(Math.round(v)); };
  const setZoom = (z) => {
    stage.style.setProperty('--z', String(z));
    cmp.querySelectorAll('[data-zoom]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.zoom) === z)));
  };
  const setModel = (i, focus = false) => {
    const m = models[i];
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    if (focus) tabs[i].focus();
    const a = $('cmp-off'), b = $('cmp-on');
    a.src = `/assets/img/sakura/${m.id}-off.webp`; a.alt = `${m.name}：修復前`;
    b.src = `/assets/img/sakura/${m.id}-on.webp`; b.alt = `${m.name}：修復後`;
    stage.style.setProperty('--fx', `${m.focus[0]}%`);
    stage.style.setProperty('--fy', `${m.focus[1]}%`);
    $('cmp-name').textContent = m.name;
    $('cmp-en').textContent = m.en;
    $('cmp-line').textContent = m.line;
    $('cmp-meta').replaceChildren(...[['適用', m.use], ['版本', m.ver], ['訓練參數', m.train], ['型號', m.variants.join(' · ')]].map(([k, v]) => { const row = el('div'); row.append(el('dt', null, k), el('dd', null, v)); return row; }));
    $('cmp-link').href = m.href;
    setX(50);
  };
  let drag = false;
  const at = (e) => { const r = stage.getBoundingClientRect(); setX(((e.clientX - r.left) / r.width) * 100); };
  on(stage, 'pointerdown', (e) => { if (e.button > 0) return; drag = true; stage.setPointerCapture(e.pointerId); stage.classList.add('is-drag'); at(e); });
  on(stage, 'pointermove', (e) => { if (drag) at(e); });
  const drop = () => { drag = false; stage.classList.remove('is-drag'); };
  on(stage, 'pointerup', drop);
  on(stage, 'pointercancel', drop);
  on(range, 'input', () => setX(Number(range.value)));
  on(cmp, 'click', (e) => {
    const t = e.target.closest('[data-model]');
    if (t) { setModel(Number(t.dataset.model)); return; }
    const z = e.target.closest('[data-zoom]');
    if (z) setZoom(Number(z.dataset.zoom));
  });
  on(cmp.querySelector('[role="tablist"]'), 'keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const cur = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    setModel((cur + step + tabs.length) % tabs.length, true);
  });

  // ---------------- the world ----------------
  if (!(await world.ready())) return () => off.forEach((f) => f());          // static layout: everything above still works
  if (!main.isConnected) { off.forEach((f) => f()); return null; }
  ns.classList.add('ns--live');

  const out = { pct: $('pct'), phase: $('phase'), coh: $('coh') };
  const hero = secs[0], end = secs[secs.length - 1];
  const pin = $('pin'), track = $('track'), strip = $('strip'), time = $('time');
  const items = [...time.children];
  const pinMq = matchMedia('(min-width: 900px) and (min-height: 600px)');
  let target = 0, cur = 0, dirty = true, lastHud = 0, travel = 0;
  let mx = 0, my = 0, px = 0, py = 0;

  // 04: on wide screens the section is as tall as the row is long, and the row moves sideways while it is pinned
  const measure = () => {
    const pinned = pinMq.matches && !reducedMotion();
    ns.classList.toggle('ns--pin', pinned);
    travel = pinned ? Math.max(0, track.scrollWidth - strip.clientWidth) : 0;
    pin.style.setProperty('--travel', `${travel}px`);
    if (!pinned) track.style.transform = '';
    dirty = true;
  };
  const read = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? clamp01(scrollY / max) : 0;
    dirty = true;
  };

  // where the timeline is for the current scroll position
  let tWant = T_GATHER, h = 0, f = 0;
  function applyDom() {
    const vh = innerHeight, hh = hero.offsetHeight;
    h = clamp01(scrollY / Math.max(1, hh * 0.86));
    f = clamp01((vh * 0.92 - end.getBoundingClientRect().top) / (vh * 0.62));
    const mid = clamp01((scrollY - hh) / Math.max(1, document.documentElement.scrollHeight - vh - hh - vh * 0.6));
    tWant = T_GATHER + (T_FORM - T_GATHER) * smooth(0, 1, h) + (T_HOLD - T_FORM) * mid + (T_POSTER - T_HOLD) * smooth(0, 1, f);

    let active = 0;
    secs.forEach((s, i) => {
      const top = s.getBoundingClientRect().top;
      const k = i === 0 ? 1 : clamp01((vh * 0.96 - top) / (vh * 0.42));
      s.style.setProperty('--k', k.toFixed(3));
      if (top < vh * 0.5) active = i;
    });
    rail.forEach((a, i) => a.classList.toggle('is-on', i === active));

    // layer stack: fills while the core section crosses the screen
    const sr = stack.getBoundingClientRect();
    stack.style.setProperty('--fill', clamp01((vh * 0.9 - sr.top) / (vh * 0.7)).toFixed(3));

    // jobs: sideways travel
    if (travel > 0) {
      const p = clamp01(-pin.getBoundingClientRect().top / travel);
      track.style.transform = `translate3d(${(-p * travel).toFixed(1)}px, 0, 0)`;
      pin.style.setProperty('--tp', p.toFixed(4));
    }

    // timeline
    const tr = time.getBoundingClientRect();
    const fill = clamp01((vh * 0.62 - tr.top) / tr.height);
    time.style.setProperty('--fill', fill.toFixed(4));
    const y = fill * tr.height;
    items.forEach((li) => li.classList.toggle('is-on', li.offsetTop <= y + 2));

    // the figure is clear in the first screen, dimmed behind the copy while reading, and returns as the poster
    // (portrait: the copy scrolls up over her at once, so she dims earlier)
    const reading = smooth(innerWidth / innerHeight < 1.2 ? 0.06 : 0.35, 1, h) * (1 - smooth(0, 0.7, f));
    ns.style.setProperty('--scrim', (0.86 * reading).toFixed(3));
    ns.style.setProperty('--side', ((1 - smooth(0.5, 1, h)) * (1 - f)).toFixed(3));
    ns.style.setProperty('--h', h.toFixed(3));
    ns.style.setProperty('--p', target.toFixed(4));
  }

  const driver = {
    frame(now, dt) {
      const still = reducedMotion();
      const k = still ? 1 : 1 - Math.exp(-dt * 6);
      if (dirty) { applyDom(); dirty = false; }
      cur += (tWant - cur) * k;
      if (Math.abs(tWant - cur) < 0.0004) cur = tWant;
      px += (mx - px) * k * 0.6; py += (my - py) * k * 0.6;
      const wide = clamp01((innerWidth / innerHeight - 1.05) / 0.35);
      const hs = smooth(0.2, 1, h), fs = smooth(0, 1, f);
      return {
        t: cur,
        speed: 0,
        // desktop: the chapter already seats her right of centre; she steps a little further aside while the page is read
        shift: wide * 0.05 * hs * (1 - fs) + (still ? 0 : px * 0.01),
        // portrait: she stands above the copy in the first screen
        lift: (1 - wide) * (0.29 * (1 - hs) + 0.33 * fs) + (still ? 0 : py * 0.01),
        // … and smaller, so head to toe fits in the space above the title
        pull: (1 - wide) * (0.2 + 0.08 * (1 - hs) + 0.12 * fs),
      };
    },
    state(st) {
      ns.style.setProperty('--poster', (st.poster || 0).toFixed(3));
      // on the poster the header reads in ink, like the copy
      document.documentElement.classList.toggle('nx-on-poster', st.poster > 0.5);
      const now = performance.now();
      if (now - lastHud < 90) return;
      lastHud = now;
      const coh = smooth(3.98, 4.4, cur);
      out.coh.textContent = String(Math.round(coh * 100)).padStart(3, '0');
      ns.style.setProperty('--coh', coh.toFixed(3));
      out.pct.textContent = (target * 100).toFixed(1).padStart(5, '0');
      out.phase.textContent = `PHASE — ${st.poster > 0.5 ? 'PRINT' : coh < 0.98 ? 'GATHERING' : 'RESOLVED'}`;
    },
    resize() { measure(); read(); },
  };
  // start where the scroll position says, not from the first frame of the chapter
  cur = T_GATHER;

  on(window, 'scroll', read, { passive: true });
  on(window, 'resize', () => { measure(); read(); });
  on(window, 'pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    mx = (e.clientX / innerWidth - 0.5) * -2;
    my = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  on(pinMq, 'change', () => { measure(); read(); });
  const ro = new ResizeObserver(() => { measure(); read(); });
  ro.observe(ns.querySelector('.ns-doc'));
  ro.observe(track);

  measure();
  read();
  applyDom();
  cur = tWant;
  const release = world.drive(driver);

  return () => {
    release();
    document.documentElement.classList.remove('nx-on-poster');
    ro.disconnect();
    off.forEach((fn) => fn());
  };
}
