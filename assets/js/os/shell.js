// The shell of the WebOS: boot screen, lock screen, the bar (start, search, overview, widgets, tasks, tray) and
// the one rule every panel follows — only one of them is open at a time.
//
//   start.js    the start menu                         search.js   the search page
//   tray.js     quick settings · notifications + calendar · the focus timer
//   hub.js      the widget board and the start screen (tiles)
import { h, ico, btn, tool, appTile } from './ui.js';
import { svg } from './icons.js';
import { appById } from './apps.js';
import { SCENES, two, clamp } from './kernel.js';
import { reducedMotion } from '../core/store.js';
import { lunar } from './lib/lunar.js';
import { createStart } from './start.js';
import { createSearch } from './search.js';
import { createTray } from './tray.js';
import { createHub } from './hub.js';

export const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LOGO = '<svg viewBox="0 0 120 120" aria-hidden="true"><path class="a" d="M60 14 108 100H12z"/><path class="b" d="M60 50 82 90H38z"/><path class="c" d="M60 14v36M12 100l26-10M108 100 82 90"/></svg>';
const STEPS = 5;

// ---------------------------------------------------------------- boot
/** The boot screen. Each `step` is reported by the code that just ran it (see os.js) — the list is a log, not a show. */
export function createBoot(os, { full }) {
  const log = h('ol', { class: 'os-boot__log' });
  const fill = h('i'), count = h('b', null, '00');
  const el = h('div', { class: `os-boot${full ? '' : ' os-boot--fast'}`, role: 'status', 'aria-label': '系統啟動中' },
    h('div', { class: 'os-boot__map', 'aria-hidden': 'true' }),
    h('div', { class: 'os-boot__core' },
      h('div', { class: 'os-boot__head' },
        h('div', { class: 'os-boot__mark', html: LOGO }),
        h('p', { class: 'os-boot__step', 'aria-hidden': 'true' }, count, h('span', null, `/ ${two(STEPS)}`))),
      h('p', { class: 'os-boot__name' }, h('b', null, 'NAGATO SAKURA'), h('span', null, `WEBOS ${os.version}`)),
      log,
      h('div', { class: 'os-boot__bar' }, fill),
      h('p', { class: 'os-boot__foot' }, h('span', null, `BUILD ${os.env.build}`), h('span', null, full ? '點一下或按任意鍵略過' : 'RESUME'))));
  os.layers.front.append(el);
  let n = 0, skip = !full || reducedMotion();
  const hurry = () => { skip = true; };
  el.addEventListener('pointerdown', hurry);
  addEventListener('keydown', hurry);
  const line = (name, text, state) => {
    n += 1;
    log.append(h('li', { class: `is-${state}` }, h('b', null, state === 'ok' ? 'OK' : state === 'warn' ? 'WARN' : 'FAIL'), h('span', null, name), h('i', null, text)));
    fill.style.width = `${Math.min(100, (n / STEPS) * 100)}%`;
    count.textContent = two(Math.min(STEPS, n));
  };
  return {
    async step(name, text, state = 'ok') { line(name, text, state); await wait(skip ? 0 : 210); },
    fail(name, text) { line(name, text, 'fail'); el.classList.add('is-failed'); removeEventListener('keydown', hurry); },
    async done() {
      await wait(skip ? 0 : 460);
      removeEventListener('keydown', hurry);
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 700);
    },
  };
}

