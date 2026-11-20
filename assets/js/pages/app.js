// App frame: mounts a self-contained legacy application inside the shell.
// The shell (header, settings, Live2D) stays in the top document; only this frame changes.
// The frame has no bar of its own: back and title live in the one site header. A game opened from the
// game centre also gets the centre's side rail (shell/sidebar.js), and its play time is recorded.
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { library } from '../core/library.js';
import { HUB } from '../shell/sidebar.js';

export function mount(main) {
  const stage = main.querySelector('[data-app-stage]');
  const frame = document.createElement('iframe');
  frame.className = 'app-frame';
  const name = main.dataset.name || 'application';
  frame.title = name;
  frame.allow = 'autoplay; fullscreen; gamepad; midi; geolocation; clipboard-write';
  frame.src = main.dataset.src;
  stage.append(frame);
  document.documentElement.classList.add('nx-app');

  const syncTheme = (v) => { try { frame.contentDocument?.documentElement.setAttribute('data-theme', v); } catch { /* not ready */ } };
  frame.addEventListener('load', () => { syncTheme(store.get('theme')); stage.classList.add('is-ready'); });
  const off = store.on('theme', syncTheme);

  // an embedded application may ask the shell to change page (see assets/js/embed.js)
  const onMessage = (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    const href = e.data && e.data.nx === 'go' && e.data.href;
    if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) router.go(href);
  };
  addEventListener('message', onMessage);

  const played = main.dataset.back === HUB ? library.begin(main.dataset.app) : null;

  return () => {
    off();
    played?.();
    removeEventListener('message', onMessage);
    document.documentElement.classList.remove('nx-app');
    // stop the application without adding an entry to the tab's history (assigning src would)
    try { frame.contentWindow.location.replace('about:blank'); } catch { frame.remove(); }
  };
}
