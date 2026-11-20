// The mascot: a Live2D model that stands in a corner of every page and stays there while pages change.
// It is part of the shell (the router never touches it) and is switched by the 看板娘 setting.
//
// It runs on the same pieces as the Live2D works page — the runtime in ../live2d/puppet.js and the renderer in
// ../live2d/stage.js, on top of the official Cubism Core — and shows the same three models (../data/live2d.js).
// Nothing is downloaded until it is switched on.
//
//   states   off → loading → on            (failed: a notice with "retry", never a silent switch-off)
//   on/off   every change takes a new ticket; a load that finishes after its ticket was replaced is dropped,
//            so switching quickly — or leaving while it loads — cannot leave a half-started mascot behind
//   away     on pages where she would be in the way (the Live2D page has her on stage, the music player has its
//            deck there, the WebOS has her as its assistant) she steps out and the render loop stops
//   speech   lines from ../data/mascot.js: on arrival, per page, when touched, when the pointer rests on
//            something she knows about, after a quiet while
//   tools    talk · next model · outfit · photo · adjust · step aside · switch off. The column stands inside her
//            box and is opened and closed by this script (pointer in / out with a grace period, a tap on touch
//            screens, the keyboard), not by a CSS hover — a hover rule dropped it whenever the pointer crossed
//            the few pixels between her and the buttons
//   place    drag her anywhere; the position is stored as fractions of the free space, so a smaller window
//            can never leave her off screen. Double-click puts her back in the corner.
//   adjust   a window appears round her — a title bar on top, her box under it: drag the bar to move, pull a corner
//            of the window to resize (the figure keeps its proportions); the two icons in the bar put size and
//            place back / close the window (so does Esc)
import { store, quality, reducedMotion } from '../core/store.js';
import { router } from '../core/router.js';

const AWAY = new Set(['live2d', 'music', 'webos']);
const SIZES = { s: 240, m: 320, l: 420 };              // (heights an earlier version stored by name)
const MIN_H = 140, MAX_H = 900, BAR = 30;              // limits of the figure's height in CSS px · height of the adjust window's title bar
const TOOLS = 7;
const MARGIN = 10;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pickOne = (list, not) => { const a = Array.isArray(list) ? list : [list]; if (a.length < 2) return a[0]; let v; do { v = a[Math.floor(Math.random() * a.length)]; } while (v === not); return v; };

const ICON = {
  talk: '<path d="M4.500 5.500h15v10.500H10l-4 3.500v-3.500H4.500z"/>',
  model: '<path d="M4 8.500h13.500M14 5l3.500 3.500L14 12M20 15.500H6.500M10 12l-3.500 3.500L10 19"/>',
  outfit: '<path d="M8.500 4 3.500 7.500l2 3.500 2.500-1.500V20h8V9.500l2.500 1.500 2-3.500L15.500 4c-.5 1.500-1.800 2.300-3.500 2.300S9 5.500 8.500 4z"/>',
  photo: '<path d="M4 8h3.500L9 6h6l1.500 2H20v10.500H4z"/><circle cx="12" cy="13" r="3.200"/>',
  edit: '<path d="M5 19 19 5M5 12.500V19h6.500M12.500 5H19v6.500"/>',
  min: '<path d="M6 8.500l6 6 6-6M5 19h14"/>',
  off: '<path d="M6 6l12 12M18 6 6 18"/>',
  up: '<path d="M6 14.500l6-6 6 6"/>',
  reset: '<path d="M5.500 12a6.500 6.500 0 1 0 2-4.700M5 4.500v4h4"/>',
  done: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const tool = (act, label, icon = act) => `<button type="button" data-mc="${act}" aria-label="${label}" title="${label}">${svg(icon)}</button>`;

// ---------------------------------------------------------------- state
let root = null, ui = null, canvas = null, stage = null;
let lib = null;                                   // the modules, once imported
let state = 'off', token = 0, started = false;
let page = '', pageName = '', away = false;
let min = false, sizePx = 320, pos = { x: 1, y: 0 }, edit = false;
let index = 0, pup = null, def = null, role = {}, wardrobe = null;   // wardrobe: [label, value] of the outfits she can change into
const cache = new Map();                          // model index → Promise<{ def, pup, img }>
const S = { cam: { cx: 0, cy: 0, sx: 0, sy: 0, s: 1 }, sheet: 0, sheetSide: 1, wire: 0, fill: 1, fan: 0, angle: 0, spread: 0, lift: 0, skew: 0, hi: -1, frame: 0, grid: 0 };
const box = { w: 160, h: 320, left: 0, top: 0 };
const ptr = { x: 0, y: 0, on: false, touch: false, until: 0 };
const tween = new Map();                          // parameter index → value the pose is moving to
let raf = 0, last = 0, skip = false, low = false;
let kick = 0, kickT = 0, nod = 0, talk = 0, talkT = 0, mood = null, moodK = 0, moodUntil = 0;
let sayTimer = 0, sayPrio = 0, sayUntil = 0, lastLine = '';
let idleAt = 0, hintEl = null, hintAt = 0, hintTimer = 0, hoverAt = 0, hoverSince = 0;
let wantPhoto = false, closeTimer = 0, offTimer = 0, inside = false;

const now = () => performance.now();

// ---------------------------------------------------------------- DOM
let cssReady = null;
function loadCss() {
  cssReady ||= new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/mascot.css';
    link.onload = link.onerror = () => resolve();
    document.head.append(link);
  });
  return cssReady;
}

