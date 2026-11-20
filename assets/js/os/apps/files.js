// File manager. One folder per window, with a history; the desktop and every other window of it follow the
// file system as it changes.
import { h, ico, tool, btn, nodeTile, nodeIcon, KIND, when } from '../ui.js';
import { bytes } from '../kernel.js';
import { LABEL } from '../vfs.js';

const PLACES = ['home', 'desktop', 'docs', 'pics', 'music', 'dl', null, 'sys', 'trash'];

export function start(os, win, args = {}) {
  const { fs, ops } = os;
  const TYPE = os.desktop.TYPE;
  const state = os.cfg.app('files');
  let dir = args.dir && args.dir.dir ? args.dir : fs.home;
  let hist = [dir.id], at = 0, view = state.get('view', 'grid'), filter = '';
  const sel = new Set();

  const side = h('nav', { class: 'fx-side', 'aria-label': '位置' });
  const crumbs = h('div', { class: 'fx-path' });
  const find = h('input', { class: 'os-input fx-find', type: 'search', placeholder: '篩選這個資料夾', spellcheck: false, 'aria-label': '篩選' });
  const list = h('div', { class: 'fx-list', tabindex: '0', role: 'listbox', 'aria-multiselectable': 'true' });
  const status = h('p', { class: 'fx-status' });
  const meter = h('div', { class: 'fx-meter' });
  const b = {
    back: tool('back', '上一頁', { onclick: () => step(-1) }), fwd: tool('fwd', '下一頁', { onclick: () => step(1) }),
    up: tool('up', '上一層（Backspace）', { onclick: () => { const p = fs.parent(dir); if (p) go(p); } }),
    view: tool('list', '切換檢視', { onclick: () => { view = view === 'grid' ? 'list' : 'grid'; state.set('view', view); draw(); } }),
    add: btn('新增', { icon: 'plus', onclick: (e) => newMenu(e.currentTarget) }),
    empty: btn('清空垃圾桶', { icon: 'trash', cls: 'is-danger', onclick: () => ops.emptyTrash() }),
  };
  win.body.append(h('div', { class: 'fx' }, side,
    h('div', { class: 'fx-main' },
      h('div', { class: 'fx-top' }, b.back, b.fwd, b.up, crumbs, find, b.view, b.add, b.empty),
      list, status)));

  const rows = () => fs.children(dir).filter((n) => !filter || fs.label(n).toLowerCase().includes(filter));
  const picked = () => fs.children(dir).filter((n) => sel.has(n.id));
  const inTrash = () => dir.id === 'trash' || fs.inTrash(dir);
  const canWrite = () => fs.canWrite(dir);

  function go(next, push = true) {
    if (!next || !next.dir) return;
    dir = next; sel.clear(); filter = ''; find.value = '';
    if (push) { hist = hist.slice(0, at + 1); hist.push(dir.id); at = hist.length - 1; }
    draw();
    list.scrollTop = 0;
  }
  function step(d) {
    for (let i = at + d; i >= 0 && i < hist.length; i += d) { const n = fs.get(hist[i]); if (n) { at = i; go(n, false); return; } }
  }

  function draw() {
    // the folder may have been deleted from another window
    if (!fs.get(dir.id)) { dir = fs.home; hist = [dir.id]; at = 0; }
    win.setTitle(`${fs.label(dir)} — 檔案總管`);
    side.replaceChildren(...PLACES.map((id) => (id ? h('button', { type: 'button', class: dir.id === id ? 'is-on' : '', data: { id } }, ico(nodeIcon(fs, fs.dir(id))), h('span', null, LABEL[id]), id === 'trash' && fs.children(fs.dir('trash')).length ? h('i', null, String(fs.children(fs.dir('trash')).length)) : null) : h('hr'))), meter);
    const u = fs.usage();
    meter.replaceChildren(h('span', null, 'LOCAL STORAGE'), h('b', null, bytes(u.text + u.blobs)), h('i', null, `${u.count} 個檔案${fs.volatile ? ' · 僅記憶體' : ''}`));

    const chain = [];
    for (let n = dir; n; n = fs.parent(n)) chain.unshift(n);
    crumbs.replaceChildren(...chain.flatMap((n, i) => [i ? h('i', null, '/') : null, h('button', { type: 'button', data: { id: n.id } }, n.id === 'root' ? '這台裝置' : fs.label(n))]).filter(Boolean));
    b.back.disabled = at <= 0; b.fwd.disabled = at >= hist.length - 1; b.up.disabled = !fs.parent(dir);
    b.view.innerHTML = tool(view === 'grid' ? 'list' : 'tiles', '').innerHTML;
    b.add.hidden = !canWrite() || inTrash();
    b.empty.hidden = dir.id !== 'trash';

    const items = rows();
    for (const id of [...sel]) if (!items.some((n) => n.id === id)) sel.delete(id);
    list.className = `fx-list fx-list--${view}`;
    const cut = ops.clip?.cut ? ops.clip.ids : [];
    if (!items.length) list.replaceChildren(h('p', { class: 'fx-none' }, filter ? '沒有符合的項目' : dir.id === 'trash' ? '垃圾桶是空的' : '這個資料夾是空的', !filter && canWrite() && !inTrash() ? h('small', null, '可以把檔案從桌面、其他視窗或這台電腦拖進來') : null));
    else {
      const head = view === 'list' ? [h('div', { class: 'fx-head' }, h('span', null, '名稱'), h('span', null, dir.id === 'trash' ? '原位置' : '種類'), h('span', null, '大小'), h('span', null, '修改時間'))] : [];
      list.replaceChildren(...head, ...items.map((n) => {
        const cls = `fx-item${sel.has(n.id) ? ' is-on' : ''}${cut.includes(n.id) ? ' is-cut' : ''}`;
        if (view === 'grid') return h('button', { type: 'button', class: cls, draggable: true, role: 'option', data: { id: n.id }, title: fs.label(n) }, nodeTile(os, n), h('span', null, fs.label(n)));
        const from = dir.id === 'trash' ? fs.get(n.from) : null;
        return h('button', { type: 'button', class: cls, draggable: true, role: 'option', data: { id: n.id } },
          h('span', { class: 'fx-name' }, nodeTile(os, n, 'os-tile--s'), h('b', null, fs.label(n))),
          h('span', null, dir.id === 'trash' ? (from ? fs.path(from) : '—') : KIND[fs.kind(n)]),
          h('span', null, n.dir ? `${fs.children(n).length} 個項目` : n.url ? '—' : bytes(n.size || 0)),
          h('span', null, n.url || n.fixed ? '—' : when(n.mtime)));
      }));
    }
    const p = picked();
    status.textContent = p.length ? `已選取 ${p.length} 個項目${p.length === 1 && !p[0].dir && !p[0].url ? ` · ${bytes(p[0].size || 0)}` : ''}` : `${items.length} 個項目${canWrite() ? '' : ' · 唯讀'}`;
  }
  const mark = () => { list.querySelectorAll('.fx-item').forEach((el) => el.classList.toggle('is-on', sel.has(el.dataset.id))); const p = picked(); status.textContent = p.length ? `已選取 ${p.length} 個項目` : `${rows().length} 個項目`; };
  const nodeOf = (el) => { const x = el?.closest?.('.fx-item'); return x ? fs.get(x.dataset.id) : null; };
  const open = (n) => { if (inTrash()) { ops.props(n); return; } if (n.dir) go(n); else os.openNode(n, dir); };

  function newMenu(anchor) {
    os.ui.menu([
      { label: '資料夾', icon: 'newDir', action: () => ops.newFolder(dir) },
      { label: '文字文件', icon: 'newDoc', action: () => ops.newText(dir) },
      '-',
      { label: '從這台電腦加入檔案…', icon: 'upload', action: () => ops.addFiles(dir) },
    ], { anchor, side: 'bottom', align: 'end' });
  }
  function itemMenu(n, e) {
    const p = picked(), many = p.length > 1;
    if (inTrash()) {
      os.ui.menu([
        { label: many ? `還原 ${p.length} 個項目` : '還原', icon: 'undo', action: () => ops.restore(p) },
        { label: '永久刪除', icon: 'trash', danger: true, action: () => ops.remove(p) },
        !many ? '-' : null, !many ? { label: '內容', icon: 'info', action: () => ops.props(n) } : null,
      ], { x: e.clientX, y: e.clientY });
      return;
    }
    const ro = p.every((x) => fs.isRO(x));
    os.ui.menu([
      { label: many ? `開啟 ${p.length} 個項目` : '開啟', icon: 'folderOpen', action: () => p.forEach(open) },
      !many && n.dir ? { label: '在新視窗開啟', icon: 'ext', action: () => os.launch('files', { dir: n }) } : null,
      !many && fs.kind(n) === 'image' ? { label: '設為桌布', icon: 'image', action: () => os.cfg.set('wall', n.wall ? `img:${n.wall}` : `file:${n.id}`) } : null,
      '-',
      { label: '剪下', icon: 'cut', hint: 'Ctrl X', disabled: ro, action: () => { ops.cut(p); draw(); } },
      { label: '複製', icon: 'copy', hint: 'Ctrl C', action: () => ops.copy(p) },
      !many ? { label: '重新命名', icon: 'edit', hint: 'F2', disabled: ro, action: () => ops.rename(n) } : null,
      !many && !n.dir && !n.app ? { label: '匯出到這台電腦', icon: 'download', action: () => os.exportNode(n) } : null,
      '-',
      { label: '丟進垃圾桶', icon: 'trash', hint: 'Del', danger: true, disabled: ro, action: () => ops.trash(p) },
      !many ? '-' : null, !many ? { label: '內容', icon: 'info', action: () => ops.props(n) } : null,
    ], { x: e.clientX, y: e.clientY });
  }
  function blankMenu(e) {
    if (inTrash()) { os.ui.menu([{ label: '清空垃圾桶', icon: 'trash', danger: true, disabled: !fs.children(fs.dir('trash')).length, action: () => ops.emptyTrash() }], { x: e.clientX, y: e.clientY }); return; }
    const w = canWrite();
    os.ui.menu([
      { label: '新增資料夾', icon: 'newDir', disabled: !w, action: () => ops.newFolder(dir) },
      { label: '新增文字文件', icon: 'newDoc', disabled: !w, action: () => ops.newText(dir) },
      { label: '從這台電腦加入檔案…', icon: 'upload', disabled: !w, action: () => ops.addFiles(dir) },
      { label: '貼上', icon: 'paste', hint: 'Ctrl V', disabled: !ops.canPaste(dir), action: () => ops.paste(dir) },
      '-',
      { label: view === 'grid' ? '清單檢視' : '圖示檢視', icon: view === 'grid' ? 'list' : 'tiles', action: () => b.view.click() },
      { label: '在這裡開啟終端機', icon: 'terminal', action: () => os.launch('terminal', { dir }) },
      { label: '內容', icon: 'info', action: () => ops.props(dir) },
    ], { x: e.clientX, y: e.clientY });
  }

  // ---------------- events
  let touch = false, anchor = null;
  side.addEventListener('click', (e) => { const x = e.target.closest('[data-id]'); if (x) go(fs.dir(x.dataset.id)); });
  crumbs.addEventListener('click', (e) => { const x = e.target.closest('[data-id]'); if (x) go(fs.get(x.dataset.id)); });
  find.addEventListener('input', () => { filter = find.value.trim().toLowerCase(); draw(); });
  list.addEventListener('pointerdown', (e) => {
    touch = e.pointerType === 'touch';
    const n = nodeOf(e.target);
    if (!n) { if (e.button === 0 && !e.ctrlKey) { sel.clear(); mark(); } return; }
    if (e.button > 0 && sel.has(n.id)) return;
    if (e.ctrlKey || e.metaKey) { if (sel.has(n.id)) sel.delete(n.id); else sel.add(n.id); anchor = n.id; }
    else if (e.shiftKey && anchor) {
      const items = rows(), a = items.findIndex((x) => x.id === anchor), z = items.indexOf(n);
      if (a >= 0) { sel.clear(); for (let i = Math.min(a, z); i <= Math.max(a, z); i++) sel.add(items[i].id); }
    } else if (!sel.has(n.id)) { sel.clear(); sel.add(n.id); anchor = n.id; }
    mark();
  });
  list.addEventListener('click', (e) => {
    const n = nodeOf(e.target);
    if (!n) return;
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { sel.clear(); sel.add(n.id); anchor = n.id; mark(); }
    if (touch || os.wm.compact) open(n);
  });
  list.addEventListener('dblclick', (e) => { const n = nodeOf(e.target); if (n && !touch && !os.wm.compact) open(n); });
  list.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    const n = nodeOf(e.target);
    if (!n) { blankMenu(e); return; }
    if (!sel.has(n.id)) { sel.clear(); sel.add(n.id); mark(); }
    itemMenu(n, e);
  });
  win.body.addEventListener('keydown', (e) => {
    if (e.target === find) { if (e.key === 'Escape' && find.value) { e.stopPropagation(); find.value = ''; filter = ''; draw(); } return; }
    const p = picked(), mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Enter' && p.length) { e.preventDefault(); p.forEach(open); }
    else if (e.key === 'Backspace') { e.preventDefault(); b.up.click(); }
    else if (e.key === 'F2' && p.length === 1 && !inTrash()) { e.preventDefault(); ops.rename(p[0]); }
    else if (e.key === 'Delete' && p.length) { e.preventDefault(); if (inTrash()) ops.remove(p); else ops.trash(p); }
    else if (mod && k === 'a') { e.preventDefault(); rows().forEach((n) => sel.add(n.id)); mark(); }
    else if (mod && k === 'c' && p.length) { e.preventDefault(); ops.copy(p); }
    else if (mod && k === 'x' && p.length && !inTrash()) { e.preventDefault(); ops.cut(p); draw(); }
    else if (mod && k === 'v' && ops.canPaste(dir)) { e.preventDefault(); ops.paste(dir); }
    else if (e.key.startsWith('Arrow')) {
      const els = [...list.querySelectorAll('.fx-item')];
      if (!els.length) return;
      e.preventDefault();
      const cur = els.findIndex((x) => x === document.activeElement);
      const cols = view === 'grid' ? Math.max(1, Math.floor(list.clientWidth / (els[0].offsetWidth + 4))) : 1;
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      const next = els[Math.max(0, Math.min(els.length - 1, cur < 0 ? 0 : cur + d))];
      sel.clear(); sel.add(next.dataset.id); anchor = next.dataset.id; mark(); next.focus(); next.scrollIntoView({ block: 'nearest' });
    }
  });

  // drag and drop: the same payload as the desktop's
  list.addEventListener('dragstart', (e) => {
    const n = nodeOf(e.target);
    if (!n) { e.preventDefault(); return; }
    if (!sel.has(n.id)) { sel.clear(); sel.add(n.id); mark(); }
    e.dataTransfer.setData(TYPE, JSON.stringify([...sel]));
    e.dataTransfer.effectAllowed = 'copyMove';
    os.root.classList.add('is-dragging');
  });
  list.addEventListener('dragend', () => os.root.classList.remove('is-dragging'));
  const accepts = (e) => e.dataTransfer.types.includes(TYPE) || e.dataTransfer.types.includes('Files');
  const clearTargets = () => win.body.querySelectorAll('.is-target').forEach((x) => x.classList.remove('is-target'));
  const targetOf = (e) => {
    const item = nodeOf(e.target);
    if (item && item.dir && !sel.has(item.id)) return { node: item, el: e.target.closest('.fx-item') };
    const place = e.target.closest('.fx-side [data-id]');
    if (place) return { node: fs.dir(place.dataset.id), el: place };
    return e.target.closest('.fx-list') ? { node: dir, el: null } : null;
  };
  win.body.addEventListener('dragover', (e) => {
    if (!accepts(e)) return;
    const t = targetOf(e);
    clearTargets();
    if (!t || !fs.canWrite(t.node)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(TYPE) ? 'move' : 'copy';
    t.el?.classList.add('is-target');
  });
  win.body.addEventListener('dragleave', (e) => { if (!win.body.contains(e.relatedTarget)) clearTargets(); });
  win.body.addEventListener('drop', async (e) => {
    if (!accepts(e)) return;
    const t = targetOf(e);
    clearTargets();
    if (!t) return;
    e.preventDefault();
    if (e.dataTransfer.types.includes(TYPE)) {
      let ids = [];
      try { ids = JSON.parse(e.dataTransfer.getData(TYPE)); } catch { /* not ours */ }
      const nodes = ids.map((id) => fs.get(id)).filter((n) => n && n.id !== 'trash');
      // system files cannot be moved: dropping them somewhere makes a copy
      const fixed = nodes.filter((n) => fs.isRO(n)), free = nodes.filter((n) => !fs.isRO(n));
      if (free.length) await ops.drop(free, t.node);
      if (fixed.length && t.node.id !== 'trash') { try { for (const n of fixed) await fs.copy(n, t.node); } catch (er) { os.ui.fail(er); } }
    } else if (e.dataTransfer.files.length && t.node.id !== 'trash') await os.importFiles(e.dataTransfer.files, t.node);
  });

  win.cleanup.push(os.bus.on('fs', draw), os.bus.on('clip', draw));
  draw();
  list.focus({ preventScroll: true });
  return { open: (a) => { if (a.dir) go(a.dir); } };
}
