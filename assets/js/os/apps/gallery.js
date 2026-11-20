// Gallery: the system's wallpapers and every picture in the home folder, with a viewer (zoom, pan, rotate,
// slideshow) and "set as wallpaper".
import { h, tool, btn } from '../ui.js';
import { clamp } from '../kernel.js';

export async function start(os, win, args = {}) {
  const { fs } = os;
  let tab = 'all', list = [], cur = -1, zoom = 1, rot = 0, pan = { x: 0, y: 0 }, show = 0, job = 0;
  const extra = [];                       // pictures opened from somewhere the gallery does not list

  const grid = h('div', { class: 'gl-grid' });
  const tabs = h('div', { class: 'nx-seg gl-tabs', role: 'group' }, [['all', '全部'], ['walls', '桌布'], ['mine', '我的圖片']].map(([v, l]) => h('button', { type: 'button', data: { v } }, l)));
  const img = h('img', { class: 'gl-img', alt: '', draggable: false });
  const cap = h('p', { class: 'gl-cap' });
  const stage = h('div', { class: 'gl-stage' }, img);
  const slideBtn = tool('show', '幻燈片', { onclick: () => slide(!show) });
  const wallBtn = btn('設為桌布', { icon: 'desktop', onclick: () => setWall() });
  const delBtn = tool('trash', '丟進垃圾桶', { onclick: async () => { const n = list[cur]; if (n && !fs.isRO(n)) { await os.ops.trash([n]); } } });
  const viewer = h('div', { class: 'gl-view', hidden: true },
    h('div', { class: 'gl-bar' }, tool('back', '回到相簿（Esc）', { onclick: () => close() }), cap, h('i'),
      tool('zoomOut', '縮小', { onclick: () => setZoom(zoom / 1.25) }), tool('fit', '符合視窗', { onclick: () => { zoom = 1; pan = { x: 0, y: 0 }; place(); } }), tool('zoomIn', '放大', { onclick: () => setZoom(zoom * 1.25) }),
      tool('rotate', '旋轉', { onclick: () => { rot = (rot + 90) % 360; place(); } }), slideBtn, delBtn, wallBtn),
    stage, tool('chevL', '上一張', { class: 'os-tool gl-nav gl-nav--l', onclick: () => step(-1) }), tool('chevR', '下一張', { class: 'os-tool gl-nav gl-nav--r', onclick: () => step(1) }));
  win.body.append(h('div', { class: 'gl' },
    h('div', { class: 'gl-top' }, tabs, h('i'), btn('加入圖片', { icon: 'upload', onclick: () => os.ops.addFiles(fs.dir('pics'), 'image/*') })),
    grid, viewer));

  function collect() {
    const walls = fs.children(fs.get('sys:walls')), mine = [];
    const walk = (d) => fs.children(d).forEach((n) => { if (n.dir) walk(n); else if (fs.kind(n) === 'image') mine.push(n); });
    walk(fs.home);
    for (const n of extra) if (fs.get(n.id) && !mine.includes(n) && !walls.includes(n)) mine.push(n);
    return tab === 'walls' ? walls : tab === 'mine' ? mine : [...walls, ...mine];
  }
  const thumb = (n) => (n.wall ? Promise.resolve(n.url.replace('.webp', '-thumb.webp')) : fs.url(n));
  function draw() {
    const keep = cur >= 0 ? list[cur] : null;
    list = collect();
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === tab)));
    grid.replaceChildren(...(list.length ? list.map((n, i) => {
      const pic = h('img', { alt: '', loading: 'lazy', decoding: 'async', draggable: false });
      thumb(n).then((u) => { pic.src = u; }).catch(() => pic.closest('button')?.classList.add('is-broken'));
      return h('button', { type: 'button', class: 'gl-item', data: { i }, title: fs.label(n) }, pic, h('span', null, n.name.replace(/\.[^.]+$/, '')), n.wall ? h('i', null, 'WALLPAPER') : null);
    }) : [h('p', { class: 'gl-none' }, tab === 'mine' ? '還沒有自己的圖片' : '沒有圖片', h('small', null, '按「加入圖片」，或把圖片檔拖進這個視窗'))]));
    if (keep) { const i = list.indexOf(keep); if (i < 0) close(); else cur = i; }
  }
  function place() { img.style.transform = `translate(${pan.x}px, ${pan.y}px) rotate(${rot}deg) scale(${zoom})`; stage.classList.toggle('is-zoomed', zoom > 1.01); }
  function setZoom(z) { zoom = clamp(z, 1, 8); if (zoom === 1) pan = { x: 0, y: 0 }; place(); }
  async function view(i) {
    if (!list.length) return;
    cur = (i + list.length) % list.length;
    const n = list[cur], my = ++job;
    zoom = 1; rot = 0; pan = { x: 0, y: 0 }; place();
    viewer.hidden = false;
    cap.textContent = `${n.name}　${cur + 1} / ${list.length}`;
    delBtn.hidden = fs.isRO(n);
    win.setTitle(`${n.name} — 相簿`);
    img.classList.add('is-loading');
    try { const u = await fs.url(n); if (my !== job) return; img.src = u; await img.decode().catch(() => {}); if (my === job) cap.textContent = `${n.name}　${img.naturalWidth}×${img.naturalHeight}　${cur + 1} / ${list.length}`; } catch (e) { if (my === job) cap.textContent = `${n.name} — 無法顯示`; }
    if (my === job) img.classList.remove('is-loading');
  }
  const step = (d) => view(cur + d);
  function close() { slide(false); viewer.hidden = true; cur = -1; win.setTitle('相簿'); }
  function slide(on) {
    clearInterval(show); show = 0;
    if (on) show = setInterval(() => step(1), 4000);
    slideBtn.setAttribute('aria-pressed', String(!!on));
  }
  function setWall() {
    const n = list[cur];
    if (!n) return;
    os.cfg.set('wall', n.wall ? `img:${n.wall}` : `file:${n.id}`);
    os.notify({ app: 'gallery', title: '桌布已更換', body: n.name, silent: true });
    cap.textContent = `${n.name}　已設為桌布`;
  }

  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.v; draw(); } });
  grid.addEventListener('click', (e) => { const b = e.target.closest('.gl-item'); if (b) view(Number(b.dataset.i)); });
  grid.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('.gl-item');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const n = list[Number(b.dataset.i)];
    os.ui.menu([
      { label: '檢視', icon: 'image', action: () => view(Number(b.dataset.i)) },
      { label: '設為桌布', icon: 'desktop', action: () => os.cfg.set('wall', n.wall ? `img:${n.wall}` : `file:${n.id}`) },
      { label: '在檔案總管顯示', icon: 'folder', action: () => os.launch('files', { dir: fs.parent(n) }) },
      { label: '匯出到這台電腦', icon: 'download', action: () => os.exportNode(n) },
      '-', { label: '丟進垃圾桶', icon: 'trash', danger: true, disabled: fs.isRO(n), action: () => os.ops.trash([n]) },
    ], { x: e.clientX, y: e.clientY });
  });
  stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  stage.addEventListener('dblclick', () => setZoom(zoom > 1 ? 1 : 2.5));
  stage.addEventListener('pointerdown', (e) => {
    if (zoom <= 1 || e.button) return;
    const sx = e.clientX - pan.x, sy = e.clientY - pan.y;
    const move = (ev) => { pan = { x: ev.clientX - sx, y: ev.clientY - sy }; place(); };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  win.body.addEventListener('keydown', (e) => {
    if (viewer.hidden) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.25); else if (e.key === '-') setZoom(zoom / 1.25);
  });
  win.body.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  win.body.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); os.importFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')), fs.dir('pics')); } });
  win.cleanup.push(os.bus.on('fs', draw), () => clearInterval(show));

  const openNode = (n) => { if (!n) return; if (!collectAll().includes(n)) extra.push(n); tab = 'all'; draw(); view(list.indexOf(n)); };
  const collectAll = () => { const t = tab; tab = 'all'; const all = collect(); tab = t; return all; };
  draw();
  if (args.node) openNode(args.node);
  return { open: (a) => openNode(a.node) };
}
