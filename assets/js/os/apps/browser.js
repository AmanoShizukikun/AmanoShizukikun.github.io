// Browser: a frame with an address bar, history and bookmarks.
// What it can honestly do: open any page of this site, and any other site that allows itself to be embedded.
// Most large sites refuse (the browser enforces that, and a page cannot even find out that it happened), so an
// external address always comes with a "open in a new tab" strip instead of a blank frame and no explanation.
import { h, tool, btn, ico } from '../ui.js';
import { site, works, hrefOf } from '../../data/site.js';

const HOME = 'about:home';
const DEFAULT_MARKS = [['首頁', '/'], ['作品', '/works/'], ['長門櫻計畫', '/apps/nagato-sakura/']];

export function start(os, win, args = {}) {
  const state = os.cfg.app('browser');
  let hist = [], at = -1, frame = null;
  const marks = () => state.get('marks', DEFAULT_MARKS);

  const addr = h('input', { class: 'os-input wb-addr', type: 'text', spellcheck: false, autocomplete: 'off', placeholder: '輸入網址，或 / 開頭的站內路徑', 'aria-label': '網址' });
  const b = {
    back: tool('back', '上一頁', { onclick: () => step(-1) }), fwd: tool('fwd', '下一頁', { onclick: () => step(1) }),
    reload: tool('reload', '重新載入', { onclick: () => show(hist[at], true) }), home: tool('home', '首頁', { onclick: () => go(HOME) }),
    star: tool('star', '加入書籤', { onclick: () => toggleMark() }), ext: tool('ext', '在新分頁開啟', { onclick: () => { const u = hist[at]; if (u && u !== HOME) window.open(u, '_blank', 'noopener,noreferrer'); } }),
  };
  const bar = h('div', { class: 'wb-marks' });
  const note = h('p', { class: 'wb-note', hidden: true });
  const view = h('div', { class: 'wb-view' });
  win.body.append(h('div', { class: 'wb' }, h('form', { class: 'wb-bar', onsubmit: (e) => { e.preventDefault(); go(addr.value); } }, b.back, b.fwd, b.reload, b.home, addr, b.star, b.ext), bar, note, view));

  const isLocal = (u) => { try { return new URL(u, location.href).origin === location.origin; } catch { return false; } };
  /** What was typed → an address, or null when it is not one. */
  function parse(text) {
    const t = String(text).trim();
    if (!t || t === HOME) return HOME;
    if (t.startsWith('/')) return new URL(t, location.origin).href;
    if (/^https?:\/\//i.test(t)) { try { return new URL(t).href; } catch { return null; } }
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(t) || /^localhost(:\d+)?(\/.*)?$/.test(t)) { try { return new URL(`https://${t}`).href; } catch { return null; } }
    return null;
  }
  function go(text) {
    const url = parse(text);
    if (!url) {
      os.ui.dialog({
        title: '這不是網址', icon: 'globe', text: `「${String(text).trim()}」不是網址。\n這個瀏覽器只開網址；搜尋引擎不允許被嵌在別的網頁裡，所以搜尋要在新分頁進行。`,
        buttons: [{ label: '取消', value: false }, { label: '在新分頁搜尋', value: true, primary: true }],
      }).then((ok) => { if (ok) window.open(`https://duckduckgo.com/?q=${encodeURIComponent(String(text).trim())}`, '_blank', 'noopener,noreferrer'); });
      return;
    }
    hist = hist.slice(0, at + 1); hist.push(url); at = hist.length - 1;
    show(url);
  }
  function step(d) { if (hist[at + d]) { at += d; show(hist[at]); } }

  function homePage() {
    const tile = (label, sub, href, out) => h('button', { type: 'button', class: 'wb-tile', onclick: () => (out ? window.open(href, '_blank', 'noopener,noreferrer') : go(href)) }, h('b', null, label), h('span', null, sub), out ? ico('ext') : null);
    return h('div', { class: 'wb-home' },
      h('p', { class: 'wb-kicker' }, 'NEW TAB'), h('h2', null, site.name),
      h('h3', null, '本站'),
      h('div', { class: 'wb-tiles' }, tile('首頁', 'INDEX', '/'), tile('檔案', 'PROFILE', '/profile/'), tile('作品', 'WORKS', '/works/'), ...works.filter((w) => w.id !== 'webos' && !w.href).map((w) => tile(w.title, w.en, hrefOf(w)))),   // entries outside the site are under the external links
      h('h3', null, '外部連結（在新分頁開啟）'),
      h('div', { class: 'wb-tiles' }, site.links.map((l) => tile(l.label, new URL(l.href).hostname, l.href, true))),
      h('p', { class: 'wb-foot' }, '這個瀏覽器能開本站的每一頁，以及允許被嵌入的網站。多數大型網站不允許，請用右上角的按鈕在新分頁開啟。'));
  }
  function show(url, again = false) {
    if (!url) return;
    addr.value = url === HOME ? '' : url.startsWith(location.origin) ? url.slice(location.origin.length) : url;
    b.back.disabled = at <= 0; b.fwd.disabled = at >= hist.length - 1; b.ext.disabled = url === HOME;
    drawMarks();
    if (url === HOME) {
      frame = null; note.hidden = true;
      view.replaceChildren(homePage());
      win.setTitle('新分頁 — 瀏覽器');
      return;
    }
    const local = isLocal(url);
    note.hidden = local;
    if (!local) note.replaceChildren('外部網站可能拒絕被嵌入。如果下面是空白的：', h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, '在新分頁開啟 ↗'));
    win.setTitle(`${local ? new URL(url).pathname : new URL(url).hostname} — 瀏覽器`);
    if (frame && again && local) { try { frame.contentWindow.location.reload(); return; } catch { /* rebuild it */ } }
    frame = h('iframe', { class: 'wb-frame', title: '網頁', referrerpolicy: 'no-referrer', allow: 'fullscreen' });
    // a page of another site gets no access to this one; pages of this site run as they are
    if (!local) frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    const mine = frame;
    view.replaceChildren(h('div', { class: 'os-loading' }, h('i'), h('span', null, 'LOADING')), frame);
    frame.addEventListener('load', () => {
      if (mine !== frame) return;
      view.querySelector('.os-loading')?.remove();
      // links followed inside a page of this site show up in the address bar and the history
      try {
        const now = frame.contentWindow.location.href;
        if (now && now !== 'about:blank' && now !== hist[at]) { hist = hist.slice(0, at + 1); hist.push(now); at = hist.length - 1; addr.value = now.slice(location.origin.length); b.back.disabled = false; b.fwd.disabled = true; drawMarks(); }
        const t = frame.contentDocument.title;
        if (t) win.setTitle(`${t} — 瀏覽器`);
      } catch { /* another origin: nothing to read */ }
    });
    frame.src = url;
  }

  function drawMarks() {
    const cur = hist[at], list = marks();
    const here = cur && cur !== HOME ? (cur.startsWith(location.origin) ? cur.slice(location.origin.length) : cur) : null;
    const on = !!here && list.some((m) => m[1] === here);
    b.star.classList.toggle('is-on', on);
    b.star.title = on ? '移除書籤' : '加入書籤'; b.star.setAttribute('aria-label', b.star.title);
    b.star.disabled = !here;
    bar.replaceChildren(...list.map(([label, href], i) => h('button', { type: 'button', data: { i }, title: href }, label)));
    bar.hidden = !list.length;
  }
  async function toggleMark() {
    const cur = hist[at];
    if (!cur || cur === HOME) return;
    const here = cur.startsWith(location.origin) ? cur.slice(location.origin.length) : cur, list = marks();
    if (list.some((m) => m[1] === here)) { state.set('marks', list.filter((m) => m[1] !== here)); drawMarks(); return; }
    let title = here;
    try { title = frame?.contentDocument?.title || here; } catch { /* another origin */ }
    const name = await os.ui.prompt('書籤名稱', title.slice(0, 40), { title: '加入書籤', ok: '加入' });
    if (name == null || !name.trim()) return;
    state.set('marks', [...list, [name.trim().slice(0, 40), here]].slice(-16));
    drawMarks();
  }
  bar.addEventListener('click', (e) => { const x = e.target.closest('[data-i]'); if (x) go(marks()[Number(x.dataset.i)][1]); });
  bar.addEventListener('contextmenu', (e) => {
    const x = e.target.closest('[data-i]');
    if (!x) return;
    e.preventDefault(); e.stopPropagation();
    const i = Number(x.dataset.i);
    os.ui.menu([{ label: '開啟', icon: 'globe', action: () => go(marks()[i][1]) }, { label: '移除書籤', icon: 'trash', danger: true, action: () => { state.set('marks', marks().filter((_, k) => k !== i)); drawMarks(); } }], { x: e.clientX, y: e.clientY });
  });
  addr.addEventListener('focus', () => addr.select());
  win.cleanup.push(() => { try { frame?.contentWindow.location.replace('about:blank'); } catch { /* another origin */ } });

  go(args.url || HOME);
  return null;
}
