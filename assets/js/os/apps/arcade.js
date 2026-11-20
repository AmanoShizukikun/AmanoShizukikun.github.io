// Arcade: the site's games and interactive works, each opened in a window of its own.
// Play time is recorded in the same place as the site's game centre (core/library.js), so both show the same hours.
import { h, btn } from '../ui.js';
import { works } from '../../data/site.js';
import { library } from '../../core/library.js';

const hub = works.find((w) => w.id === 'game-center');
// the games of the game centre, then the works that are a single interactive document
const TITLES = [
  ...(hub ? hub.items : []).filter((g) => g.src).map((g) => ({ ...g, group: '遊戲' })),
  ...works.filter((w) => w.id !== 'game-center').flatMap((w) => (w.items || []).filter((i) => i.src).map((i) => ({ ...i, img: i.img || w.img, en: i.en || w.en, desc: i.desc || w.desc, group: w.title }))),
  ...works.filter((w) => w.src && !(w.items || []).some((i) => i.src)).map((w) => ({ id: w.id, title: (w.items && w.items[0]?.title) || w.title, note: w.kind, en: w.en, desc: w.desc, img: w.img, src: w.src, group: w.title })),
];
const playTime = (s) => (s < 1 ? '尚未遊玩' : s < 60 ? '不到 1 分鐘' : s < 3600 ? `${Math.round(s / 60)} 分鐘` : `${(s / 3600).toFixed(1)} 小時`);

export function start(os, win) {
  const grid = h('div', { class: 'ar-grid' });
  const info = h('aside', { class: 'ar-info' });
  let cur = TITLES[0];
  win.body.append(h('div', { class: 'ar' }, h('div', { class: 'ar-list' }, h('p', { class: 'ar-kicker' }, 'LIBRARY'), grid), info));

  function draw() {
    grid.replaceChildren(...TITLES.map((t) => h('button', { type: 'button', class: `ar-card${t === cur ? ' is-on' : ''}`, data: { id: t.id } },
      h('span', { class: 'ar-card__img' }, t.img ? h('img', { src: `/assets/img/${t.img}`, alt: '', loading: 'lazy', decoding: 'async' }) : h('i', null, 'NO CAPTURE')),
      h('b', null, t.title), h('span', null, t.note || t.group))));
    const s = library.stat(cur.id), open = os.wm.byApp('game').find((w) => w.game === cur.id);
    info.replaceChildren(
      h('p', { class: 'ar-kicker' }, cur.group), h('h2', null, cur.title), h('p', { class: 'ar-en' }, cur.en || ''),
      h('p', { class: 'ar-desc' }, cur.desc || ''),
      h('dl', { class: 'os-rows' }, [['遊玩時間', playTime(s.time)], ['上次開啟', s.last ? new Date(s.last).toLocaleDateString('zh-TW') : '—'], cur.input ? ['操作', cur.input] : null].filter(Boolean).map(([a, b]) => h('div', null, h('dt', null, a), h('dd', null, b)))),
      btn(open ? '切換到視窗' : '啟動', { cls: 'is-primary ar-go', icon: 'play', onclick: () => (open ? os.wm.focus(open) : os.launch('game', { id: cur.id })) }));
  }
  grid.addEventListener('click', (e) => { const b = e.target.closest('.ar-card'); if (b) { cur = TITLES.find((t) => t.id === b.dataset.id); draw(); } });
  grid.addEventListener('dblclick', (e) => { const b = e.target.closest('.ar-card'); if (b) os.launch('game', { id: b.dataset.id }); });
  win.cleanup.push(os.bus.on('wm', draw));
  draw();
  return null;
}

/** One game in one window. */
export function startGame(os, win, args = {}) {
  const t = TITLES.find((x) => x.id === args.id);
  if (!t) throw new Error(`找不到「${args.id}」。`);
  win.game = t.id;
  win.setTitle(t.title);
  const frame = h('iframe', { class: 'ar-frame', title: t.title, allow: 'autoplay; fullscreen; gamepad; midi; clipboard-write', src: t.src });
  const cover = h('div', { class: 'os-loading' }, h('i'), h('span', null, `LOADING ${t.title.toUpperCase()}`));
  win.body.append(frame, cover);
  frame.addEventListener('load', () => cover.remove());
  const done = library.begin(t.id);
  // an embedded game that sends itself "back to the game centre" (assets/js/embed.js) closes its window instead
  const onMessage = (e) => { if (e.origin === location.origin && e.source === frame.contentWindow && e.data && e.data.nx === 'go') win.close(); };
  addEventListener('message', onMessage);
  win.cleanup.push(() => {
    done();
    removeEventListener('message', onMessage);
    try { frame.contentWindow.location.replace('about:blank'); } catch { /* already gone */ }
  });
  return null;
}
