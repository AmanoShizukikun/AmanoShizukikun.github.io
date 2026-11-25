// One model of the 3D works gallery (/apps/models/<id>/). Markup: src/pages/models.mjs · viewer: models/viewer.js.
// Wires the page to the viewer: loading with progress, the toolbar, keys, shape keys and animations, and — on the
// preview server only — the two tools that make adding a model easy (設為封面 writes the cover through
// tools/serve.mjs; 複製視角 copies the camera for `view.camera` in data/models.js).
//   keys on the stage: A spin · R reset · 1–5 shadeless / material / clay / wireframe / normals · L light · B background · F full screen
import { store, reducedMotion } from '../core/store.js';

const MB = (b) => `${(b / 1048576).toFixed(1)} MB`;

export async function mount(main) {
  const root = main.querySelector('.m3v');
  if (!root) return null;
  const $ = (k) => root.querySelector(`[data-m3v="${k}"]`);
  const data = JSON.parse($('data').textContent);
  const stage = $('stage'), canvas = $('canvas'), load = $('load'), tools = $('tools');
  const off = [];
  const on = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); off.push(() => el.removeEventListener(type, fn, opt)); };
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  // still the page on screen? (the router takes the id off a page it is leaving, while it may still be loading)
  const current = () => root.isConnected && main.id === 'view';

  const fail = (msg) => { load.classList.add('is-error'); $('msg').textContent = msg; $('bar').style.width = '0'; };
  const gl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  if (!gl) { fail('這個瀏覽器無法顯示 3D（需要 WebGL 2）。上面是這件作品的封面。'); return () => off.forEach((f) => f()); }

  const hi = () => { const q = store.get('nxQuality'); return q === 'high' || (q === 'auto' && !matchMedia('(pointer: coarse)').matches); };
  const btn = (sel) => [...tools.querySelectorAll(sel)];
  const spinBtn = tools.querySelector('[data-act="spin"]');
  let viewer = null;
  try {
    const { createViewer } = await import('../models/viewer.js');
    if (!current()) return null;
    // with reduced motion asked for, nothing turns by itself
    const view = reducedMotion() ? { ...data.view, spin: false } : data.view;
    viewer = createViewer(canvas, { kind: data.kind, view, hi: hi(), onSpin: (v) => spinBtn.setAttribute('aria-pressed', String(v)) });
  } catch (e) {
    console.error('[model] the viewer failed to start', e);
    fail('檢視器無法啟動。請重新整理頁面再試一次。');
    return () => off.forEach((f) => f());
  }

  // ---------- background: the site's theme, or the other one ----------
  let bg = null;
  const applyBg = () => {
    const dark = (bg || (store.get('theme') === 'light' ? 'light' : 'dark')) === 'dark';
    stage.dataset.bg = dark ? 'dark' : 'light';
    viewer.setWireColor(dark ? 0xffc400 : 0x6b4a00);
  };
  applyBg();
  off.push(store.on('theme', () => { if (!bg) applyBg(); }));

  // ---------- load ----------
  let info;
  try {
    info = await viewer.load(data.file, (got, total) => {
      const all = total || data.bytes;
      $('bar').style.width = all ? `${Math.min(100, (got / all) * 100).toFixed(1)}%` : '30%';
      $('bytes').textContent = all ? `${MB(got)} / ${MB(all)}` : MB(got);
    });
  } catch (e) {
    console.error('[model] could not load', data.file, e);
    fail('模型載入失敗。請檢查網路後重新整理。');
    return () => { off.forEach((f) => f()); viewer.dispose(); };
  }
  if (!info || !current()) { viewer.dispose(); return null; }
  stage.classList.add('is-ready');
  tools.hidden = false;
  $('hint').hidden = false;

  // ---------- toolbar ----------
  const radio = (group, value) => btn(`[data-group="${group}"] [role="radio"]`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset[group] === value)));
  const setMode = (m) => { viewer.setMode(m); radio('mode', m); };
  const setLight = (l) => radio('light', viewer.setLight(l));
  radio('mode', viewer.mode); radio('light', viewer.light);
  spinBtn.setAttribute('aria-pressed', String(viewer.spin));
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.())?.catch?.(() => {});
  const nextBg = () => { bg = stage.dataset.bg === 'dark' ? 'light' : 'dark'; applyBg(); };
  on(tools, 'click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) setMode(b.dataset.mode);
    else if (b.dataset.light) setLight(b.dataset.light);
    else if (b.dataset.act === 'spin') viewer.setSpin(!viewer.spin);
    else if (b.dataset.act === 'reset') viewer.reset();
    else if (b.dataset.act === 'bg') nextBg();
    else if (b.dataset.act === 'full') full();
  });
  // arrow keys move inside each radio group, as radio groups do
  on(tools, 'keydown', (e) => {
    const b = e.target.closest('[role="radio"]');
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!b || !step) return;
    e.preventDefault();
    const all = [...b.parentElement.querySelectorAll('[role="radio"]')], n = all[(all.indexOf(b) + step + all.length) % all.length];
    n.click(); n.focus();
  });
  const MODES = ['flat', 'material', 'clay', 'wire', 'normal'], LIGHTS = ['studio', 'dusk', 'night'];
  on(canvas, 'keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'a') viewer.setSpin(!viewer.spin);
    else if (k === 'r') viewer.reset();
    else if (k === 'f') full();
    else if (k === 'b') nextBg();
    else if (k === 'l') setLight(LIGHTS[(LIGHTS.indexOf(viewer.light) + 1) % LIGHTS.length]);
    else if (/^[1-5]$/.test(k)) setMode(MODES[+k - 1]);
    else return;
    e.preventDefault();
  });
  on(document, 'fullscreenchange', () => stage.classList.toggle('is-full', document.fullscreenElement === stage));

  // ---------- shape keys and animations ----------
  if (info.morphs.length) {
    $('morphs').hidden = false;
    $('sliders').innerHTML = info.morphs.map((n, i) => `<label><span>${n.replace(/[<&]/g, '')}</span><input type="range" min="0" max="1" step="0.01" value="0" data-morph="${i}"><output>0.00</output></label>`).join('');
    on($('sliders'), 'input', (e) => {
      const r = e.target.closest('[data-morph]');
      if (!r) return;
      viewer.setMorph(info.morphs[+r.dataset.morph], +r.value);
      r.nextElementSibling.textContent = (+r.value).toFixed(2);
    });
  }
  if (info.clips.length) {
    $('anims').hidden = false;
    $('clips').innerHTML = info.clips.map((c, i) => `<button type="button" data-clip="${i}" aria-pressed="false">${c.name.replace(/[<&]/g, '') || `動畫 ${i + 1}`}<i>${c.duration.toFixed(1)} s</i></button>`).join('');
    on($('clips'), 'click', (e) => {
      const b = e.target.closest('[data-clip]');
      if (!b) return;
      const now = viewer.play(+b.dataset.clip);
      $('clips').querySelectorAll('[data-clip]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.clip === now)));
    });
  }

  // ---------- preview server only: the cover and the camera ----------
  if (local) {
    const dev = $('dev'), say = (t) => { $('devmsg').textContent = t; };
    dev.hidden = false;
    // the stage's own background, painted into the picture (the same gradient css/models.css draws)
    const paint = (ctx, w, h) => {
      const cs = getComputedStyle(stage), a = cs.getPropertyValue('--m3v-a').trim(), b = cs.getPropertyValue('--m3v-b').trim();
      const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.hypot(w, h) * 0.62);
      g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    };
    on(dev, 'click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'camera') {
        const text = JSON.stringify(viewer.cameraJSON()).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ');
        try { await navigator.clipboard.writeText(`camera: ${text}`); say('已複製，貼到 data/models.js 這一件的 view 裡'); } catch { say(`camera: ${text}`); }
      } else if (b.dataset.act === 'poster') {
        say('擷取中…');
        const blob = await viewer.capture(paint);
        try {
          const r = await fetch(`/__models/${data.id}/poster`, { method: 'POST', headers: { 'content-type': 'image/webp' }, body: blob }).then((x) => x.json());
          say(r.ok ? `已寫入 ${r.file}（${Math.round(r.bytes / 1024)} KB），重新建置後生效` : `沒有寫入：${r.error}`);
        } catch { say('沒有寫入：請用 node tools/serve.mjs 開啟預覽'); }
      }
    });
    window.m3v = viewer;
  }

  return () => {
    off.forEach((f) => f());
    if (document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
    viewer.dispose();
    if (window.m3v === viewer) delete window.m3v;
  };
}
