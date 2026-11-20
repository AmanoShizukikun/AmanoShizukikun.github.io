// Nagato Sakura WebOS — the system itself. `createOS(root, env)` builds it inside `root` and returns `{ dispose }`.
//
//   kernel.js   bus · configuration · sound          vfs.js      the file system
//   wm.js       windows, workspaces, overview        ui.js       menus, dialogs, the file picker
//   desktop.js  icons and the telemetry block        shell.js    boot, lock screen, bar and the panels it opens:
//   start.js    the start menu                       search.js   the search page
//   tray.js     quick settings, notifications,       hub.js      the widget board and the start screen
//               calendar, focus timer
//   apps.js     the applications (each in apps/, loaded when first opened)
//
// `env` is what the page gives the system (pages/webos.js): the world behind it as a live wallpaper (`stage`), the
// build id, and the way out.
import { createBus, createConfig, createSound, SCENES, WALLS, two } from './kernel.js';
import { createFs } from './vfs.js';
import { createUi, h, btn } from './ui.js';
import { createWm } from './wm.js';
import { APPS, appById } from './apps.js';
import { createOps } from './fileops.js';
import { createDesktop } from './desktop.js';
import { createShell, createBoot } from './shell.js';

export const VERSION = '2.1';
const html = document.documentElement;

