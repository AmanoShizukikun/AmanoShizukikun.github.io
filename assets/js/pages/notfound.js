// 404 page. URLs of the previous site are forwarded to their new location.
import { router } from '../core/router.js';
import { stage } from './stage.js';

const MOVED = [
  [/^\/index\.html$/, '/'],
  [/^\/pages\/(about|experience|skills)\.html$/, '/profile/'],
  [/^\/projects\/nagato-sakura\/nagato-sakura\.html$/, '/apps/nagato-sakura/'],
  [/^\/projects\/nagato-sakura-webos\//, '/apps/webos/'],
  [/^\/projects\/nagato-sakura-nijigen\//, '/apps/nijigen/'],
  [/^\/projects\/music-player\//, '/apps/music/'],
  [/^\/projects\/forza-tuning-calculator\//, '/apps/forza/'],
  [/^\/projects\/game-center\/games\/cyberrace\//, '/apps/cyber-race/'],
  [/^\/projects\/game-center\/games\/nsroom\//, '/apps/ns-room/'],
  [/^\/projects\/game-center\/games\/snake\//, '/apps/snake/'],
  [/^\/projects\/game-center\/games\/piano\//, '/apps/piano/'],
  [/^\/projects\/game-center\/games\/wallclimber\//, '/apps/wall-climber/'],
  [/^\/projects\/game-center\//, '/apps/game-center/'],
];

export async function mount(main) {
  const hit = MOVED.find(([re]) => re.test(location.pathname));
  if (hit) {
    history.replaceState({}, '', hit[1]);
    router.go(hit[1], { push: false, wipe: false });
    return null;
  }
  // off the chart: the survey map of the first chapter, held still
  const s = stage(main, { from: 0.34 });
  await s.ready;
  return s.cleanup;
}
