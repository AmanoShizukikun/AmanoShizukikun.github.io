// Game centre: a library that manages the games listed under the 遊戲中心 entry (markup: src/pages/games.mjs).
//
//   library   featured banner (cycles by itself, pauses while it has the focus) · category tabs ·
//             sort / filter · card grid. A card opens the game's detail view.
//   detail    captures, description, data (play time and last launch are recorded per device),
//             favourite, and the launch button. /apps/game-center/#<id> opens straight on a detail view.
//
// One focus model serves the keyboard and the gamepad (core/gamepad.js):
//   move      arrows · d-pad / left stick        zones: side rail ← grid ↑ banner
//   confirm   Enter · A        back   Esc · B     sort / enlarge   X     filter / favourite   Y
//   tabs / captures   Q E · LB RB                 launch the focused card directly   START
// The footer shows these for whichever device was used last.
import { works, gameCats } from '../data/site.js';
import { router } from '../core/router.js';
import { reducedMotion } from '../core/store.js';
import { pad } from '../core/gamepad.js';
import { library } from '../core/library.js';
import { stage } from './stage.js';

const LAST = 'nxGcLast';                                   // the game opened last in this tab → focused on return
const SORTS = [['recent', '最近遊玩'], ['time', '遊玩時間'], ['name', '遊戲名稱']];
const GROUPS = {
  genre: { label: '遊戲類型', tabs: [['ALL', '全部'], ['FAV', '最愛'], ...gameCats] },
  input: { label: '操作方式', tabs: [['ALL', '全部'], ['PAD', '手把'], ['KEYS', '鍵鼠']] },
};
const two = (i) => String(i).padStart(2, '0');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const playTime = (s) => (s < 1 ? '尚未遊玩' : s < 60 ? '不到 1 分鐘' : s < 3600 ? `${Math.round(s / 60)} 分鐘` : `${(s / 3600).toFixed(1)} 小時`);
const day = (ms) => (ms ? new Date(ms).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—');

export async function mount(main) {
  const gc = main.querySelector('.gc');
  if (!gc) return null;
  const hub = works.find((w) => w.id === main.dataset.app);
  const games = hub ? hub.items : [];
  const byId = (id) => games.find((g) => g.id === id);
  const $ = (name) => gc.querySelector(`[data-gc="${name}"]`);
  const d = Object.fromEntries([...gc.querySelectorAll('[data-d]')].map((e) => [e.dataset.d, e]));
  const lib = $('lib'), hero = $('hero'), grid = $('grid'), detail = $('detail'), modalEl = $('modal'), preview = $('preview');
  const cards = Object.fromEntries([...grid.children].map((li) => [li.dataset.id, li]));
  const heroImgs = [...hero.querySelectorAll('.gc-hero__media img')];
  const dots = [...hero.querySelectorAll('[data-hero]')];
  const side = () => [...document.querySelectorAll('.nx-side:not([inert]) button')];
  const off = [];

  // ---------------- state ----------------
  let view = 'lib';            // 'lib' | 'detail'
  let modal = null;            // null | 'sort' | 'filter' | 'preview'
  let zone = 'grid';           // 'grid' | 'hero' | 'side'
  let shown = [];              // games in the grid, filtered and sorted
  let cur = 0;                 // focused card (index into shown)
  let sideCur = 1, modalCur = 0;
  let group = 'genre', tab = 0, sort = 'recent';
  let heroCur = 0;
  let game = null, shot = 0;   // detail view
  let libScroll = 0;
  // Framed layout (desktop): the page is a fixed frame and the library scrolls inside it.
  // Stacked layout (phones): the document scrolls. See the game-centre section of pages.css.
  const scroller = () => (getComputedStyle(gc).position === 'fixed' ? lib : document.scrollingElement);

  // ---------------- focus ----------------
  // `.is-focus` is the page's own focus mark (a gamepad gives no :focus-visible); real focus follows it
  let marked = null;
  const mark = (target, scroll = true) => {
    if (marked && marked !== target) marked.classList.remove('is-focus');
    marked = target || null;
    if (!target) return;
    target.classList.add('is-focus');
    target.focus({ preventScroll: true });
    if (scroll) target.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const cardHit = (i) => (shown[i] ? cards[shown[i].id].querySelector('[data-card]') : null);
  const focusNow = (scroll = true) => {
    if (modal === 'sort' || modal === 'filter') { mark($('modal-list').children[modalCur]?.firstElementChild, false); return; }
    if (modal === 'preview') { mark(null); return; }
    if (view === 'detail') { mark($('launch'), false); return; }
    if (zone === 'side') { const b = side(); sideCur = Math.min(b.length - 1, Math.max(0, sideCur)); if (b[sideCur]) { mark(b[sideCur], false); return; } zone = 'grid'; }
    if (zone === 'hero') { mark(hero, scroll); return; }
    if (!shown.length) { zone = 'hero'; mark(hero, scroll); return; }
    mark(cardHit(cur), scroll);
  };

  // ---------------- featured banner ----------------
  const setHero = (i, user = false) => {
    heroCur = (i + games.length) % games.length;
    const g = games[heroCur];
    heroImgs.forEach((img, k) => img.classList.toggle('is-on', k === heroCur));
    dots.forEach((b, k) => { if (k === heroCur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    $('hero-no').textContent = two(heroCur + 1);
    $('hero-title').textContent = g.title;
    $('hero-en').textContent = g.en;
    $('hero-desc').textContent = g.desc;
    $('hero-play').setAttribute('href', `/apps/${g.id}/`);
    // restart the progress line of the current dot
    const bar = dots[heroCur].firstElementChild;
    bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    if (user) hero.classList.add('is-held');
  };
  const heroPause = () => hero.classList.toggle('is-paused', view !== 'lib' || !!modal || zone === 'hero' || hero.matches(':hover') || reducedMotion());
  hero.addEventListener('animationend', (e) => { if (e.animationName === 'gc-run' && !hero.classList.contains('is-paused')) setHero(heroCur + 1); });
  hero.addEventListener('pointerenter', heroPause);
  hero.addEventListener('pointerleave', () => { hero.classList.remove('is-held'); heroPause(); });

  // ---------------- library ----------------
  const tabsOf = () => GROUPS[group].tabs;
  const match = (g) => {
    const key = tabsOf()[tab][0];
    if (key === 'ALL') return true;
    if (key === 'FAV') return library.isFav(g.id);
    if (key === 'PAD') return !!g.pad;
    if (key === 'KEYS') return !g.pad;
    return g.cat === key;
  };
  const renderTabs = () => {
    const box = $('tabs');
    box.replaceChildren(...tabsOf().map(([, label], i) => {
      const b = el('button', null, label);
      b.type = 'button'; b.dataset.tab = String(i);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === tab));
      b.tabIndex = i === tab ? 0 : -1;
      return b;
    }));
    $('filter-label').textContent = GROUPS[group].label;
    $('sort-label').textContent = SORTS.find(([id]) => id === sort)[1];
  };
  const syncFavs = () => {
    games.forEach((g) => {
      const on = library.isFav(g.id), b = cards[g.id].querySelector('[data-fav]');
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? `將 ${g.title} 從最愛移除` : `將 ${g.title} 加入最愛`);
    });
    if (game) {
      const on = library.isFav(game.id), b = detail.querySelector('[data-act="fav"]');
      b.setAttribute('aria-pressed', String(on));
      b.lastElementChild.textContent = on ? '已加入最愛' : '加入最愛';
    }
  };
  const apply = (keep) => {
    const order = games.filter(match);
    if (sort === 'name') order.sort((a, b) => a.title.localeCompare(b.title, 'zh-TW'));
    else order.sort((a, b) => {
      const sa = library.stat(a.id), sb = library.stat(b.id);
      return (sort === 'time' ? sb.time - sa.time : sb.last - sa.last) || games.indexOf(a) - games.indexOf(b);
    });
    shown = order;
    games.forEach((g) => { cards[g.id].hidden = !order.includes(g); });
    order.forEach((g, i) => { grid.append(cards[g.id]); cards[g.id].querySelector('.gc-card__no').textContent = two(i + 1); });
    $('count').textContent = `${two(order.length)} ITEMS`;
    $('empty').hidden = order.length > 0;
    const at = keep ? order.findIndex((g) => g.id === keep) : -1;
    cur = at >= 0 ? at : Math.min(cur, Math.max(0, order.length - 1));
  };
  const setTab = (i) => {
    const n = tabsOf().length;
    tab = (i + n) % n;
    renderTabs();
    apply(shown[cur]?.id);
    if (zone !== 'side') zone = 'grid';
    focusNow();
  };
  const toggleFav = (id) => {
    const on = library.toggleFav(id);
    syncFavs();
    note(on ? `已加入最愛：${byId(id).title}` : `已從最愛移除：${byId(id).title}`);
    if (tabsOf()[tab][0] === 'FAV' && view === 'lib') { apply(shown[cur]?.id); focusNow(false); }
  };

  // number of columns the grid currently has
  const columns = () => {
    const vis = shown.map((g) => cards[g.id]);
    if (vis.length < 2) return 1;
    const top = vis[0].offsetTop;
    const n = vis.findIndex((li) => li.offsetTop !== top);
    return n < 0 ? vis.length : n;
  };

  // ---------------- detail ----------------
  const shotsOf = (g) => [[g.img, '主畫面'], ...(g.shots || [])];
  const setShot = (i) => {
    const list = shotsOf(game);
    shot = (i + list.length) % list.length;
    const [src, cap] = list[shot];
    d.shot.src = `/assets/img/${src}`;
    d.shot.alt = `${game.title}：${cap}`;
    d['shot-no'].textContent = `${two(shot + 1)} / ${two(list.length)}`;
    d['shot-cap'].textContent = cap;
    [...d.thumbs.children].forEach((li, k) => li.firstElementChild.setAttribute('aria-current', String(k === shot)));
    d.thumbs.children[shot]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (modal === 'preview') { $('preview-img').src = d.shot.src; $('preview-img').alt = d.shot.alt; $('preview-cap').textContent = `${two(shot + 1)} / ${two(list.length)} — ${cap}`; }
  };
  // How the game is played: the list for one device at a time. It follows the device in use
  // (like the footer) until the visitor picks a tab.
  let ctlDev = null;
  const DEVICES = [['keys', '鍵盤 · 滑鼠'], ['pad', '手把']];
  const fillControls = () => {
    const c = game?.controls;
    d.ctl.hidden = !c;
    if (!c) return;
    const have = DEVICES.filter(([k]) => c[k]);
    const want = ctlDev || (pad.mode === 'pad' ? 'pad' : 'keys');
    const dev = c[want] ? want : have[0][0];
    const tabs = el('div', 'gc-ctl__tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', '操作方式');
    tabs.append(el('span', null, '操作 CONTROLS'), ...have.map(([k, name]) => {
      const b = el('button', null, name);
      b.type = 'button'; b.dataset.ctl = k;
      b.setAttribute('aria-pressed', String(k === dev));
      return b;
    }));
    const list = el('dl');
    list.append(...c[dev].map(([input, does]) => { const row = el('div'), dt = el('dt'); dt.append(el('kbd', null, input)); row.append(dt, el('dd', null, does)); return row; }));
    d.ctl.replaceChildren(tabs, list);
    more();
  };
  const fillDetail = (g) => {
    game = g; shot = 0;
    const st = library.stat(g.id);
    d.kicker.textContent = `${hub.en} — ${two(games.indexOf(g) + 1)} / ${two(games.length)}`;
    d.title.textContent = g.title;
    d.en.textContent = g.en;
    d.desc.textContent = g.desc;
    const rows = [
      ['類型 GENRE', (gameCats.find(([id]) => id === g.cat) || [0, g.cat])[1]],
      ['操作 INPUT', g.input],
      ['發行日期 RELEASED', g.released || '—'],
      ['開發 DEVELOPER', 'AMANO SHIZUKI'],
      ['遊玩時間 PLAYED', playTime(st.time)],
      ['最近遊玩 LAST', day(st.last)],
    ];
    d.meta.replaceChildren(...rows.map(([k, v]) => { const row = el('div'); row.append(el('dt', null, k), el('dd', null, v)); return row; }));
    d.tags.replaceChildren(...(g.tags || []).map((t) => el('i', null, t)));
    ctlDev = null;
    fillControls();
    d.thumbs.replaceChildren(...shotsOf(g).map(([src, cap], i) => {
      const li = el('li'), b = el('button');
      b.type = 'button'; b.dataset.shot = String(i); b.setAttribute('aria-label', `${cap}（第 ${i + 1} 張）`);
      const img = el('img'); img.src = `/assets/img/${src}`; img.alt = ''; img.loading = 'lazy'; img.width = 160; img.height = 100;
      b.append(img); li.append(b);
      return li;
    }));
    $('launch').setAttribute('href', `/apps/${g.id}/`);
    setShot(0);
    syncFavs();
  };
  const body = detail.querySelector('.gc-info__body');
  const more = () => body.classList.toggle('is-more', body.scrollHeight - body.clientHeight - body.scrollTop > 6);
  body.addEventListener('scroll', more, { passive: true });
  const setView = (v) => {
    view = v;
    gc.dataset.view = v;
    lib.inert = v !== 'lib';
    detail.hidden = v !== 'detail';
    heroPause();
    hints();
  };
  const openDetail = (g, remember = true) => {
    if (!g) return;
    if (view === 'lib') libScroll = scroller().scrollTop;
    fillDetail(g);
    setView('detail');
    scrollTo(0, 0);
    body.scrollTop = 0;
    more();
    if (remember) history.replaceState(history.state, '', `#${g.id}`);
    focusNow();
  };
  const closeDetail = () => {
    if (view !== 'detail') return;
    const id = game.id;
    setView('lib');
    history.replaceState(history.state, '', location.pathname + location.search);
    const at = shown.findIndex((g) => g.id === id);
    if (at >= 0) { cur = at; zone = 'grid'; }
    scroller().scrollTop = libScroll;
    focusNow();
  };
  const launch = (g) => {
    if (!g) return;
    try { sessionStorage.setItem(LAST, g.id); } catch { /* private mode */ }
    router.go(`/apps/${g.id}/`);
  };

  // ---------------- sort / filter list, capture preview ----------------
  const openModal = (kind) => {
    modal = kind;
    const list = kind === 'sort' ? SORTS : Object.entries(GROUPS).map(([k, g]) => [k, g.label]);
    const now = kind === 'sort' ? sort : group;
    modalCur = Math.max(0, list.findIndex(([id]) => id === now));
    $('modal-title').textContent = kind === 'sort' ? '排序方式' : '篩選組別';
    $('modal-list').replaceChildren(...list.map(([id, label], i) => {
      const li = el('li'), b = el('button', null, label);
      b.type = 'button'; b.dataset.opt = String(i);
      b.setAttribute('aria-pressed', String(id === now));
      li.append(b);
      return li;
    }));
    modalEl.hidden = false;
    heroPause(); hints(); focusNow();
  };
  const pick = (i) => {
    if (modal === 'sort') { sort = SORTS[i][0]; note(`排序：${SORTS[i][1]}`); }
    else { group = Object.keys(GROUPS)[i]; tab = 0; note(`篩選：${GROUPS[group].label}`); }
    closeModal(false);
    renderTabs();
    apply(shown[cur]?.id);
    zone = 'grid';
    focusNow();
  };
  const openPreview = () => {
    if (view !== 'detail') return;
    modal = 'preview';
    preview.hidden = false;
    setShot(shot);
    hints(); focusNow();
  };
  function closeModal(refocus = true) {
    modal = null;
    modalEl.hidden = true;
    preview.hidden = true;
    heroPause(); hints();
    if (refocus) focusNow();
  }

  // ---------------- one set of actions for click, key and pad ----------------
  const confirm = () => {
    if (modal === 'sort' || modal === 'filter') return pick(modalCur);
    if (modal === 'preview') return closeModal();
    if (view === 'detail') return launch(game);
    if (zone === 'side') return marked?.click();
    if (zone === 'hero') return launch(games[heroCur]);
    return openDetail(shown[cur]);
  };
  const back = () => {
    if (modal) return closeModal();
    if (view === 'detail') return closeDetail();
    if (zone !== 'grid') { zone = 'grid'; heroPause(); focusNow(); }
  };
  const move = (dir) => {
    if (modal === 'sort' || modal === 'filter') {
      const n = $('modal-list').children.length;
      if (dir === 'up') modalCur = Math.max(0, modalCur - 1);
      if (dir === 'down') modalCur = Math.min(n - 1, modalCur + 1);
      return focusNow();
    }
    if (modal === 'preview' || view === 'detail') {
      if (dir === 'left') setShot(shot - 1);
      if (dir === 'right') setShot(shot + 1);
      // up / down read on through the description and controls
      if (modal !== 'preview' && (dir === 'up' || dir === 'down')) {
        const box = getComputedStyle(gc).position === 'fixed' ? body : document.scrollingElement;
        box.scrollBy({ top: (dir === 'down' ? 1 : -1) * 120, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
      return undefined;
    }
    if (zone === 'side') {
      if (dir === 'up') sideCur -= 1;
      else if (dir === 'down') sideCur += 1;
      else if (dir === 'right') zone = 'grid';
      return focusNow();
    }
    if (zone === 'hero') {
      if (dir === 'left') setHero(heroCur - 1);
      else if (dir === 'right') setHero(heroCur + 1);
      else if (dir === 'down' && shown.length) zone = 'grid';
      heroPause();
      return focusNow();
    }
    const cols = columns(), n = shown.length, col = cur % cols;
    if (dir === 'left') { if (col > 0) cur -= 1; else if (side().length) zone = 'side'; }
    else if (dir === 'right') { if (col < cols - 1 && cur + 1 < n) cur += 1; }
    else if (dir === 'up') { if (cur - cols >= 0) cur -= cols; else zone = 'hero'; }
    else if (dir === 'down') { if (cur + cols < n) cur += cols; else if (Math.floor(cur / cols) < Math.floor((n - 1) / cols)) cur = n - 1; }
    heroPause();
    return focusNow();
  };
  const act = (name) => {
    if (name === 'confirm') confirm();
    else if (name === 'back') back();
    else if (name === 'sort') { if (modal === 'sort') closeModal(); else if (!modal && view === 'lib') openModal('sort'); }
    else if (name === 'filter') { if (modal === 'filter') closeModal(); else if (!modal && view === 'lib') openModal('filter'); }
    else if (name === 'tab-prev') { if (!modal && view === 'lib') setTab(tab - 1); }
    else if (name === 'tab-next') { if (!modal && view === 'lib') setTab(tab + 1); }
    else if (name === 'media-prev') { if (view === 'detail') setShot(shot - 1); }
    else if (name === 'media-next') { if (view === 'detail') setShot(shot + 1); }
    else if (name === 'preview') { if (modal === 'preview') closeModal(); else if (!modal) openPreview(); }
    else if (name === 'fav') { if (view === 'detail' && modal !== 'preview') toggleFav(game.id); }
    else if (name === 'hero-info') openDetail(games[heroCur]);
    else if (name === 'launch') { if (view === 'detail') launch(game); else if (zone === 'hero') launch(games[heroCur]); else if (zone === 'grid') launch(shown[cur]); }
  };
  // X and Y mean different things in the two views (as on the old game centre)
  const actX = () => act(view === 'detail' ? 'preview' : 'sort');
  const actY = () => act(view === 'detail' ? 'fav' : 'filter');
  const shoulder = (step) => act(view === 'detail' ? (step < 0 ? 'media-prev' : 'media-next') : (step < 0 ? 'tab-prev' : 'tab-next'));

  // ---------------- footer hints ----------------
  const HINTS = {
    lib: [['confirm', 'Enter', 'A', '確認 / 選擇'], ['back', 'Esc', 'B', '取消 / 返回'], ['sort', 'X', 'X', '排序'], ['filter', 'Y', 'Y', '篩選'], ['tab-next', 'Q · E', 'LB · RB', '切換分類'], ['launch', null, 'START', '直接啟動']],
    detail: [['confirm', 'Enter', 'A', '啟動遊戲'], ['back', 'Esc', 'B', '返回遊戲庫'], ['preview', 'X', 'X', '放大畫面'], ['fav', 'Y', 'Y', '切換最愛'], ['media-next', '← →', 'LB · RB', '切換畫面']],
    list: [['confirm', 'Enter', 'A', '確認'], ['back', 'Esc', 'B', '關閉']],
    preview: [['media-next', '← →', '← →', '切換畫面'], ['back', 'Esc', 'B', '關閉']],
  };
  function hints() {
    const isPad = pad.mode === 'pad';
    const set = HINTS[modal === 'preview' ? 'preview' : modal ? 'list' : view];
    $('hints').replaceChildren(...set.filter(([, key]) => isPad || key).map(([name, key, btn, label]) => {
      const b = el('button');
      b.type = 'button'; b.dataset.act = name; b.tabIndex = -1;
      b.append(el('kbd', isPad ? `is-pad is-${btn.toLowerCase()}` : null, isPad ? btn : key), el('span', null, label));
      return b;
    }));
    $('device').textContent = isPad ? 'GAMEPAD' : 'KEYBOARD';
  }
  off.push(pad.onMode(() => { hints(); if (view === 'detail' && !ctlDev) fillControls(); }));

  // ---------------- toast ----------------
  let noteEl = null, noteT = 0;
  function note(text) {
    if (!noteEl) { noteEl = el('p', 'gc-note'); noteEl.setAttribute('role', 'status'); gc.append(noteEl); }
    noteEl.textContent = text;
    noteEl.classList.add('is-on');
    clearTimeout(noteT);
    noteT = setTimeout(() => noteEl.classList.remove('is-on'), 1800);
  }

  // ---------------- input: pointer ----------------
  const onClick = (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const t = e.target;
    const fav = t.closest('[data-fav]');
    if (fav) { toggleFav(fav.dataset.fav); return; }
    const card = t.closest('[data-card]');
    if (card) {                                   // a card opens the game's entry, not the game
      e.preventDefault();
      const i = shown.findIndex((g) => cards[g.id].contains(card));
      if (i >= 0) { cur = i; zone = 'grid'; openDetail(shown[i]); }
      return;
    }
    const play = t.closest('[data-gc="hero-play"], [data-gc="launch"]');
    if (play) { e.preventDefault(); launch(play.dataset.gc === 'launch' ? game : games[heroCur]); return; }
    const dot = t.closest('[data-hero]');
    if (dot) { setHero(Number(dot.dataset.hero), true); return; }
    const tb = t.closest('[data-tab]');
    if (tb) { setTab(Number(tb.dataset.tab)); return; }
    const opt = t.closest('[data-opt]');
    if (opt) { pick(Number(opt.dataset.opt)); return; }
    const ct = t.closest('[data-ctl]');
    if (ct) { ctlDev = ct.dataset.ctl; fillControls(); return; }
    const th = t.closest('[data-shot]');
    if (th) { setShot(Number(th.dataset.shot)); return; }
    const a = t.closest('[data-act]');
    if (a) { act(a.dataset.act); return; }
    if (t === modalEl || t === preview) closeModal();
  };
  const onOver = (e) => {
    if (e.pointerType !== 'mouse' || view !== 'lib' || modal) return;
    const card = e.target.closest?.('[data-card]');
    if (!card) return;
    const i = shown.findIndex((g) => cards[g.id].contains(card));
    if (i >= 0 && (i !== cur || zone !== 'grid')) { cur = i; zone = 'grid'; heroPause(); if (marked) marked.classList.remove('is-focus'); marked = card; card.classList.add('is-focus'); }
  };
  // Tab-key focus keeps the model in step
  const onFocusIn = (e) => {
    const card = e.target.closest?.('[data-card]');
    if (card) { const i = shown.findIndex((g) => cards[g.id].contains(card)); if (i >= 0) { cur = i; zone = 'grid'; } }
    else if (e.target === hero) zone = 'hero';
    heroPause();
  };
  gc.addEventListener('click', onClick);
  gc.addEventListener('pointerover', onOver);
  gc.addEventListener('focusin', onFocusIn);

  // the header's back control goes one level up: detail → library → works
  const onBack = (e) => {
    if (view !== 'detail' && !modal) return;
    if (!e.target.closest?.('.nx-header [data-back]')) return;
    e.preventDefault(); e.stopPropagation();
    back();
  };
  document.addEventListener('click', onBack, true);
  const onHome = () => { if (modal) closeModal(false); if (view === 'detail') closeDetail(); zone = 'grid'; scroller().scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); focusNow(false); };
  addEventListener('nx:gc-home', onHome);

  // ---------------- input: keyboard ----------------
  const busy = () => !!document.querySelector('.nx-menu.is-open, .nx-settings.is-open');
  const ARROW = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || busy()) return;
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable]')) return;
    if (t.closest?.('.nx-header, .nx-settings, .nx-menu')) return;         // the shell's own controls keep their keys
    const k = e.key;
    if (ARROW[k]) { e.preventDefault(); move(ARROW[k]); return; }
    if (k === 'Enter' || k === ' ') {
      // a control that has the real focus acts for itself (a favourite heart, a tab, a thumbnail …)
      const own = t.closest?.('button, a');
      if (own && own !== marked && !own.matches('[data-card]')) return;
      e.preventDefault(); confirm(); return;
    }
    if (k === 'Escape' || k === 'Backspace') { if (modal || view === 'detail' || zone !== 'grid') { e.preventDefault(); back(); } return; }
    const c = k.length === 1 ? k.toLowerCase() : k;
    if (c === 'x') actX();
    else if (c === 'y') actY();
    else if (c === 'q' || c === 'PageUp') { e.preventDefault(); shoulder(-1); }
    else if (c === 'e' || c === 'PageDown') { e.preventDefault(); shoulder(1); }
  };
  // capture phase: decided before the shell's own Escape handling closes a drawer
  addEventListener('keydown', onKey, true);

  // ---------------- input: gamepad ----------------
  off.push(pad.on((e) => {
    if (e.type !== 'press' || !main.isConnected || busy()) return;
    const k = e.key;
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') move(k);
    else if (e.repeat) return;
    else if (k === 'a') confirm();
    else if (k === 'b') back();
    else if (k === 'x') actX();
    else if (k === 'y') actY();
    else if (k === 'lb') shoulder(-1);
    else if (k === 'rb') shoulder(1);
    else if (k === 'start') act('launch');
  }));

  // ---------------- start ----------------
  hero.tabIndex = -1;
  renderTabs();
  let last = null;
  try { last = sessionStorage.getItem(LAST); } catch { /* private mode */ }
  apply(last);
  syncFavs();
  setHero(Math.max(0, games.findIndex((g) => g.id === last)));
  setView('lib');
  const wanted = byId(decodeURIComponent(location.hash.slice(1)));
  if (wanted) { const at = shown.indexOf(wanted); if (at >= 0) cur = at; openDetail(wanted, false); }
  else if (last && byId(last)) { marked = cardHit(cur); marked?.classList.add('is-focus'); }   // back from a game: its card is marked
  const onResize = () => { if (view === 'lib' && !modal && zone === 'grid' && marked) marked.scrollIntoView({ block: 'nearest' }); if (view === 'detail') more(); };
  addEventListener('resize', onResize);

  // backdrop: the helix of the works index, held on this entry
  const index = Math.max(0, works.indexOf(hub));
  // (not awaited: the library is usable before the world behind it has finished loading)
  const backdrop = stage(main, { from: 5.3 + (0.42 * index) / Math.max(1, works.length - 1), shift: 0.1 });

  return () => {
    backdrop.cleanup();
    off.forEach((f) => f());
    clearTimeout(noteT);
    removeEventListener('keydown', onKey, true);
    marked?.classList.remove('is-focus');
    removeEventListener('resize', onResize);
    removeEventListener('nx:gc-home', onHome);
    document.removeEventListener('click', onBack, true);
  };
}
