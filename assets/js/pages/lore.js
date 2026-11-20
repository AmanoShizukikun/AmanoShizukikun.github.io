// The world page (/apps/nijigen/). Markup: src/pages/lore.mjs · content: data/lore.js · styles: css/lore.css.
// Everything here follows the scroll (forward, hold, rewind); only the first print of the dots plays once.
//   film    four paintings crossed by scrolling: a dot-matrix print gives way to the first one, each is pushed
//           in slowly while it is on, fog closes over the cut to the next
//   ledger  the entry nearest the reading line is the open one; its sign is printed in dots beside the list
//   atlas   pinned: scrolling goes from place to place (the list jumps there)
//   cast    one poster per character: groups, a row of faces, arrow keys; /apps/nijigen/#<id> opens on one
//   reel    pinned: scrolling pulls the sixteen chapters sideways
import { store, reducedMotion } from '../core/store.js';
import { acts } from '../data/lore.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const bell = (x, w) => Math.exp(-((x / w) ** 2));
const hash2 = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

export async function mount(main) {
  const lr = main.querySelector('.lr');
  if (!lr) return null;
  const html = document.documentElement;
  const off = [];
  const on = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); off.push(() => el.removeEventListener(type, fn, opt)); };
  const $ = (name, root = lr) => root.querySelector(`[data-lr="${name}"]`);
  lr.classList.add('lr--ui');
  const pinned = matchMedia('(min-width: 900px) and (min-height: 560px)');
  const ink = () => (store.get('theme') === 'light' ? '#101112' : '#ecebe5');
  // how far a pinned block has been scrolled through, 0 → 1
  const through = (el) => { const r = el.getBoundingClientRect(), span = r.height - innerHeight; return span > 0 ? clamp01(-r.top / span) : 0; };

  // ---------- tabs: one list of buttons carrying data-<key>, and everything else carrying the same data-<key> ----------
  function tabs(box, key, onChange) {
    const buttons = [...box.querySelectorAll(`[role="tab"][data-${key}]`)];
    const ids = buttons.map((b) => b.dataset[key]);
    let cur = -1;
    const select = (i, focus) => {
      i = Math.min(ids.length - 1, Math.max(0, i));
      if (i === cur) return;
      cur = i;
      box.querySelectorAll(`[data-${key}]`).forEach((el) => {
        const hit = el.dataset[key] === ids[i];
        if (el.getAttribute('role') === 'tab') { el.setAttribute('aria-selected', hit); el.tabIndex = hit ? 0 : -1; }
        else el.classList.toggle('is-on', hit);
      });
      if (focus) buttons[i].focus({ preventScroll: true });
      onChange?.(ids[i], i);
    };
    on(box, 'keydown', (e) => {
      if (!e.target.closest?.('[role="tab"]')) return;
      const visible = buttons.filter((b) => b.offsetParent !== null), at = visible.indexOf(buttons[cur]);
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step || at < 0) return;
      e.preventDefault();
      const next = visible[(at + step + visible.length) % visible.length];
      next.click(); next.focus({ preventScroll: true });
    });
    select(0);
    return { select: (id, focus) => { const i = ids.indexOf(id); if (i >= 0) select(i, focus); return i >= 0; }, at: (i) => select(i), get index() { return cur; }, ids, buttons };
  }

  // ---------- dots: a picture, or a sign, printed as a matrix of dots ----------
  // `cells` = brightness 0–1 per cell (cols × rows); `shown` = how much of it has been printed (0–1)
  function printDots(canvas, cells, cols, rows, shown, { cover = false, faint = 0, alpha = 1 } = {}) {
    const dpr = Math.min(2, devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const step = cover ? Math.max(w / cols, h / rows) : Math.min(w / cols, h / rows);
    const ox = (w - step * cols) / 2, oy = (h - step * rows) / 2;
    ctx.fillStyle = ink();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v = cells[j * cols + i], seen = hash2(i, j) < shown;
        const r = seen ? step * 0.5 * Math.pow(v, 0.75) : 0;
        const rr = Math.max(r, faint * step);
        if (rr < 0.35) continue;
        ctx.globalAlpha = r > faint * step ? alpha : 0.16;
        ctx.beginPath(); ctx.arc(ox + (i + 0.5) * step, oy + (j + 0.5) * step, rr, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  const scratch = document.createElement('canvas'), sctx = scratch.getContext('2d', { willReadFrequently: true });
  // the sign of a ledger entry: one character, rasterised
  function signOf(ch, n = 34) {
    scratch.width = scratch.height = n;
    sctx.clearRect(0, 0, n, n);
    sctx.fillStyle = '#000'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
    sctx.font = `700 ${Math.round(n * 0.9)}px "Noto Serif TC", "Source Han Serif TC", "Songti TC", "PMingLiU", serif`;
    sctx.fillText(ch, n / 2, n / 2 + n * 0.04);
    const d = sctx.getImageData(0, 0, n, n).data, cells = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) cells[i] = d[i * 4 + 3] / 255 > 0.42 ? 0.86 : 0;
    return cells;
  }

  // ---------- 00 film ----------
  const film = lr.querySelector('.lr-film'), stage = film.querySelector('.lr-film__stage');
  const shots = [...film.querySelectorAll('.lr-shot')], caps = [...film.querySelectorAll('.lr-cap')];
  const fog = film.querySelector('.lr-fog'), title = $('title'), pct = $('pct'), dots = $('dots');
  const N = shots.length;
  let picture = null, printed = reducedMotion() ? 1 : 0, filmU = 0;
  const COLS = 112, ROWS = 63;
  // (printed pale, so the title set over it stays the darkest — or the lightest — thing on the sheet)
  const drawPicture = () => { if (picture) printDots(dots, picture, COLS, ROWS, printed, { cover: true, alpha: 0.42 }); };
  {
    const img = new Image();
    img.onload = () => {
      scratch.width = COLS; scratch.height = ROWS;
      sctx.drawImage(img, 0, 0, COLS, ROWS);
      const d = sctx.getImageData(0, 0, COLS, ROWS).data;
      picture = new Float32Array(COLS * ROWS);
      // what is printed is the light of the painting (it is a night scene: printing its darkness would fill the
      // sheet) — light dots on the dark page, ink dots on paper
      for (let i = 0; i < COLS * ROWS; i++) { const l = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255; picture[i] = Math.min(1, l * 1.5); }
      const t0 = performance.now();
      const print = (now) => {                             // the one thing that plays: the sheet is printed once
        if (!lr.isConnected) return;
        printed = reducedMotion() ? 1 : clamp01((now - t0) / 1300);
        drawPicture();
        if (printed < 1) requestAnimationFrame(print);
      };
      requestAnimationFrame(print);
    };
    img.src = dots.dataset.src;
    off.push(store.on('theme', () => { img.onload?.(); }));
  }
  function playFilm() {
    const p = through(film), u = p * (N + 0.5);
    filmU = u;
    stage.style.setProperty('--dots', (1 - smooth(0.14, 0.5, u)).toFixed(3));
    title.style.setProperty('--t', (1 - smooth(0.22, 0.46, u)).toFixed(3));
    let mist = bell(u - 0.36, 0.14) * 0.9;
    shots.forEach((el, i) => {
      const k = u - 0.5 - i;                               // 0 → 1 while this painting is the one on screen
      const o = (i === 0 ? 1 : smooth(-0.12, 0.06, k)) * (i === N - 1 ? 1 : 1 - smooth(0.94, 1.1, k));
      el.style.setProperty('--o', o.toFixed(3));
      el.style.setProperty('--v', o > 0.002 ? 'visible' : 'hidden');
      if (o > 0.002) {
        const kk = clamp01((k + 0.5) / 1.6);
        el.style.setProperty('--s', (1.24 - 0.22 * kk).toFixed(4));
        el.style.setProperty('--y', `${((0.5 - kk) * 3).toFixed(2)}%`);
        el.style.setProperty('--co', smooth(0.1, 0.42, k).toFixed(3));
        el.style.setProperty('--cx', ((1 - smooth(0.05, 0.9, k)) * 140).toFixed(1));
      }
      if (i < N - 1) mist = Math.max(mist, bell(k - 1.0, 0.13));
      const cap = caps[i];
      cap.style.setProperty('--o', (smooth(0.14, 0.34, k) * (i === N - 1 ? 1 : 1 - smooth(0.74, 0.9, k))).toFixed(3));
    });
    fog.style.setProperty('--fog', mist.toFixed(3));
    fog.style.setProperty('--fx', ((u * 37) % 60 - 30).toFixed(2));
    pct.textContent = String(Math.round(p * 100)).padStart(3, '0');
  }

  // ---------- 01 / 05 ledgers ----------
  const ledgers = [...lr.querySelectorAll('[data-lr="ledger"]')].map((box) => {
    const items = [...box.querySelectorAll('.lr-ledger__list li')], canvas = box.querySelector('canvas');
    const signs = items.map((li) => signOf(li.dataset.glyph));
    let cur = -1;
    const open = (i) => {
      if (i === cur) return;
      cur = i;
      items.forEach((li, k) => li.classList.toggle('is-on', k === i));
      printDots(canvas, signs[i], 34, 34, 1, { faint: 0.07 });
    };
    items.forEach((li, i) => { on(li, 'pointerenter', () => open(i)); on(li, 'focusin', () => open(i)); });
    return {
      read() {                                             // the entry nearest the reading line (45 % down the window)
        const line = innerHeight * 0.45;
        let best = 0, dist = Infinity;
        items.forEach((li, i) => { const r = li.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - line); if (d < dist) { dist = d; best = i; } });
        const r = box.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) open(best);
      },
      redraw() { const i = Math.max(0, cur); cur = -1; open(i); },
    };
  });

  // ---------- 02 atlas ----------
  const atlas = $('atlas'), realmNo = $('realm-no');
  const realms = tabs(atlas, 'realm', (id, i) => { realmNo.textContent = String(i + 1).padStart(2, '0'); });
  const atlasTop = (i) => atlas.getBoundingClientRect().top + scrollY + (atlas.offsetHeight - innerHeight) * (i / (realms.ids.length - 1));
  on(atlas, 'click', (e) => {
    const b = e.target.closest('[role="tab"]');
    if (!b) return;
    const i = realms.buttons.indexOf(b);
    if (pinned.matches) scrollTo({ top: atlasTop(i), behavior: reducedMotion() ? 'auto' : 'smooth' }); else realms.at(i);
  });
  let realmAt = 0;
  function readAtlas() {
    if (!pinned.matches) return;
    const at = through(atlas) * (realms.ids.length - 1);
    if (Math.abs(at - realmAt) > 0.56) realmAt = Math.round(at);
    realms.at(realmAt);
  }

  // ---------- 03 cast ----------
  const castBox = $('cast'), castEn = $('cast-en');
  const groupButtons = [...castBox.querySelectorAll('[data-group][aria-pressed]')], faces = [...castBox.querySelectorAll('.lr-cast__tabs li')];
  const showGroup = (g) => {
    groupButtons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.group === g));
    faces.forEach((li) => li.classList.toggle('is-out', li.dataset.group !== g));
  };
  const cast = tabs(castBox, 'cast', (id) => {
    const file = castBox.querySelector(`.lr-file[data-cast="${id}"]`);
    castBox.style.setProperty('--tone', file.style.getPropertyValue('--tone'));
    castEn.textContent = file.dataset.en;
    showGroup(castBox.querySelector(`.lr-cast__tabs [data-cast="${id}"]`).parentElement.dataset.group);
  });
  on(castBox, 'click', (e) => {
    const tab = e.target.closest('[role="tab"]'), group = e.target.closest('[data-group][aria-pressed]');
    if (tab) cast.select(tab.dataset.cast);
    else if (group) { const first = faces.find((li) => li.dataset.group === group.dataset.group); cast.select(first.firstElementChild.dataset.cast); }
  });
  on(castBox, 'pointermove', (e) => { if (!e.pointerType || e.pointerType === 'mouse') castBox.style.setProperty('--px', ((e.clientX / innerWidth - 0.5) * 2).toFixed(3)); }, { passive: true });

  // ---------- 04 reel ----------
  const reel = $('reel'), strip = reel.querySelector('.lr-reel__strip'), cards = [...strip.children], backs = [...reel.querySelectorAll('.lr-reel__back figure')];
  const bar = reel.querySelector('.lr-reel__bar'), actNo = $('act-no'), actZh = $('act-zh'), actEn = $('act-en');
  let chapter = -1;
  function turnReel() {
    if (!pinned.matches) { strip.style.removeProperty('--x'); cards.forEach((c) => c.classList.add('is-on')); return; }
    const p = through(reel), last = cards.at(-1);
    strip.style.setProperty('--x', `${(-p * (last.offsetLeft - cards[0].offsetLeft)).toFixed(1)}px`);
    bar.style.setProperty('--p', p.toFixed(4));
    const now = Math.round(p * (cards.length - 1));
    if (now === chapter) return;
    chapter = now;
    cards.forEach((c, i) => c.classList.toggle('is-on', i === now));
    backs.forEach((f, i) => f.classList.toggle('is-on', i === now));
    const a = acts[Number(cards[now].dataset.act)];
    actNo.textContent = a.no; actZh.textContent = a.zh; actEn.textContent = a.en;
  }

  // ---------- sections, rail, address ----------
  const secs = [...lr.querySelectorAll('[data-sec]')], rail = [...lr.querySelectorAll('.lr-rail a')];
  let active = -1;
  function readSections() {
    let now = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.5) now = i; });
    if (now !== active) { active = now; rail.forEach((a, i) => a.classList.toggle('is-on', i === now)); }
    // the header and the rail turn light while a painting is behind them
    const id = secs[now].id, dark = (id === 'lr-top' && filmU > 0.42) || ((id === 'lr-realms' || id === 'lr-story') && pinned.matches && secs[now].getBoundingClientRect().top < 40);
    html.classList.toggle('lr-dark', dark);
  }
  on(lr, 'click', (e) => {
    const a = e.target.closest('a[href^="#lr-"]');
    if (!a) return;
    e.preventDefault();
    lr.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });
  // an address that names a character or a place opens the page on it
  const open = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    if (cast.select(id)) castBox.scrollIntoView({ block: 'start' });
    else if (realms.ids.includes(id)) { const i = realms.ids.indexOf(id); if (pinned.matches) scrollTo(0, atlasTop(i)); else lr.querySelector(`#lr-r-${id}`)?.scrollIntoView(); }
  };
  on(window, 'hashchange', open);

  let queued = false;
  const update = () => { queued = false; playFilm(); readAtlas(); turnReel(); ledgers.forEach((l) => l.read()); readSections(); };
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  const resized = () => { drawPicture(); ledgers.forEach((l) => l.redraw()); chapter = -1; ask(); };
  on(window, 'scroll', ask, { passive: true });
  on(window, 'resize', resized);
  off.push(store.on('theme', () => ledgers.forEach((l) => l.redraw())));
  document.fonts?.ready.then(() => { if (lr.isConnected) { ledgers.forEach((l) => l.redraw()); } });
  update();
  if (location.hash) { open(); update(); }

  return () => { off.forEach((f) => f()); html.classList.remove('lr-dark'); };
}