export function createShell(os) {
  const { cfg, bus, wm, fs } = os;
  const root = os.root, bar = os.layers.bar, pop = os.layers.pop;
  const off = [];
  const timers = [];
  const every = (ms, fn) => { timers.push(setInterval(fn, ms)); fn(); };
  const clock = (d = new Date()) => `${two(cfg.get('hour12') ? d.getHours() % 12 || 12 : d.getHours())}:${two(d.getMinutes())}${cfg.get('seconds') ? `:${two(d.getSeconds())}` : ''}`;

  // ================================================================ lock screen and sleep
  const lockEl = h('div', { class: 'os-lock', hidden: true });
  const lk = { time: h('b'), date: h('p'), scene: h('p', { class: 'os-lock__scene' }) };
  lockEl.append(
    h('div', { class: 'os-lock__map', 'aria-hidden': 'true' }),
    h('div', { class: 'os-lock__clock' }, lk.time, lk.date),
    lk.scene,
    h('div', { class: 'os-lock__user' },
      h('img', { src: '/assets/img/amano-face.webp', alt: '', width: 64, height: 64 }),
      h('div', null, h('b', { data: { id: 'nameZh' } }, '天野靜樹'), h('span', null, 'LOCAL SESSION · 不需要密碼')),
      btn('進入', { cls: 'is-primary os-lock__go', icon: 'chevR', onclick: () => lock.enter() })),
    h('p', { class: 'os-lock__hint' }, '按任意鍵，或點一下畫面'));
  const sleepEl = h('div', { class: 'os-sleep', hidden: true, role: 'button', 'aria-label': '睡眠中。點一下或按任意鍵喚醒' }, h('p', null, 'SLEEP　·　按任意鍵喚醒'));
  os.layers.front.append(lockEl, sleepEl);
  os.env.identity?.(lockEl);
  lockEl.addEventListener('click', (e) => { if (!e.target.closest('button')) lock.enter(); });
  const lockTick = () => {
    if (lockEl.hidden) return;
    const d = new Date(), lu = lunar(d);
    lk.time.textContent = clock(d);
    lk.date.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日　星期${WEEK[d.getDay()]}${lu ? `　·　農曆${lu.text}` : ''}`;
    const s = cfg.get('spaces')[wm.ws] || cfg.get('spaces')[0], sc = SCENES[s.scene] || SCENES.gate;
    lk.scene.textContent = root.dataset.wall === 'live' ? `${two(wm.ws + 1)} / ${s.name} — ${sc.en}` : `${two(wm.ws + 1)} / ${s.name}`;
  };
  const lock = {
    show() {
      lockEl.hidden = false;
      lockEl.classList.remove('is-out');
      root.classList.add('is-locked');
      os.env.stage.depth(0.34);
      lockTick();
      lockEl.querySelector('.os-lock__go').focus({ preventScroll: true });
    },
    enter() {
      if (lockEl.hidden || lockEl.classList.contains('is-out')) return;
      lockEl.classList.add('is-out');
      os.unlock();
      os.sound.play('login');
      os.env.stage.depth(0);
      enter(true);
      setTimeout(() => { lockEl.hidden = true; }, reducedMotion() ? 0 : 620);
    },
    key(e) {
      if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      lock.enter();
    },
  };
  /** The desktop comes in: the bar rises, the icons follow. */
  function enter(animated) {
    root.classList.remove('is-locked');
    os.env.stage.depth(0);
    if (!animated || reducedMotion()) return;
    root.classList.add('is-entering');
    setTimeout(() => root.classList.remove('is-entering'), 1100);
  }
  /** Sleep: the session is locked, the screen goes dark and the world behind it stops being drawn. */
  function sleep() {
    if (os.asleep) return;
    closePanels();
    os.lock();
    os.asleep = true;
    sleepEl.hidden = false; void sleepEl.offsetWidth; sleepEl.classList.add('is-on');
    setTimeout(() => { if (os.asleep) os.env.stage.setLive(false); }, reducedMotion() ? 0 : 700);
  }
  function wake() {
    if (!os.asleep) return;
    os.asleep = false;
    os.env.stage.setLive(root.dataset.wall === 'live');
    sleepEl.classList.remove('is-on');
    setTimeout(() => { if (!os.asleep) sleepEl.hidden = true; }, reducedMotion() ? 0 : 520);
    lockTick();
  }
  sleepEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); wake(); });

  // ================================================================ panels: one at a time
  // name → { el, buttons, depth, out, onOpen(arg), onClose() }
  const panels = new Map();
  const isOpen = (name) => !!panels.get(name)?.el.classList.contains('is-open');
  const current = () => [...panels.keys()].find(isOpen) || null;
  function settle() {
    const name = current(), p = name ? panels.get(name) : null;
    if (name) root.dataset.panel = name; else delete root.dataset.panel;
    const d = p ? (typeof p.depth === 'function' ? p.depth() : p.depth || 0) : 0;
    os.env.stage.depth(Math.max(d, wm.overview ? 0.16 : 0));
  }
  function setPanel(name, open, arg) {
    const p = panels.get(name);
    if (!p || isOpen(name) === open) { if (p && open) { p.onOpen?.(arg); settle(); } return; }
    if (open) { p.el.hidden = false; void p.el.offsetWidth; p.el.classList.add('is-open'); p.onOpen?.(arg); }
    else { p.el.classList.remove('is-open'); p.onClose?.(); setTimeout(() => { if (!p.el.classList.contains('is-open')) p.el.hidden = true; }, reducedMotion() ? 0 : p.out || 240); }
    p.buttons?.forEach((b) => b.setAttribute('aria-expanded', String(open)));
    settle();
  }
  function closePanels(except = null) {
    let any = false;
    for (const name of panels.keys()) if (name !== except && isOpen(name)) { setPanel(name, false); any = true; }
    return any;
  }
  const sh = {
    os, clock,
    register(name, p) { p.el.hidden = true; pop.append(p.el); panels.set(name, p); return p; },
    isOpen, settle,
    open(name, arg) { os.ui.closeMenu(); os.ui.hideTip(); closePanels(name); wm.setOverview(false); setPanel(name, true, arg); },
    close(name) { if (name) setPanel(name, false); else closePanels(); },
    toggle(name, arg) { if (isOpen(name)) setPanel(name, false); else sh.open(name, arg); },
    sleep,
    /** The files opened last that still exist, newest first. */
    recent(max = 6) { return cfg.get('recent').map((id) => fs.get(id)).filter((n) => n && !n.dir && !fs.inTrash(n)).slice(0, max); },
    powerMenu(anchor, side = 'top') {
      os.ui.menu([
        { label: '鎖定', icon: 'lock', hint: 'Alt L', action: () => { closePanels(); os.lock(); } },
        { label: '睡眠', icon: 'moon', action: sleep },
        '-',
        { label: '重新啟動', icon: 'restart', action: sh.restart },
        { label: '關機（離開 WebOS）', icon: 'power', danger: true, action: sh.shutdown },
      ], { anchor, side, align: 'end' });
    },
    userMenu(anchor, side = 'top') {
      os.ui.menu([
        { label: '個人化', icon: 'palette', action: () => { closePanels(); os.launch('settings', { page: 'look' }); } },
        { label: '關於這個系統', icon: 'info', action: () => { closePanels(); os.launch('settings', { page: 'about' }); } },
        '-',
        { label: '鎖定', icon: 'lock', hint: 'Alt L', action: () => { closePanels(); os.lock(); } },
      ], { anchor, side });
    },
    async restart() {
      closePanels();
      if (await os.ui.confirm('重新啟動會關閉所有視窗，尚未儲存的內容會遺失。', { title: '重新啟動', ok: '重新啟動' })) os.restart();
    },
    async shutdown() {
      closePanels();
      if (!wm.wins.some((w) => w.dirty) || await os.ui.confirm('有尚未儲存的內容，確定要離開？', { title: '離開 WebOS', ok: '離開', danger: true })) os.exit();
    },
    /** The menu of an application, wherever its badge is shown. */
    appMenu(id, at, { tiles = false, extra = null } = {}) {
      const app = appById(id);
      if (!app) return;
      const list = wm.byApp(id), pins = cfg.get('pins'), sp = cfg.get('startPins'), size = cfg.get('tileSize')[id] || 's';
      const flip = (key, arr) => cfg.set(key, arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
      os.ui.menu([
        { label: list.length && !app.multi ? '切換到視窗' : '開啟', icon: app.icon, action: () => { closePanels(); os.launch(id); } },
        app.multi && list.length ? { label: '開新視窗', icon: 'plus', action: () => { closePanels(); os.launch(id); } } : null,
        '-',
        { label: sp.includes(id) ? '從開始選單取消釘選' : '釘選到開始選單', icon: 'pin', action: () => flip('startPins', sp) },
        { label: pins.includes(id) ? '從工作列取消釘選' : '釘選到工作列', icon: 'pin', action: () => flip('pins', pins) },
        tiles ? { label: '磁貼大小', icon: 'widgets', sub: [['s', '小'], ['w', '寬'], ['l', '大']].map(([v, label]) => ({ label, checked: size === v, action: () => cfg.set('tileSize', { ...cfg.get('tileSize'), [id]: v }) })) } : null,
        ...(extra || []),
        '-',
        { label: '在桌面建立捷徑', icon: 'link', action: () => fs.create(fs.dir('desktop'), app.name, { app: id }).catch((er) => os.ui.fail(er)) },
      ], at);
    },
  };

  // ================================================================ bar
  const startBtn = h('button', { type: 'button', class: 'os-start-btn', 'aria-label': '開始', title: '開始（Alt A）', 'aria-expanded': 'false', html: svg('logo') });
  const searchBtn = tool('search', '搜尋（Alt Q）', { class: 'os-tool os-bar__btn', 'aria-expanded': 'false' });
  const overNo = h('i');
  const overBtn = h('button', { type: 'button', class: 'os-tool os-bar__btn os-bar__btn--over', 'aria-label': '工作總覽與工作區', html: svg('layers') }, overNo);
  const hubBtn = tool('widgets', '小工具（Alt G）', { class: 'os-tool os-bar__btn', 'aria-expanded': 'false' });
  const tasksEl = h('div', { class: 'os-tasks', role: 'toolbar', 'aria-label': '應用程式' });
  const sys = { net: ico('wifi'), vol: ico('vol'), bat: ico('battery', 'os-sys__bat') };
  sys.bat.hidden = true;
  const sysBtn = h('button', { type: 'button', class: 'os-sys', 'aria-label': '快速設定', 'aria-expanded': 'false' }, sys.net, sys.vol, sys.bat);
  const tray = { time: h('b'), date: h('span'), mark: h('i', { class: 'os-clock__mark', hidden: true }), run: h('i', { class: 'os-clock__run', hidden: true }) };
  const clockBtn = h('button', { type: 'button', class: 'os-clock', 'aria-label': '通知與行事曆', 'aria-expanded': 'false' }, tray.time, tray.date, tray.mark, tray.run);
  const peek = h('button', { type: 'button', class: 'os-peek', 'aria-label': '顯示桌面', title: '顯示桌面（Alt S）' });
  bar.append(h('div', { class: 'os-bar__left' }, startBtn, searchBtn, overBtn, hubBtn), tasksEl, h('div', { class: 'os-tray' }, sysBtn, clockBtn, peek));

  // ---------------- workspaces: reached from the overview (and from its button's menu and wheel)
  function addSpace() {
    const spaces = cfg.get('spaces');
    if (spaces.length >= 6) return;
    const used = new Set(spaces.map((s) => s.scene));
    const id = Object.keys(SCENES).find((k) => !used.has(k)) || 'gate';
    cfg.set('spaces', [...spaces, { name: SCENES[id].name, scene: id }]);
    wm.setWs(spaces.length);
  }
  function spaceMenu(i, at) {
    const spaces = cfg.get('spaces');
    const patch = (fn) => { const next = spaces.map((s) => ({ ...s })); fn(next); cfg.set('spaces', next); };
    os.ui.menu([
      { label: '前往', icon: 'chevR', disabled: i === wm.ws, action: () => wm.setWs(i) },
      { label: '重新命名', icon: 'edit', action: async () => { const name = await os.ui.prompt('工作區名稱', spaces[i].name, { title: '重新命名工作區' }); if (name && name.trim()) patch((n) => { n[i].name = name.trim().slice(0, 12); }); } },
      { label: '場景', icon: 'image', sub: Object.entries(SCENES).map(([id, s]) => ({ label: `${s.name}　${s.en}`, checked: spaces[i].scene === id, action: () => patch((n) => { n[i].scene = id; }) })) },
      '-',
      { label: '新增工作區', icon: 'plus', disabled: spaces.length >= 6, action: addSpace },
      { label: '移除這個工作區', icon: 'trash', danger: true, disabled: spaces.length < 2, action: () => { patch((n) => n.splice(i, 1)); wm.dropWs(i); } },
    ], at);
  }
  /** Every workspace in one menu: where the overview cannot be (small frames), and for the overview button's right click. */
  function spacesMenu(at) {
    const spaces = cfg.get('spaces');
    os.ui.menu([
      ...spaces.map((s, i) => ({ label: `${two(i + 1)}　${s.name}`, hint: `${wm.count(i)} 個視窗`, checked: i === wm.ws, action: () => wm.setWs(i) })),
      '-',
      wm.compact ? null : { label: '工作總覽', icon: 'layers', hint: 'Alt Z', action: () => { closePanels(); wm.setOverview(true); } },
      { label: '新增工作區', icon: 'plus', disabled: spaces.length >= 6, action: addSpace },
      { label: '工作區設定', icon: 'gear', action: () => { closePanels(); os.launch('settings', { page: 'spaces' }); } },
    ], at);
  }
  function drawSpaces() {
    const spaces = cfg.get('spaces'), s = spaces[wm.ws] || spaces[0];
    overNo.textContent = two(wm.ws + 1);
    overBtn.dataset.tip = `工作總覽 · ${two(wm.ws + 1)} ${s.name}（Alt Z）`;
    overBar.replaceChildren(
      ...spaces.map((sp, i) => h('button', { type: 'button', class: `os-space${i === wm.ws ? ' is-on' : ''}`, data: { ws: i } }, h('b', null, two(i + 1)), h('span', null, sp.name), h('i', null, `${(SCENES[sp.scene] || SCENES.gate).en} · ${wm.count(i)} 個視窗`))),
      ...(spaces.length < 6 ? [h('button', { type: 'button', class: 'os-space os-space--add', 'aria-label': '新增工作區', title: '新增工作區', html: svg('plus'), onclick: addSpace })] : []));
  }
  overBtn.addEventListener('click', () => { if (wm.compact) { spacesMenu({ anchor: overBtn, side: 'top' }); return; } closePanels(); wm.setOverview(!wm.overview); });
  overBtn.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); spacesMenu({ anchor: overBtn, side: 'top' }); });
  overBtn.addEventListener('wheel', (e) => { e.preventDefault(); wm.setWs(wm.ws + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });

  // ---------------- tasks
  function taskIds() {
    const pins = cfg.get('pins').filter((id) => appById(id));
    const run = [];
    for (const w of wm.wins) if (!pins.includes(w.app) && !run.includes(w.app)) run.push(w.app);
    return [...pins, ...run];
  }
  function drawTasks() {
    const act = wm.active;
    tasksEl.replaceChildren(...taskIds().map((id) => {
      const app = appById(id), list = wm.byApp(id);
      const label = list.length === 1 && list[0].title !== app.name ? `${app.name} — ${list[0].title}` : app.name;
      // a running application answers a hover with the list of its windows instead of a name
      return h('button', { type: 'button', class: `os-task${list.length ? ' is-run' : ''}${act && act.app === id ? ' is-active' : ''}`, data: { app: id, n: Math.min(3, list.length), ...(list.length ? {} : { tip: app.name }) }, 'aria-label': label, 'aria-pressed': String(!!act && act.app === id) },
        appTile(app, 'os-tile--s'), h('i', { class: 'os-task__dots' }));
    }));
    if (cardFor) { const b = tasksEl.querySelector(`[data-app="${cardFor}"]`); if (b && wm.byApp(cardFor).length) showCard(b); else hideCard(); }
  }
  function taskClick(id, b) {
    const app = appById(id), list = wm.byApp(id);
    if (!list.length) { os.launch(id); return; }
    if (list.length === 1) { const w = list[0]; if (wm.active === w) wm.minimize(w); else wm.focus(w); return; }
    os.ui.menu([
      ...list.map((w) => ({ label: w.title, icon: app.icon, checked: wm.active === w, action: () => wm.focus(w) })),
      '-', { label: '開新視窗', icon: 'plus', action: () => os.launch(id) },
    ], { anchor: b, side: 'top' });
  }
  function taskMenu(id, b) {
    const app = appById(id), list = wm.byApp(id), pins = cfg.get('pins'), pinned = pins.includes(id);
    os.ui.menu([
      { label: list.length && !app.multi ? '切換到視窗' : app.multi && list.length ? '開新視窗' : '開啟', icon: app.icon, action: () => (list.length && !app.multi ? wm.focus(list[0]) : os.launch(id)) },
      app.cat ? { label: pinned ? '從工作列取消釘選' : '釘選到工作列', icon: 'pin', action: () => cfg.set('pins', pinned ? pins.filter((x) => x !== id) : [...pins, id]) } : null,
      list.length ? '-' : null,
      list.length ? { label: list.length > 1 ? `關閉 ${list.length} 個視窗` : '關閉視窗', icon: 'close', danger: true, action: async () => { for (const w of [...list]) await wm.close(w); } } : null,
    ], { anchor: b, side: 'top' });
  }
  tasksEl.addEventListener('click', (e) => { const b = e.target.closest('.os-task'); if (b) { hideCard(); closePanels(); taskClick(b.dataset.app, b); } });
  tasksEl.addEventListener('contextmenu', (e) => { const b = e.target.closest('.os-task'); if (b) { e.preventDefault(); e.stopPropagation(); hideCard(); taskMenu(b.dataset.app, b); } });
  tasksEl.addEventListener('auxclick', (e) => { const b = e.target.closest('.os-task'); if (b && e.button === 1) os.launch(b.dataset.app); });

  // the card above a running application: its windows, by name
  const card = h('div', { class: 'os-peekcard', hidden: true });
  pop.append(card);
  let cardFor = null, cardTimer = 0;
  function showCard(b) {
    const id = b.dataset.app, app = appById(id), list = wm.byApp(id), spaces = cfg.get('spaces');
    if (!list.length) { hideCard(); return; }
    cardFor = id;
    card.replaceChildren(
      h('header', null, appTile(app, 'os-tile--s'), h('b', null, app.name), h('span', null, `${list.length} 個視窗`)),
      ...list.map((w) => h('div', { class: `os-peekcard__row${wm.active === w ? ' is-on' : ''}` },
        h('button', { type: 'button', onclick: () => { hideCard(); wm.focus(w); } }, h('span', null, w.title), w.ws !== wm.ws ? h('i', null, `${two(w.ws + 1)} ${spaces[w.ws]?.name || ''}`) : w.min ? h('i', null, '最小化') : null),
        tool('close', '關閉視窗', { onclick: () => wm.close(w) }))));
    card.hidden = false;
    const frame = root.getBoundingClientRect(), r = b.getBoundingClientRect(), w = card.offsetWidth;
    card.style.left = `${Math.round(clamp(r.left + r.width / 2 - w / 2 - frame.left, 6, frame.width - w - 6))}px`;
    void card.offsetWidth; card.classList.add('is-open');
  }
  function hideCard() { clearTimeout(cardTimer); cardFor = null; card.classList.remove('is-open'); card.hidden = true; }
  const leaveCard = () => { clearTimeout(cardTimer); cardTimer = setTimeout(hideCard, 220); };
  tasksEl.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.os-task');
    if (!b || e.pointerType === 'touch' || os.ui.menuOpen) return;
    clearTimeout(cardTimer);
    if (!b.classList.contains('is-run')) { if (cardFor) cardTimer = setTimeout(hideCard, 120); return; }
    if (cardFor === b.dataset.app) return;
    cardTimer = setTimeout(() => { if (b.isConnected) showCard(b); }, cardFor ? 80 : 420);
  });
  tasksEl.addEventListener('pointerleave', leaveCard);
  card.addEventListener('pointerenter', () => clearTimeout(cardTimer));
  card.addEventListener('pointerleave', leaveCard);

  // ---------------- tray
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  let battery = null, unread = 0;
  function drawTray() {
    const d = new Date();
    tray.time.textContent = clock(d);
    tray.date.textContent = `${two(d.getMonth() + 1)}/${two(d.getDate())} ${DAYS[d.getDay()]}`;
    const online = navigator.onLine, muted = cfg.get('mute') || cfg.get('vol') === 0;
    sys.net.innerHTML = svg(online ? 'wifi' : 'wifiOff');
    sys.net.classList.toggle('is-warn', !online);
    sys.vol.innerHTML = svg(muted ? 'volOff' : 'vol');
    sys.bat.hidden = !battery;
    if (battery) sys.bat.style.setProperty('--k', String(battery.level));
    sysBtn.dataset.tip = [online ? `已連線${conn && conn.effectiveType ? ` ${conn.effectiveType}` : ''}` : '離線', muted ? '靜音' : `音量 ${cfg.get('vol')}`, battery ? `電池 ${Math.round(battery.level * 100)}%` : null].filter(Boolean).join('　·　');
    const lu = lunar(d);
    clockBtn.dataset.tip = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${WEEK[d.getDay()]}${lu ? `　農曆${lu.text}` : ''}${unread ? `　·　${unread} 則新通知` : ''}`;
    tray.mark.hidden = !unread;
    const run = os.timer?.state();
    tray.run.hidden = !run;
    if (run) tray.run.style.setProperty('--k', String(run.k));
  }
  sysBtn.addEventListener('wheel', (e) => { e.preventDefault(); cfg.set('vol', clamp(cfg.get('vol') + (e.deltaY < 0 ? 5 : -5), 0, 100)); if (cfg.get('mute')) cfg.set('mute', false); }, { passive: false });
  navigator.getBattery?.().then((b) => {
    battery = b;
    const upd = () => { drawTray(); bus.emit('battery'); };
    b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
    off.push(() => { b.removeEventListener('levelchange', upd); b.removeEventListener('chargingchange', upd); });
    upd();
  }).catch(() => {});
  Object.assign(sh, { conn, battery: () => battery, spaceMenu, spacesMenu, addSpace });

  // ================================================================ toasts
  const toasts = h('div', { class: 'os-toasts', 'aria-live': 'polite' });
  pop.append(toasts);
  function toast(n) {
    const el = h('button', { type: 'button', class: 'os-toast' }, ico(n.icon), h('div', null, h('b', null, n.title), n.body ? h('p', null, n.body) : null, h('i', null, appById(n.app)?.name || '系統')), h('span', { class: 'os-toast__life', 'aria-hidden': 'true' }));
    const bye = () => { el.classList.add('is-out'); setTimeout(() => el.remove(), 260); };
    el.addEventListener('click', () => { bye(); n.action?.(); });
    toasts.prepend(el);
    while (toasts.children.length > 3) toasts.lastChild.remove();
    setTimeout(bye, 5600);
  }

  // ================================================================ overview strip
  const overBar = h('div', { class: 'os-over__bar' });
  os.layers.over.append(overBar, h('p', { class: 'os-over__hint' }, '點一個視窗切換過去　·　點工作區前往，右鍵改名或換場景　·　Esc 離開'), h('p', { class: 'os-over__none' }, '這個工作區沒有開啟的視窗'));
  overBar.addEventListener('click', (e) => { const b = e.target.closest('[data-ws]'); if (b) wm.setWs(Number(b.dataset.ws)); });
  overBar.addEventListener('contextmenu', (e) => { const b = e.target.closest('[data-ws]'); if (b) { e.preventDefault(); e.stopPropagation(); spaceMenu(Number(b.dataset.ws), { x: e.clientX, y: e.clientY }); } });
  overBar.addEventListener('wheel', (e) => { e.preventDefault(); wm.setWs(wm.ws + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  os.layers.desk.addEventListener('pointerdown', (e) => { if (wm.overview) { e.stopPropagation(); wm.setOverview(false); } }, true);
  os.layers.wins.addEventListener('pointerdown', (e) => { if (wm.overview && e.target === os.layers.wins) wm.setOverview(false); });

  // ================================================================ the panels themselves
  const start = createStart(os, sh);
  const search = createSearch(os, sh);
  const trayPanels = createTray(os, sh);
  sh.timerBar = trayPanels.timerBar;
  const hub = createHub(os, sh);
  sh.register('start', { el: start.el, buttons: [startBtn], depth: 0.05, onOpen: start.open });
  sh.register('search', { el: search.el, buttons: [searchBtn], depth: 0.14, out: 280, onOpen: search.open, onClose: search.close });
  sh.register('quick', { el: trayPanels.quick.el, buttons: [sysBtn], onOpen: trayPanels.quick.open });
  sh.register('side', { el: trayPanels.side.el, buttons: [clockBtn], onOpen: () => { unread = 0; drawTray(); trayPanels.side.open(); } });
  sh.register('hub', { el: hub.el, depth: () => (hub.mode === 'full' ? 0.12 : 0.03), out: 320, onOpen: hub.open, onClose: hub.close });

  const startStyle = () => (cfg.get('startStyle') === 'tiles' ? 'tiles' : 'menu');
  function toggleStart() {
    if (startStyle() === 'tiles') { if (isOpen('hub') && hub.mode === 'full') sh.close('hub'); else sh.open('hub', 'full'); }
    else sh.toggle('start');
    if (isOpen('start') || isOpen('hub')) os.sound.play('tick');
  }
  // the hub is two things: its side state belongs to the widgets button, its full state to the start button
  const syncStart = () => {
    startBtn.setAttribute('aria-expanded', String(isOpen('start') || (isOpen('hub') && hub.mode === 'full')));
    hubBtn.setAttribute('aria-expanded', String(isOpen('hub') && hub.mode === 'side'));
  };
  startBtn.addEventListener('click', () => { toggleStart(); syncStart(); });
  searchBtn.addEventListener('click', () => sh.toggle('search'));
  hubBtn.addEventListener('click', () => { if (isOpen('hub') && hub.mode === 'side') sh.close('hub'); else sh.open('hub', 'side'); });
  sysBtn.addEventListener('click', () => sh.toggle('quick'));
  clockBtn.addEventListener('click', () => sh.toggle('side'));
  peek.addEventListener('click', () => { closePanels(); wm.showDesktop(); });
  const outside = (e) => {
    if (!current() || e.target.closest('.os-bar__left, .os-tray, .os-menu, .os-modal, .os-tip')) return;
    for (const p of panels.values()) if (p.el.contains(e.target)) return;
    closePanels();
  };
  root.addEventListener('pointerdown', outside, true);
  bar.addEventListener('contextmenu', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault(); e.stopPropagation();
    os.ui.menu([
      { label: '工作總覽', icon: 'layers', hint: 'Alt Z', disabled: wm.compact, action: () => { closePanels(); wm.setOverview(true); } },
      { label: '顯示桌面', icon: 'desktop', hint: 'Alt S', action: () => wm.showDesktop() },
      { label: '小工具', icon: 'widgets', hint: 'Alt G', action: () => sh.open('hub', 'side') },
      '-',
      { label: '系統監控', icon: 'pulse', action: () => os.launch('monitor') },
      { label: '工作列設定', icon: 'gear', action: () => os.launch('settings', { page: 'bar' }) },
    ], { x: e.clientX, y: e.clientY });
  });

  // ================================================================ wiring
  off.push(
    bus.on('wm', () => { drawTasks(); drawSpaces(); }),
    bus.on('ws', drawSpaces),
    bus.on('cfg', (k) => {
      if (k === 'pins') drawTasks();
      if (k === 'spaces') drawSpaces();
      if (['mute', 'vol', 'hour12', 'seconds'].includes(k)) drawTray();
      if (k === 'startStyle') { closePanels(); syncStart(); }
    }),
    bus.on('note', ({ note, toast: show }) => { if (isOpen('side')) return; unread += 1; drawTray(); if (show) toast(note); }),
    bus.on('notes', () => { if (!os.notes.length) { unread = 0; drawTray(); } }),
    bus.on('timer', drawTray),
    bus.on('frame-focus', () => closePanels()),
    bus.on('compact', () => { closePanels(); hideCard(); }),
  );
  // a panel's own button mirrors its state; the start button stands for two of them
  const mo = new MutationObserver(syncStart);
  mo.observe(start.el, { attributes: true, attributeFilter: ['class'] });
  mo.observe(hub.el, { attributes: true, attributeFilter: ['class', 'data-mode'] });
  const net = () => { drawTray(); bus.emit('net'); };
  addEventListener('online', net); addEventListener('offline', net);
  off.push(() => { removeEventListener('online', net); removeEventListener('offline', net); root.removeEventListener('pointerdown', outside, true); mo.disconnect(); });
  every(1000, () => { drawTray(); lockTick(); });
  drawTasks(); drawSpaces();

  return {
    lock, enter, sleep, wake, closePanels: () => closePanels(), toggleStart: () => { toggleStart(); syncStart(); },
    toggleSearch: () => sh.toggle('search'),
    toggleHub: () => { if (isOpen('hub') && hub.mode === 'side') sh.close('hub'); else sh.open('hub', 'side'); },
    open: sh.open,
    /** Escape: the search page first gives up its text, then the open panel closes. */
    escape() { if (isOpen('search') && search.clear()) return true; return closePanels(); },
    /** Where a window shrinks to when it is minimised: the middle of its task button, in the windows layer's space. */
    dockPoint(win) {
      const b = tasksEl.querySelector(`[data-app="${win.app}"]`), box = os.layers.wins.getBoundingClientRect();
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: box.height };
    },
    dispose() { timers.forEach(clearInterval); off.forEach((f) => f()); trayPanels.dispose(); hub.dispose(); start.dispose(); },
  };
}