export async function createOS(root, env) {
  const bus = createBus();
  const cfg = createConfig(bus);
  const sound = createSound(cfg);
  const off = [];
  const on = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); off.push(() => target.removeEventListener(type, fn, opt)); };

  const layers = {
    wall: h('div', { class: 'os-wall', 'aria-hidden': 'true' }),
    scrim: h('div', { class: 'os-scrim', 'aria-hidden': 'true' }),
    desk: h('div', { class: 'os-desk' }),
    wins: h('div', { class: 'os-wins' }),
    over: h('div', { class: 'os-over' }),
    bar: h('nav', { class: 'os-bar', 'aria-label': '工作列' }),
    pop: h('div', { class: 'os-pop' }),
    night: h('div', { class: 'os-night', 'aria-hidden': 'true' }),
    dim: h('div', { class: 'os-dim', 'aria-hidden': 'true' }),
    front: h('div', { class: 'os-front' }),
  };
  root.replaceChildren(...Object.values(layers));
  // night light and brightness are the screen's, not the desk's: they lie over the site's header as well
  document.body.append(layers.night, layers.dim);
  root.classList.add('os--on');

  const os = {
    root, bus, cfg, sound, layers, env, apps: APPS, version: VERSION, bootAt: Date.now(),
    locked: true, asleep: false, ready: false, notes: [], media: null, timer: null,
    fs: null, ui: null, wm: null, desktop: null, shell: null,
    app: appById,
    scene: () => SCENES[cfg.get('spaces')[os.wm ? os.wm.ws : 0]?.scene] || SCENES.gate,
  };

  // ---------------------------------------------------------------- boot: every line is a step that really ran
  const first = !sessionStorage.getItem('nxosUp');
  const boot = createBoot(os, { full: first });
  await boot.step('KERNEL', `bus · config · build ${env.build}`);
  try { os.fs = await createFs(bus); } catch (e) { console.error('[os] file system', e); boot.fail('FILE SYSTEM', '無法啟動檔案系統'); throw e; }
  const use = os.fs.usage();
  await boot.step('FILE SYSTEM', `${use.count} 個項目 · ${os.fs.volatile ? '僅存在記憶體（這個瀏覽器不提供 IndexedDB）' : 'localStorage + IndexedDB'}`, os.fs.volatile ? 'warn' : 'ok');
  os.ui = createUi(os);
  os.wm = createWm(os);
  await boot.step('WINDOW MANAGER', `${cfg.get('spaces').length} 個工作區`);
  await boot.step('DISPLAY', env.stage.available ? 'WebGL2 世界 · 即時桌布' : '沒有 WebGL：使用靜態桌布', env.stage.available ? 'ok' : 'warn');

  // ---------------------------------------------------------------- applications
  os.launch = async (id, args = {}) => {
    const app = appById(id);
    if (!app) { os.ui.fail(new Error(`找不到應用程式「${id}」。`)); return null; }
    if (!app.multi) {
      const ex = os.wm.byApp(id)[0];
      if (ex) { os.wm.focus(ex); ex.api?.open?.(args); return ex; }
    }
    const win = os.wm.open({ app: id, title: app.name, icon: app.icon, code: app.code, tint: app.tint, w: app.w, h: app.h, minW: app.minW, minH: app.minH });
    const run = async () => {
      win.body.replaceChildren(h('div', { class: 'os-loading' }, h('i'), h('span', null, `LOADING ${app.en}`)));
      try {
        const mod = await app.load();
        if (!os.wm.wins.includes(win)) return;
        win.body.replaceChildren();
        win.api = (await mod.start(os, win, args)) || null;
      } catch (e) {
        console.error(`[os] ${id} failed to start`, e);
        if (!os.wm.wins.includes(win)) return;
        win.body.replaceChildren(h('div', { class: 'os-crash' }, h('b', null, 'APPLICATION FAULT'), h('p', null, `${app.name} 無法啟動。`), h('code', null, String(e && e.message || e)), btn('重試', { cls: 'is-primary', onclick: run })));
      }
    };
    await run();
    return win;
  };
  /** Opens a file or folder with the application that handles it. */
  os.openNode = (node, from = null) => {
    if (!node) return null;
    const kind = os.fs.kind(node);
    if (kind === 'link') return os.launch(node.app, node.args || {});
    if (kind === 'dir') return os.launch('files', { dir: node });
    const app = { text: 'notes', image: 'gallery', audio: 'media', video: 'media' }[kind];
    if (!app) { os.ui.alert(`沒有可以開啟「${node.name}」的應用程式。可以在檔案總管把它匯出到這台電腦。`, '無法開啟'); return null; }
    // the files opened last: the start menu, the search page and a widget list them
    if (!String(node.id).startsWith('sys:')) cfg.set('recent', [node.id, ...cfg.get('recent').filter((id) => id !== node.id)].slice(0, 12));
    return os.launch(app, { node, from });
  };
  /** Files from the device (a drop or a file input) → `dir`. Small text files are kept as editable text. */
  os.importFiles = async (files, dir) => {
    const made = [];
    for (const f of [...files]) {
      try {
        const kind = os.fs.kind({ name: f.name, mime: f.type });
        if (kind === 'text' && f.size <= 512 * 1024) made.push(await os.fs.create(dir, f.name, { text: await f.text(), mime: f.type || undefined }));
        else made.push(await os.fs.create(dir, f.name, { blob: f, mime: f.type || undefined }));
      } catch (e) { await os.ui.fail(e, `無法加入「${f.name}」`); }
    }
    if (made.length) os.notify({ app: 'files', title: `已加入 ${made.length} 個檔案`, body: `放在「${os.fs.label(dir)}」。檔案只存在這個瀏覽器裡。` });
    return made;
  };
  os.exportNode = async (node) => {
    try {
      const a = h('a', { href: URL.createObjectURL(await os.fs.blob(node)), download: node.name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { os.ui.fail(e); }
  };

  // ---------------------------------------------------------------- notifications
  os.notify = ({ app = null, title, body = '', icon = null, action = null, silent = false }) => {
    const note = { id: `${Date.now()}-${os.notes.length}`, app, title, body, icon: icon || appById(app)?.icon || 'bell', action, at: Date.now() };
    os.notes.unshift(note);
    if (os.notes.length > 40) os.notes.length = 40;
    bus.emit('note', { note, toast: !silent && !cfg.get('dnd') && !os.locked });
    if (!silent && !cfg.get('dnd')) sound.play('note');
    return note;
  };

  // ---------------------------------------------------------------- appearance
  const look = {
    accent: (v) => root.style.setProperty('--signal', v),
    tone: (v) => { root.dataset.tone = v === 'light' ? 'light' : 'dark'; html.classList.toggle('nx-os-light', v === 'light'); },
    glass: (v) => { root.toggleAttribute('data-glass', !!v); html.classList.toggle('nx-os-glass', !!v); },
    bright: (v) => { layers.dim.style.opacity = String(((100 - v) / 100) * 0.9); },
    night: () => { layers.night.style.opacity = cfg.get('night') ? String((cfg.get('nightK') / 100) * 0.32) : '0'; },
    nightK: () => look.night(),
    barAlign: (v) => { root.dataset.barAlign = v; },
    barSize: (v) => { root.dataset.barSize = v; },
    focus: (v) => html.classList.toggle('nx-os-focus', !!v),
    wall: () => applyWall(),
    spaces: () => { if (root.dataset.wall === 'live') env.stage.go(os.scene().t, true); },
  };
  let wallJob = 0;
  async function applyWall() {
    const my = ++wallJob;
    let mode = cfg.get('wall');
    if (mode === 'live' && !env.stage.available) mode = 'img:night';
    const set = (kind, url) => {
      if (my !== wallJob) return;
      root.dataset.wall = kind;
      layers.wall.style.backgroundImage = url ? `url("${url}")` : '';
      env.stage.setLive(kind === 'live');
      if (kind === 'live') env.stage.go(os.scene().t, false);
    };
    if (mode === 'live') return set('live');
    if (mode === 'solid') return set('solid');
    if (mode.startsWith('file:')) {
      const node = os.fs.get(mode.slice(5));
      if (node && os.fs.kind(node) === 'image') { try { return set('img', await os.fs.url(node)); } catch { /* fall through */ } }
      mode = 'img:night';
    }
    const w = WALLS.find((x) => x.id === mode.slice(4)) || WALLS[0];
    return set('img', `/assets/img/os/${w.file}.webp`);
  }
  for (const k in look) { if (k !== 'wall' && k !== 'spaces') look[k](cfg.get(k)); }
  off.push(bus.on('cfg', (k) => look[k]?.(cfg.get(k))));
  off.push(bus.on('ws', ({ dir }) => { if (root.dataset.wall === 'live') env.stage.go(os.scene().t, dir !== 0); }));
  off.push(bus.on('overview', (v) => env.stage.depth(v ? 0.16 : 0)));
  off.push(bus.on('fs:error', (e) => os.ui.fail(e, '儲存失敗')));
  off.push(bus.on('cfg:error', () => os.notify({ title: '設定沒有存下來', body: '瀏覽器拒絕寫入儲存空間（可能是無痕模式或空間已滿）。', icon: 'warn' })));

  // ---------------------------------------------------------------- desktop and shell
  // a new system lays its first icons out in the order they were made, not by name
  os.deskDefaults = () => Object.fromEntries((os.fs.seedOrder || []).filter((id) => os.fs.get(id)).map((id, i) => [id, [0, i]]));
  if (os.fs.seedOrder && !Object.keys(cfg.get('desk')).length) cfg.set('desk', os.deskDefaults());
  os.ops = createOps(os);
  os.desktop = createDesktop(os);
  os.shell = createShell(os);
  await applyWall();
  await boot.step('SHELL', `${APPS.filter((a) => a.cat).length} 個應用程式`);

  // ---------------------------------------------------------------- session: lock, restart, leave
  os.lock = () => { if (!os.locked) { os.locked = true; os.ui.closeMenu(); os.shell.closePanels(); os.wm.setOverview(false); os.shell.lock.show(); } };
  os.unlock = () => {
    os.locked = false;
    try { sessionStorage.setItem('nxosUp', '1'); } catch { /* private mode */ }
    if (!cfg.get('seen')) {
      cfg.set('seen', true);
      setTimeout(() => os.notify({ app: 'sakura', title: '歡迎，主人。', body: '我是長門櫻。桌面上的「歡迎.txt」有簡單的說明，也可以直接問我。', action: () => os.launch('sakura') }), 900);
    }
  };
  os.restart = async () => {
    os.shell.closePanels();
    await os.wm.closeAll();
    os.locked = true;
    os.bootAt = Date.now();
    const again = createBoot(os, { full: true });
    for (const [name, text] of [['KERNEL', `bus · config · build ${env.build}`], ['FILE SYSTEM', `${os.fs.usage().count} 個項目`], ['WINDOW MANAGER', `${cfg.get('spaces').length} 個工作區`], ['DISPLAY', env.stage.available ? 'WebGL2 世界 · 即時桌布' : '靜態桌布'], ['SHELL', `${APPS.filter((a) => a.cat).length} 個應用程式`]]) await again.step(name, text);
    await again.done();
    os.shell.lock.show();
  };
  os.exit = () => { cfg.flush(); os.fs.flush(); env.exit(); };

  // ---------------------------------------------------------------- keyboard
  on(window, 'keydown', (e) => {
    if (!os.ready) return;
    if (os.asleep) { e.preventDefault(); e.stopPropagation(); os.shell.wake(); return; }
    if (os.locked) { os.shell.lock.key(e); return; }
    if (e.key === 'Escape' && !e.defaultPrevented) {
      if (os.ui.menuOpen) os.ui.closeMenu();
      else if (os.shell.escape()) { e.preventDefault(); }
      else if (os.wm.overview) os.wm.setOverview(false);
      return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const win = os.wm.active;
    const k = e.code;
    const hit = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.shiftKey) {
      const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[k];
      if (dir && win) { hit(); os.wm.snapKey(win, dir); }
      return;
    }
    if (k === 'KeyA') { hit(); os.shell.toggleStart(); }
    else if (k === 'KeyQ') { hit(); os.shell.toggleSearch(); }
    else if (k === 'KeyG') { hit(); os.shell.toggleHub(); }
    else if (k === 'KeyZ') { hit(); os.shell.closePanels(); os.wm.setOverview(!os.wm.overview); }
    else if (k === 'Backquote') { hit(); os.wm.cycle(1); }
    else if (k === 'KeyW' && win) { hit(); os.wm.close(win); }
    else if (k === 'KeyM' && win) { hit(); os.wm.minimize(win); }
    else if (k === 'KeyX' && win) { hit(); os.wm.toggleMax(win); }
    else if (k === 'KeyS') { hit(); os.wm.showDesktop(); }
    else if (k === 'KeyL') { hit(); os.lock(); }
    else if (/^Digit[1-6]$/.test(k)) { hit(); os.wm.setWs(Number(k.slice(5)) - 1); }
  }, true);
  // the browser's own menu has no business on the desktop; text fields keep theirs
  on(root, 'contextmenu', (e) => { if (!e.target.closest('input, textarea, [contenteditable="true"], .os-native-menu')) e.preventDefault(); });
  // a real page unload with unsaved work in a window asks first
  on(window, 'beforeunload', (e) => { cfg.flush(); os.fs.flush(); if (os.wm.wins.some((w) => w.dirty)) { e.preventDefault(); e.returnValue = ''; } });
  on(window, 'pagehide', () => { cfg.flush(); os.fs.flush(); });

  // ---------------------------------------------------------------- up
  os.ready = true;
  await boot.done();
  if (first) os.shell.lock.show(); else { os.unlock(); os.shell.enter(false); }

  return {
    os,
    dispose() {
      cfg.flush();
      off.forEach((f) => f());
      os.shell.dispose(); os.desktop.dispose(); os.wm.dispose(); os.ui.dispose(); os.fs.dispose(); sound.dispose();
      bus.clear();
      html.classList.remove('nx-os-focus', 'nx-os-light', 'nx-os-glass');
      layers.night.remove(); layers.dim.remove();
      root.classList.remove('os--on');
      root.replaceChildren();
    },
  };
}

export { two };
