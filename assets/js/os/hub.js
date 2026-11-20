// The hub: one panel on the left edge with two states.
//   side   the widget board (the bar's widgets button) — cards of three heights that can be added, removed,
//          resized and dragged into order
//   full   the start screen (the "平板" start style) — the same board as a column, and every application as a
//          tile beside it; tiles are dragged into any order, between groups, or out into a group of their own
// Widgets only run while the panel is open: closing it stops their clocks and their measuring.
import { h, ico, btn, tool, nodeTile, arrowNav, when } from './ui.js';
import { svg } from './icons.js';
import { APPS, CATS, appById } from './apps.js';
import { SCENES, WALLS, two, bytes, uid, clamp } from './kernel.js';
import { lunar } from './lib/lunar.js';
import { APP_TYPE } from './start.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const TYPE = 'application/x-nxos-widget';
const SIZE = { 1: 'S', 2: 'M', 3: 'L' };
const CAT_EN = { sys: 'SYSTEM', app: 'APPLICATIONS', media: 'MEDIA' };
const ART = { sakura: 'wall-night-thumb', gallery: 'wall-blade-thumb' };   // tiles that wear an illustration when they are wide or large

// ---------------------------------------------------------------- frame-rate sampler, shared by every performance widget
const sampler = {
  users: 0, raf: 0, frames: 0, last: 0, prev: 0, worst: 0, fps: 0, series: [], subs: new Set(),
  loop(t) {
    sampler.raf = requestAnimationFrame(sampler.loop);
    if (sampler.prev) sampler.worst = Math.max(sampler.worst, t - sampler.prev);
    sampler.prev = t; sampler.frames += 1;
    if (t - sampler.last >= 1000) {
      sampler.fps = (sampler.frames * 1000) / (t - sampler.last);
      sampler.series.push({ fps: sampler.fps, worst: sampler.worst });
      if (sampler.series.length > 60) sampler.series.shift();
      sampler.frames = 0; sampler.last = t; sampler.worst = 0;
      sampler.subs.forEach((fn) => fn());
    }
  },
  use(fn) {
    sampler.subs.add(fn);
    if (!sampler.users++) { sampler.last = performance.now(); sampler.prev = 0; sampler.frames = 0; sampler.raf = requestAnimationFrame(sampler.loop); }
    return () => { sampler.subs.delete(fn); if (!--sampler.users) { cancelAnimationFrame(sampler.raf); sampler.series.length = 0; sampler.fps = 0; } };
  },
};

