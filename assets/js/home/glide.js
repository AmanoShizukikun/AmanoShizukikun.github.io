// The archive helix turns one work at a time. Where the scroll is only chooses WHICH work is in front; the
// turn from one to the next is a glide of its own, the same whatever moved the scroll. A mouse wheel moves the
// page in coarse notches — tied directly to the scroll, one notch was a whole turn (still, still, lurch). Here
// the helix eases to the work the scroll has reached, keeps turning smoothly while the wheel keeps spinning,
// and always comes to rest square-on to a panel.
import { reducedMotion } from '../core/store.js';

const RATE = 7.5;            // spring rate (1/s): about half a second to turn to the next work, no overshoot from rest
const HOLD = 0.58;           // how far (in works) the scroll must be from the work in front before the next one is chosen

export function createGlide(count) {
  const last = count - 1;
  const clamp = (i) => Math.min(last, Math.max(0, i));
  let index = 0, pos = 0, vel = 0;
  return {
    /** The work in front (an integer) and where the helix is on its way to it (fractional while turning). */
    get index() { return index; },
    get pos() { return pos; },
    /** Put the helix on the work nearest to `at` (in works, 0 … count − 1) without a glide. */
    reset(at) { index = clamp(Math.round(at)); pos = index; vel = 0; },
    /** One frame: `at` is where the scroll is (in works). Returns the helix's position. */
    step(at, dt) {
      if (Math.abs(at - index) > HOLD) index = clamp(Math.round(at));
      if (reducedMotion()) { pos = index; vel = 0; return pos; }
      // critically damped spring, in steps short enough to stay exact on a slow frame
      for (let left = Math.min(dt, 0.1); left > 0; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        vel += (RATE * RATE * (index - pos) - 2 * RATE * vel) * h;
        pos += vel * h;
      }
      if (Math.abs(index - pos) < 1e-4 && Math.abs(vel) < 1e-3) { pos = index; vel = 0; }
      return pos;
    },
  };
}
