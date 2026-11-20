// Notes: a plain-text editor on the WebOS file system.
import { h, tool } from '../ui.js';
import { bytes } from '../kernel.js';

export async function start(os, win, args = {}) {
  const { fs } = os;
  const state = os.cfg.app('notes');
  let node = null, saved = '', wrap = state.get('wrap', true), size = state.get('size', 14);

  const text = h('textarea', { class: 'nt-text os-text', spellcheck: false, 'aria-label': '內容', wrap: 'soft' });
  const status = { pos: h('span'), count: h('span'), state: h('span'), path: h('span', { class: 'nt-path' }) };
  const findIn = h('input', { class: 'os-input', type: 'text', placeholder: '尋找', spellcheck: false, 'aria-label': '尋找' });
  const replIn = h('input', { class: 'os-input', type: 'text', placeholder: '取代為', spellcheck: false, 'aria-label': '取代為' });
  const findInfo = h('span', { class: 'nt-find__n' });
  const findBar = h('div', { class: 'nt-find', hidden: true }, findIn, replIn, findInfo,
    tool('chevU', '上一個', { onclick: () => seek(-1) }), tool('chevD', '下一個（Enter）', { onclick: () => seek(1) }),
    h('button', { type: 'button', class: 'os-btn is-quiet', onclick: () => replace(false) }, '取代'), h('button', { type: 'button', class: 'os-btn is-quiet', onclick: () => replace(true) }, '全部取代'),
    tool('close', '關閉尋找', { onclick: () => toggleFind(false) }));
  const wrapBtn = tool('wrap', '自動換行', { onclick: () => { wrap = !wrap; state.set('wrap', wrap); look(); } });
  win.body.append(h('div', { class: 'nt' },
    h('div', { class: 'nt-bar' },
      tool('newDoc', '新文件', { onclick: () => fresh() }), tool('folderOpen', '開啟（Ctrl O）', { onclick: () => openDialog() }),
      tool('save', '儲存（Ctrl S）', { onclick: () => save() }), tool('copy', '另存新檔', { onclick: () => save(true) }), h('i'),
      tool('undo', '復原', { onclick: () => { text.focus(); document.execCommand('undo'); } }), tool('redo', '重做', { onclick: () => { text.focus(); document.execCommand('redo'); } }), h('i'),
      tool('find', '尋找與取代（Ctrl F）', { onclick: () => toggleFind(findBar.hidden) }), wrapBtn,
      tool('minus', '縮小文字', { onclick: () => { size = Math.max(11, size - 1); state.set('size', size); look(); } }), tool('plus', '放大文字', { onclick: () => { size = Math.min(26, size + 1); state.set('size', size); look(); } })),
    findBar, text,
    h('div', { class: 'nt-status' }, status.pos, status.count, status.state, status.path)));

  const dirty = () => text.value !== saved;
  function look() {
    text.style.fontSize = `${size}px`;
    text.wrap = wrap ? 'soft' : 'off';
    text.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
    wrapBtn.setAttribute('aria-pressed', String(wrap));
  }
  function sync() {
    const d = dirty(), name = node ? node.name : '未命名.txt';
    win.dirty = d;
    win.setTitle(`${d ? '● ' : ''}${name} — 記事本`);
    const before = text.value.slice(0, text.selectionStart), line = before.split('\n').length, col = before.length - before.lastIndexOf('\n');
    status.pos.textContent = `第 ${line} 行，第 ${col} 欄`;
    status.count.textContent = `${[...text.value.replace(/\s/g, '')].length} 字 · ${bytes(new Blob([text.value]).size)}`;
    status.state.textContent = node && fs.isRO(node) ? '唯讀（儲存時會另存）' : d ? '已修改' : node ? '已儲存' : '尚未存檔';
    status.state.className = d ? 'is-dirty' : '';
    status.path.textContent = node ? fs.path(node) : '';
  }

  async function ask() {
    if (!dirty()) return true;
    const v = await os.ui.dialog({ title: '尚未儲存', icon: 'warn', text: `「${node ? node.name : '未命名.txt'}」有尚未儲存的變更。`, buttons: [{ label: '取消', value: 'cancel' }, { label: '不儲存', value: 'drop', danger: true }, { label: '儲存', value: 'save', primary: true }] });
    if (v === 'drop') return true;
    if (v === 'save') return save();
    return false;
  }
  async function load(n) {
    try {
      const t = await fs.text(n);
      node = n; saved = t; text.value = t;
      text.setSelectionRange(0, 0); text.scrollTop = 0;
      sync();
    } catch (e) { os.ui.fail(e, '無法開啟'); }
  }
  async function fresh() { if (await ask()) { node = null; saved = ''; text.value = ''; sync(); text.focus(); } }
  async function openDialog() {
    if (!(await ask())) return;
    const n = await os.ui.pick({ mode: 'open', kinds: ['text'], start: node ? fs.parent(node) : null });
    if (n) await load(n);
  }
  /** Returns true when the text is on disk. */
  async function save(as = false) {
    try {
      if (node && !as && !fs.isRO(node) && fs.get(node.id) && !fs.inTrash(node)) fs.writeText(node, text.value);
      else {
        const hit = await os.ui.pick({ mode: 'save', kinds: ['text'], name: node ? node.name : '未命名.txt', start: node && fs.canWrite(fs.parent(node)) ? fs.parent(node) : null });
        if (!hit) return false;
        if (hit.node) { fs.writeText(hit.node, text.value); node = hit.node; }
        else node = await fs.create(hit.dir, /\.[a-z0-9]+$/i.test(hit.name) ? hit.name : `${hit.name}.txt`, { text: text.value, exact: true });
      }
      saved = text.value;
      sync();
      return true;
    } catch (e) { await os.ui.fail(e, '無法儲存'); return false; }
  }

  // ---------------- find and replace
  function hits() {
    const q = findIn.value;
    if (!q) return [];
    const out = [], src = text.value.toLowerCase(), low = q.toLowerCase();
    for (let i = src.indexOf(low); i >= 0; i = src.indexOf(low, i + low.length)) out.push(i);
    return out;
  }
  function seek(d) {
    const list = hits(), q = findIn.value;
    findInfo.textContent = q ? (list.length ? '' : '找不到') : '';
    if (!list.length) return;
    const from = d > 0 ? text.selectionEnd : text.selectionStart - 1;
    let i = d > 0 ? list.findIndex((p) => p >= from) : list.findLastIndex((p) => p + q.length <= from + 1);
    if (i < 0) i = d > 0 ? 0 : list.length - 1;
    text.focus();
    text.setSelectionRange(list[i], list[i] + q.length);
    // bring the match into view: the caret's line, measured from the text before it
    const line = text.value.slice(0, list[i]).split('\n').length;
    const lh = parseFloat(getComputedStyle(text).lineHeight) || size * 1.7;
    if (line * lh < text.scrollTop + lh * 2 || line * lh > text.scrollTop + text.clientHeight - lh * 2) text.scrollTop = Math.max(0, line * lh - text.clientHeight / 2);
    findInfo.textContent = `${i + 1} / ${list.length}`;
    sync();
  }
  function replace(all) {
    const q = findIn.value;
    if (!q) return;
    if (all) {
      const n = hits().length;
      if (!n) { findInfo.textContent = '找不到'; return; }
      text.value = text.value.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), () => replIn.value);
      findInfo.textContent = `已取代 ${n} 處`;
      sync();
      return;
    }
    if (text.value.slice(text.selectionStart, text.selectionEnd).toLowerCase() === q.toLowerCase()) text.setRangeText(replIn.value, text.selectionStart, text.selectionEnd, 'end');
    seek(1);
  }
  function toggleFind(on) {
    findBar.hidden = !on;
    if (on) { const s = text.value.slice(text.selectionStart, text.selectionEnd); if (s && !s.includes('\n')) findIn.value = s; findIn.focus(); findIn.select(); } else text.focus();
  }
  findIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); seek(e.shiftKey ? -1 : 1); } });
  findBar.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); toggleFind(false); } });

  text.addEventListener('input', sync);
  ['keyup', 'click', 'select'].forEach((t) => text.addEventListener(t, sync));
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) { e.preventDefault(); text.setRangeText('  ', text.selectionStart, text.selectionEnd, 'end'); sync(); }
  });
  win.body.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); save(e.shiftKey); } else if (k === 'o') { e.preventDefault(); openDialog(); } else if (k === 'f') { e.preventDefault(); toggleFind(true); }
  });
  // a text file dropped on the editor opens in it
  win.body.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes(os.desktop.TYPE)) e.preventDefault(); });
  win.body.addEventListener('drop', async (e) => {
    if (!e.dataTransfer.types.includes(os.desktop.TYPE)) return;
    e.preventDefault();
    let ids = [];
    try { ids = JSON.parse(e.dataTransfer.getData(os.desktop.TYPE)); } catch { /* not ours */ }
    const n = ids.map((id) => fs.get(id)).find((x) => x && fs.kind(x) === 'text');
    if (n && await ask()) load(n);
  });
  win.onClose = ask;
  win.cleanup.push(os.bus.on('fs', () => { if (node && !fs.get(node.id)) { node = null; sync(); } else sync(); }));

  look();
  if (args.node) await load(args.node); else sync();
  text.focus({ preventScroll: true });
  return { open: (a) => { if (a.node) ask().then((ok) => ok && load(a.node)); } };
}
