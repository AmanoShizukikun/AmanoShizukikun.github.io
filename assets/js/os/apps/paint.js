// Paint: a 1280 × 720 canvas with pen, eraser, line, rectangle, ellipse and fill; pictures are saved as PNG
// into the WebOS file system (and can be exported to the computer from the file manager).
import { h, tool, btn } from '../ui.js';
import { ACCENTS } from '../kernel.js';

const W = 1280, H = 720, PAPER = '#101214';
const COLORS = ['#ecebe5', '#a9a79f', '#101214', ...ACCENTS.slice(0, 5).map((a) => a[0]), '#7fb4d6', '#e5484d'];
const TOOLS = [['pen', 'pen', '畫筆（B）'], ['eraser', 'eraser', '橡皮擦（E）'], ['line', 'line', '直線（L）'], ['rect', 'rect', '矩形（R）'], ['ellipse', 'ellipse', '橢圓（O）'], ['fill', 'bucket', '填滿（F）']];

export async function start(os, win, args = {}) {
  const { fs } = os;
  let mode = 'pen', color = COLORS[3], size = 6, node = null, dirty = false;
  const undo = [], redo = [];

  const canvas = h('canvas', { class: 'pt-canvas', width: W, height: H });
  const over = h('canvas', { class: 'pt-canvas pt-over', width: W, height: H });
  const g = canvas.getContext('2d', { willReadFrequently: true }), og = over.getContext('2d');
  const toolEls = TOOLS.map(([id, icon, label]) => tool(icon, label, { data: { t: id } }));
  const swatches = h('div', { class: 'pt-colors' }, COLORS.map((c) => h('button', { type: 'button', data: { c }, style: { '--c': c }, title: c, 'aria-label': `顏色 ${c}` })));
  const custom = h('input', { type: 'color', value: color, title: '自訂顏色', 'aria-label': '自訂顏色' });
  const sizeIn = h('input', { type: 'range', min: 1, max: 60, step: 1, value: size, 'aria-label': '筆刷粗細' });
  const sizeOut = h('span', { class: 'pt-size' });
  const undoBtn = tool('undo', '復原（Ctrl Z）', { onclick: () => back() }), redoBtn = tool('redo', '重做（Ctrl Y）', { onclick: () => forward() });
  const board = h('div', { class: 'pt-board' }, h('div', { class: 'pt-sheet' }, canvas, over));
  win.body.append(h('div', { class: 'pt' },
    h('div', { class: 'pt-bar' },
      tool('newDoc', '新畫布', { onclick: () => fresh() }), tool('folderOpen', '開啟圖片', { onclick: () => openDialog() }), tool('save', '儲存（Ctrl S）', { onclick: () => save() }), h('i'),
      undoBtn, redoBtn, h('i'), ...toolEls, h('i'), swatches, custom, h('i'), sizeIn, sizeOut),
    board));

  function sync() {
    toolEls.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === mode)));
    swatches.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset.c.toLowerCase() === color.toLowerCase()));
    custom.value = /^#[0-9a-f]{6}$/i.test(color) ? color : '#ffffff';
    sizeOut.textContent = `${size} px`;
    undoBtn.disabled = !undo.length; redoBtn.disabled = !redo.length;
    win.dirty = dirty;
    win.setTitle(`${dirty ? '● ' : ''}${node ? node.name : '未命名.png'} — 繪圖板`);
  }
  const snap = () => { undo.push(g.getImageData(0, 0, W, H)); if (undo.length > 24) undo.shift(); redo.length = 0; dirty = true; };
  function back() { if (!undo.length) return; redo.push(g.getImageData(0, 0, W, H)); g.putImageData(undo.pop(), 0, 0); dirty = true; sync(); }
  function forward() { if (!redo.length) return; undo.push(g.getImageData(0, 0, W, H)); g.putImageData(redo.pop(), 0, 0); dirty = true; sync(); }
  function blank() { g.fillStyle = PAPER; g.fillRect(0, 0, W, H); }

  const at = (e) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  const pen = (ctx) => { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = size; ctx.strokeStyle = mode === 'eraser' ? PAPER : color; ctx.fillStyle = ctx.strokeStyle; };
  function shape(ctx, a, b) {
    pen(ctx);
    ctx.beginPath();
    if (mode === 'line') { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    else if (mode === 'rect') ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    else ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  /** Scan-line flood fill from (x, y), with a small tolerance so anti-aliased edges do not leave a halo. */
  function flood(x0, y0) {
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const c = /^#[0-9a-f]{6}$/i.test(color) ? [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)] : [255, 255, 255];
    const p0 = (y0 * W + x0) * 4, t = [d[p0], d[p0 + 1], d[p0 + 2]];
    if (Math.abs(t[0] - c[0]) + Math.abs(t[1] - c[1]) + Math.abs(t[2] - c[2]) < 6) return;
    const same = (p) => Math.abs(d[p] - t[0]) + Math.abs(d[p + 1] - t[1]) + Math.abs(d[p + 2] - t[2]) <= 48;
    const stack = [[x0, y0]], seen = new Uint8Array(W * H);
    while (stack.length) {
      const [x, y] = stack.pop();
      let l = x, r = x;
      while (l > 0 && !seen[y * W + l - 1] && same((y * W + l - 1) * 4)) l--;
      while (r < W - 1 && !seen[y * W + r + 1] && same((y * W + r + 1) * 4)) r++;
      for (let i = l; i <= r; i++) {
        const k = y * W + i, p = k * 4;
        seen[k] = 1; d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
        for (const yy of [y - 1, y + 1]) if (yy >= 0 && yy < H && !seen[yy * W + i] && same((yy * W + i) * 4)) { seen[yy * W + i] = 1; stack.push([i, yy]); }
      }
    }
    g.putImageData(img, 0, 0);
  }

  over.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    const a = at(e);
    snap();
    if (mode === 'fill') { flood(a.x, a.y); sync(); return; }
    let lastP = a;
    if (mode === 'pen' || mode === 'eraser') { pen(g); g.beginPath(); g.arc(a.x, a.y, size / 2, 0, Math.PI * 2); g.fill(); }
    const move = (ev) => {
      const b = at(ev);
      if (mode === 'pen' || mode === 'eraser') {
        pen(g);
        // every sample the pointer delivered since the last frame, so a fast stroke stays a curve
        const pts = ev.getCoalescedEvents ? ev.getCoalescedEvents().map(at) : [b];
        g.beginPath(); g.moveTo(lastP.x, lastP.y);
        for (const p of pts.length ? pts : [b]) g.lineTo(p.x, p.y);
        g.stroke();
        lastP = b;
      } else { og.clearRect(0, 0, W, H); shape(og, a, ev.shiftKey ? square(a, b) : b); lastP = ev.shiftKey ? square(a, b) : b; }
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (mode !== 'pen' && mode !== 'eraser') { og.clearRect(0, 0, W, H); shape(g, a, lastP); }
      sync();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  // Shift keeps a shape square (or a line on an eighth of a turn)
  const square = (a, b) => {
    if (mode === 'line') { const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(b.x - a.x, b.y - a.y); return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len }; }
    const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    return { x: a.x + Math.sign(b.x - a.x || 1) * s, y: a.y + Math.sign(b.y - a.y || 1) * s };
  };

  async function ask() {
    if (!dirty) return true;
    const v = await os.ui.dialog({ title: '尚未儲存', icon: 'warn', text: '這張圖有尚未儲存的變更。', buttons: [{ label: '取消', value: 'cancel' }, { label: '不儲存', value: 'drop', danger: true }, { label: '儲存', value: 'save', primary: true }] });
    return v === 'drop' ? true : v === 'save' ? save() : false;
  }
  async function fresh() { if (!(await ask())) return; blank(); undo.length = redo.length = 0; node = null; dirty = false; sync(); }
  async function load(n) {
    try {
      const pic = new Image();
      pic.src = await fs.url(n);
      await pic.decode();
      blank();
      const k = Math.min(W / pic.naturalWidth, H / pic.naturalHeight), w = pic.naturalWidth * k, hh = pic.naturalHeight * k;
      g.drawImage(pic, (W - w) / 2, (H - hh) / 2, w, hh);
      undo.length = redo.length = 0; dirty = false;
      // a picture that is not a PNG of the home folder is only a starting point: saving makes a new file
      node = !fs.isRO(n) && /\.png$/i.test(n.name) ? n : null;
      sync();
    } catch (e) { os.ui.fail(new Error('這張圖片無法開啟。')); }
  }
  async function openDialog() { if (!(await ask())) return; const n = await os.ui.pick({ mode: 'open', kinds: ['image'], start: fs.dir('pics') }); if (n) load(n); }
  async function save() {
    try {
      const hit = await os.ui.pick({ mode: 'save', kinds: ['image'], name: node ? node.name : '未命名.png', start: node ? fs.parent(node) : fs.dir('pics') });
      if (!hit) return false;
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) throw new Error('無法產生圖片。');
      const name = /\.png$/i.test(hit.name) ? hit.name : `${hit.name.replace(/\.[^.]+$/, '')}.png`;
      if (hit.node) await fs.remove(hit.node);
      node = await fs.create(hit.dir, name, { blob, mime: 'image/png' });
      dirty = false;
      sync();
      os.notify({ app: 'paint', title: '圖片已儲存', body: fs.path(node), action: () => os.openNode(node), silent: true });
      return true;
    } catch (e) { await os.ui.fail(e, '無法儲存'); return false; }
  }

  win.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]'), c = e.target.closest('[data-c]');
    if (t) { mode = t.dataset.t; sync(); } else if (c) { color = c.dataset.c; if (mode === 'eraser') mode = 'pen'; sync(); }
  });
  custom.addEventListener('input', () => { color = custom.value; if (mode === 'eraser') mode = 'pen'; sync(); });
  sizeIn.addEventListener('input', () => { size = Number(sizeIn.value); sync(); });
  win.body.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) forward(); else back(); } else if (k === 'y') { e.preventDefault(); forward(); } else if (k === 's') { e.preventDefault(); save(); }
      return;
    }
    if (e.altKey) return;
    const m = { b: 'pen', e: 'eraser', l: 'line', r: 'rect', o: 'ellipse', f: 'fill' }[k];
    if (m) { mode = m; sync(); } else if (k === '[') { size = Math.max(1, size - 2); sizeIn.value = size; sync(); } else if (k === ']') { size = Math.min(60, size + 2); sizeIn.value = size; sync(); }
  });
  win.onClose = ask;

  blank();
  if (args.node) await load(args.node); else sync();
  return { open: (a) => { if (a.node) ask().then((ok) => ok && load(a.node)); } };
}