function build() {
  root = document.createElement('div');
  root.className = 'nx-mascot';
  root.dataset.state = 'off';
  root.setAttribute('role', 'complementary');
  root.setAttribute('aria-label', '看板娘');
  root.innerHTML = `
<div class="mc-say" aria-live="polite"><b class="mc-say__who"></b><p class="mc-say__text"></p></div>
<div class="mc-frame">
  <div class="mc-bar" data-grab><b>移動 · 縮放</b><span><button type="button" data-mc="reset" aria-label="還原大小與位置" title="還原大小與位置">${svg('reset')}</button><button type="button" data-mc="done" aria-label="完成" title="完成">${svg('done')}</button></span></div>
  <i data-grip="nw"></i><i data-grip="ne"></i><i data-grip="sw"></i><i data-grip="se"></i>
</div>
<div class="mc-body">
  <div class="mc-stage"></div>
  <button type="button" class="mc-hit" data-mc="hit" aria-label="看板娘：點一下和她說話，拖曳可以移動"></button>
</div>
<div class="mc-tools" role="toolbar" aria-label="看板娘工具">
  ${tool('talk', '說句話')}${tool('model', '換一位')}${tool('outfit', '換裝')}${tool('photo', '拍照（下載圖片）')}${tool('edit', '調整位置與大小')}${tool('min', '先收起來')}${tool('off', '關閉看板娘')}
</div>
<p class="mc-note"><span class="mc-note__text"></span><button type="button" data-mc="retry">重試</button><button type="button" data-mc="off">關閉</button></p>
<button type="button" class="mc-tab" data-mc="back" aria-label="叫看板娘出來">${svg('up')}<span></span></button>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  ui = { say: $('.mc-say'), who: $('.mc-say__who'), text: $('.mc-say__text'), body: $('.mc-body'), stage: $('.mc-stage'), hit: $('.mc-hit'), tools: $('.mc-tools'), note: $('.mc-note__text'), tab: $('.mc-tab span'), frame: $('.mc-frame'), bar: $('.mc-bar'), outfit: $('[data-mc="outfit"]') };
  bind();
}

function setState(next, note = '') {
  state = next;
  root.dataset.state = next;
  ui.note.textContent = note;
  if (next !== 'on') { hush(); setEdit(false); closeTools(); }
  run();
}

let noteTimer = 0;
function notice(text, ms = 3200) {
  ui.note.textContent = text;
  root.classList.add('has-note');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => root.classList.remove('has-note'), ms);
}

// ---------------------------------------------------------------- the stage
function makeStage() {
  dropStage();
  canvas = document.createElement('canvas');
  canvas.className = 'mc-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  ui.stage.append(canvas);
  low = quality() === 'low';
  stage = lib.createStage(canvas, { maxDpr: low ? 1.5 : 2 });
  if (!stage) { canvas.remove(); canvas = null; throw new Error('WebGL is not available'); }
  // a lost context (the GPU was reset, or the browser reclaimed it) is rebuilt from scratch when it comes back
  // (a canvas that has been replaced still reports the loss of its own context when it is disposed: ignore those)
  const mine = canvas;
  mine.addEventListener('webglcontextlost', (e) => { if (mine !== canvas) return; e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
  mine.addEventListener('webglcontextrestored', () => { if (mine !== canvas || state !== 'on') return; try { makeStage(); show(cacheNow); layout(); run(); } catch (err) { fail(err); } });
}
function dropStage() {
  cancelAnimationFrame(raf); raf = 0;
  try { stage?.dispose(); } catch { /* the context is already gone */ }
  stage = null;
  canvas?.remove(); canvas = null;
}

// ---------------------------------------------------------------- models
function entry(i) {
  if (!cache.has(i)) {
    cache.set(i, (async () => {
      const d = lib.models[i];
      const img = new Image();
      img.decoding = 'async';
      img.src = d.tex[1];                               // the smaller texture: she is never drawn large here
      const [p] = await Promise.all([lib.loadPuppet(d), img.decode()]);
      return { def: d, pup: p, img };
    })().catch((e) => { cache.delete(i); throw e; }));
  }
  return cache.get(i);
}

let cacheNow = null;
function show(e) {
  cacheNow = e;
  pup = e.pup; def = e.def;
  role = { ...lib.roles, ...(def.roles || {}) };
  wardrobe = def.outfit ? def.outfits || null : null;
  tween.clear();
  pup.resetPose();
  pup.physics?.reset();
  if (def.outfit) {
    const saved = Number(store.get(`nxMascotOutfit_${def.id}`));
    const o = wardrobe[Number.isInteger(saved) && wardrobe[saved] ? saved : 0];
    pup.setPose(def.outfit, o[1]);
  }
  stage.setPuppet(pup, e.img, def.crop);
  S.sheetSide = pup.canvas.h;
  ui.who.textContent = def.name;
  ui.tab.textContent = def.name;
  ui.outfit.hidden = !wardrobe;
  mood = null; moodK = 0; kick = 0; nod = 0; talk = 0;
}

async function setModel(i, greet = true) {
  const my = ++token;
  root.classList.add('is-swap');
  let e;
  try { [e] = await Promise.all([entry(i), new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 180))]); } catch (err) {
    // the one on duty stays; only the change is called off
    console.warn('[mascot]', err);
    if (my === token) { root.classList.remove('is-swap'); notice(`${lib.models[i].name} 載入失敗`); }
    return;
  }
  if (my !== token || state !== 'on') return;
  index = i;
  store.set('nxMascotModel', lib.models[i].id);
  show(e);
  layout();
  root.classList.remove('is-swap');
  if (greet) say(voice('intro') || pickOne(voice('hello')), { prio: 3, mood: 'smile' });
}

// ---------------------------------------------------------------- on / off
function fail(err) {
  console.warn('[mascot]', err);
  dropStage();
  setState('failed', /WebGL/.test(String(err && err.message)) ? '這個瀏覽器無法顯示 Live2D（需要 WebGL）' : '看板娘載入失敗');
}

async function enable() {
  if (state === 'on' || state === 'loading') return;
  const my = ++token;
  clearTimeout(offTimer);
  await loadCss();
  if (my !== token) return;
  if (!root) build();
  min = store.bool('nxMascotMin');
  sizePx = readSize();
  const p = String(store.get('nxMascotPos') || '').split(',').map(Number);
  pos = p.length === 2 && p.every(Number.isFinite) ? { x: clamp(p[0], 0, 1), y: clamp(p[1], 0, 1) } : { x: 1, y: 0 };
  root.classList.toggle('is-min', min);
  layout();
  setState('loading', 'LOADING');
  try {
    if (!lib) {
      const [puppet, stageMod, data, text] = await Promise.all([import('../live2d/puppet.js'), import('../live2d/stage.js'), import('../data/live2d.js'), import('../data/mascot.js')]);
      lib = { loadPuppet: puppet.loadPuppet, createStage: stageMod.createStage, models: data.models, roles: data.roles, faces: data.faces, ...text };
    }
    const saved = lib.models.findIndex((m) => m.id === store.get('nxMascotModel'));
    index = saved >= 0 ? saved : 0;
    const e = await entry(index);
    if (my !== token) return;
    makeStage();
    show(e);
    layout();
    setState('on');
    const met = sessionStorage.getItem('nxMascotMet');
    try { sessionStorage.setItem('nxMascotMet', '1'); } catch { /* private mode */ }
    idleAt = now() + 45000;
    if (!min && !away) setTimeout(() => { if (my === token) say(met ? pickOne(voice('hello')) : voice('intro') || pickOne(voice('hello')), { prio: 2, mood: 'smile' }); }, 500);
  } catch (err) {
    if (my === token) fail(err);
  }
}

function disable() {
  ++token;
  if (!root) return;
  setState('off');
  // the picture is kept until she has left the frame, then the GPU memory is returned
  clearTimeout(offTimer);
  offTimer = setTimeout(() => { if (state === 'off') dropStage(); }, 600);
}

// ---------------------------------------------------------------- layout
const HEAD = 56;
const defaultSize = () => (Math.min(innerWidth, innerHeight) < 560 ? 240 : 320);
function readSize() {
  const v = store.get('nxMascotSize');
  const n = SIZES[v] || Number(v);
  return Number.isFinite(n) && n > 0 ? clamp(n, MIN_H, MAX_H) : defaultSize();
}
// the box for a wanted height: the window caps it, the figure's own proportions give the width
function boxFor(want) {
  const vw = innerWidth, vh = innerHeight;
  const h = Math.round(clamp(want, Math.min(MIN_H, vh - HEAD - BAR - 4), Math.max(MIN_H, vh - HEAD - BAR - 4)));
  const b = pup ? pup.bounds : null, bw = b ? b.x1 - b.x0 : 1, bh = b ? b.y1 - b.y0 : 2;
  const w = Math.round(Math.min(h * clamp((bw / bh) * 1.34, 0.44, 0.9), vw - MARGIN * 2));
  return { w, h, bw, bh, b };
}
function layout() {
  if (!root) return;
  const vw = innerWidth, vh = innerHeight, head = HEAD;
  const phone = Math.min(vw, vh) < 560;
  const { w, h, bw, bh, b } = boxFor(sizePx);
  const freeX = Math.max(0, vw - w - MARGIN * 2), freeY = Math.max(0, vh - head - h - 4);
  box.w = w; box.h = h; box.left = MARGIN + freeX * pos.x; box.top = vh - h - freeY * pos.y;
  root.style.setProperty('--w', `${w}px`);
  root.style.setProperty('--h', `${h}px`);
  root.style.setProperty('--x', `${Math.round(box.left)}px`);
  root.style.setProperty('--y', `${Math.round(freeY * pos.y)}px`);
  root.classList.toggle('is-left', box.left + w / 2 < vw / 2);
  root.classList.toggle('is-high', box.top < head + 150);        // no room above her: the bubble goes beside
  root.classList.toggle('is-tight', box.top < head + BAR + 2);   // … nor for the adjust window's title bar: it moves inside
  root.style.setProperty('--rows', clamp(Math.floor((h * 0.9 - 4) / (phone ? 40 : 36)), 3, TOOLS));   // the tool column never stands taller than she does
  if (stage && pup) {
    stage.resize();
    const s = Math.min((h * 0.965) / bh, (w * 0.98) / bw);
    S.cam.s = s; S.cam.cx = (b.x0 + b.x1) / 2; S.cam.cy = (b.y0 + b.y1) / 2;
    S.cam.sx = w / 2; S.cam.sy = h - 2 - (bh * s) / 2;           // feet on the floor of the box
    // Changing a canvas's size empties it. Draw again at once: otherwise an empty canvas can reach the screen
    // before the next frame does, and she flickers for as long as a corner is being pulled.
    if (state === 'on' && !stage.lost) stage.draw(S);
  }
}

// ---------------------------------------------------------------- speech
const voice = (kind) => (lib.voices[def.id] && lib.voices[def.id][kind]) || lib.common[kind];

function hush() {
  clearTimeout(sayTimer);
  root?.classList.remove('is-saying');
  sayPrio = 0; sayUntil = 0;
}

/** prio: 0 remarks (idle, hints) · 1 page arrival · 2 reactions · 3 answers to a tool */
function say(text, { prio = 1, ms = 0, mood: m = null } = {}) {
  if (!text || state !== 'on' || min || away || edit || document.hidden) return false;
  const t = now();
  if (t < sayUntil && prio < sayPrio) return false;
  lastLine = text;
  ui.text.textContent = text;
  const hold = ms || clamp(2200 + text.length * 110, 2600, 7000);
  root.classList.remove('is-saying'); void ui.say.offsetWidth; root.classList.add('is-saying');
  sayPrio = prio; sayUntil = t + hold;
  clearTimeout(sayTimer);
  sayTimer = setTimeout(hush, hold);
  idleAt = t + 90000;
  if (!reducedMotion()) { talk = clamp(0.3 + text.length * 0.075, 0.6, 2.2); talkT = 0; nod = 1; }
  if (m) { mood = lib.faces.find((f) => f.id === m) || null; moodUntil = t + Math.min(hold, 3200); }
  return true;
}

// ---------------------------------------------------------------- one frame
function frame(t) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - last) / 1000);
  if (low && (skip = !skip)) return;                            // half rate on weak devices; the next frame covers both
  last = t;
  if (!pup || !stage || stage.lost) return;
  const still = reducedMotion();

  // where the pointer is, measured from her face
  const f = pup.face, c = S.cam;
  const fx = box.left + c.sx + (f.x - c.cx) * c.s, fy = box.top + c.sy - (f.y - c.cy) * c.s;
  const follow = ptr.on && (!ptr.touch || t < ptr.until) ? 1 : 0;
  pup.look.x = clamp((ptr.x - fx) / (innerWidth * 0.42), -1, 1) * follow;
  pup.look.y = clamp((fy - ptr.y) / (innerHeight * 0.42), -1, 1) * follow;
  pup.idle = !still;

  if (tween.size) {
    const k = still ? 1 : 1 - Math.exp(-dt * 10);
    for (const [i, v] of tween) { pup.pose[i] += (v - pup.pose[i]) * k; if (Math.abs(v - pup.pose[i]) < 0.004) { pup.pose[i] = v; tween.delete(i); } }
  }
  kickT += dt; talkT += dt;
  kick *= Math.exp(-dt * 2.8); nod *= Math.exp(-dt * 5); talk = Math.max(0, talk - dt);
  const wantMood = mood && t < moodUntil ? 1 : 0;
  moodK += (wantMood - moodK) * (still ? 1 : 1 - Math.exp(-dt * (wantMood ? 9 : 4)));
  if (moodK < 0.004 && !wantMood) { moodK = 0; mood = null; }

  pup.hook = hook;
  pup.update(dt);
  stage.draw(S);

  if (wantPhoto) { wantPhoto = false; snap(); }
  if (t > idleAt && !document.hidden) { idleAt = t + 90000; say(pickOne(voice('idle'), lastLine), { prio: 0 }); }
}

// added on top of the pose every frame
function hook(p) {
  const v = p.P.values, idx = (r) => p.index(role[r]);
  if (mood && moodK > 0.004) {
    for (const [r, val] of mood.set) { const i = idx(r); if (i >= 0) v[i] += ((val === 'max' ? p.P.max[i] : val === 'min' ? p.P.min[i] : val) - v[i]) * moodK; }
  }
  if (nod > 0.01) p.add('ParamAngleY', -9 * nod);
  if (talk > 0) {
    const i = idx('open');
    if (i >= 0) v[i] = Math.max(v[i], Math.min(1, talk * 2.5) * (0.12 + 0.6 * Math.abs(Math.sin(talkT * 10.7) * Math.sin(talkT * 3.9 + 1))));
  }
  if (kick > 0.004) { const w = Math.sin(kickT * 8.5) * kick; p.add('ParamBodyAngleX', w * 8); p.add('ParamBodyAngleZ', w * 6); p.add('ParamAngleZ', w * -12); p.add('ParamAngleX', w * 10); }
}

function run() {
  const want = state === 'on' && !min && !away && !document.hidden && !!stage;
  if (want && !raf) { last = now(); raf = requestAnimationFrame(frame); }
  if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
  root?.classList.toggle('is-away', away);
}

// ---------------------------------------------------------------- tools
function snap() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${def.id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

const actions = {
  talk() { say(pickOne(voice('idle'), lastLine), { prio: 3 }); },
  model() { setModel((index + 1) % lib.models.length); },
  outfit() {
    if (!wardrobe) { say(lib.common.noOutfit, { prio: 3 }); return; }
    const i = pup.index(def.outfit);
    const at = wardrobe.findIndex((o) => o[1] === (tween.has(i) ? tween.get(i) : pup.pose[i]));
    const next = (at + 1) % wardrobe.length;
    tween.set(i, wardrobe[next][1]);
    store.set(`nxMascotOutfit_${def.id}`, next);
    say(lib.common.outfit, { prio: 3, mood: 'smile' });
  },
  photo() { wantPhoto = true; say(lib.common.photo, { prio: 3, mood: 'wink' }); },
  edit() { setEdit(!edit); },
  done() { setEdit(false); },
  reset() { sizePx = defaultSize(); pos = { x: 1, y: 0 }; store.set('nxMascotSize', ''); store.set('nxMascotPos', ''); layout(); },
  min() { min = true; store.set('nxMascotMin', true); setEdit(false); closeTools(); root.classList.add('is-min'); hush(); run(); },
  back() { min = false; store.set('nxMascotMin', false); root.classList.remove('is-min'); run(); setTimeout(() => say(pickOne(voice('hello'), lastLine), { prio: 2, mood: 'smile' }), 350); },
  off() {
    if (state === 'on' && !min && say(lib.common.bye, { prio: 4, ms: 1500 })) setTimeout(() => store.set('live2dEnabled', 'false'), 1500);
    else store.set('live2dEnabled', 'false');
  },
  retry() { enable(); },
};

// The tool column. Open while the pointer is on her or on the tools, for a while after it has left, for a few
// seconds after a tap, and while the keyboard focus is inside.
function openTools(ms = 0) {
  if (state !== 'on' || min || edit) return;
  clearTimeout(closeTimer);
  root.classList.add('is-open');
  if (ms) closeTimer = setTimeout(closeTools, ms);
}
function closeSoon(ms = 700) {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => { if (!inside && !root.querySelector(':focus-visible')) closeTools(); }, ms);
}
function closeTools() {
  clearTimeout(closeTimer);
  root?.classList.remove('is-open');
}

// The adjust window.
function setEdit(on) {
  if (!root || edit === on) return;
  if (on && (state !== 'on' || min)) return;
  edit = on;
  root.classList.toggle('is-edit', on);
  if (on) { hush(); closeTools(); }
  layout();
}

function touched(e) {
  const r = canvas.getBoundingClientRect();
  const onBody = stage.pick(e.clientX - r.left, e.clientY - r.top, S) >= 0;
  if (e.pointerType !== 'mouse') openTools(6000);
  if (!onBody || edit) return;
  if (!reducedMotion()) { kick = 1; kickT = 0; }
  say(pickOne(voice('tap'), lastLine), { prio: 2, mood: 'shy' });
}

// ---------------------------------------------------------------- input
function bind() {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mc]');
    if (!b || b.dataset.mc === 'hit') return;
    if (state === 'on' || b.dataset.mc === 'retry' || b.dataset.mc === 'off') actions[b.dataset.mc]?.();
    if (e.detail === 0 || root.querySelector(':focus-visible')) return;          // keyboard: the column stays while the focus is in it
    if (!inside) closeSoon(6000);                                               // touch: a few more seconds for the next tap
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (edit) setEdit(false); closeTools(); document.activeElement?.blur?.(); } });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && edit) setEdit(false); });
  // the pointer on her or on the tools
  for (const el of [ui.hit, ui.tools]) {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { inside = true; openTools(); } });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { inside = false; closeSoon(); } });
  }
  root.addEventListener('focusin', () => { if (root.querySelector(':focus-visible')) openTools(); });
  root.addEventListener('focusout', () => closeSoon(300));
  document.addEventListener('pointerdown', (e) => { if (!root.contains(e.target)) closeTools(); }, { passive: true });

  // the adjust window: the title bar moves her, a corner resizes her
  let grip = null;
  const place = (left, top, w, h) => {
    const freeX = Math.max(1, innerWidth - w - MARGIN * 2), freeY = Math.max(1, innerHeight - HEAD - h - 4);
    pos.x = clamp((left - MARGIN) / freeX, 0, 1);
    pos.y = clamp((innerHeight - top - h) / freeY, 0, 1);
  };
  const keep = () => { store.set('nxMascotSize', Math.round(sizePx)); store.set('nxMascotPos', `${pos.x.toFixed(4)},${pos.y.toFixed(4)}`); };
  ui.frame.addEventListener('pointerdown', (e) => {
    if (e.button || !edit || e.target.closest('button')) return;
    const corner = e.target.dataset.grip, bar = e.target.closest('[data-grab]');
    if (!corner && !bar) return;
    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch { /* the gesture is followed on the window anyway */ }
    grip = { id: e.pointerId, corner, x: e.clientX, y: e.clientY, left: box.left, top: box.top, w: box.w, h: box.h };
    root.classList.add('is-drag');
    // followed on the window, not on the handle: the gesture ends properly wherever the pointer is let go
    addEventListener('pointermove', gripMove);
    addEventListener('pointerup', letGo);
    addEventListener('pointercancel', letGo);
  });
  const gripMove = (e) => {
    if (!grip || e.pointerId !== grip.id) return;
    const dx = e.clientX - grip.x, dy = e.clientY - grip.y;
    if (!grip.corner) { place(grip.left + dx, grip.top + dy, grip.w, grip.h); layout(); return; }
    // pull a corner: the opposite corner stays where it is, the figure keeps its proportions
    const east = grip.corner[1] === 'e', south = grip.corner[0] === 's';
    const want = Math.max(grip.h + (south ? dy : -dy), (grip.w + (east ? dx : -dx)) * (grip.h / grip.w));
    const n = boxFor(clamp(want, MIN_H, MAX_H));
    sizePx = n.h;
    place(east ? grip.left : grip.left + grip.w - n.w, south ? grip.top : grip.top + grip.h - n.h, n.w, n.h);
    layout();
  };
  const letGo = (e) => {
    if (!grip || (e && e.pointerId !== grip.id)) return;
    grip = null;
    removeEventListener('pointermove', gripMove); removeEventListener('pointerup', letGo); removeEventListener('pointercancel', letGo);
    root.classList.remove('is-drag');
    keep();
  };

  // drag to move her; a press that does not travel is a touch
  let drag = null;
  ui.hit.addEventListener('pointerdown', (e) => {
    if (e.button || state !== 'on') return;
    try { ui.hit.setPointerCapture(e.pointerId); } catch { /* followed on the window anyway */ }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: box.left, top: box.top, moved: false };
    addEventListener('pointermove', dragMove);
    addEventListener('pointerup', drop);
    addEventListener('pointercancel', drop);
  });
  const dragMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    root.classList.add('is-drag');
    place(drag.left + dx, drag.top + dy, box.w, box.h);
    layout();
  };
  const drop = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    removeEventListener('pointermove', dragMove); removeEventListener('pointerup', drop); removeEventListener('pointercancel', drop);
    root.classList.remove('is-drag');
    if (moved) store.set('nxMascotPos', `${pos.x.toFixed(4)},${pos.y.toFixed(4)}`);
    else if (e.type === 'pointerup' && state === 'on') touched(e);
  };
  ui.hit.addEventListener('dblclick', () => { pos = { x: 1, y: 0 }; store.set('nxMascotPos', ''); layout(); });
  ui.hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (state === 'on' && !edit) { openTools(); actions.talk(); } } });

  // the pointer: where she looks, what she remarks on
  addEventListener('pointermove', (e) => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.touch = e.pointerType !== 'mouse'; ptr.until = now() + 2600;
    if (state !== 'on') return;
    const t = now();
    if (t + 20000 > idleAt) idleAt = Math.max(idleAt, t + 45000);
    // resting on her for a moment
    if (e.target === ui.hit && e.pointerType === 'mouse' && !drag) {
      if (!hoverSince) hoverSince = t;
      else if (t - hoverSince > 1400 && t - hoverAt > 25000) { hoverAt = t; say(pickOne(voice('hover'), lastLine), { prio: 0 }); }
    } else hoverSince = 0;
  }, { passive: true });
  addEventListener('pointerdown', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.touch = e.pointerType !== 'mouse'; ptr.until = now() + 2600; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { ptr.on = false; });
  addEventListener('blur', () => { ptr.on = false; });

  document.addEventListener('pointerover', (e) => {
    if (state !== 'on' || min || away || e.pointerType !== 'mouse' || !e.target.closest || root.contains(e.target)) return;
    const hit = lib.hints.find(([sel]) => e.target.closest(sel));
    const el = hit ? e.target.closest(hit[0]) : null;
    if (el === hintEl) return;
    hintEl = el;
    clearTimeout(hintTimer);
    if (!el || now() - hintAt < 6000) return;
    hintTimer = setTimeout(() => { if (hintEl === el && say(pickOne(hit[1], lastLine), { prio: 0 })) hintAt = now(); }, 450);
  }, { passive: true });

  addEventListener('copy', () => { if (state === 'on') say(lib.common.copy, { prio: 2 }); });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = now();
    run();
    if (!document.hidden && state === 'on' && now() - hiddenAt > 20000) setTimeout(() => say(lib.common.back, { prio: 2, mood: 'smile' }), 400);
  });
  addEventListener('resize', layout);
  addEventListener('keydown', () => { if (state === 'on') idleAt = Math.max(idleAt, now() + 45000); }, { passive: true });
  store.on('nxQuality', () => { if (state === 'on') { try { makeStage(); show(cacheNow); layout(); run(); } catch (err) { fail(err); } } });
}

// ---------------------------------------------------------------- wiring
export function initMascot() {
  if (started) return;
  started = true;
  const apply = (v) => { if (v === 'true') enable(); else disable(); };
  store.on('live2dEnabled', apply);

  // (this runs after the first page is up, so every call from here on is an arrival)
  router.after((name, main) => {
    page = name; pageName = main.dataset.name || '';
    away = AWAY.has(name);
    if (!root) return;
    if (away) { hush(); setEdit(false); closeTools(); }
    run();
    if (state !== 'on' || away || min) return;
    const set = lib.pages[name];
    const line = set && pickOne(set[def.id] || set['*']);
    if (line) setTimeout(() => say(line.replace('{name}', pageName), { prio: 1 }), 700);
  });
  const main = document.getElementById('view');
  page = main?.dataset.page || ''; pageName = main?.dataset.name || '';
  away = AWAY.has(page);

  if (store.bool('live2dEnabled')) {
    // let the first page paint before pulling in the runtime and a model
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 1200)))(() => { if (store.bool('live2dEnabled') && state === 'off') enable(); }, { timeout: 2500 });
  }
}
