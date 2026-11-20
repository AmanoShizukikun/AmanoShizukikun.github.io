// The one WebGL world behind the whole site.
// The canvas belongs to the persistent shell, so it survives navigation: pages do not own a scene,
// they only *drive* this one (a timeline value plus a framing). A route change is therefore not a cut
// between two pictures but a flight: the camera and every object travel straight from the state the
// old page left them in to the state the new page asks for. Nothing covers the frame on the way.
import { store, quality, reducedMotion } from '../core/store.js';

let canvas = null, scene = null, building = null, failed = false;
let raf = 0, last = 0;
const drivers = [];                                  // the last one registered drives the world
let hold = { t: 0, speed: 0 };                       // last driven state, kept while no page is driving
let live = null, mixed = null, shown = null;         // scene states: what the driver asks for / the blend / what was drawn
const flight = { on: false, armed: false, from: null, t0: 0, dur: 0 };
const fx = { flash: 0, glitch: 0 };
let pulse = 0;                                       // short flash + tear, e.g. when the identity unlocks
// A picture that is not going anywhere does not need the display's full rate. While the driver asks for the
// same frame as the one on screen, only the ambient motion is left (drifting snow, grain, the shimmer of the
// corona), and that is redrawn at IDLE frames a second instead of 120 or 144.
// "The same frame" is strict: anything a page is easing — the tail of a scroll, a turn of the helix — is drawn
// on every frame until it has arrived, or it would stutter. Only what is slow by nature may lag: the corona
// following a song, and the timeline of a driver that says its own motion is ambient (`calm`).
const IDLE = 30;
const VIEW = { t: 1e-6, turn: 1e-6, shift: 1e-5, lift: 1e-5, seat: 1e-5, pull: 1e-5, sweep: 1.5e-3, light: 1e-4 };
const drawn = {};                                    // what the driver asked for on the last frame that was drawn
let drawnAt = 0, redraw = true;
const moved = (v) => {
  for (const k in VIEW) if (Math.abs((v[k] ?? 0) - (drawn[k] ?? 0)) > (k === 't' && v.calm ? 2e-4 : VIEW[k])) return true;
  return false;
};
// the grade of the world follows the theme: 0 dark, 1 paper. A change of theme is eased, not cut.
const gradeOf = () => (store.get('theme') === 'light' ? 1 : 0);
let grade = gradeOf(), gradeTo = grade;

const html = document.documentElement;
// zero velocity and zero acceleration at both ends: the move starts and settles without a visible step
const glide = (k) => k * k * k * (k * (k * 6 - 15) + 10);

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

// No world after all: say so on <html>, which also takes back the staged works layout that the head script
// promised before the first paint (`wk-staged`), so the page falls back to its stacked one.
function fail() {
  failed = true;
  html.classList.add('no-gl');
  html.classList.remove('wk-staged');
}

function build() {
  if (failed) return Promise.resolve(null);
  if (scene) return Promise.resolve(scene);
  canvas ||= document.querySelector('.nx-world');
  if (!canvas || !hasWebGL2()) { fail(); return Promise.resolve(null); }
  building ||= (async () => {
    try {
      const { createScene } = await import('./scene.js');
      scene = await createScene(canvas, { quality: quality() });
      scene.light = grade = gradeTo;
      live = scene.newState(); mixed = scene.newState();
      new ResizeObserver(() => { scene?.resize(); redraw = true; drivers.at(-1)?.resize?.(); }).observe(canvas);
      // once the first frames are up, prepare everything the visitor has not reached yet
      const s = scene;
      setTimeout(() => (window.requestIdleCallback || setTimeout)(() => { if (scene === s) s.warm(); }), 700);
    } catch (e) {
      console.error('[world] WebGL scene failed; pages fall back to their static layout', e);
      fail(); scene = null;
    }
    building = null;
    redraw = true;
    sync();
    return scene;
  })();
  return building;
}

