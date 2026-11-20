// The persistent shell: the world canvas, header, full-screen menu, settings drawer, the game centre's
// side rail and the frame-rate monitor.
// It is rendered exactly once from data (assets/js/data/site.js) — no page carries its own copy.
import { site, nav, works, hrefOf, linkAttrs } from '../data/site.js';
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { initSidebar } from './sidebar.js';
import { initOsd } from './osd.js';

const ICON = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h12"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 5.5 4.5 12l6.5 6.5"/></svg>',
  chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5 15.5 12 9 18.5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2.5-7 5 14 2.5-7h4"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M10 6.3A9.6 9.6 0 0 1 12 6c5.5 0 9 6 9 6a15 15 0 0 1-2.6 3.2M6.2 8A15 15 0 0 0 3 12s3.500 6 9 6a9 9 0 0 0 3.300-.6M9.900 9.900a3 3 0 0 0 4.200 4.200"/></svg>',
};

const seg = (key, options) => `<div class="nx-seg" role="group" data-seg="${key}">${options.map(([v, label]) => `<button type="button" data-v="${v}">${label}</button>`).join('')}</div>`;
const sw = (key, label) => `<button type="button" class="nx-switch" role="switch" aria-label="${label}" data-switch="${key}"></button>`;

function render() {
  const wrap = document.createElement('div');
  wrap.className = 'nx-shell';
  wrap.innerHTML = `
<canvas class="nx-world" aria-hidden="true"></canvas>
<header class="nx-header">
  <a class="nx-btn nx-back nx-sub-only" href="/works/" data-back aria-label="返回">${ICON.back}</a>
  <a class="nx-brand" href="/" aria-label="${site.nameZh} 首頁"><img src="/assets/img/logo.webp" alt="" width="22" height="22"><span data-id="name">${site.name}</span><i data-id="nameZh">${site.nameZh}</i></a>
  <span class="nx-here nx-sub-only" data-app-title></span>
  <nav class="nx-nav" aria-label="主要導覽">
    ${nav.map((n) => `<a href="${n.href}" data-nav="${n.id}">${n.zh}<small>${n.en}</small></a>`).join('')}
  </nav>
  <div class="nx-actions">
    <button type="button" class="nx-btn" data-toggle="settings" aria-label="設定" aria-expanded="false" aria-controls="nx-settings">${ICON.gear}</button>
    <button type="button" class="nx-btn nx-btn--menu" data-toggle="menu" aria-label="選單" aria-expanded="false" aria-controls="nx-menu">${ICON.menu}</button>
  </div>
</header>

<div class="nx-menu" id="nx-menu" inert>
  <nav class="nx-menu__main" aria-label="選單">
    ${nav.map((n, i) => `<a href="${n.href}" data-nav="${n.id}"><i>0${i + 1}</i>${n.en}<small>${n.zh}</small></a>`).join('')}
  </nav>
  <div class="nx-menu__side">
    <h2>APPLICATIONS</h2>
    <ul>${works.map((w) => `<li><a href="${hrefOf(w)}"${linkAttrs(w)}>${w.title}<span>${w.kind}</span></a></li>`).join('')}</ul>
    <h2>CONTACT</h2>
    <ul>
      <li><a href="mailto:${site.email}">${site.email}<span>MAIL</span></a></li>
      ${site.links.map((l) => `<li><a href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}<span>↗</span></a></li>`).join('')}
    </ul>
  </div>
</div>

<aside class="nx-settings" id="nx-settings" aria-label="設定" inert>
  <h2>SETTINGS</h2>
  <p>設定會記在這台裝置上</p>
  <div class="nx-set"><div><b>主題</b><span>深色，或畫在紙上的淺色</span></div>${seg('theme', [['dark', '深色'], ['light', '淺色']])}</div>
  <div class="nx-set"><div><b>看板娘（Live2D）</b><span>站在畫面角落，換頁時不會重新載入</span></div>${sw('live2dEnabled', '看板娘')}</div>
  <div class="nx-set"><div><b>動態效果</b><span>「減少」會關閉轉場與鏡頭緩動</span></div>${seg('nxMotion', [['full', '完整'], ['reduced', '減少']])}</div>
  <div class="nx-set"><div><b>畫質</b><span>影響首頁的粒子數量與解析度</span></div>${seg('nxQuality', [['auto', '自動'], ['high', '高'], ['low', '低']])}</div>
  <div class="nx-set"><div><b>幀率顯示</b><span>可拖曳的監控面板，有三種模式</span></div>${sw('nxFps', '幀率顯示')}</div>
  <div class="nx-set"><div><b>遊戲中心側欄</b><span>遊戲中心與遊戲畫面左側的功能列</span></div>${sw('nxSide', '遊戲中心側欄')}</div>
  <p class="nx-build">BUILD ${document.getElementById('view')?.dataset.build || 'dev'}</p>
</aside>

<aside class="nx-side" aria-label="遊戲中心側欄" inert>
  <button type="button" data-side="toggle" aria-expanded="false" title="展開側邊欄">${ICON.chev}<span>展開</span></button>
  <button type="button" data-side="hub" title="遊戲中心">${ICON.grid}<span>遊戲中心</span></button>
  <button type="button" data-side="fps" aria-pressed="false" title="幀數顯示">${ICON.pulse}<span>幀數顯示</span></button>
  <button type="button" data-side="hide" title="關閉左側欄（可在設定中重新開啟）">${ICON.eyeOff}<span>關閉左側欄</span></button>
</aside>
<div class="nx-hold" hidden aria-hidden="true"><span>按住 VIEW 返回遊戲中心</span><i></i></div>

<div class="nx-osd" data-mode="fps" role="group" aria-label="幀率監控" hidden>
  <div class="nx-osd__head"><b>MONITOR</b><div class="nx-osd__modes"><button type="button" data-m="fps" title="FPS 模式">FPS</button><button type="button" data-m="adv" title="進階模式">ADV</button><button type="button" data-m="full" title="完整模式">FULL</button></div></div>
  <p class="nx-osd__fps"><strong data-o="fps">--</strong><span>FPS</span></p>
  <canvas class="nx-osd__graph" data-o="graph" width="176" height="36"></canvas>
  <dl class="nx-osd__rows">
    <div><dt>FRAME</dt><dd data-o="ms">--</dd></div>
    <div data-full><dt>1% LOW</dt><dd data-o="low">--</dd></div>
    <div data-full><dt>JS HEAP</dt><dd data-o="heap">--</dd></div>
    <div data-full><dt>TIME</dt><dd data-o="time">--</dd></div>
  </dl>
</div>
<div class="nx-live" aria-live="polite"></div>`;
  document.body.prepend(wrap);
  return wrap;
}

