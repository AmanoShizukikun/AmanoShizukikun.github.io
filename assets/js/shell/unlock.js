// The way into the identity layer (see core/identity.js): click the profile avatar ten times in a row.
// Any element marked [data-id-tap] counts the clicks; a pause of more than a second starts the count again.
// From the fourth click its caption ([data-id-tap-out] inside it) shows how far along it is. [data-id-lock]
// locks again. On page load, a device that opened the identity before, or a link carrying #key=…, opens it.
import { identity } from '../core/identity.js';
import { world } from '../home/world.js';

const TAPS = 10;          // clicks it takes
const GAP = 1000;         // ms between two clicks before the count starts over
const SHOW = 4;           // from this click on, the caption shows the progress

export function initUnlock(root) {
  const note = document.createElement('div');
  note.className = 'nx-note';
  note.setAttribute('role', 'status');
  root.append(note);
  let noteTimer = 0;
  const toast = (text) => {
    clearTimeout(noteTimer);
    note.textContent = text;
    note.classList.add('is-on');
    noteTimer = setTimeout(() => note.classList.remove('is-on'), 4200);
  };

  let taps = 0, last = 0, target = null, idle = 0, busy = false;
  const caption = (el, n) => {
    const out = el?.querySelector('[data-id-tap-out]');
    if (!out) return;
    out.dataset.text ??= out.textContent;
    out.textContent = n >= SHOW ? `DECRYPTING ${'▮'.repeat(n)}${'▯'.repeat(TAPS - n)}` : out.dataset.text;
  };
  const reset = () => { clearTimeout(idle); caption(target, 0); taps = 0; target = null; };

  async function tap(el) {
    const now = performance.now();
    if (el !== target || now - last > GAP) { reset(); target = el; }
    last = now;
    taps += 1;
    caption(el, taps);
    clearTimeout(idle);
    if (taps < TAPS) { idle = setTimeout(reset, GAP); return; }
    busy = true;
    try {
      await identity.unlock({ animate: true });
      world.pulse(1);
      toast('IDENTITY DECRYPTED — 已顯示真實身分');
    } catch (e) {
      toast(e.code === 'unavailable' ? 'UNAVAILABLE — 這個瀏覽器無法解密' : 'DECRYPTION FAILED — 解密失敗');
    }
    busy = false;
    reset();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-id-lock]')) { e.preventDefault(); identity.lock(); toast('IDENTITY LOCKED — 已回到化名'); return; }
    const el = e.target.closest('[data-id-tap]');
    if (el && !identity.unlocked && !busy) tap(el);
  });

  return {
    toast,
    /** Page load: a device that opened the identity before, or a link carrying #key=…. */
    async boot() {
      if ((await identity.restore()) === 'link') { world.pulse(1); toast('IDENTITY DECRYPTED — 已顯示真實身分'); }
    },
  };
}
