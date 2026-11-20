// Live2D works: the models run live on a stage that stays on screen while the copy scrolls past.
// Scroll position decides how the stage shows the model — whole, back on its texture atlas, as triangles,
// as a fanned-out stack of layers, close up for the parameters. Forward, hold and rewind all follow the
// scroll; the only things that move by themselves are the ones a living model does (breathing, blinking,
// following the pointer, hair settling). (Markup: src/pages/live2d.mjs, content: data/live2d.js,
// runtime: live2d/puppet.js, renderer: live2d/stage.js.)
//
// Behind the stage the world holds on chapter 04 of the home timeline (the tree) and drifts round it.
import { world } from '../home/world.js';
import { store, quality, reducedMotion } from '../core/store.js';
import { loadPuppet } from '../live2d/puppet.js';
import { createStage } from '../live2d/stage.js';
import { models, groups, labels, hidden, roles, faces, pendulums } from '../data/live2d.js';

const T0 = 3.3, T1 = 3.82;
const SPREAD = 1.3, LIFT = 0.1, FAN_ANGLE = 0.86, SKEW = -0.3;      // how far, how high and how steeply the layers fan out
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const mix = (a, b, k) => a + (b - a) * k;
const two = (i) => String(i).padStart(2, '0');
const fmt = (n) => Number(n).toLocaleString('en-US');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// what each kind of section asks of the stage
//   frame: what the camera frames      look: how much she follows the pointer      box: outline of the model's canvas
const SHOTS = {
  full: { frame: 'body', sheet: 0, wire: 0, fan: 0, look: 1, grid: 0, box: 0, view: 'LIVE' },
  file: { frame: 'body', sheet: 0, wire: 0, fan: 0, look: 1, grid: 0, box: 1, view: 'FILE' },
  sheet: { frame: 'sheet', sheet: 1, wire: 0, fan: 0, look: 0, grid: 1, box: 0, view: 'PARTS' },
  mesh: { frame: 'bust', sheet: 0, wire: 1, fan: 0, look: 0.3, grid: 0, box: 0, view: 'MESH' },
  fan: { frame: 'fan', sheet: 0, wire: 0.3, fan: 1, look: 0, grid: 0, box: 0, view: 'LAYERS' },
  bust: { frame: 'bust', sheet: 0, wire: 0, fan: 0, look: 1, grid: 0, box: 0, view: 'RIG' },
};
const KEYS = ['sheet', 'wire', 'fan', 'look', 'grid', 'box'];

