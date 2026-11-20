// The start menu (the "普通" start style): pinned applications, the files opened last, every application, and —
// at the bottom — the session (who is signed in, and one power button that holds lock, sleep, restart and shut
// down). It opens without taking the keyboard into a field; typing anything goes to the search page.
//
// Pinned applications are arranged by hand: drag one to move it, drag one up from "全部" to pin it where it is
// dropped. (Application badges are not <button>s: Firefox does not drag those.)
import { h, ico, tool, appTile, nodeTile, arrowNav, when } from './ui.js';
import { APPS, CATS, appById } from './apps.js';

export const APP_TYPE = 'application/x-nxos-app';
const HIT = 'button, [role="button"]';

export function createStart(os, sh) {
  const { cfg, fs } = os;
  const body = h('div', { class: 'os-start__body' });
  const field = h('button', { type: 'button', class: 'os-start__search', 'aria-label': '搜尋' }, ico('search'), h('span', null, '搜尋應用程式、檔案與設定'), h('kbd', null, 'Alt Q'));
  const power = tool('power', '電源', { class: 'os-tool os-start__pw', 'aria-haspopup': 'menu' });
  const user = h('button', { type: 'button', class: 'os-start__user', 'aria-haspopup': 'menu', 'aria-label': '使用者' },
    h('img', { src: '/assets/img/amano-face.webp', alt: '', width: 36, height: 36 }),
    h('span', null, h('b', { data: { id: 'nameZh' } }, '天野靜樹'), h('i', null, 'LOCAL SESSION')));
  const el = h('div', { class: 'os-start', role: 'dialog', 'aria-label': '開始', tabindex: '-1' },
    h('header', { class: 'os-start__top' }, field),
    body,
    h('footer', { class: 'os-start__foot' }, user, power));
  os.env.identity?.(el);

  const badge = (cls, app, kids) => h('div', { class: cls, role: 'button', tabindex: '0', draggable: 'true', data: { app: app.id }, 'aria-label': app.name }, kids);
  const appBtn = (app, i = 0) => { const b = badge('os-app', app, [appTile(app), h('span', null, app.name)]); b.style.setProperty('--i', i); return b; };
  const appRow = (app) => badge('os-app os-app--row', app, [appTile(app, 'os-tile--s'), h('span', null, app.name), h('i', null, app.en), os.wm.byApp(app.id).length ? h('em', null, '執行中') : null]);
  const sec = (title, tag, extra, content) => h('section', { class: 'os-start__sec' }, h('h3', null, h('b', null, title), h('span', null, tag), h('i'), extra), content);
  const pinned = () => [...new Set(cfg.get('startPins'))].map(appById).filter((a) => a && a.cat);

  let pinsEl = null;
  function draw() {
    const pins = pinned();
    const recent = sh.recent(6), view = cfg.get('allView') === 'grid' ? 'grid' : 'list';
    const seg = h('div', { class: 'nx-seg os-start__view', role: 'group', 'aria-label': '檢視方式' }, [['list', 'list', '清單'], ['grid', 'tiles', '格狀']].map(([v, icon, label]) => h('button', { type: 'button', 'aria-pressed': String(view === v), 'aria-label': label, title: label, onclick: () => cfg.set('allView', v) }, ico(icon))));
    const all = APPS.filter((a) => a.cat);
    pinsEl = h('div', { class: 'os-start__grid os-start__pins' }, pins.length ? pins.map(appBtn) : h('p', { class: 'os-start__none' }, '還沒有釘選的應用程式。把下面的應用程式拖上來，或按右鍵選「釘選到開始選單」。'));
    body.replaceChildren(...[
      sec('已釘選', 'PINNED', h('span', { class: 'os-start__hint' }, '拖曳可以排列'), pinsEl),
      recent.length ? sec('最近使用', 'RECENT', null, h('div', { class: 'os-start__recent' }, recent.map((n) => h('button', { type: 'button', class: 'os-hit', data: { node: n.id } }, nodeTile(os, n, 'os-tile--s'), h('span', null, h('b', null, fs.label(n)), h('i', null, `${fs.label(fs.parent(n))} · ${when(n.mtime)}`)))))) : null,
      sec('全部', 'ALL', seg, view === 'grid'
        ? h('div', { class: 'os-start__grid' }, all.map(appBtn))
        : h('div', { class: 'os-start__list' }, CATS.flatMap(([id, label]) => [h('h4', null, label), ...all.filter((a) => a.cat === id).map(appRow)]))),
    ].filter(Boolean));
  }

  body.addEventListener('click', (e) => {
    const a = e.target.closest('.os-app'), f = e.target.closest('[data-node]');
    if (a) { sh.close('start'); os.launch(a.dataset.app); } else if (f) { sh.close('start'); os.openNode(fs.get(f.dataset.node)); }
  });
  body.addEventListener('contextmenu', (e) => {
    const a = e.target.closest('.os-app'), f = e.target.closest('[data-node]');
    if (!a && !f) return;
    e.preventDefault(); e.stopPropagation();
    if (a) { sh.appMenu(a.dataset.app, { x: e.clientX, y: e.clientY }); return; }
    const n = fs.get(f.dataset.node);
    os.ui.menu([
      { label: '開啟', icon: 'chevR', action: () => { sh.close('start'); os.openNode(n); } },
      { label: '開啟所在的資料夾', icon: 'folderOpen', action: () => { sh.close('start'); os.launch('files', { dir: fs.parent(n) }); } },
      '-',
      { label: '從清單移除', icon: 'close', action: () => cfg.set('recent', cfg.get('recent').filter((id) => id !== n.id)) },
    ], { x: e.clientX, y: e.clientY });
  });

  // ---------------------------------------------------------------- arranging the pinned applications
  let drag = null;                 // { id, ghost } — `ghost` is the badge standing in for one dragged up from "全部"
  let lastMove = 0;
  const endDrag = (redraw) => { if (!drag) return; drag = null; el.classList.remove('is-sorting'); if (redraw) draw(); };
  body.addEventListener('dragstart', (e) => {
    const a = e.target.closest?.('.os-app');
    if (!a) return;
    drag = { id: a.dataset.app, ghost: null };
    e.dataTransfer.setData(APP_TYPE, drag.id);
    e.dataTransfer.effectAllowed = 'copyMove';
    os.ui.hideTip();
    setTimeout(() => { if (drag) { a.classList.add('is-drag'); el.classList.add('is-sorting'); } });
  });
  body.addEventListener('dragover', (e) => {
    if (!drag || !pinsEl || !e.target.closest?.('.os-start__pins')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    let me = pinsEl.querySelector(`.os-app[data-app="${drag.id}"]`);
    if (!me) { pinsEl.querySelector('.os-start__none')?.remove(); me = drag.ghost = appBtn(appById(drag.id)); me.classList.add('is-drag'); pinsEl.append(me); }
    const over = e.target.closest('.os-app');
    if (!over || over === me || performance.now() - lastMove < 130) return;
    const r = over.getBoundingClientRect();
    over[e.clientX > r.left + r.width / 2 ? 'after' : 'before'](me);
    lastMove = performance.now();
  });
  body.addEventListener('drop', (e) => {
    if (!drag || !pinsEl || !e.target.closest?.('.os-start__pins')) return;
    e.preventDefault(); e.stopPropagation();
    const order = [...new Set([...pinsEl.querySelectorAll('.os-app')].map((a) => a.dataset.app))];
    drag = null; el.classList.remove('is-sorting');
    cfg.set('startPins', order);
    draw();
  });
  body.addEventListener('dragend', () => endDrag(true));

  field.addEventListener('click', () => sh.open('search'));
  power.addEventListener('click', () => sh.powerMenu(power));
  user.addEventListener('click', () => sh.userMenu(user));
  el.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.startsWith('Arrow')) { arrowNav(e, el, HIT); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"]')) { e.preventDefault(); e.target.click(); return; }
    // typing is a search: the first letter goes with it
    if (e.key.length === 1 && e.key !== ' ' && !e.isComposing) { e.preventDefault(); sh.open('search', e.key); }
  });
  const redraw = () => { if (sh.isOpen('start') && !drag) draw(); };
  const offs = [os.bus.on('cfg', (k) => { if (['startPins', 'allView', 'recent'].includes(k)) redraw(); }), os.bus.on('wm', redraw)];

  return {
    el,
    open() { endDrag(false); draw(); body.scrollTop = 0; el.classList.remove('is-fresh'); void el.offsetWidth; el.classList.add('is-fresh'); el.focus({ preventScroll: true }); },
    dispose() { offs.forEach((f) => f()); },
  };
}