export function createHub(os, sh) {
  const { cfg, fs, wm, bus } = os;
  let mode = 'side', mounted = [], live = false, freshTimer = 0;

  // ================================================================ widgets
  const rows = (list) => h('dl', { class: 'os-wd__rows' }, list.map(([a, b]) => h('div', null, h('dt', null, a), b && b.nodeType ? b : h('dd', null, b))));
  const WIDGETS = {
    clock: { name: '時鐘', icon: 'clock', sizes: [1, 2, 3], make(body, size, x) {
      const t = h('b'), s = h('i'), d = h('p', { class: 'wd-clock__date' }), l = h('p', { class: 'wd-clock__lunar' });
      let hands = null;
      if (size === 3) {
        const ticks = Array.from({ length: 60 }, (_, i) => `<path d="M60 ${i % 5 ? 9 : 6}v${i % 5 ? 3 : 8}" transform="rotate(${i * 6} 60 60)"${i % 15 ? '' : ' class="q"'}/>`).join('');
        const dial = h('div', { class: 'wd-clock__dial', html: `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="57"/>${ticks}<path class="h" d="M60 60V30"/><path class="m" d="M60 60V17"/><path class="s" d="M60 68V13"/><path class="c" d="M57 57h6v6h-6z"/></svg>` });
        hands = ['h', 'm', 's'].map((k) => dial.querySelector(`.${k}`));
        body.append(dial);
      }
      body.append(h('div', { class: 'wd-clock' }, h('p', { class: 'wd-clock__time' }, t, s), size > 1 ? d : null, size > 1 ? l : null));
      x.every(1000, () => {
        const now = new Date(), hr = cfg.get('hour12') ? now.getHours() % 12 || 12 : now.getHours(), lu = lunar(now);
        t.textContent = `${two(hr)}:${two(now.getMinutes())}`; s.textContent = two(now.getSeconds());
        d.textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日　星期${WEEK[now.getDay()]}`;
        l.textContent = lu ? `農曆${lu.text}` : Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (hands) [((now.getHours() % 12) + now.getMinutes() / 60) * 30, (now.getMinutes() + now.getSeconds() / 60) * 6, now.getSeconds() * 6].forEach((deg, i) => hands[i].setAttribute('transform', `rotate(${deg.toFixed(1)} 60 60)`));
      });
    } },
    cal: { name: '月曆', icon: 'calendar', sizes: [2, 3], make(body, size, x) {
      const draw = () => {
        const now = new Date(), y = now.getFullYear(), m = now.getMonth();
        const cell = (d, out) => { const lu = size === 2 ? lunar(d) : null; return h('span', { class: `${out ? 'is-out' : ''}${d.toDateString() === now.toDateString() ? ' is-today' : ''}`.trim() }, size === 2 ? h('em', null, WEEK[d.getDay()]) : null, h('b', null, String(d.getDate())), lu ? h('i', null, lu.day === 1 ? lu.month : lu.name) : null); };
        if (size === 2) {
          const start = new Date(y, m, now.getDate() - now.getDay());
          body.replaceChildren(h('p', { class: 'wd-cal__head' }, h('b', null, `${y} 年 ${m + 1} 月`), h('span', null, `第 ${Math.ceil((now.getDate() + new Date(y, m, 1).getDay()) / 7)} 週`)), h('div', { class: 'wd-cal wd-cal--week' }, Array.from({ length: 7 }, (_, i) => cell(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), false))));
        } else {
          const first = new Date(y, m, 1).getDay(), weeks = Math.ceil((first + new Date(y, m + 1, 0).getDate()) / 7);
          body.replaceChildren(h('p', { class: 'wd-cal__head' }, h('b', null, `${y} 年 ${m + 1} 月`), h('span', null, `${now.getMonth() + 1}/${now.getDate()} 星期${WEEK[now.getDay()]}`)),
            h('div', { class: 'wd-cal wd-cal--head' }, WEEK.map((w) => h('em', null, w))),
            h('div', { class: 'wd-cal' }, Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(y, m, i - first + 1); return cell(d, d.getMonth() !== m); })));
        }
      };
      let day = new Date().getDate();
      draw();
      x.every(30000, () => { if (new Date().getDate() !== day) { day = new Date().getDate(); draw(); } });
    } },
    perf: { name: '效能', icon: 'pulse', sizes: [1, 2, 3], make(body, size, x) {
      const fps = h('b', null, '--'), sub = h('span'), graph = size > 1 ? h('canvas', { class: 'wd-perf__graph' }) : null, more = size === 3 ? h('div') : null;
      body.append(h('button', { type: 'button', class: 'wd-perf', title: '開啟系統監控', onclick: () => { sh.close('hub'); os.launch('monitor', { tab: 'perf' }); } }, h('p', { class: 'wd-perf__big' }, fps, h('i', null, 'FPS'), sub), graph, more));
      const draw = () => {
        const mem = performance.memory, cur = sampler.series.at(-1);
        fps.textContent = sampler.fps ? sampler.fps.toFixed(0) : '--';
        sub.textContent = mem ? `JS ${bytes(mem.usedJSHeapSize)}` : `${wm.wins.length} 個視窗`;
        if (more) more.replaceChildren(rows([['最慢的一幀', cur ? `${cur.worst.toFixed(1)} ms` : '—'], ['DOM 節點', String(document.getElementsByTagName('*').length)], ['視窗', `${wm.wins.length} 個`], ['桌布', os.root.dataset.wall === 'live' ? 'WebGL 即時場景' : '靜態']]));
        if (!graph || !graph.clientWidth) return;
        const w = graph.clientWidth, hh = graph.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
        graph.width = Math.round(w * dpr); graph.height = Math.round(hh * dpr);
        const g = graph.getContext('2d'), css = getComputedStyle(graph), top = Math.max(60, ...sampler.series.map((v) => v.fps)) * 1.12;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.strokeStyle = css.getPropertyValue('--line').trim() || 'rgba(236,235,229,.14)'; g.lineWidth = 1;
        for (const v of [30, 60]) { const y = Math.round(hh - (v / top) * hh) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        if (sampler.series.length < 2) return;
        const px = (i) => w - (sampler.series.length - 1 - i) * (w / 59), py = (v) => hh - (Math.min(top, v) / top) * hh;
        g.beginPath();
        sampler.series.forEach((v, i) => { if (i) g.lineTo(px(i), py(v.fps)); else g.moveTo(px(i), py(v.fps)); });
        g.strokeStyle = css.getPropertyValue('--hot').trim() || '#ffc400'; g.lineWidth = 1.5; g.stroke();
        g.lineTo(w, hh); g.lineTo(px(0), hh); g.closePath();
        g.globalAlpha = 0.12; g.fillStyle = g.strokeStyle; g.fill(); g.globalAlpha = 1;
      };
      x.off(sampler.use(draw));
      draw();
    } },
    storage: { name: '儲存空間', icon: 'hdd', sizes: [1, 2], make(body, size, x) {
      const used = h('b', null, '…'), of = h('span'), bar = h('i', { class: 'wd-store__bar' }), more = size > 1 ? h('div') : null;
      body.append(h('button', { type: 'button', class: 'wd-store', title: '開啟儲存空間設定', onclick: () => { sh.close('hub'); os.launch('settings', { page: 'storage' }); } }, h('p', null, used, of), bar, more));
      const draw = async () => {
        const u = fs.usage();
        let est = null;
        try { est = await navigator.storage?.estimate?.(); } catch { est = null; }
        if (!body.isConnected) return;
        const mine = u.text + u.blobs;
        used.textContent = bytes(est && est.usage != null ? est.usage : mine);
        of.textContent = est && est.quota ? `／ 瀏覽器上限約 ${bytes(est.quota)}` : '檔案與設定';
        bar.style.setProperty('--k', `${clamp(est && est.quota ? (est.usage / est.quota) * 100 : 0, 0.5, 100)}%`);
        if (more) more.replaceChildren(rows([['檔案', `${u.count} 個 · ${bytes(mine)}`], ['垃圾桶', `${fs.children(fs.dir('trash')).length} 個項目`]]));
      };
      draw();
      x.off(bus.on('fs', draw));
    } },
    media: { name: '正在播放', icon: 'music', sizes: [1], make(body, size, x) {
      const draw = () => {
        const m = os.media;
        body.replaceChildren(m
          ? h('div', { class: 'wd-media' }, h('div', null, h('b', null, m.title), h('i', null, m.playing ? '播放中' : '已暫停')), tool('prev', '上一首', { onclick: () => m.prev() }), tool(m.playing ? 'pause' : 'play', m.playing ? '暫停' : '播放', { class: 'os-tool is-main', onclick: () => m.toggle() }), tool('next', '下一首', { onclick: () => m.next() }))
          : h('div', { class: 'wd-media' }, h('div', null, h('b', null, '沒有播放中的媒體'), h('i', null, 'IDLE')), btn('開啟播放器', { onclick: () => { sh.close('hub'); os.launch('media'); } })));
      };
      draw();
      x.off(bus.on('media', draw));
    } },
    memo: { name: '便條', icon: 'note', sizes: [2, 3], make(body, size, x) {
      const ta = h('textarea', { class: 'wd-memo', placeholder: '寫點什麼。內容會自動留在這個瀏覽器裡。', spellcheck: false, 'aria-label': '便條', value: cfg.get('memo') });
      ta.addEventListener('input', () => cfg.set('memo', ta.value.slice(0, 4000)));
      body.append(ta);
      x.off(bus.on('cfg:memo', (v) => { if (document.activeElement !== ta) ta.value = v; }));
    } },
    recent: { name: '最近的檔案', icon: 'history', sizes: [2, 3], make(body, size, x) {
      const draw = () => {
        const list = sh.recent(size === 3 ? 6 : 3);
        body.replaceChildren(list.length
          ? h('div', { class: 'wd-recent' }, list.map((n) => h('button', { type: 'button', onclick: () => { sh.close('hub'); os.openNode(n); } }, nodeTile(os, n, 'os-tile--s'), h('span', null, h('b', null, fs.label(n)), h('i', null, `${fs.label(fs.parent(n))} · ${when(n.mtime)}`)))))
          : h('p', { class: 'os-wd__none' }, '還沒有開啟過檔案。'));
      };
      draw();
      x.off(bus.on('cfg:recent', draw)); x.off(bus.on('fs', draw));
    } },
    scene: { name: '場景', icon: 'image', sizes: [1, 2], make(body, size, x) {
      const no = h('b'), name = h('span'), en = h('i'), cam = h('dd', null, '—'), t = h('dd');
      body.append(h('div', { class: 'wd-scene' }, tool('chevL', '上一個工作區', { onclick: () => wm.setWs(wm.ws - 1) }), h('p', null, no, name, en), tool('chevR', '下一個工作區', { onclick: () => wm.setWs(wm.ws + 1) })),
        size > 1 ? rows([['TIMELINE', t], ['CAMERA', cam]]) : null);
      const draw = () => {
        const spaces = cfg.get('spaces'), s = spaces[wm.ws] || spaces[0], sc = SCENES[s.scene] || SCENES.gate, on = os.root.dataset.wall === 'live';
        no.textContent = two(wm.ws + 1); name.textContent = s.name; en.textContent = on ? sc.en : 'STILL IMAGE';
        t.textContent = on ? `T ${sc.t.toFixed(2)}` : '—';
      };
      draw();
      x.off(bus.on('ws', draw)); x.off(bus.on('cfg:spaces', draw)); x.off(bus.on('cfg:wall', () => setTimeout(draw, 80)));
      if (size > 1) x.every(250, () => { const p = os.env.stage.read(); cam.textContent = p ? `${p.x.toFixed(1)}  ${p.y.toFixed(1)}  ${p.z.toFixed(1)}` : '—'; });
    } },
    ask: { name: '問長門櫻', icon: 'sakura', sizes: [1], make(body) {
      const input = h('input', { class: 'os-input', type: 'text', placeholder: '例如：打開終端機、換到神樹', 'aria-label': '問長門櫻', autocomplete: 'off' });
      const go = () => { const text = input.value.trim(); if (!text) return; input.value = ''; sh.close('hub'); os.launch('sakura', { ask: text }); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) go(); });
      body.append(h('div', { class: 'wd-ask' }, input, tool('send', '送出', { onclick: go })));
    } },
    timer: { name: '專注計時', icon: 'timer', sizes: [1], make(body, size, x) {
      const tb = sh.timerBar();
      body.append(tb.el);
      x.off(bus.on('timer', tb.draw)); x.off(bus.on('cfg:focusMin', tb.draw));
    } },
  };

  // ================================================================ the panel
  const col = h('div', { class: 'os-hub__col', role: 'list', 'aria-label': '小工具' });
  const tiles = h('div', { class: 'os-hub__tiles', 'aria-label': '所有應用程式' });
  const title = h('b'), tag = h('span');
  const t = {
    col: tool('sideL', '顯示或隱藏小工具欄'),
    add: tool('plus', '新增小工具', { 'aria-haspopup': 'menu' }),
    close: tool('close', '關閉'),
    power: tool('power', '電源', { 'aria-haspopup': 'menu' }),
    user: h('button', { type: 'button', class: 'os-hub__user', 'aria-haspopup': 'menu', 'aria-label': '使用者' }, h('span', null, h('b', { data: { id: 'nameZh' } }, '天野靜樹'), h('i', null, 'LOCAL SESSION')), h('img', { src: '/assets/img/amano-face.webp', alt: '', width: 40, height: 40 })),
  };
  const el = h('aside', { class: 'os-hub', 'aria-label': '小工具與開始畫面', tabindex: '-1', data: { mode } },
    h('div', { class: 'os-hub__map', 'aria-hidden': 'true' }),
    h('header', { class: 'os-hub__head' }, h('div', { class: 'os-hub__title' }, title, tag), h('div', { class: 'os-hub__tools' }, t.col, t.add, t.close), h('div', { class: 'os-hub__who' }, t.user, t.power)),
    h('div', { class: 'os-hub__main' }, col, tiles));
  os.env.identity?.(el);

  const board = () => cfg.get('widgets').filter((w) => w && WIDGETS[w.type]);
  function unmount() { mounted.forEach((m) => m.dispose()); mounted = []; }
  function mount() {
    unmount();
    const list = board();
    const cards = list.map((w) => {
      const def = WIDGETS[w.type], size = def.sizes.includes(w.size) ? w.size : def.sizes[0];
      const body = h('div', { class: 'os-wd__body' });
      const cleanup = [];
      const ctl = h('span', { class: 'os-wd__ctl' },
        def.sizes.length > 1 ? h('button', { type: 'button', class: 'os-wd__size', title: '調整大小', 'aria-label': `調整大小，目前 ${SIZE[size]}`, onclick: () => resize(w.id, def.sizes[(def.sizes.indexOf(size) + 1) % def.sizes.length]) }, SIZE[size]) : null,
        tool('close', '移除這個小工具', { onclick: () => cfg.set('widgets', board().filter((v) => v.id !== w.id)) }));
      const head = h('header', { class: 'os-wd__head', draggable: 'true' }, ico(def.icon), h('b', null, def.name), h('span', { class: 'os-wd__grip', html: svg('grip'), 'aria-hidden': 'true' }), ctl);
      const card = h('section', { class: `os-wd os-wd--${w.type}`, role: 'listitem', data: { id: w.id, size }, style: { '--i': mounted.length } }, head, body);
      try {
        def.make(body, size, {
          off: (fn) => cleanup.push(fn),
          every: (ms, fn) => { const id = setInterval(fn, ms); cleanup.push(() => clearInterval(id)); fn(); },
        });
      } catch (e) { console.error(`[os] widget ${w.type}`, e); body.replaceChildren(h('p', { class: 'os-wd__none' }, '這個小工具無法載入。')); }
      mounted.push({ id: w.id, dispose: () => cleanup.forEach((f) => { try { f(); } catch { /* already gone */ } }) });
      return card;
    });
    col.replaceChildren(...(cards.length ? cards : [h('div', { class: 'os-hub__empty' }, ico('widgets'), h('b', null, '面板上還沒有小工具'), btn('新增小工具', { icon: 'plus', onclick: () => addMenu(t.add) }))]));
  }
  const resize = (id, size) => cfg.set('widgets', board().map((w) => (w.id === id ? { ...w, size } : w)));
  function addMenu(anchor) {
    const have = new Set(board().map((w) => w.type));
    const items = Object.entries(WIDGETS).map(([type, def]) => ({ label: def.name, icon: def.icon, checked: have.has(type), action: () => cfg.set('widgets', have.has(type) ? board().filter((w) => w.type !== type) : [...board(), { id: uid(), type, size: def.sizes.includes(2) ? 2 : def.sizes[0] }]) }));
    os.ui.menu([...items, '-', { label: '恢復預設的小工具', icon: 'restart', action: () => cfg.set('widgets', undefined) }], { anchor, side: 'bottom', align: 'end' });
  }

  // ---------------- drag a card by its header to reorder
  let dragId = null;
  col.addEventListener('dragstart', (e) => {
    const card = e.target.closest?.('.os-wd');
    if (!card || !e.target.closest('.os-wd__head')) return;
    dragId = card.dataset.id;
    e.dataTransfer.setData(TYPE, dragId);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setDragImage(card, 24, 18); } catch { /* not supported */ }
    setTimeout(() => card.classList.add('is-drag'));
  });
  col.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const me = col.querySelector(`.os-wd[data-id="${dragId}"]`), over = e.target.closest?.('.os-wd');
    if (!me || !over || over === me) return;
    const r = over.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
    if (after ? over.nextSibling !== me : over.previousSibling !== me) over[after ? 'after' : 'before'](me);
  });
  col.addEventListener('drop', (e) => {
    if (!dragId) return;
    e.preventDefault(); e.stopPropagation();
    const order = [...col.querySelectorAll('.os-wd')].map((c) => c.dataset.id), list = board();
    dragId = null;
    cfg.set('widgets', order.map((id) => list.find((w) => w.id === id)).filter(Boolean));
  });
  col.addEventListener('dragend', () => { if (dragId) { dragId = null; mount(); } });

  // ================================================================ tiles
  function liveOf(app, size) {
    if (size === 's') return null;
    if (app.id === 'files') { const r = sh.recent(1)[0]; return [h('b', null, `${fs.usage().count} 個項目`), r ? h('i', null, `最近：${fs.label(r)}`) : null]; }
    if (app.id === 'media') { const m = os.media; return [h('b', null, m ? m.title : '沒有播放中的媒體'), h('i', null, m ? (m.playing ? '播放中' : '已暫停') : 'IDLE')]; }
    if (app.id === 'settings') { const wall = cfg.get('wall'), img = WALLS.find((w) => `img:${w.id}` === wall); return [h('b', null, wall === 'live' ? '即時場景' : img ? img.name : wall === 'solid' ? '純色桌布' : '自己的圖片'), h('i', null, `${cfg.get('tone') === 'light' ? '淺色' : '深色'}面板`)]; }
    if (app.id === 'monitor') return [h('b', null, `${wm.wins.length} 個視窗`), h('i', null, `${cfg.get('spaces').length} 個工作區`)];
    if (app.id === 'sakura') return [h('b', null, '「主人，需要我做什麼？」'), h('i', null, '依關鍵字辦事 · 不連網')];
    return null;
  }
  /** The groups as they are stored, made whole: unknown and repeated applications dropped, new ones added to the group of their kind. */
  function groups() {
    const seen = new Set();
    const list = cfg.get('tiles').filter((g) => g && Array.isArray(g.apps)).map((g, i) => ({
      id: String(g.id || `g${i}`), name: String(g.name || '群組').slice(0, 16),
      apps: g.apps.filter((id) => { const a = appById(id); if (!a || !a.cat || seen.has(id)) return false; seen.add(id); return true; }),
    }));
    for (const a of APPS) {
      if (!a.cat || seen.has(a.id)) continue;
      let g = list.find((x) => x.id === a.cat) || list.at(-1);
      if (!g) { g = { id: a.cat, name: CATS.find((c) => c[0] === a.cat)?.[1] || '應用程式', apps: [] }; list.push(g); }
      g.apps.push(a.id);
    }
    return list.filter((g) => g.apps.length);
  }
  const saveGroups = (list) => cfg.set('tiles', list.filter((g) => g.apps.length).map(({ id, name, apps }) => ({ id, name, apps })));
  /** Moves a tile: to another group (`to` — null makes a new one), or `by` places along its own. */
  function moveTile(id, { to, by }) {
    const list = groups(), from = list.find((g) => g.apps.includes(id));
    if (!from) return;
    const at = from.apps.indexOf(id);
    if (by) {
      const flat = list.flatMap((g) => g.apps.map((a) => [g, a])), i = flat.findIndex((x) => x[1] === id), j = i + by;
      if (j < 0 || j >= flat.length) return;
      const [g2, other] = flat[j];
      from.apps.splice(at, 1);
      g2.apps.splice(g2.apps.indexOf(other) + (g2 === from ? (by > 0 ? 1 : 0) : by > 0 ? 0 : 1), 0, id);
    } else {
      from.apps.splice(at, 1);
      const dest = to ? list.find((g) => g.id === to) : null;
      if (dest) dest.apps.push(id); else list.push({ id: `g-${uid()}`, name: '新群組', apps: [id] });
    }
    saveGroups(list);
  }
  function tileMenu(id, at) {
    const list = groups(), mine = list.find((g) => g.apps.includes(id));
    sh.appMenu(id, at, { tiles: true, extra: [
      { label: '移到群組', icon: 'spaces', sub: [...list.map((g) => ({ label: g.name, checked: g === mine, action: () => { if (g !== mine) moveTile(id, { to: g.id }); } })), '-', { label: '新群組', icon: 'plus', action: () => moveTile(id, { to: null }) }] },
      { label: '往前移', icon: 'chevL', action: () => moveTile(id, { by: -1 }) },
      { label: '往後移', icon: 'chevR', action: () => moveTile(id, { by: 1 }) },
    ] });
  }
  function groupMenu(gid, at) {
    const list = groups(), g = list.find((x) => x.id === gid);
    os.ui.menu([
      g ? { label: '重新命名群組', icon: 'edit', action: async () => { const name = await os.ui.prompt('群組名稱', g.name, { title: '重新命名群組' }); if (name && name.trim()) { g.name = name.trim().slice(0, 16); saveGroups(list); } } } : null,
      { label: '恢復預設的排列', icon: 'restart', action: () => cfg.set('tiles', undefined) },
    ], at);
  }
  function drawTiles() {
    if (drag) return;                       // a tile is in the hand: the page keeps still until it is put down
    const sizes = cfg.get('tileSize');
    let i = 0;
    const tile = (a) => {
      const size = ['s', 'w', 'l'].includes(sizes[a.id]) ? sizes[a.id] : 's', art = size !== 's' && ART[a.id], info = liveOf(a, size), n = wm.byApp(a.id).length;
      // not a <button>: Firefox does not drag those
      return h('div', { class: `os-tl${art ? ' os-tl--art' : ''}`, role: 'button', tabindex: '0', draggable: 'true', data: { app: a.id, size }, style: { '--tint': a.tint, '--i': i++, ...(art ? { '--art': `url("/assets/img/os/${art}.webp")` } : {}) }, 'aria-label': a.name },
        h('span', { class: 'os-tl__code' }, a.code), n ? h('em', null, n > 1 ? `${n} 個視窗` : '執行中') : null,
        h('span', { class: 'os-tl__ico', html: svg(a.icon) }),
        info ? h('span', { class: 'os-tl__live' }, info) : null,
        h('span', { class: 'os-tl__name' }, h('b', null, a.name), h('i', null, a.en)));
    };
    tiles.replaceChildren(
      ...groups().map((g, gi) => h('section', { class: 'os-tg', data: { g: g.id, name: g.name } },
        h('h3', null, h('b', null, g.name), h('span', null, CATS.some((c) => c[0] === g.id && c[1] === g.name) ? CAT_EN[g.id] : `GROUP ${two(gi + 1)}`)),
        h('div', { class: 'os-tg__grid' }, g.apps.map((id) => tile(appById(id)))))),
      // where a tile is dropped to start a group of its own; only shown while one is being dragged
      h('section', { class: 'os-tg os-tg--new', data: { g: `g-${uid()}`, name: '新群組' } }, h('h3', null, h('b', null, '新群組'), h('span', null, 'DROP HERE')), h('div', { class: 'os-tg__grid' })));
    flow();
  }
  /** Tiles run in columns that scroll sideways when there is room, and in one page that scrolls down when there is not. */
  function flow() {
    const w = tiles.clientWidth, hgt = tiles.clientHeight;
    if (!w) return;
    const stack = w < 620 || hgt < 300;
    // the rows share the height that is there, so the tiles grow with the screen instead of leaving it empty
    const rowsN = stack ? 0 : hgt >= 1000 ? 5 : hgt >= 470 ? 4 : hgt >= 360 ? 3 : 2;
    const unit = stack ? 96 : clamp(Math.floor((hgt - 66 - (rowsN - 1) * 8) / rowsN), 84, 152), key = `${stack}|${unit}|${rowsN}`;
    if (key === flowKey) return;
    flowKey = key;
    tiles.dataset.flow = stack ? 'stack' : 'row';
    tiles.style.setProperty('--u', `${unit}px`);
    tiles.style.setProperty('--rows', String(rowsN || 1));
  }
  // measured a frame later: changing the layout inside the observer's own callback would loop
  let flowKey = '', flowRaf = 0;
  const ro = new ResizeObserver(() => { cancelAnimationFrame(flowRaf); flowRaf = requestAnimationFrame(flow); });
  ro.observe(tiles);
  tiles.addEventListener('click', (e) => { const b = e.target.closest('.os-tl'); if (b) { sh.close('hub'); os.launch(b.dataset.app); } });
  tiles.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('.os-tl'), head = e.target.closest('.os-tg h3');
    e.preventDefault(); e.stopPropagation();
    if (b) tileMenu(b.dataset.app, { x: e.clientX, y: e.clientY });
    else groupMenu(head ? head.parentNode.dataset.g : null, { x: e.clientX, y: e.clientY });
  });
  tiles.addEventListener('wheel', (e) => { if (tiles.dataset.flow !== 'row' || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || tiles.scrollWidth <= tiles.clientWidth) return; e.preventDefault(); tiles.scrollLeft += e.deltaY; }, { passive: false });

  // ---------------- a tile is moved by dragging it: within its group, into another, or out to a new one
  let drag = null, lastMove = 0;
  tiles.addEventListener('dragstart', (e) => {
    const b = e.target.closest?.('.os-tl');
    if (!b) return;
    drag = b.dataset.app;
    e.dataTransfer.setData(APP_TYPE, drag);
    e.dataTransfer.effectAllowed = 'move';
    os.ui.hideTip();
    setTimeout(() => { if (drag) { b.classList.add('is-drag'); tiles.classList.add('is-sorting'); } });
  });
  tiles.addEventListener('dragover', (e) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const me = tiles.querySelector(`.os-tl[data-app="${drag}"]`), over = e.target.closest('.os-tl'), sec = e.target.closest('.os-tg');
    if (!me || performance.now() - lastMove < 150) return;
    if (over && over !== me) {
      // before or after: which side of the tile's diagonal the pointer is on (holds for columns and for rows)
      const r = over.getBoundingClientRect(), k = (e.clientX - r.left) / r.width + (e.clientY - r.top) / r.height;
      const after = k > 1;
      if (after ? over.nextElementSibling === me : over.previousElementSibling === me) return;
      over[after ? 'after' : 'before'](me);
      lastMove = performance.now();
    } else if (!over && sec) {
      // over a group but not over a tile: join that group at its end. Inside its own group the gaps between
      // tiles mean nothing, or a tile would jump to the end every time it crossed one.
      const grid = sec.querySelector('.os-tg__grid');
      if (me.parentNode !== grid) { grid.append(me); lastMove = performance.now(); }
    }
  });
  tiles.addEventListener('drop', (e) => {
    if (!drag) return;
    e.preventDefault(); e.stopPropagation();
    const list = [...tiles.querySelectorAll('.os-tg')].map((s) => ({ id: s.dataset.g, name: s.dataset.name, apps: [...s.querySelectorAll('.os-tl')].map((x) => x.dataset.app) }));
    drag = null; tiles.classList.remove('is-sorting');
    saveGroups(list);
    drawTiles();
  });
  tiles.addEventListener('dragend', () => { if (drag) { drag = null; tiles.classList.remove('is-sorting'); drawTiles(); } });
  tiles.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.os-tl')) { e.preventDefault(); e.target.click(); } });

  // ================================================================ state
  function apply() {
    el.dataset.mode = mode;
    el.toggleAttribute('data-col', mode === 'side' || !!cfg.get('hubCol'));
    const s = cfg.get('spaces')[wm.ws] || cfg.get('spaces')[0];
    title.textContent = mode === 'full' ? '開始' : '小工具';
    tag.textContent = mode === 'full' ? `NAGATO SAKURA WEBOS　/　${two(wm.ws + 1)} ${s.name}` : 'WIDGET BOARD';
    t.col.hidden = mode !== 'full';
    t.col.setAttribute('aria-pressed', String(!!cfg.get('hubCol')));
    if (mode === 'full') drawTiles();
    sh.settle();
  }
  t.col.addEventListener('click', () => cfg.set('hubCol', !cfg.get('hubCol')));
  t.add.addEventListener('click', () => { if (mode === 'full' && !cfg.get('hubCol')) cfg.set('hubCol', true); addMenu(t.add); });
  t.close.addEventListener('click', () => sh.close('hub'));
  t.power.addEventListener('click', () => sh.powerMenu(t.power, 'bottom'));
  t.user.addEventListener('click', () => sh.userMenu(t.user, 'bottom'));
  el.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea')) return;
    if (e.key.startsWith('Arrow') && mode === 'full') { arrowNav(e, tiles, '.os-tl'); return; }
    if (mode === 'full' && e.key.length === 1 && e.key !== ' ' && !e.isComposing) { e.preventDefault(); sh.open('search', e.key); }
  });
  const offs = [
    bus.on('cfg', (k) => {
      if (!live) return;
      if (k === 'widgets') mount();
      if (k === 'hubCol') apply();
      if (mode === 'full' && ['tiles', 'tileSize', 'tone', 'wall', 'recent', 'spaces'].includes(k)) drawTiles();
    }),
    bus.on('wm', () => { if (live && mode === 'full') drawTiles(); }),
    bus.on('ws', () => { if (live) apply(); }),
    bus.on('media', () => { if (live && mode === 'full') drawTiles(); }),
  ];

  return {
    el,
    get mode() { return mode; },
    open(arg) {
      if (arg === 'side' || arg === 'full') mode = arg;
      const fresh = !live;
      live = true;
      apply();
      // the arrival is staged once; later redraws (a tile resized, a widget added) must not replay it
      if (fresh) { mount(); el.classList.remove('is-fresh'); void el.offsetWidth; el.classList.add('is-fresh'); clearTimeout(freshTimer); freshTimer = setTimeout(() => el.classList.remove('is-fresh'), 1300); }
      el.focus({ preventScroll: true });
    },
    close() { live = false; setTimeout(() => { if (!live) { unmount(); col.replaceChildren(); } }, 340); },
    dispose() { unmount(); ro.disconnect(); cancelAnimationFrame(flowRaf); clearTimeout(freshTimer); offs.forEach((f) => f()); },
  };
}
