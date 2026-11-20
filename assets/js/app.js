// Entry point, loaded by every page.
import { initShell } from './shell/shell.js';
import { initUnlock } from './shell/unlock.js';
import { initMascot } from './shell/mascot.js';
import { router } from './core/router.js';
import { identity } from './core/identity.js';

const shell = initShell();
const unlock = initUnlock(shell);

// every freshly mounted view is shown under the current identity (alias, or the decrypted one)
const retitle = () => { const t = document.getElementById('view')?.dataset.title; if (t) document.title = identity.title(t); };
router.after((page, main) => { identity.apply(main); retitle(); });
identity.on(retitle);

identity.resume();
router.start().then(() => { unlock.boot(); initMascot(); });
