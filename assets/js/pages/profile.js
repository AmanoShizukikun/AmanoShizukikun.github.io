// Profile: the same world as the home page, seen from the approach to the observer gate.
// Scroll progress through the document is the timeline here too — reading down walks the camera
// toward the gate while the eye opens; scrolling back up walks it away again. Section reveals are
// scrubbed by scroll position (both directions), never played once.
import { world } from '../home/world.js';
import { reducedMotion } from '../core/store.js';

const T0 = 1.93, T1 = 2.4;               // timeline range of the approach (see CAM in home/scene.js)
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const pad = (v, n = 5) => v.toFixed(1).padStart(n, '0');

export async function mount(main) {
  const pf = main.querySelector('.pf');
  if (!pf) return null;
  const secs = [...pf.querySelectorAll('[data-sec]')];
  const rail = [...pf.querySelectorAll('.pf-rail a')];
  const out = Object.fromEntries([...pf.querySelectorAll('[data-pf]')].map((el) => [el.dataset.pf, el]));
  const time = out.time, items = time ? [...time.children] : [];

  // rail: scroll to the section instead of changing the address
  const onRail = (e) => {
    const a = e.target.closest('.pf-rail a');
    if (!a) return;
    e.preventDefault();
    pf.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  pf.addEventListener('click', onRail);

  if (!(await world.ready())) return () => pf.removeEventListener('click', onRail);   // static layout
  if (!main.isConnected) return null;
  pf.classList.add('pf--live');

  let target = 0, cur = 0, dirty = true, lastHud = 0;
  let mx = 0, my = 0, px = 0, py = 0;          // pointer parallax: target / damped
  const g = {};

  const read = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? clamp01(scrollY / max) : 0;
    dirty = true;
  };

  function applyDom(p) {
    const vh = innerHeight;
    let active = 0;
    secs.forEach((s, i) => {
      const top = s.getBoundingClientRect().top;
      // 0 while the section is still below the fold, 1 once its head has risen into the upper half
      const k = i === 0 ? 1 : clamp01((vh * 0.96 - top) / (vh * 0.42));
      s.style.setProperty('--k', k.toFixed(3));
      if (top < vh * 0.5) active = i;
    });
    rail.forEach((a, i) => a.classList.toggle('is-on', i === active));
    if (time) {
      const r = time.getBoundingClientRect();
      const fill = clamp01((vh * 0.62 - r.top) / r.height);
      time.style.setProperty('--fill', fill.toFixed(4));
      const y = fill * r.height;
      items.forEach((li) => li.classList.toggle('is-on', li.offsetTop <= y + 2));
    }
    // the gate is clear in the hero, sinks behind the copy while reading, and returns at the end
    const away = smooth(0.03, 0.2, p) * (1 - smooth(0.84, 1, p));
    pf.style.setProperty('--scrim', (0.1 + 0.7 * away + 0.14 * smooth(0.84, 1, p)).toFixed(3));
    pf.style.setProperty('--side', (1 - away).toFixed(3));
    pf.style.setProperty('--p', p.toFixed(4));
  }

  const driver = {
    frame(now, dt) {
      const still = reducedMotion();
      const k = still ? 1 : 1 - Math.exp(-dt * 6);
      const before = cur;
      cur += (target - cur) * k;
      if (Math.abs(target - cur) < 0.0002) cur = target;
      px += (mx - px) * k * 0.6; py += (my - py) * k * 0.6;
      if (dirty || cur !== before) { applyDom(cur); dirty = cur !== target; }
      const wide = clamp01((innerWidth / innerHeight - 1.05) / 0.35);
      return {
        t: T0 + (T1 - T0) * cur,
        speed: 0,
        // desktop: the gate sits right of the copy in the hero, drifts toward centre while reading and
        // swings back out for the last section; portrait: it stays centred, raised clear of the name
        shift: wide * (0.2 - 0.12 * smooth(0.1, 0.5, cur) + 0.14 * smooth(0.8, 1, cur)) + (still ? 0 : px * 0.012),
        // (phones get a taller hero with the gate above the name, so it is lifted further)
        lift: (1 - wide) * (innerWidth < 520 ? 0.25 : 0.17) * (1 - smooth(0.05, 0.3, cur)) + (still ? 0 : py * 0.012),
      };
    },
    state(st, scene) {
      scene.gate(g);
      const w = innerWidth, h = innerHeight;
      pf.style.setProperty('--gx', `${(g.x * w).toFixed(1)}px`);
      pf.style.setProperty('--gy', `${(g.y * h).toFixed(1)}px`);
      pf.style.setProperty('--gr', `${(g.r * h).toFixed(1)}px`);
      const now = performance.now();
      if (now - lastHud > 90) {
        lastHud = now;
        out.range.textContent = `RANGE ${pad(g.range)}`;
        out.open.textContent = `APERTURE ${String(Math.round(g.open * 100)).padStart(2, '0')} %`;
        out.pct.textContent = pad(cur * 100);
      }
    },
    resize: read,
  };

  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    mx = (e.clientX / innerWidth - 0.5) * -2;
    my = (e.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', read);
  addEventListener('pointermove', onMove, { passive: true });
  // images and fonts change the document height after mount
  const ro = new ResizeObserver(read);
  ro.observe(pf);

  read();
  cur = target;
  applyDom(cur);
  const release = world.drive(driver);

  return () => {
    release();
    removeEventListener('scroll', read);
    removeEventListener('resize', read);
    removeEventListener('pointermove', onMove);
    pf.removeEventListener('click', onRail);
    ro.disconnect();
  };
}