export async function mount(main) {
  const l2 = main.querySelector('.l2');
  if (!l2) return null;
  const $ = (name) => l2.querySelector(`[data-l2="${name}"]`);
  const $$ = (name) => [...l2.querySelectorAll(`[data-l2="${name}"]`)];
  const off = [];
  const on = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); off.push(() => target.removeEventListener(type, fn, opt)); };
  let dead = false;

  // ---------------- things that work without the stage ----------------
  on(l2, 'click', (e) => {
    const a = e.target.closest('.l2-rail a, .l2-go a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    l2.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });
  const mascot = l2.querySelector('[data-act="mascot"]');
  const syncMascot = (v) => { mascot.setAttribute('aria-pressed', String(v === 'true')); mascot.querySelector('span').textContent = v === 'true' ? '看板娘已啟用' : '啟用看板娘'; };
  syncMascot(store.get('live2dEnabled'));
  off.push(store.on('live2dEnabled', syncMascot));
  on(mascot, 'click', () => store.set('live2dEnabled', store.get('live2dEnabled') === 'true' ? 'false' : 'true'));

  // ---------------- the stage ----------------
  const canvas = $('canvas');
  let stage = null;
  try { stage = createStage(canvas, { maxDpr: quality() === 'low' ? 1.5 : 2 }); } catch (e) { console.warn('[live2d] stage unavailable', e); }
  if (!stage) { l2.classList.add('l2--static'); return () => off.forEach((f) => f()); }   // a document with one capture per model
  l2.classList.add('l2--live', 'is-loading');

  const secs = [...l2.querySelectorAll('[data-sec]')];
  const doc = l2.querySelector('.l2-doc');
  // tall windows: the copy scrolls in its own box under the stage (see live2d.css), otherwise the page scrolls
  const tall = matchMedia('(max-aspect-ratio: 1/1), (max-width: 899px) and (max-aspect-ratio: 13/10)');
  const scrollPos = () => (tall.matches ? doc.scrollTop : scrollY);
  const scrollMax = () => (tall.matches ? doc.scrollHeight - doc.clientHeight : document.documentElement.scrollHeight - innerHeight);
  const rail = [...l2.querySelectorAll('.l2-rail a')];
  const frameEl = $('frame'), axes = $('axes'), time = $('time'), sliders = $('sliders'), pend = $('pend'), wind = $('wind');
  const timeItems = [...time.children];
  const probes = $$('probe').map((p) => ({ root: p, out: Object.fromEntries([...p.querySelectorAll('[data-p]')].map((d) => [d.dataset.p, d])) }));
  const hiRes = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1) >= 1500 && quality() !== 'low';

  // state of the stage: `want` is what the scroll position asks for, `S` is what is drawn (eased towards it)
  const S = { cam: { cx: 0, cy: 0, sx: 0, sy: 0, s: 1 }, sheet: 0, sheetSide: 1, wire: 0, fill: 1, fan: 0, angle: FAN_ANGLE, spread: SPREAD, lift: LIFT, skew: SKEW, hi: -1, frame: 0, grid: 0 };
  const want = { sheet: 0, wire: 0, fan: 0, look: 1, grid: 0, box: 0, cx: 0, cy: 0, ls: 0 };
  const now = { look: 1, cx: 0, cy: 0, ls: 0, set: false };
  const R = { x: 0, y: 0, w: 1, h: 1 };                       // where the model stands, in canvas pixels
  let active = -1, pup = null, def = null, loadId = 0, dirty = true, last = performance.now(), raf = 0;
  let view = '', sweep = { x: 0, y: 0, z: 0, on: 0 }, physK = 0;
  const pointer = { x: -1, y: -1, inside: false, touch: false, until: 0 };   // a touch is followed for a moment, a mouse always
  let dimmed = 0, kick = 0, kickT = 0, blush = 0, gust = 0, lastY = scrollPos(), scrollV = 0;
  const cache = new Map();
  const tween = new Map();                                     // parameter index → value the pose is moving to
  let rows = [], bobs = [], role = {};

  // ---- cameras
  function camOf(kind) {
    const b = pup.bounds, f = pup.face;
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (kind === 'sheet') return { cx: 0, cy: 0, s: (Math.min(R.w, R.h) * 0.94) / S.sheetSide };
    if (kind === 'bust') return { cx: f.x, cy: f.y - f.r * 0.95, s: Math.min(R.h / (f.r * 5.6), R.w / (f.r * 4.4)) };
    if (kind === 'fan') {
      const w = bw * Math.cos(FAN_ANGLE) + SPREAD * Math.sin(FAN_ANGLE), h = bh + LIFT + bw * Math.abs(SKEW);
      return { cx: ((b.x0 + b.x1) / 2) * Math.cos(FAN_ANGLE), cy: (b.y0 + b.y1) / 2, s: Math.min((R.w * 0.94) / w, (R.h * 0.9) / h) };
    }
    return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, s: Math.min((R.h * 0.95) / bh, (R.w * 0.96) / bw) };
  }

  // ---- scroll → what the stage should show
  function applyDom() {
    // the band of the screen the copy is read in: all of it, or the box under the stage
    const top0 = tall.matches ? doc.getBoundingClientRect().top : 0, span = innerHeight - top0;
    const at = (k) => top0 + span * k;
    const fr = frameEl.getBoundingClientRect();
    R.x = fr.left; R.y = fr.top; R.w = Math.max(40, fr.width); R.h = Math.max(40, fr.height);
    // a section takes over the stage while its top crosses this band of the screen
    const hi = at(tall.matches ? 0.98 : 0.92), lo = at(tall.matches ? 0.46 : 0.4);

    let activeSec = 0;
    const shot = { ...SHOTS.full };
    let cam = pup ? camOf('body') : null;
    secs.forEach((s, i) => {
      const top = s.getBoundingClientRect().top;
      const k = i === 0 ? 1 : smooth(0, 1, (hi - top) / (hi - lo));
      s.style.setProperty('--k', k.toFixed(3));
      if (top < at(0.56)) activeSec = i;
      if (i === 0 || k <= 0) return;
      const key = SHOTS[s.dataset.shot] || SHOTS.full;
      KEYS.forEach((n) => { shot[n] = mix(shot[n], key[n], k); });
      if (pup) { const c = camOf(key.frame); cam.cx = mix(cam.cx, c.cx, k); cam.cy = mix(cam.cy, c.cy, k); cam.s = Math.exp(mix(Math.log(cam.s), Math.log(c.s), k)); }
    });
    KEYS.forEach((n) => { want[n] = shot[n]; });
    if (cam) { want.cx = cam.cx; want.cy = cam.cy; want.ls = Math.log(cam.s); }
    rail.forEach((a, i) => a.classList.toggle('is-on', i === activeSec));
    const v = secs[activeSec].id === 'l2-6' ? 'PHYSICS' : (SHOTS[secs[activeSec].dataset.shot] || SHOTS.full).view;
    if (v !== view) { view = v; l2.dataset.view = v; setText('tag-view', v); }

    // 05: X, Y, Z — one full swing each while the three rows cross the screen
    const ar = axes.getBoundingClientRect();
    const q = clamp01((at(tall.matches ? 0.94 : 0.8) - ar.top) / (span * (tall.matches ? 0.6 : 0.46)));
    ['x', 'y', 'z'].forEach((a, i) => {
      const u = clamp01(q * 3 - i);
      sweep[a] = Math.sin(u * Math.PI * 2);
      const li = axes.children[i];
      li.style.setProperty('--u', u.toFixed(3));
      li.classList.toggle('is-on', u > 0 && u < 1);
    });
    sweep.on = q > 0 && q < 1 ? 1 : 0;

    // 06: the wind only blows while the physics section is the one being read
    const pr = secs[6].getBoundingClientRect();
    physK = smooth(0, 1, (at(0.8) - pr.top) / (span * 0.3)) * (1 - smooth(0, 1, (at(0.3) - pr.bottom) / (span * 0.2)));

    // 07: timeline fill
    const tr = time.getBoundingClientRect();
    const fill = clamp01((at(0.72) - tr.top) / Math.max(1, tr.height));
    time.style.setProperty('--fill', fill.toFixed(4));
    timeItems.forEach((li) => li.classList.toggle('is-on', li.offsetTop <= fill * tr.height + 2));

    const max = scrollMax();
    l2.style.setProperty('--p', (max > 0 ? clamp01(scrollPos() / max) : 0).toFixed(4));
  }

  // ---- model data → page
  const setText = (name, text) => $$(name).forEach((n) => { n.textContent = text; });
  function describe() {
    const st = pup.stats;
    setText('n-meshes', fmt(st.meshes));
    setText('n-verts', fmt(st.verts));
    setText('n-tris', fmt(st.tris));
    setText('n-params', fmt(st.params));
    setText('n-masked', fmt(st.masked));
    setText('n-atlas', `${def.atlas} × ${def.atlas}`);
    setText('tag-code', def.code);
    role = { ...roles, ...(def.roles || {}) };
    if (def.eyes) { role.eyeL = def.eyes[0]; role.eyeR = def.eyes[1]; }
  }

  // 05: one slider per parameter the page can name; the ones physics drives are left to the next section
  function buildPanel() {
    const driven = new Set(pup.physics ? pup.physics.settings.flatMap((s) => s.outputs.map((o) => o.id)) : []);
    const names = { ...labels, ...(def.labels || {}) };
    const by = new Map(groups.map(([id]) => [id, []]));
    pup.P.ids.forEach((id, i) => {
      if (driven.has(id) || hidden.includes(id) || !names[id]) return;
      const [name, group] = names[id];
      by.get(group)?.push({ id, i, name });
    });
    rows = [];
    sliders.replaceChildren(...groups.filter(([id]) => by.get(id).length).map(([id, title], gi) => {
      const d = el('details', 'l2-group');
      d.open = gi === 0;
      const sum = el('summary');
      sum.append(el('b', null, title), el('i', null, two(by.get(id).length)));
      d.append(sum, ...by.get(id).map((p) => {
        const row = el('label', 'l2-row');
        const input = el('input');
        const lo = pup.P.min[p.i], hi = pup.P.max[p.i];
        Object.assign(input, { type: 'range', min: String(lo), max: String(hi), step: String((hi - lo) / 200), value: String(pup.pose[p.i]) });
        input.dataset.param = p.id;
        const out = el('output', null, pup.pose[p.i].toFixed(2));
        row.append(el('span', null, p.name), input, out);
        rows.push({ i: p.i, input, out, shown: pup.pose[p.i] });
        return row;
      }));
      return d;
    }));
    l2.querySelectorAll('[data-face]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.face === 'rest')));
  }
  const syncRows = () => rows.forEach((r) => {
    const v = pup.pose[r.i];
    if (Math.abs(v - r.shown) < 1e-4) return;
    r.shown = v; r.input.value = String(v); r.out.textContent = v.toFixed(2);
  });

  // 06: one pendulum per physics group
  function buildPend() {
    bobs = [];
    const list = pup.physics ? pup.physics.settings : [];
    pend.replaceChildren(...list.map((s) => {
      const li = el('li');
      const rod = el('i');
      li.append(rod, el('span', null, pendulums[s.outputs[0].id] || s.name));
      bobs.push({ s, rod, a: 0 });
      return li;
    }));
  }

  // expressions: move the pose towards a set of values
  function setFace(id) {
    const f = faces.find((x) => x.id === id) || faces[0];
    const P = pup.P;
    // back to rest for everything an expression may have touched, then the new one on top
    Object.values(role).forEach((pid) => { const i = pup.index(pid); if (i >= 0) tween.set(i, P.def[i]); });
    f.set.forEach(([r, v]) => { const i = pup.index(role[r]); if (i >= 0) tween.set(i, v === 'max' ? P.max[i] : v === 'min' ? P.min[i] : clamp(v, P.min[i], P.max[i])); });
    l2.querySelectorAll('[data-face]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.face === f.id)));
  }

  // ---- loading and switching models
  async function entry(i) {
    if (!cache.has(i)) {
      cache.set(i, (async () => {
        const d = models[i];
        const img = new Image();
        img.decoding = 'async';
        img.src = d.tex[hiRes ? 0 : 1];
        const [p] = await Promise.all([loadPuppet(d), img.decode()]);
        return { def: d, pup: p, img };
      })().catch((e) => { cache.delete(i); throw e; }));
    }
    return cache.get(i);
  }

  function markModel(i) {
    l2.querySelectorAll('[data-model]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.model) === i)));
    l2.querySelectorAll('[data-file]').forEach((f) => f.classList.toggle('is-on', Number(f.dataset.file) === i));
  }

  async function setModel(i, { quiet = false } = {}) {
    if (i === active || !models[i]) return;
    const id = ++loadId;
    active = i;
    markModel(i);
    l2.classList.add('is-loading');
    $('load').textContent = `LOADING ${models[i].code}`;
    if (!quiet) history.replaceState(history.state, '', `#${models[i].id}`);
    let e;
    try { e = await entry(i); } catch (err) {
      console.warn('[live2d] model failed to load', err);
      if (id === loadId && !dead) { $('load').textContent = `${models[i].code} 載入失敗`; l2.classList.add('is-failed'); }
      return;
    }
    if (id !== loadId || dead) return;
    l2.classList.remove('is-failed');
    if (pup && !reducedMotion()) { l2.classList.add('is-swap'); await new Promise((r) => setTimeout(r, 170)); if (id !== loadId || dead) return; }
    tween.clear();
    pup = e.pup; def = e.def;
    pup.physics?.reset();
    pup.resetPose();
    stage.setPuppet(pup, e.img, def.crop);
    S.sheetSide = pup.canvas.h; S.hi = -1;
    describe(); buildPanel(); buildPend(); showProbe(-1);
    if (def.outfit) l2.querySelectorAll('[data-outfit]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.outfit) === pup.pose[pup.index(def.outfit)])));
    now.set = false; dirty = true;
    l2.classList.remove('is-loading', 'is-swap');
    // the others are fetched once this one is on stage
    (window.requestIdleCallback || setTimeout)(() => { if (!dead) models.forEach((_, k) => entry(k).catch(() => {})); }, { timeout: 4000 });
  }

  // ---- inspecting a part
  function showProbe(i) {
    S.hi = i;
    const d = pup && i >= 0 ? pup.d : null;
    probes.forEach((p) => {
      p.root.classList.toggle('is-on', !!d);
      p.out.id.textContent = d ? d.ids[i] : '—';
      p.out.verts.textContent = d ? fmt(d.vertexCounts[i]) : '—';
      p.out.tris.textContent = d ? fmt(d.indexCounts[i] / 3) : '—';
      p.out.order.textContent = d ? `${d.renderOrders[i] + 1} / ${d.count}` : '—';
    });
  }
  const inspecting = () => S.wire > 0.3 || S.fan > 0.3 || S.sheet > 0.6;
  const overCopy = (t) => !!t.closest?.('.l2-doc a, .l2-doc button, .l2-doc input, .l2-doc summary, .l2-cast, .l2-rail, .nx-header, .l2-panel, .l2-phys');

  // ---- one frame
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    const still = reducedMotion();
    if (dirty) { applyDom(); dirty = false; }
    const sy = scrollPos();
    scrollV += ((sy - lastY) / Math.max(0.001, dt) / innerHeight - scrollV) * (1 - Math.exp(-dt * 8));
    lastY = sy;
    if (!pup) { stage.clear(); return; }

    const k = still ? 1 : 1 - Math.exp(-dt * 9);
    if (!now.set) { now.cx = want.cx; now.cy = want.cy; now.ls = want.ls; now.look = want.look; KEYS.forEach((n) => { if (n in S) S[n] = want[n]; }); S.frame = want.box; now.set = true; }
    S.sheet += (want.sheet - S.sheet) * k; S.wire += (want.wire - S.wire) * k; S.fan += (want.fan - S.fan) * k; S.grid += (want.grid - S.grid) * k; S.frame += (want.box - S.frame) * k;
    now.cx += (want.cx - now.cx) * k; now.cy += (want.cy - now.cy) * k; now.ls += (want.ls - now.ls) * k; now.look += (want.look - now.look) * k;
    for (const n of ['sheet', 'wire', 'fan', 'grid', 'frame']) if (Math.abs(S[n]) < 0.0015) S[n] = 0;
    // the world steps back while she is taken apart
    const dim = Math.max(S.sheet, S.fan, S.wire * 0.7);
    if (Math.abs(dim - dimmed) > 0.004) { dimmed = dim; l2.style.setProperty('--dim', dim.toFixed(3)); }
    const cam = S.cam;
    cam.cx = now.cx; cam.cy = now.cy; cam.s = Math.exp(now.ls); cam.sx = R.x + R.w / 2; cam.sy = R.y + R.h / 2;

    // where she is asked to look: towards the pointer, measured from her face
    const f = pup.face;
    const fx = cam.sx + (f.x - cam.cx) * cam.s, fy = cam.sy - (f.y - cam.cy) * cam.s;
    const follow = pointer.inside && (!pointer.touch || t < pointer.until) ? now.look * (1 - sweep.on) : 0;
    pup.look.x = clamp((pointer.x - fx) / (innerWidth * 0.36), -1, 1) * follow;
    pup.look.y = clamp((fy - pointer.y) / (innerHeight * 0.36), -1, 1) * follow;
    pup.idle = !still;

    // pose on its way to an expression / an outfit
    if (tween.size) {
      const tk = still ? 1 : 1 - Math.exp(-dt * 12);
      for (const [i, v] of tween) { pup.pose[i] += (v - pup.pose[i]) * tk; if (Math.abs(v - pup.pose[i]) < 0.004) { pup.pose[i] = v; tween.delete(i); } }
      syncRows();
    }
    kickT += dt; kick *= Math.exp(-dt * 2.6); blush *= Math.exp(-dt * 1.6);
    gust += (clamp(-scrollV * 0.55, -0.7, 0.7) * physK + Number(wind.value) * 0.8 - gust) * (1 - Math.exp(-dt * 5));
    if (pup.physics) pup.physics.wind = still ? Number(wind.value) * 0.8 : gust;
    pup.hook = hook;
    pup.update(dt);
    stage.draw(S);

    for (const b of bobs) { const a = b.s.swing * 42; if (Math.abs(a - b.a) > 0.05) { b.a = a; b.rod.style.transform = `rotate(${a.toFixed(1)}deg)`; } }
  }
  // added on top of the pose every frame
  function hook(p) {
    const amp = now.look > 0.5 ? 1 : now.look * 2;            // the demonstration only plays in the close-up
    if (sweep.on && amp > 0) {
      p.add('ParamAngleX', sweep.x * 30 * amp); p.add('ParamBodyAngleX', sweep.x * 6 * amp);
      p.add('ParamAngleY', sweep.y * 30 * amp); p.add('ParamBodyAngleY', sweep.y * 5 * amp);
      p.add('ParamAngleZ', sweep.z * 30 * amp); p.add('ParamBodyAngleZ', sweep.z * 6 * amp);
    }
    if (kick > 0.002) { const w = Math.sin(kickT * 8.5) * kick; p.add('ParamBodyAngleX', w * 10); p.add('ParamBodyAngleZ', w * 8); p.add('ParamAngleZ', w * -14); p.add('ParamAngleX', w * 12); }
    if (blush > 0.01) {
      const b = Math.min(1, blush);
      const to = (r, v) => { const i = p.index(role[r]); if (i >= 0) p.P.values[i] += ((v === 'max' ? p.P.max[i] : v) - p.P.values[i]) * b; };
      to('cheek', 'max'); to('smileL', 0.7); to('smileR', 0.7); to('mouth', 'max');
    }
  }

  // ---- input
  on(l2, 'click', (e) => {
    const m = e.target.closest('[data-model]');
    if (m) { setModel(Number(m.dataset.model)); return; }
    const o = e.target.closest('[data-outfit]');
    if (o && pup && def.outfit) {
      const i = pup.index(def.outfit);
      if (i >= 0) tween.set(i, Number(o.dataset.outfit));
      o.parentElement.querySelectorAll('[data-outfit]').forEach((b) => b.setAttribute('aria-pressed', String(b === o)));
      return;
    }
    const f = e.target.closest('[data-face]');
    if (f && pup) { setFace(f.dataset.face); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'reset' && pup) {
      const keep = def.outfit ? pup.index(def.outfit) : -1;
      pup.P.ids.forEach((_, i) => { if (i !== keep) tween.set(i, pup.P.def[i]); });
      l2.querySelectorAll('[data-face]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.face === 'rest')));
    }
    if (act === 'push') { kick = 1; kickT = 0; }
  });
  on(sliders, 'input', (e) => {
    const input = e.target.closest('input[data-param]');
    if (!input || !pup) return;
    const r = rows.find((x) => x.input === input);
    tween.delete(r.i);
    pup.pose[r.i] = Number(input.value);
    r.shown = pup.pose[r.i]; r.out.textContent = r.shown.toFixed(2);
    l2.querySelectorAll('[data-face]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  });

  const at = (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.touch = e.pointerType !== 'mouse'; pointer.inside = !overCopy(e.target); };
  on(window, 'pointermove', (e) => {
    at(e);
    if (!pup || pointer.touch) return;
    if (inspecting() && pointer.inside) showProbe(stage.pick(e.clientX, e.clientY, S)); else if (S.hi >= 0) showProbe(-1);
  }, { passive: true });
  on(window, 'pointerdown', (e) => { at(e); pointer.until = performance.now() + 2600; }, { passive: true });
  on(document.documentElement, 'mouseleave', () => { pointer.inside = false; });
  // a tap on her: a part in the take-apart views, otherwise she reacts
  on(window, 'click', (e) => {
    if (!pup || overCopy(e.target) || e.target.closest('.l2-doc p, .l2-doc h1, .l2-doc h2, .l2-doc h3, .l2-doc li, .l2-doc dl')) return;
    const hit = stage.pick(e.clientX, e.clientY, S);
    if (inspecting()) showProbe(hit);
    else if (hit >= 0) blush = 1.6;
  });

  on(window, 'scroll', () => { dirty = true; }, { passive: true });
  on(doc, 'scroll', () => { dirty = true; }, { passive: true });
  // tall layout: the wheel and the keyboard scroll the copy wherever the pointer is
  on(window, 'wheel', (e) => { if (tall.matches && !doc.contains(e.target) && !e.ctrlKey) doc.scrollTop += e.deltaY; }, { passive: true });
  on(window, 'keydown', (e) => {
    if (!tall.matches || e.defaultPrevented || e.target.closest?.('input, button, summary, a, .nx-header, .nx-menu, .nx-settings')) return;
    const page = doc.clientHeight * 0.85;
    const by = { ArrowDown: 60, ArrowUp: -60, PageDown: page, PageUp: -page, ' ': e.shiftKey ? -page : page, Home: -1e7, End: 1e7 }[e.key];
    if (by) { e.preventDefault(); doc.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' }); }
  });
  const layout = () => { stage.resize(); lastY = scrollPos(); dirty = true; };
  on(window, 'resize', layout);
  on(tall, 'change', layout);
  const ro = new ResizeObserver(() => { stage.resize(); dirty = true; });
  ro.observe(l2.querySelector('.l2-doc'));
  ro.observe(canvas);
  on(document, 'visibilitychange', () => { last = performance.now(); });
  on(canvas, 'webglcontextlost', (e) => { e.preventDefault(); l2.classList.add('is-failed'); $('load').textContent = '繪圖環境中斷，請重新整理'; cancelAnimationFrame(raf); });

  layout();
  applyDom();
  // which model first: the one named in the address (/apps/live2d/#wl2d-01), else the first
  const named = () => models.findIndex((m) => m.id === location.hash.slice(1));
  setModel(Math.max(0, named()), { quiet: true });
  on(window, 'hashchange', () => { if (named() >= 0) setModel(named(), { quiet: true }); });
  raf = requestAnimationFrame(frame);

  // ---------------- the world behind the stage ----------------
  let release = null;
  world.ready().then((ok) => {
    if (!ok || dead) return;
    let cur = T0 + (T1 - T0) * Number(l2.style.getPropertyValue('--p') || 0);
    release = world.drive({
      frame(_, dt) {
        const tw = T0 + (T1 - T0) * Number(l2.style.getPropertyValue('--p') || 0);
        cur += (tw - cur) * (reducedMotion() ? 1 : 1 - Math.exp(-dt * 5));
        const wide = clamp01((innerWidth / innerHeight - 1.05) / 0.35);
        return { t: cur, speed: 0, shift: wide * 0.2, lift: (1 - wide) * 0.22 };
      },
    });
    l2.classList.add('l2--world');
  });

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    release?.();
    ro.disconnect();
    off.forEach((fn) => fn());
    cache.forEach((p) => p.then((e) => e.pup.release()).catch(() => {}));
    stage.dispose();
    delete l2.dataset.view;
  };
}
