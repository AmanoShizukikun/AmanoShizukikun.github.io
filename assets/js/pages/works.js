// Works index: the list of works beside the archive helix of the home page.
// Staged (wide screen + WebGL): the list is fixed, scroll progress turns the helix from one entry to
// the next, and whichever entry the helix has brought to the front is the open one. Forward, hold
// and rewind follow the scroll, like the home sequence.
// Stacked (phones, short windows, no WebGL): every entry is open in normal document flow; the helix,
// if there is one, only turns quietly in the background.
// Which layout shows is decided before the first paint, not here: the head script marks <html> with `wk-staged`
// (WORKS_STAGED matches and WebGL2 exists) and the CSS follows that class, so a refresh never shows the stacked
// layout while the world is still being built. If the world then fails, world.js takes the class back.
import { world } from '../home/world.js';
import { reducedMotion } from '../core/store.js';
import { createGlide } from '../home/glide.js';
import { WORKS_STAGED } from '../data/site.js';

const FROM = 5.3, TO = 5.72;                 // the helix's stretch of the timeline (HELIX.from / .to in home/scene.js)
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export async function mount(main) {
  const wk = main.querySelector('.wk');
  if (!wk) return null;
  const items = [...wk.querySelectorAll('.wk-item')];
  const heads = items.map((el) => el.querySelector('.wk-item__head'));
  const no = wk.querySelector('[data-wk="no"]');
  const n = items.length;
  const off = [];

  const scene = await world.ready();
  if (!main.isConnected) { off.forEach((f) => f()); return null; }
  wk.classList.toggle('wk--live', !!scene);

  const mq = matchMedia(WORKS_STAGED);
  let staged = false, target = 0, cur = 0, active = -1;
  const glide = createGlide(n);                // the scroll chooses the entry, the helix glides to it

  const read = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? clamp01(scrollY / max) : 0;
    wk.style.setProperty('--top', clamp01(scrollY / 60).toFixed(2));   // 0 at the very top: nothing under the header yet
  };
  const setActive = (i) => {
    if (i === active) return;
    active = i;
    items.forEach((el, k) => el.classList.toggle('is-on', k === i));
    heads.forEach((a, k) => { if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    if (no) no.textContent = String(i + 1).padStart(2, '0');
  };
  // bring entry i to the front: the timeline moves in one step and the world flies there
  const select = (i, fly = true) => {
    i = Math.min(n - 1, Math.max(0, i));
    if (fly && !reducedMotion()) world.fly(world.snapshot(), 900);
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, Math.round((max * i) / (n - 1)));
    read();
    cur = target;
    glide.reset(i);
    setActive(i);
  };
  const setMode = () => {
    const was = staged;
    staged = !!scene && mq.matches;                // the same as <html>.wk-staged, which the CSS follows
    if (staged && !was) select(Math.max(0, active), false);
    if (!staged) { active = -1; items.forEach((el) => el.classList.remove('is-on')); }
    read();
  };

  const onClick = (e) => {
    const head = e.target.closest('.wk-item__head');
    if (!head) return;
    const i = heads.indexOf(head);
    const here = head.getAttribute('href').startsWith('/works/');     // an entry without a page of its own
    if (staged && i !== active) { e.preventDefault(); select(i); return; }
    if (here) e.preventDefault();
  };
  const onKey = (e) => {
    if (!staged || !e.target.closest?.('.wk-item__head')) return;
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    select(active + step);
    heads[active]?.focus({ preventScroll: true });
  };
  wk.addEventListener('click', onClick);
  wk.addEventListener('keydown', onKey);
  mq.addEventListener('change', setMode);
  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', read);

  setMode();
  // a link to one entry (/works/#live2d) opens the page on it
  // (entries are id="wk-…", so an entry never shares an id with anything the shell or a page creates)
  const wanted = items.findIndex((el) => `#${el.dataset.id}` === location.hash);
  if (wanted >= 0) {
    if (staged) select(wanted, false); else items[wanted].scrollIntoView();
  }
  read();
  cur = target;
  glide.reset(target * (n - 1));

  const release = scene ? world.drive({
    frame(now, dt) {
      cur += (target - cur) * (reducedMotion() ? 1 : 1 - Math.exp(-dt * 6));
      if (Math.abs(target - cur) < 0.00002) cur = target;
      const turn = glide.step(target * (n - 1), dt);
      const wide = clamp01((innerWidth / innerHeight - 1.05) / 0.35);
      // narrower landscape screens push the helix further right, clear of the list
      const tight = clamp01((1.9 - innerWidth / innerHeight) / 0.6);
      // staged: a slightly wider shot, so the panel in front and its neighbour both stand clear of the list
      return { t: FROM + (TO - FROM) * cur, speed: 0, shift: wide * (staged ? 0.065 + 0.09 * tight : 0.13), pull: staged ? 0.16 + 0.14 * tight : 0, turn };
    },
    // the entry in front follows this page's own progress (during a flight the scene still reports where it came from)
    state() { if (staged) setActive(glide.index); },
    resize: read,
  }) : null;

  return () => {
    release?.();
    off.forEach((f) => f());
    mq.removeEventListener('change', setMode);
    removeEventListener('scroll', read);
    removeEventListener('resize', read);
  };
}
