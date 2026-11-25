// Client-side router: swaps <main id="view"> between real HTML documents without reloading
// the shell, so the header, settings, the Live2D widget and the WebGL world stay alive across navigation.
// Every route is also a real file, so deep links, reloads and no-JS visitors still work.
//
// A route change is one continuous shot. The world is never covered and never cut: the camera and
// every object in it fly from where the old page left them to where the new page needs them
// (world.fly), while the old page's copy dissolves out over the first part of the flight and the
// new page's copy resolves in over the last part.
import { world } from '../home/world.js';
import { reducedMotion } from './store.js';

const PAGES = {
  home: () => import('../pages/home.js'),
  profile: () => import('../pages/profile.js'),
  works: () => import('../pages/works.js'),
  app: () => import('../pages/app.js'),
  games: () => import('../pages/games.js'),
  sakura: () => import('../pages/sakura.js'),
  live2d: () => import('../pages/live2d.js'),
  music: () => import('../pages/music.js'),
  webos: () => import('../pages/webos.js'),
  lore: () => import('../pages/lore.js'),
  models: () => import('../pages/models.js'),
  model: () => import('../pages/model.js'),
  room: () => import('../pages/room.js'),
  notfound: () => import('../pages/notfound.js'),
};

const cache = new Map();
let build = null;            // build id of the scripts this tab is running (see tools/build.mjs)
let cleanup = null;
let navId = 0;
let depth = 0;               // in-site pages below the current one in this tab's history
let prev = null;             // the route the visitor was on before this one (null after a history step)
const hooks = { before: [], after: [] };

const main = () => document.getElementById('view');
const isInternal = (url) => url.origin === location.origin
  && !url.pathname.startsWith('/legacy/') && !url.pathname.startsWith('/assets/')
  && !/\.[a-z0-9]+$/i.test(url.pathname.replace(/\.html$/i, ''));

async function fetchDoc(href) {
  if (!cache.has(href)) {
    cache.set(href, fetch(href, { headers: { accept: 'text/html' }, cache: 'no-cache' }).then(async (r) => {
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const m = doc.getElementById('view');
      if (!m) throw new Error('not a site page');
      return m;
    }).catch((e) => { cache.delete(href); throw e; }));
  }
  const doc = (await cache.get(href)).cloneNode(true);
  setTimeout(() => cache.delete(href), 30000);       // keep it for the hover → click moment, not for the life of the tab
  return doc;
}

async function mountCurrent() {
  const el = main();
  const name = el.dataset.page;
  document.documentElement.dataset.page = name;
  if (el.dataset.title) document.title = el.dataset.title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta && el.dataset.desc) meta.content = el.dataset.desc;
  try {
    const mod = await (PAGES[name] || PAGES.notfound)();
    cleanup = (await mod.mount(el)) || null;
  } catch (e) {
    console.error('[router] page mount failed', e);
  }
  hooks.after.forEach((fn) => fn(name, el));
}

async function go(href, { push = true, wipe = true } = {}) {
  const url = new URL(href, location.href);
  const id = ++navId;
  hooks.before.forEach((fn) => fn(url));
  let next;
  try { next = await fetchDoc(url.pathname + url.search); } catch {
    location.href = url.href; // fall back to a normal navigation
    return;
  }
  if (id !== navId) return;
  // the site was rebuilt since this tab loaded: take the new scripts along with the new page
  if (build && next.dataset.build && next.dataset.build !== build) { location.href = url.href; return; }
  const fx = wipe && !reducedMotion();
  const cur = main();
  const from = fx ? world.snapshot() : null;          // the frame we are leaving, to fly from
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  world.fly(from);                                    // holds that frame until the next page drives
  document.querySelectorAll('.nx-ghost').forEach((g) => g.remove());
  if (fx) {
    // the page being left stays exactly where it is on screen and dissolves; it is no longer the view
    cur.style.top = `${-scrollY}px`;
    cur.removeAttribute('id');
    cur.classList.add('nx-ghost');
    cur.inert = true;
    cur.setAttribute('aria-hidden', 'true');
    next.classList.add('nx-enter');
    cur.after(next);
    // leave when the dissolve has actually finished (a slow device may start it late), or after 2 s at most
    const gone = () => cur.remove();
    cur.addEventListener('animationend', (e) => { if (e.target === cur) gone(); });
    setTimeout(gone, 2000);
  } else {
    cur.replaceWith(next);
  }
  if (push) { prev = location.pathname; history.pushState({}, '', url.href); depth += 1; } else prev = null;
  scrollTo(0, 0);
  await mountCurrent();
  world.land();
  if (id !== navId) return;
  if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
  next.focus({ preventScroll: true });
  const live = document.querySelector('.nx-live');
  if (live) live.textContent = document.title;
  if (fx) {
    const done = () => next.classList.remove('nx-enter');
    next.addEventListener('animationend', (e) => { if (e.target === next) done(); });
    setTimeout(done, 4000);
  }
}

function onClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (!isInternal(url)) return;
  if (url.pathname === location.pathname && url.search === location.search) {
    if (url.hash) return; // in-page anchor: let the page handle it
    e.preventDefault();
    scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  e.preventDefault();
  go(url.href);
}

function onHover(e) {
  const a = e.target.closest?.('a[href]');
  if (!a || a.target === '_blank') return;
  const url = new URL(a.href, location.href);
  if (isInternal(url) && url.pathname !== location.pathname) fetchDoc(url.pathname + url.search).catch(() => {});
}

export const router = {
  start() {
    history.scrollRestoration = 'manual';
    build = main().dataset.build || null;
    document.addEventListener('click', onClick);
    document.addEventListener('pointerover', onHover, { passive: true });
    addEventListener('popstate', () => { depth = Math.max(0, depth - 1); go(location.href, { push: false }); });
    return mountCurrent();
  },
  go,
  /** Go up to `parent`. If that is where the visitor just came from, this is a plain step back in history. */
  back(parent) { if (depth > 0 && prev === parent) history.back(); else go(parent); },
  before: (fn) => hooks.before.push(fn),
  after: (fn) => hooks.after.push(fn),
};
