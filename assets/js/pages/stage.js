// A page that only needs the world as a quiet backdrop: it parks the timeline on a range and lets
// scroll progress move through it. Used by the works index (the archive helix) and the 404 page.
import { world } from '../home/world.js';
import { store, reducedMotion } from '../core/store.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function stage(main, { from, to = from, darkOnly = false, seat = 1, shift = 0 }) {
  let release = null, target = 0, cur = 0, alive = true;
  const read = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? clamp01(scrollY / max) : 0;
  };
  const driver = {
    frame(now, dt) {
      cur += (target - cur) * (reducedMotion() ? 1 : 1 - Math.exp(-dt * 6));
      // `shift` only applies on landscape screens, where there is room beside the copy
      return { t: from + (to - from) * cur, speed: 0, seat, shift: shift * clamp01((innerWidth / innerHeight - 1.05) / 0.35) };
    },
    resize: read,
  };
  const sync = async () => {
    const want = !(darkOnly && store.get('theme') === 'light') && !!(await world.ready()) && alive && main.isConnected;
    if (want && !release) { read(); cur = target; release = world.drive(driver); }
    if (!want && release) { release(); release = null; }
    main.classList.toggle('wk--live', !!release);
  };
  const off = store.on('theme', sync);
  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', read);
  const ready = sync();
  return {
    ready,
    cleanup() {
      alive = false;
      off();
      removeEventListener('scroll', read);
      removeEventListener('resize', read);
      release?.();
      release = null;
    },
  };
}
