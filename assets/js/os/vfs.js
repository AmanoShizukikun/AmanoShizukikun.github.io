// The WebOS file system.
//
//   /Home      the visitor's files. The tree and the contents of text files live in localStorage; files brought in
//              from the device (pictures, audio, video …) keep their bytes in IndexedDB. Everything stays on this device.
//   /System    read-only: the wallpapers, the site's music and a few documents. Rebuilt from the site's own data on
//              every start, so it follows the site instead of going stale in storage.
//   /Trash     where deleted files wait; each remembers the folder it came from.
//
// The tree is held in memory, so listing, moving and renaming are synchronous. Reading a file's contents is async
// (a system file is fetched, a device file comes out of IndexedDB).
import { uid } from './kernel.js';
import { WALLS } from './kernel.js';
import { tracks } from '../data/music.js';

const KEY = 'nxosFs';
const TEXT_MAX = 512 * 1024, BLOB_MAX = 200 * 1024 * 1024;
const enc = new TextEncoder();

export class FsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const err = (code, message) => new FsError(code, message);

const EXT = {
  text: ['txt', 'md', 'json', 'js', 'mjs', 'css', 'html', 'htm', 'xml', 'csv', 'log', 'ini', 'yml', 'yaml', 'svg', 'ts', 'py', 'sh'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus', 'aac'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'ogv'],
};
const MIME = { txt: 'text/plain', md: 'text/markdown', json: 'application/json', js: 'text/javascript', css: 'text/css', html: 'text/html', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm' };
export const extOf = (name) => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; };

const FIXED = [
  ['home', 'root', 'Home'], ['desktop', 'home', 'Desktop'], ['docs', 'home', 'Documents'], ['pics', 'home', 'Pictures'],
  ['music', 'home', 'Music'], ['dl', 'home', 'Downloads'], ['sys', 'root', 'System'], ['trash', 'root', 'Trash'],
];
export const LABEL = { root: '這台裝置', home: '主資料夾', desktop: '桌面', docs: '文件', pics: '圖片', music: '音樂', dl: '下載', sys: '系統', trash: '垃圾桶' };

const WELCOME = `歡迎使用 Nagato Sakura WebOS。

這是一套在瀏覽器裡執行的桌面環境：
  · 視窗可以拖曳、縮放、貼齊畫面邊緣，也能最大化與最小化
  · 桌面的檔案是真的檔案：建立、改名、搬移、刪除，都會記在這台裝置上
  · 把電腦裡的檔案拖進來，就能用相簿、媒體播放器或記事本開啟
  · 工作列左側可以切換工作區，每個工作區是世界裡的一個地點

想知道更多，可以問長門櫻，或在終端機輸入 help。

提醒：檔案只存在這個瀏覽器裡，不會上傳到任何地方；清除瀏覽器資料也會一併清掉。
`;
const KEYS = `鍵盤快捷鍵

Alt + A            開啟應用程式選單（可直接輸入搜尋）
Alt + Z            工作總覽
Alt + \`            切換到下一個視窗
Alt + W            關閉視窗
Alt + M            最小化
Alt + X            最大化 / 還原
Alt + Shift + ←→   貼齊左半 / 右半
Alt + Shift + ↑↓   最大化 / 還原
Alt + 1 – 6        切換工作區
Alt + S            顯示桌面
Alt + L            鎖定
Esc                關閉選單、對話框、工作總覽

桌面與檔案總管
Enter 開啟 · F2 重新命名 · Delete 丟進垃圾桶 · Ctrl + A 全選
Ctrl + C / X / V 複製 / 剪下 / 貼上
`;

function openDb() {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open('nxos', 1); } catch { resolve(null); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

export async function createFs(bus) {
  const nodes = new Map();          // id → node
  const kids = new Map();           // dir id → Set of child ids
  const urls = new Map();           // node id → object URL
  const mem = new Map();            // blobs kept in memory when IndexedDB is unavailable
  const db = await openDb();
  let timer = 0, firstRun = false, volatile = !db;

  const idb = (mode, fn) => new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', mode);
    const req = fn(tx.objectStore('blobs'));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('IndexedDB'));
  });
  const putBlob = (id, blob) => (db ? idb('readwrite', (s) => s.put(blob, id)) : Promise.resolve(mem.set(id, blob)));
  const getBlob = (id) => (db ? idb('readonly', (s) => s.get(id)) : Promise.resolve(mem.get(id)));
  const delBlob = (id) => (db ? idb('readwrite', (s) => s.delete(id)).catch(() => {}) : Promise.resolve(mem.delete(id)));

  const add = (n) => {
    nodes.set(n.id, n);
    if (n.parent) { if (!kids.has(n.parent)) kids.set(n.parent, new Set()); kids.get(n.parent).add(n.id); }
    if (n.dir && !kids.has(n.id)) kids.set(n.id, new Set());
    return n;
  };
  const drop = (n) => { nodes.delete(n.id); kids.get(n.parent)?.delete(n.id); kids.delete(n.id); const u = urls.get(n.id); if (u) { URL.revokeObjectURL(u); urls.delete(n.id); } };

  // ---------------- the fixed skeleton and the system volume
  const now = Date.now();
  add({ id: 'root', name: '', dir: true, parent: null, fixed: true, ro: true, mtime: now });
  for (const [id, parent, name] of FIXED) add({ id, name, dir: true, parent, fixed: true, ro: id === 'sys', mtime: now });
  const sys = (id, parent, name, extra = {}) => add({ id: `sys:${id}`, name, parent, ro: true, mtime: now, ...extra });
  sys('walls', 'sys', 'Wallpapers', { dir: true });
  sys('music', 'sys', 'Music', { dir: true });
  for (const w of WALLS) sys(`wall-${w.id}`, 'sys:walls', `${w.name}.webp`, { url: `/assets/img/os/${w.file}.webp`, mime: 'image/webp', wall: w.id });
  for (const t of tracks) sys(`track-${t.id}`, 'sys:music', `${t.title}${t.sub ? ` – ${t.sub}` : ''}.mp3`, { url: `/assets/music/${t.id}.mp3`, mime: 'audio/mpeg', track: t.id });
  sys('keys', 'sys', '快捷鍵.txt', { text: KEYS, mime: 'text/plain' });

  // ---------------- what the visitor has stored
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && Array.isArray(raw.nodes)) {
      // parents first, whatever order they were written in
      const pending = raw.nodes.filter((n) => n && typeof n.id === 'string' && typeof n.name === 'string' && !nodes.has(n.id));
      let moved = true;
      while (pending.length && moved) {
        moved = false;
        for (let i = pending.length - 1; i >= 0; i--) {
          const n = pending[i];
          if (nodes.has(n.parent) && nodes.get(n.parent).dir) { add(n); pending.splice(i, 1); moved = true; }
        }
      }
    } else firstRun = true;
  } catch { firstRun = true; }

  const persist = () => {
    timer = 0;
    const out = [];
    for (const n of nodes.values()) if (!n.fixed && !n.ro) out.push(n);
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, nodes: out })); } catch (e) { bus.emit('fs:error', err('quota', '儲存空間不足，這次變更沒有存下來。')); }
  };
  const touch = () => { if (!timer) timer = setTimeout(persist, 150); bus.emit('fs'); };

  // ---------------- helpers
  const cleanName = (name) => {
    const s = String(name).trim();
    if (!s || s === '.' || s === '..' || s.length > 120 || /[\\/\u0000-\u001f]/.test(s)) throw err('name', '名稱不能是空的，也不能包含 / 或 \\。');
    return s;
  };
  const children = (dir) => [...(kids.get(dir.id) || [])].map((id) => nodes.get(id)).filter(Boolean)
    .sort((a, b) => (!!b.dir - !!a.dir) || a.name.localeCompare(b.name, 'zh-Hant', { numeric: true }));
  const childNamed = (dir, name) => { const low = name.toLowerCase(); for (const id of kids.get(dir.id) || []) { const n = nodes.get(id); if (n && n.name.toLowerCase() === low) return n; } return null; };
  const free = (dir, name) => {
    if (!childNamed(dir, name)) return name;
    const e = extOf(name), stem = e ? name.slice(0, -e.length - 1) : name;
    for (let i = 2; ; i++) { const s = `${stem} (${i})${e ? `.${e}` : ''}`; if (!childNamed(dir, s)) return s; }
  };
  const within = (node, dir) => { for (let n = dir; n; n = nodes.get(n.parent)) if (n === node) return true; return false; };
  const inTrash = (node) => within(nodes.get('trash'), node) && node.id !== 'trash';
  const writable = (dir) => { if (!dir || !dir.dir) throw err('dir', '目的地不是資料夾。'); if (dir.ro || dir.id === 'root') throw err('ro', '這個位置是唯讀的。'); };
  const movable = (node) => { if (node.fixed || node.ro) throw err('ro', `「${LABEL[node.id] || node.name || '這個項目'}」是系統項目，不能更動。`); };
  const kind = (n) => (n.dir ? 'dir' : n.app ? 'link' : (() => { const e = extOf(n.name); for (const k in EXT) if (EXT[k].includes(e)) return k; const m = n.mime || ''; return m.startsWith('text/') ? 'text' : m.startsWith('image/') ? 'image' : m.startsWith('audio/') ? 'audio' : m.startsWith('video/') ? 'video' : n.text != null ? 'text' : 'file'; })());

  const pathOf = (node) => {
    const parts = [];
    for (let n = node; n && n.id !== 'root'; n = nodes.get(n.parent)) parts.unshift(n.name);
    return `/${parts.join('/')}`;
  };
  const resolve = (path, cwd = nodes.get('home')) => {
    let p = String(path || '').trim();
    if (p === '~' || p.startsWith('~/')) p = `/Home${p.slice(1)}`;
    let cur = p.startsWith('/') ? nodes.get('root') : cwd;
    for (const part of p.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { cur = nodes.get(cur.parent) || cur; continue; }
      if (!cur.dir) return null;
      cur = childNamed(cur, part);
      if (!cur) return null;
    }
    return cur;
  };

  const sizeOf = (n) => (n.dir ? children(n).reduce((s, c) => s + sizeOf(c), 0) : n.size || 0);
  const walk = (n, fn) => { fn(n); if (n.dir) for (const c of children(n)) walk(c, fn); };

  const fs = {
    get volatile() { return volatile; },
    get firstRun() { return firstRun; },
    get: (id) => nodes.get(id) || null,
    root: nodes.get('root'),
    home: nodes.get('home'),
    dir: (id) => nodes.get(id),
    children, resolve, kind, free, inTrash,
    path: pathOf,
    parent: (n) => nodes.get(n.parent) || null,
    label: (n) => LABEL[n.id] || n.name,
    /** The node itself cannot be renamed, moved or deleted. */
    isRO: (n) => !!(n.ro || n.fixed),
    /** Files can be created in, or moved into, this folder. */
    canWrite: (d) => !!d && !!d.dir && !d.ro && d.id !== 'root',
    size: sizeOf,
    named: childNamed,

    mkdir(dir, name) {
      writable(dir);
      const n = add({ id: uid(), name: free(dir, cleanName(name)), dir: true, parent: dir.id, mtime: Date.now(), ctime: Date.now() });
      touch();
      return n;
    },
    /** Creates a file. `text` for a text file, `blob` for bytes, `app` for a shortcut to an application. */
    async create(dir, name, { text, blob, mime, app, args, exact = false } = {}) {
      writable(dir);
      name = cleanName(name);
      if (exact && childNamed(dir, name)) throw err('exists', `這裡已經有「${name}」。`);
      const n = { id: uid(), name: free(dir, name), parent: dir.id, mtime: Date.now(), ctime: Date.now() };
      if (app) { n.app = app; if (args) n.args = args; n.size = 0; }
      else if (blob) {
        if (blob.size > BLOB_MAX) throw err('big', '檔案太大（上限 200 MB）。');
        try { await putBlob(n.id, blob); } catch { throw err('quota', '瀏覽器沒有足夠空間存放這個檔案。'); }
        n.blob = true; n.size = blob.size; n.mime = mime || blob.type || MIME[extOf(name)] || 'application/octet-stream';
      } else {
        const s = String(text ?? '');
        const size = enc.encode(s).length;
        if (size > TEXT_MAX) throw err('big', '文字檔太大（上限 512 KB）。');
        n.text = s; n.size = size; n.mime = mime || MIME[extOf(name)] || 'text/plain';
      }
      add(n);
      touch();
      return n;
    },
    writeText(node, text) {
      if (node.ro) throw err('ro', '這個檔案是唯讀的。');
      if (node.dir || node.blob || node.app) throw err('kind', '這不是文字檔。');
      const s = String(text), size = enc.encode(s).length;
      if (size > TEXT_MAX) throw err('big', '文字檔太大（上限 512 KB）。');
      node.text = s; node.size = size; node.mtime = Date.now();
      const u = urls.get(node.id); if (u) { URL.revokeObjectURL(u); urls.delete(node.id); }
      touch();
    },
    async blob(node) {
      if (node.dir) throw err('kind', '資料夾沒有內容可讀。');
      if (node.url) { const r = await fetch(node.url); if (!r.ok) throw err('io', `讀取失敗（${r.status}）。`); return r.blob(); }
      if (node.blob) { const b = await getBlob(node.id); if (!b) throw err('io', '找不到這個檔案的內容（可能已被瀏覽器清除）。'); return b; }
      return new Blob([node.text ?? ''], { type: node.mime || 'text/plain' });
    },
    async text(node) {
      if (node.text != null) return node.text;
      return (await fs.blob(node)).text();
    },
    /** A URL an <img>, <audio> or <video> can load. */
    async url(node) {
      if (node.url) return node.url;
      if (!urls.has(node.id)) urls.set(node.id, URL.createObjectURL(await fs.blob(node)));
      return urls.get(node.id);
    },
    rename(node, name) {
      movable(node);
      name = cleanName(name);
      const dir = nodes.get(node.parent), hit = childNamed(dir, name);
      if (hit && hit !== node) throw err('exists', `這裡已經有「${name}」。`);
      node.name = name; node.mtime = Date.now();
      touch();
    },
    move(node, dir, { keepFrom = false } = {}) {
      movable(node); writable(dir);
      if (node.parent === dir.id) return node;
      if (node.dir && within(node, dir)) throw err('loop', '不能把資料夾移進它自己裡面。');
      kids.get(node.parent)?.delete(node.id);
      node.name = free(dir, node.name);
      node.parent = dir.id;
      if (!keepFrom) delete node.from;
      kids.get(dir.id).add(node.id);
      touch();
      return node;
    },
    async copy(node, dir, name = node.name) {
      writable(dir);
      if (node.dir) {
        if (within(node, dir)) throw err('loop', '不能把資料夾複製進它自己裡面。');
        const d = fs.mkdir(dir, name);
        for (const c of children(node)) await fs.copy(c, d);
        return d;
      }
      if (node.app) return fs.create(dir, name, { app: node.app, args: node.args });
      if (node.text != null) return fs.create(dir, name, { text: node.text, mime: node.mime });
      return fs.create(dir, name, { blob: await fs.blob(node), mime: node.mime });
    },
    trash(node) {
      movable(node);
      if (inTrash(node)) return;
      const from = node.parent;
      fs.move(node, nodes.get('trash'));
      node.from = from; node.gone = Date.now();
      touch();
    },
    /** Back to where it was deleted from (or the home folder, when that place is gone). */
    restore(node) {
      const dest = nodes.get(node.from);
      const dir = dest && dest.dir && !inTrash(dest) && dest.id !== 'trash' ? dest : nodes.get('home');
      delete node.gone;
      return fs.move(node, dir);
    },
    async remove(node) {
      movable(node);
      const all = [];
      walk(node, (n) => all.push(n));
      for (const n of all.reverse()) { if (n.blob) await delBlob(n.id); drop(n); }
      touch();
    },
    async emptyTrash() { for (const n of children(nodes.get('trash'))) await fs.remove(n); },
    usage() {
      let text = 0, blobs = 0, count = 0;
      for (const n of nodes.values()) { if (n.fixed || n.ro || n.dir) continue; count++; if (n.blob) blobs += n.size || 0; else text += n.size || 0; }
      return { text, blobs, count };
    },
    find(query, max = 40) {
      const q = String(query).trim().toLowerCase(), out = [];
      if (!q) return out;
      for (const n of nodes.values()) {
        if (n.id === 'root' || inTrash(n)) continue;
        if (fs.label(n).toLowerCase().includes(q) || n.name.toLowerCase().includes(q)) { out.push(n); if (out.length >= max) break; }
      }
      return out;
    },
    /** What a new system starts with. */
    async seed() {
      const d = nodes.get('desktop');
      const made = [];
      for (const [app, name] of [['files', '檔案總管'], ['sakura', '長門櫻'], ['browser', '瀏覽器'], ['arcade', '遊戲中心'], ['terminal', '終端機'], ['settings', '設定']]) made.push(await fs.create(d, name, { app }));
      made.push(await fs.create(d, '歡迎.txt', { text: WELCOME }));
      fs.seedOrder = made.map((n) => n.id);
      await fs.create(nodes.get('docs'), '快捷鍵.txt', { text: KEYS });
      firstRun = false;
    },
    async reset() {
      for (const n of [...nodes.values()]) if (!n.fixed && !n.ro) { if (n.blob) await delBlob(n.id); drop(n); }
      await fs.seed();
      touch();
    },
    flush() { if (timer) { clearTimeout(timer); persist(); } },
    dispose() { fs.flush(); urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); try { db?.close(); } catch { /* closed */ } },
  };
  if (firstRun) await fs.seed();
  return fs;
}
