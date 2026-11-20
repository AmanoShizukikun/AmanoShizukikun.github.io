// The game centre's side rail: part of the shell, shown on the library page and on every game opened
// from it (one rail for the whole section — the games' own copies inside the frame are switched off).
//   展開 / 摺疊     icon rail ↔ rail with labels
//   遊戲中心        back to the library (inside the library: back to its first screen)
//   幀數顯示        the frame-rate monitor (shell/osd.js)
//   關閉左側欄      hides the rail; it comes back from the settings drawer
// With a gamepad, holding VIEW inside a game returns to the library.
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { pad } from '../core/gamepad.js';

export const HUB = '/apps/game-center/';
const HOLD = 800;       // ms VIEW has to be held

export function initSidebar(root) {
  const html = document.documentElement;
  const side = root.querySelector('.nx-side');
  const hold = root.querySelector('.nx-hold');
  const btn = (name) => side.querySelector(`[data-side="${name}"]`);
  let inSection = false, inGame = false;

  const sync = () => {
    const shown = store.get('nxSide') === 'true', wide = store.get('nxSideWide') === 'true';
    html.classList.toggle('nx-side-off', !shown);
    html.classList.toggle('nx-side-wide', wide);
    side.inert = !(inSection && shown);
    const t = btn('toggle');
    t.setAttribute('aria-expanded', String(wide));
    t.title = wide ? '摺疊側邊欄' : '展開側邊欄';
    t.querySelector('span').textContent = wide ? '摺疊' : '展開';
    btn('fps').setAttribute('aria-pressed', String(store.get('nxFps') === 'true'));
    // the page (and a game inside the frame) lays itself out again for the new width
    requestAnimationFrame(() => dispatchEvent(new Event('resize')));
  };
  ['nxSide', 'nxSideWide', 'nxFps'].forEach((k) => store.on(k, sync));

  side.addEventListener('click', (e) => {
    const b = e.target.closest('[data-side]');
    if (!b) return;
    const act = b.dataset.side;
    if (act === 'toggle') store.set('nxSideWide', store.get('nxSideWide') === 'true' ? 'false' : 'true');
    else if (act === 'fps') store.set('nxFps', store.get('nxFps') === 'true' ? 'false' : 'true');
    else if (act === 'hide') store.set('nxSide', 'false');
    else if (act === 'hub') { if (location.pathname === HUB) dispatchEvent(new CustomEvent('nx:gc-home')); else router.go(HUB); }
  });

  router.after((page, main) => {
    inSection = page === 'games' || main.dataset.back === HUB;
    inGame = inSection && page === 'app';
    html.classList.toggle('nx-gc', inSection);
    hold.hidden = true;
    sync();
  });

  // gamepad: hold VIEW in a game → back to the library
  let fired = false;
  pad.on((e) => {
    if (e.key !== 'view') return;
    if (e.type === 'release') { fired = false; hold.hidden = true; return; }
    if (e.type !== 'hold' || !inGame || fired) return;
    const k = Math.min(1, e.ms / HOLD);
    hold.hidden = e.ms < 120;
    hold.style.setProperty('--k', k.toFixed(3));
    if (k >= 1) { fired = true; hold.hidden = true; router.go(HUB); }
  });
}