function sync() {
  const want = !!scene && drivers.length > 0;
  html.classList.toggle('nx-world-on', want);
  const run = !document.hidden && (want || flight.on || pulse > 0.002);
  if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  pulse *= Math.exp(-dt * 4.2);
  if (pulse < 0.002) pulse = 0;

  const d = drivers.at(-1);
  const r = d?.frame(now, dt);
  if (r) hold = r;
  if (scene) {
    if (grade !== gradeTo) {
      grade += (gradeTo - grade) * (reducedMotion() ? 1 : 1 - Math.exp(-dt * 4.5));
      if (Math.abs(gradeTo - grade) < 0.004) grade = gradeTo;
      scene.light = grade;
    }
    const still = !redraw && !flight.on && !pulse && grade === gradeTo && !(hold.speed > 0.001) && !moved(hold);
    if (!still || now - drawnAt >= 1000 / IDLE - 3) draw(now, d);
  }
  if (!drivers.length && !flight.on && !pulse) sync();
}

function draw(now, d) {
  {
    redraw = false;
    drawnAt = now;
    for (const k in VIEW) drawn[k] = hold[k] ?? 0;
    scene.sample(hold.t, hold.speed || 0, hold, live);
    let P = live;
    if (flight.on) {
      if (flight.armed && d) {
        // the destination has taken the wheel: the clock starts now, and the longer the trip the longer it takes
        const A = flight.from;
        const dist = Math.hypot(live.px - A.px, live.py - A.py, live.pz - A.pz);
        flight.armed = false;
        flight.t0 = now;
        flight.dur = (flight.fixed || 1050 + Math.min(900, dist * 3.2)) * world.slow;
      }
      if (flight.armed) P = flight.from;               // nobody to fly to yet: hold the frame we left on
      else {
        const k = Math.min(1, (now - flight.t0) / flight.dur);
        if (k >= 1) flight.on = false;
        else P = scene.mix(flight.from, live, glide(k), mixed);
      }
    }
    shown = P;
    fx.flash = pulse * 0.8;
    fx.glitch = Math.min(1, pulse * 2.4);
    const st = scene.render(P, now / 1000, fx);
    d?.state?.(st, scene);
  }
}

store.on('nxQuality', async () => {
  if (!scene) return;
  const old = scene;
  scene = null;
  flight.on = false;
  old.dispose();
  await build();
  drivers.at(-1)?.resize?.();
});
store.on('theme', () => {
  gradeTo = gradeOf();
  if (!raf && scene) scene.light = grade = gradeTo;    // nothing on screen to ease
});
document.addEventListener('visibilitychange', sync);

export const world = {
  /** Resolves to the scene, or null when WebGL is unavailable. Builds it on first use. */
  ready: build,
  get scene() { return scene; },
  /**
   * Take the wheel. `driver.frame(now, dt)` returns `{ t, speed, shift, lift, seat, … }` every frame (see the
   * views of scene.js; `calm: true` = the timeline only drifts, it may be redrawn at the idle rate);
   * `driver.state(st, scene)` receives what the scene derived from it; `driver.resize()` on canvas resize.
   * Returns a function that lets go again.
   */
  drive(driver) {
    drivers.push(driver);
    redraw = true;
    sync();
    return () => {
      const i = drivers.indexOf(driver);
      if (i >= 0) drivers.splice(i, 1);
      redraw = true;
      sync();
    };
  },
  /** The state on screen right now (a copy), to fly from. Null when there is no picture to leave. */
  snapshot() {
    if (!scene || !shown || !html.classList.contains('nx-world-on')) return null;
    return Object.assign(scene.newState(), shown);
  },
  /**
   * Fly from `from` to whatever the driver asks for from now on. The frame holds on `from` until a
   * driver is in place, so the caller can swap pages in between without a single frame of the
   * destination showing early. `ms` fixes the duration; otherwise it follows the distance.
   */
  fly(from, ms = 0) {
    if (!scene || !from || reducedMotion()) return;
    Object.assign(flight, { on: true, armed: true, from, fixed: ms });
    redraw = true;
    sync();
  },
  /** The destination turned out not to use the world: stop waiting for it. */
  land() {
    if (flight.armed && !drivers.length) flight.on = false;
    sync();
  },
  /** Debugging: stretch every flight by this factor to inspect it frame by frame. */
  slow: 1,
  /** A short white-out with a tear, for moments that should register in the world. */
  pulse(v = 1) { if (scene && !reducedMotion()) { pulse = Math.max(pulse, v); sync(); } },
};