function panels(root) {
  const els = { menu: root.querySelector('.nx-menu'), settings: root.querySelector('.nx-settings') };
  const set = (name, open) => {
    const el = els[name];
    el.classList.toggle('is-open', open);
    el.inert = !open;
    root.querySelector(`[data-toggle="${name}"]`).setAttribute('aria-expanded', String(open));
    if (name === 'menu') document.documentElement.classList.toggle('nx-lock', open);
  };
  const closeAll = () => { set('menu', false); set('settings', false); };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const name = t.dataset.toggle;
    const open = !els[name].classList.contains('is-open');
    closeAll();
    set(name, open);
    if (open) els[name].querySelector('a, button')?.focus({ preventScroll: true });
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('pointerdown', (e) => {
    if (els.settings.classList.contains('is-open') && !e.target.closest('.nx-settings, [data-toggle="settings"]')) set('settings', false);
  });
  router.before(closeAll);
}

function settings(root) {
  const html = document.documentElement;
  const bind = (key, apply) => { apply(store.get(key)); store.on(key, apply); };

  root.querySelectorAll('[data-seg]').forEach((g) => {
    const key = g.dataset.seg;
    const sync = (v) => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    g.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) store.set(key, b.dataset.v); });
    bind(key, sync);
  });
  root.querySelectorAll('[data-switch]').forEach((b) => {
    const key = b.dataset.switch;
    b.addEventListener('click', () => store.set(key, store.get(key) === 'true' ? 'false' : 'true'));
    bind(key, (v) => b.setAttribute('aria-checked', String(v === 'true')));
  });

  bind('theme', (v) => {
    html.dataset.theme = v;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v === 'light' ? '#e9e8e2' : '#0b0c0d');
  });
  bind('nxMotion', (v) => { html.dataset.motion = v; });

}

function activeNav(root) {
  // the back control goes one level up: an application → the index it belongs to → the works index
  const back = root.querySelector('[data-back]');
  back.addEventListener('click', (e) => { e.preventDefault(); router.back(back.getAttribute('href')); });
  const here = root.querySelector('[data-app-title]');
  router.after((page, main) => {
    // pages below the works index (an application, the game centre, the project page) get the back control and their name in the bar
    const sub = page === 'app' || page === 'games' || page === 'sakura' || page === 'live2d' || page === 'music' || page === 'webos' || page === 'lore';
    document.documentElement.classList.toggle('nx-sub', sub);
    back.setAttribute('href', main.dataset.back || '/works/');
    here.textContent = sub ? main.dataset.name || '' : '';
    const id = sub ? main.dataset.app : page;
    root.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === id || (a.dataset.nav === 'works' && sub);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  });
}

export function initShell() {
  const root = render();
  panels(root);
  settings(root);
  activeNav(root);
  initSidebar(root);
  initOsd(root);
  return root;
}
