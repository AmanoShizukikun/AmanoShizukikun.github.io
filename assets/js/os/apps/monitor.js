// System monitor. Every figure is measured in this tab; what a browser does not expose is shown as "not
// available" instead of being estimated.
import { h, btn } from '../ui.js';
import { bytes, span, two } from '../kernel.js';
import { appById } from '../apps.js';

const NA = '這個瀏覽器不提供';

export function start(os, win, args = {}) {
  const { fs, wm } = os;
  let tab = args.tab || 'proc', raf = 0, frames = 0, last = performance.now(), fps = 0, worst = 0, long = 0;
  const series = [];                                     // one frame rate per second, the last two minutes
  const tabs = h('div', { class: 'nx-seg mn-tabs', role: 'group' }, [['proc', '處理程序'], ['perf', '效能'], ['disk', '儲存'], ['sys', '系統']].map(([v, l]) => h('button', { type: 'button', data: { v } }, l)));
  const body = h('div', { class: 'mn-body' });
  win.body.append(h('div', { class: 'mn' }, h('div', { class: 'mn-top' }, tabs), body));

  // ---------------- measuring
  let prev = 0;
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (prev) worst = Math.max(worst, t - prev);
    prev = t;
    frames += 1;
    if (t - last >= 1000) {
      fps = (frames * 1000) / (t - last);
      series.push({ fps, worst }); if (series.length > 120) series.shift();
      frames = 0; last = t; worst = 0;
      if (tab === 'perf') drawPerf();
    }
  };
  raf = requestAnimationFrame(loop);
  let po = null;
  try { po = new PerformanceObserver((l) => { long += l.getEntries().length; }); po.observe({ entryTypes: ['longtask'] }); } catch { po = null; }

  const rows = (list) => h('dl', { class: 'os-rows' }, list.map(([a, v]) => h('div', null, h('dt', null, a), h('dd', null, v))));
  const meter = (label, value, k, sub) => h('div', { class: 'mn-meter' }, h('header', null, h('span', null, label), h('b', null, value)), h('i', { style: { '--k': `${Math.max(0, Math.min(1, k || 0)) * 100}%` } }), sub ? h('small', null, sub) : null);

  // ---------------- pages
  function drawProc() {
    const spaces = os.cfg.get('spaces');
    body.replaceChildren(h('table', { class: 'mn-table' },
      h('thead', null, h('tr', null, ['編號', '應用程式', '視窗', '工作區', '狀態', '已開啟', ''].map((x) => h('th', null, x)))),
      h('tbody', null, wm.wins.length ? wm.wins.map((w) => h('tr', { class: w === wm.active ? 'is-on' : '' },
        h('td', null, two(w.id)), h('td', null, appById(w.app)?.name || w.app), h('td', null, w.title), h('td', null, `${two(w.ws + 1)} ${spaces[w.ws]?.name || ''}`),
        h('td', null, w.min ? '最小化' : w === wm.active ? '使用中' : w.ws === wm.ws ? '背景' : '其他工作區'), h('td', { data: { t: w.started } }, span((Date.now() - w.started) / 1000)),
        h('td', null, w === win ? null : btn('結束', { cls: 'is-quiet', onclick: () => wm.close(w) })))) : h('tr', null, h('td', { colspan: 7 }, '沒有開啟的視窗')))),
    h('p', { class: 'mn-foot' }, `${wm.wins.length} 個視窗 · 系統已運作 `, h('span', { data: { t: os.bootAt } }, span((Date.now() - os.bootAt) / 1000))));
  }
  let graph = null;
  function drawPerf() {
    const mem = performance.memory;
    if (!graph || !graph.isConnected) {
      graph = h('canvas', { class: 'mn-graph' });
      body.replaceChildren(h('div', { class: 'mn-perf' }, h('div', { class: 'mn-big' }, h('b', { data: { m: 'fps' } }), h('span', null, 'FPS')), graph, h('div', { data: { m: 'rows' } })));
    }
    body.querySelector('[data-m="fps"]').textContent = fps ? fps.toFixed(0) : '--';
    const cur = series.at(-1);
    body.querySelector('[data-m="rows"]').replaceChildren(rows([
      ['最慢的一幀', cur ? `${cur.worst.toFixed(1)} ms（這一秒）` : '—'],
      ['長任務', po ? `${long} 次（開啟監控以來，超過 50 ms 的工作）` : NA],
      ['JS 記憶體', mem ? `${bytes(mem.usedJSHeapSize)} / ${bytes(mem.jsHeapSizeLimit)}` : NA],
      ['DOM 節點', String(document.getElementsByTagName('*').length)],
      ['桌布', os.root.dataset.wall === 'live' ? 'WebGL 即時場景' : '靜態'],
    ]));
    const w = graph.clientWidth, hh = graph.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (!w) return;
    graph.width = Math.round(w * dpr); graph.height = Math.round(hh * dpr);
    const g = graph.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(graph), top = Math.max(60, ...series.map((s) => s.fps)) * 1.1;
    g.strokeStyle = css.getPropertyValue('--line').trim() || 'rgba(236,235,229,.14)'; g.lineWidth = 1;
    for (const v of [30, 60, 120]) { if (v > top) continue; const y = hh - (v / top) * hh; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.fillStyle = css.getPropertyValue('--ink-3').trim() || '#6d6c66'; g.font = '10px "IBM Plex Mono", monospace'; g.fillText(String(v), 4, y - 3); }
    g.strokeStyle = css.getPropertyValue('--hot').trim() || '#ffc400'; g.lineWidth = 1.5;
    g.beginPath();
    series.forEach((s, i) => { const x = w - (series.length - 1 - i) * (w / 119), y = hh - (Math.min(top, s.fps) / top) * hh; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
  async function drawDisk() {
    const u = fs.usage(), trash = fs.size(fs.dir('trash'));
    let est = null;
    try { est = await navigator.storage?.estimate?.(); } catch { est = null; }
    if (tab !== 'disk') return;
    let ls = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch { ls = 0; }
    body.replaceChildren(h('div', { class: 'mn-disk' },
      meter('這個網站在瀏覽器裡的用量', est && est.usage != null ? bytes(est.usage) : NA, est && est.quota ? est.usage / est.quota : 0, est && est.quota ? `瀏覽器給的上限約 ${bytes(est.quota)}` : null),
      meter('localStorage', bytes(ls), ls / (5 * 1024 * 1024), '多數瀏覽器的上限約 5 MB：設定、檔案目錄與文字檔都在這裡'),
      rows([
        ['檔案數量', `${u.count} 個`], ['文字檔', bytes(u.text)], ['匯入的檔案', `${bytes(u.blobs)}${fs.volatile ? '（只在記憶體，重新整理後消失）' : '（IndexedDB）'}`],
        ['垃圾桶', `${bytes(trash)} · ${fs.children(fs.dir('trash')).length} 個項目`], ['系統設定', bytes(os.cfg.size())],
      ]),
      h('p', { class: 'mn-foot' }, btn('清空垃圾桶', { icon: 'trash', onclick: () => os.ops.emptyTrash() }), btn('開啟儲存空間設定', { icon: 'gear', onclick: () => os.launch('settings', { page: 'storage' }) }))));
  }
  function gpu() {
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return '沒有 WebGL';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return String(name);
    } catch { return NA; }
  }
  let gpuName = null;
  function drawSys() {
    gpuName ??= gpu();
    const ua = navigator.userAgentData, conn = navigator.connection;
    const brand = ua ? ua.brands.filter((x) => !/not.?a.?brand/i.test(x.brand)).map((x) => `${x.brand} ${x.version}`).join(' · ') : navigator.userAgent;
    body.replaceChildren(rows([
      ['系統', `Nagato Sakura WebOS ${os.version} · build ${os.env.build}`],
      ['瀏覽器', brand], ['平台', ua?.platform || navigator.platform || NA],
      ['邏輯核心', navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency}` : NA],
      ['裝置記憶體', navigator.deviceMemory ? `約 ${navigator.deviceMemory} GB（瀏覽器回報的級距）` : NA],
      ['繪圖處理器', gpuName],
      ['螢幕', `${screen.width}×${screen.height} · 像素比 ${devicePixelRatio}`], ['系統畫面', `${os.root.clientWidth}×${os.root.clientHeight}`],
      ['網路', navigator.onLine ? `已連線${conn?.effectiveType ? ` · ${conn.effectiveType}` : ''}${conn?.downlink ? ` · 約 ${conn.downlink} Mbps` : ''}` : '離線'],
      ['語言 · 時區', `${navigator.language} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`],
      ['檔案儲存', fs.volatile ? '記憶體（沒有 IndexedDB）' : 'localStorage + IndexedDB'],
    ]));
  }
  function draw() {
    tabs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === tab)));
    graph = null;
    ({ proc: drawProc, perf: drawPerf, disk: drawDisk, sys: drawSys })[tab]();
  }
  tabs.addEventListener('click', (e) => { const x = e.target.closest('button'); if (x) { tab = x.dataset.v; draw(); } });
  // the table is rebuilt only when the windows change; in between, just the clocks tick (a rebuild under the
  // pointer would swallow a click on "結束")
  const timer = setInterval(() => { if (tab === 'proc') body.querySelectorAll('[data-t]').forEach((el) => { el.textContent = span((Date.now() - Number(el.dataset.t)) / 1000); }); }, 1000);
  const ro = new ResizeObserver(() => { if (tab === 'perf') drawPerf(); });
  ro.observe(body);
  win.cleanup.push(os.bus.on('wm', () => { if (tab === 'proc') drawProc(); }), os.bus.on('fs', () => { if (tab === 'disk') drawDisk(); }), () => { cancelAnimationFrame(raf); clearInterval(timer); ro.disconnect(); po?.disconnect(); });
  draw();
  return { open: (a) => { if (a.tab) { tab = a.tab; draw(); } } };
}
