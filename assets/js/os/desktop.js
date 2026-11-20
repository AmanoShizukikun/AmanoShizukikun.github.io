// The desktop: the contents of /Home/Desktop (plus the trash) as icons on a grid, and the telemetry block.
//
//   grid      column by column from the top left. A position chosen by dragging is remembered per file; icons
//             without one take the first free cell, so a smaller window never loses an icon.
//   select    click · Ctrl / Shift click · drag a rectangle on the empty desk
//   open      double click, Enter — or a single tap on touch screens
//   drag      the browser's own drag and drop, so an icon can be dropped on a folder, on the trash, in a file
//             manager window — and files from the computer can be dropped on the desk
import { h, nodeTile } from './ui.js';
import { SCENES, two, span } from './kernel.js';

const TYPE = 'application/x-nxos-nodes';
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function createDesktop(os) {
  const { fs, cfg } = os;
  const desk = os.layers.desk;
  const iconsEl = h('div', { class: 'os-icons', role: 'group', 'aria-label': '桌面' });
  const marquee = h('div', { class: 'os-marquee', 'aria-hidden': 'true' });
  const widget = h('aside', { class: 'os-widget', 'aria-label': '系統狀態' });
  desk.append(iconsEl, marquee, widget);
  const home = fs.dir('desktop'), trash = fs.dir('trash');
  const sel = new Set();
  const off = [];
  let cells = new Map();           // node id → { c, r }
  let grid = { cw: 92, ch: 100, pad: 12, cols: 1, rows: 1 };

  const items = () => [...fs.children(home), trash];
  const picked = () => items().filter((n) => sel.has(n.id));

  // ---------------------------------------------------------------- layout
  function measure() {
    const small = os.wm.compact;
    grid.cw = small ? 78 : 92; grid.ch = small ? 92 : 100; grid.pad = small ? 8 : 12;
    grid.cols = Math.max(1, Math.floor((desk.clientWidth - grid.pad * 2) / grid.cw));
    grid.rows = Math.max(1, Math.floor((desk.clientHeight - grid.pad * 2) / grid.ch));
  }
  function place(list) {
    const saved = cfg.get('desk'), taken = new Set(), out = new Map(), rest = [];
    for (const n of list) {
      const p = saved[n.id];
      if (Array.isArray(p) && p[0] >= 0 && p[1] >= 0 && p[0] < grid.cols && p[1] < grid.rows && !taken.has(`${p[0]},${p[1]}`)) { taken.add(`${p[0]},${p[1]}`); out.set(n.id, { c: p[0], r: p[1] }); } else rest.push(n);
    }
    let c = 0, r = 0;
    for (const n of rest) {
      while (taken.has(`${c},${r}`)) { r++; if (r >= grid.rows) { r = 0; c++; } }
      taken.add(`${c},${r}`); out.set(n.id, { c, r });
    }
    return out;
  }
  function render() {
    measure();
    const list = items();
    cells = place(list);
    for (const id of [...sel]) if (!list.some((n) => n.id === id)) sel.delete(id);
    const focused = document.activeElement?.closest?.('.os-icon')?.dataset.id;
    iconsEl.replaceChildren(...list.map((n) => {
      const p = cells.get(n.id);
      const empty = n === trash && !fs.children(trash).length;
      return h('button', {
        type: 'button', class: `os-icon${sel.has(n.id) ? ' is-on' : ''}${os.ops.clip?.cut && os.ops.clip.ids.includes(n.id) ? ' is-cut' : ''}`, draggable: true, data: { id: n.id },
        style: { left: `${grid.pad + p.c * grid.cw}px`, top: `${grid.pad + p.r * grid.ch}px`, width: `${grid.cw}px`, height: `${grid.ch}px` },
        title: n === trash ? (empty ? '垃圾桶（空的）' : `垃圾桶：${fs.children(trash).length} 個項目`) : fs.label(n),
      }, nodeTile(os, n, n === trash && !empty ? 'is-full' : ''), h('span', { class: 'os-icon__name' }, fs.label(n)));
    }));
    if (focused) iconsEl.querySelector(`[data-id="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }
  const mark = () => iconsEl.querySelectorAll('.os-icon').forEach((b) => b.classList.toggle('is-on', sel.has(b.dataset.id)));
  const nodeOf = (el) => { const b = el?.closest?.('.os-icon'); return b ? fs.get(b.dataset.id) : null; };

  // ---------------------------------------------------------------- actions
  const open = (n) => (n === trash ? os.launch('files', { dir: trash }) : os.openNode(n));
  function iconMenu(n, e) {
    const list = picked(), many = list.length > 1;
    if (n === trash) {
      os.ui.menu([
        { label: '開啟', icon: 'folderOpen', action: () => open(n) },
        { label: '清空垃圾桶', icon: 'trash', danger: true, disabled: !fs.children(trash).length, action: () => os.ops.emptyTrash() },
      ], { x: e.clientX, y: e.clientY });
      return;
    }
    const files = list.filter((x) => x !== trash);
    os.ui.menu([
      { label: many ? `開啟 ${files.length} 個項目` : '開啟', icon: 'folderOpen', action: () => files.forEach(open) },
      !many && fs.kind(n) === 'text' ? { label: '用記事本編輯', icon: 'note', action: () => os.launch('notes', { node: n }) } : null,
      '-',
      { label: '剪下', icon: 'cut', hint: 'Ctrl X', action: () => { os.ops.cut(files); render(); } },
      { label: '複製', icon: 'copy', hint: 'Ctrl C', action: () => os.ops.copy(files) },
      !many ? { label: '重新命名', icon: 'edit', hint: 'F2', action: () => os.ops.rename(n) } : null,
      !many && !n.dir && !n.app ? { label: '匯出到這台電腦', icon: 'download', action: () => os.exportNode(n) } : null,
      '-',
      { label: '丟進垃圾桶', icon: 'trash', hint: 'Del', danger: true, action: () => os.ops.trash(files) },
      !many ? '-' : null,
      !many ? { label: '內容', icon: 'info', action: () => os.ops.props(n) } : null,
    ], { x: e.clientX, y: e.clientY });
  }
  function deskMenu(e) {
    const cellAt = dropCell(e.clientX, e.clientY);
    const put = (n) => { if (n) setCell(n.id, cellAt); };
    os.ui.menu([
      { label: '新增', icon: 'plus', sub: [
        { label: '資料夾', icon: 'newDir', action: async () => put(await os.ops.newFolder(home)) },
        { label: '文字文件', icon: 'newDoc', action: async () => put(await os.ops.newText(home)) },
      ] },
      { label: '從這台電腦加入檔案…', icon: 'upload', action: () => os.ops.addFiles(home) },
      { label: '貼上', icon: 'paste', hint: 'Ctrl V', disabled: !os.ops.canPaste(home), action: () => os.ops.paste(home) },
      '-',
      { label: '重新排列圖示', icon: 'tiles', action: () => cfg.set('desk', {}) },
      { label: '顯示系統狀態', checked: cfg.get('widget'), action: () => cfg.set('widget', !cfg.get('widget')) },
      '-',
      { label: '在這裡開啟終端機', icon: 'terminal', action: () => os.launch('terminal', { dir: home }) },
      { label: '變更桌布…', icon: 'image', action: () => os.launch('settings', { page: 'look' }) },
    ], { x: e.clientX, y: e.clientY });
  }

  // ---------------------------------------------------------------- positions
  function dropCell(x, y) {
    const b = desk.getBoundingClientRect();
    return { c: Math.max(0, Math.min(grid.cols - 1, Math.floor((x - b.left - grid.pad) / grid.cw))), r: Math.max(0, Math.min(grid.rows - 1, Math.floor((y - b.top - grid.pad) / grid.ch))) };
  }
  function setCell(id, cell) {
    const saved = { ...cfg.get('desk') };
    // whoever sits in that cell gives it up and takes the next free one
    for (const [other, p] of cells) if (other !== id && p.c === cell.c && p.r === cell.r) delete saved[other];
    saved[id] = [cell.c, cell.r];
    // forget files that no longer exist
    for (const k of Object.keys(saved)) if (!fs.get(k)) delete saved[k];
    cfg.set('desk', saved);
  }

  // ---------------------------------------------------------------- events: icons
  let lastTouch = false;
  iconsEl.addEventListener('pointerdown', (e) => {
    const n = nodeOf(e.target);
    if (!n || e.button > 0) return;
    lastTouch = e.pointerType === 'touch';
    os.wm.blur();
    if (e.ctrlKey || e.metaKey) { if (sel.has(n.id)) sel.delete(n.id); else sel.add(n.id); }
    else if (e.shiftKey) sel.add(n.id);
    else if (!sel.has(n.id)) { sel.clear(); sel.add(n.id); }
    mark();
  });
  iconsEl.addEventListener('click', (e) => {
    const n = nodeOf(e.target);
    if (!n) return;
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { sel.clear(); sel.add(n.id); mark(); }
    if (lastTouch || os.wm.compact) open(n);
  });
  iconsEl.addEventListener('dblclick', (e) => { const n = nodeOf(e.target); if (n && !lastTouch && !os.wm.compact) open(n); });
  iconsEl.addEventListener('contextmenu', (e) => {
    const n = nodeOf(e.target);
    if (!n) return;
    e.preventDefault(); e.stopPropagation();
    if (!sel.has(n.id)) { sel.clear(); sel.add(n.id); mark(); }
    iconMenu(n, e);
  });
  iconsEl.addEventListener('keydown', (e) => {
    const n = nodeOf(e.target);
    if (!n) return;
    const list = picked().filter((x) => x !== trash);
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter') { e.preventDefault(); (picked().length ? picked() : [n]).forEach(open); }
    else if (e.key === 'F2' && n !== trash) { e.preventDefault(); os.ops.rename(n); }
    else if (e.key === 'Delete' && list.length) { e.preventDefault(); os.ops.trash(list); }
    else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); items().forEach((x) => sel.add(x.id)); mark(); }
    else if (mod && e.key.toLowerCase() === 'c' && list.length) { e.preventDefault(); os.ops.copy(list); }
    else if (mod && e.key.toLowerCase() === 'x' && list.length) { e.preventDefault(); os.ops.cut(list); render(); }
    else if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); if (os.ops.canPaste(home)) os.ops.paste(home); }
    else if (e.key.startsWith('Arrow')) {
      // move the focus to the neighbouring icon
      const p = cells.get(n.id), d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      let best = null, bd = Infinity;
      for (const [id, q] of cells) {
        const dc = q.c - p.c, dr = q.r - p.r;
        if (id === n.id || dc * d[0] + dr * d[1] <= 0) continue;
        const dist = Math.abs(dc) + Math.abs(dr) + (d[0] ? Math.abs(dr) : Math.abs(dc)) * 2;
        if (dist < bd) { bd = dist; best = id; }
      }
      if (best) { e.preventDefault(); sel.clear(); sel.add(best); mark(); iconsEl.querySelector(`[data-id="${CSS.escape(best)}"]`)?.focus(); }
    }
  });
  iconsEl.addEventListener('focusin', (e) => { const n = nodeOf(e.target); if (n && !sel.has(n.id)) { sel.clear(); sel.add(n.id); mark(); } });

  // ---------------------------------------------------------------- events: drag and drop
  iconsEl.addEventListener('dragstart', (e) => {
    const n = nodeOf(e.target);
    if (!n) { e.preventDefault(); return; }
    if (!sel.has(n.id)) { sel.clear(); sel.add(n.id); mark(); }
    e.dataTransfer.setData(TYPE, JSON.stringify([...sel]));
    e.dataTransfer.effectAllowed = 'move';
    os.root.classList.add('is-dragging');
  });
  iconsEl.addEventListener('dragend', () => { os.root.classList.remove('is-dragging'); iconsEl.querySelectorAll('.is-target').forEach((x) => x.classList.remove('is-target')); });
  const accepts = (e) => e.dataTransfer.types.includes(TYPE) || e.dataTransfer.types.includes('Files');
  desk.addEventListener('dragover', (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(TYPE) ? 'move' : 'copy';
    const over = nodeOf(e.target);
    iconsEl.querySelectorAll('.is-target').forEach((x) => x.classList.remove('is-target'));
    if (over && over.dir && !sel.has(over.id)) e.target.closest('.os-icon').classList.add('is-target');
  });
  desk.addEventListener('drop', async (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    iconsEl.querySelectorAll('.is-target').forEach((x) => x.classList.remove('is-target'));
    const over = nodeOf(e.target), cell = dropCell(e.clientX, e.clientY);
    if (e.dataTransfer.types.includes(TYPE)) {
      let ids = [];
      try { ids = JSON.parse(e.dataTransfer.getData(TYPE)); } catch { /* not ours */ }
      const nodes = ids.map((id) => fs.get(id)).filter(Boolean);
      if (over && over.dir && !nodes.includes(over)) { await os.ops.drop(nodes.filter((n) => n !== trash), over); return; }
      // onto the desk itself: files from elsewhere move here; icons already here just change place
      const outside = nodes.filter((n) => n.parent !== home.id && n !== trash);
      if (outside.length) await os.ops.drop(outside, home);
      const lead = nodes[0];
      if (lead && (lead.parent === home.id || lead === trash)) setCell(lead.id, cell);
    } else if (e.dataTransfer.files.length) {
      const made = await os.importFiles(e.dataTransfer.files, over && over.dir && over !== trash ? over : home);
      if (made[0] && made[0].parent === home.id) setCell(made[0].id, cell);
    }
  });

  // ---------------------------------------------------------------- events: the empty desk
  desk.addEventListener('contextmenu', (e) => { if (e.target === desk || e.target === iconsEl) { e.preventDefault(); e.stopPropagation(); deskMenu(e); } });
  desk.addEventListener('pointerdown', (e) => {
    if (e.target !== desk && e.target !== iconsEl) return;
    os.wm.blur();
    os.shell?.closePanels();
    if (!e.ctrlKey && !e.shiftKey) { sel.clear(); mark(); }
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const b = desk.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, base = new Set(sel);
    let on = false;
    const move = (ev) => {
      const x0 = Math.min(sx, ev.clientX), y0 = Math.min(sy, ev.clientY), x1 = Math.max(sx, ev.clientX), y1 = Math.max(sy, ev.clientY);
      if (!on && x1 - x0 + y1 - y0 < 6) return;
      on = true;
      Object.assign(marquee.style, { display: 'block', left: `${x0 - b.left}px`, top: `${y0 - b.top}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
      sel.clear(); base.forEach((id) => sel.add(id));
      iconsEl.querySelectorAll('.os-icon').forEach((el) => { const r = el.getBoundingClientRect(); if (r.left < x1 && r.right > x0 && r.top < y1 && r.bottom > y0) sel.add(el.dataset.id); });
      mark();
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); marquee.style.display = 'none'; };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });

  // ---------------------------------------------------------------- telemetry block
  const w = {
    time: h('b'), sec: h('i'), date: h('p', { class: 'os-widget__date' }),
    space: h('dd'), scene: h('dd'), cam: h('dd'), up: h('dd'), wins: h('dd'), camRow: null,
  };
  w.camRow = h('div', null, h('dt', null, 'CAMERA'), w.cam);
  widget.append(
    h('p', { class: 'os-widget__time' }, w.time, w.sec), w.date,
    h('dl', null, h('div', null, h('dt', null, 'WORKSPACE'), w.space), h('div', null, h('dt', null, 'SCENE'), w.scene), w.camRow, h('div', null, h('dt', null, 'WINDOWS'), w.wins), h('div', null, h('dt', null, 'UPTIME'), w.up)),
  );
  function tick() {
    if (widget.hidden) return;
    const d = new Date();
    const hr = cfg.get('hour12') ? d.getHours() % 12 || 12 : d.getHours();
    w.time.textContent = `${two(hr)}:${two(d.getMinutes())}`;
    w.sec.textContent = `:${two(d.getSeconds())}`;
    w.date.textContent = `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())} ${DAYS[d.getDay()]}`;
    const spaces = cfg.get('spaces'), s = spaces[os.wm.ws] || spaces[0], sc = SCENES[s.scene] || SCENES.gate;
    w.space.textContent = `${two(os.wm.ws + 1)} / ${s.name}`;
    const live = os.root.dataset.wall === 'live';
    w.scene.textContent = live ? `${sc.en} · T ${sc.t.toFixed(2)}` : 'STILL IMAGE';
    w.camRow.hidden = !live;
    w.wins.textContent = `${os.wm.wins.filter((x) => x.ws === os.wm.ws).length} / ${os.wm.wins.length}`;
    w.up.textContent = span((Date.now() - os.bootAt) / 1000);
  }
  function cam() {
    if (widget.hidden || w.camRow.hidden) return;
    const p = os.env.stage.read();
    if (p) w.cam.textContent = `${p.x.toFixed(1)}  ${p.y.toFixed(1)}  ${p.z.toFixed(1)}`;
  }
  const showWidget = () => { widget.hidden = !cfg.get('widget') || os.wm.compact; tick(); };
  const t1 = setInterval(tick, 1000), t2 = setInterval(cam, 250);

  // ---------------------------------------------------------------- wiring
  const ro = new ResizeObserver(render);
  ro.observe(desk);
  off.push(os.bus.on('fs', render), os.bus.on('cfg:desk', render), os.bus.on('clip', render), os.bus.on('compact', () => { render(); showWidget(); }),
    os.bus.on('cfg:widget', showWidget), os.bus.on('ws', tick), os.bus.on('wm', tick), os.bus.on('cfg:wall', () => setTimeout(tick, 60)), os.bus.on('cfg:spaces', tick), os.bus.on('cfg:hour12', tick));
  render();
  showWidget();

  return {
    TYPE,
    select(ids) { sel.clear(); ids.forEach((id) => sel.add(id)); mark(); },
    dispose() { ro.disconnect(); clearInterval(t1); clearInterval(t2); off.forEach((f) => f()); },
  };
}
