// What the game centre remembers on this device: favourites, play time and when each game was last opened.
const FAV = 'nxGcFav', STAT = 'nxGcStats';
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

export const library = {
  isFav: (id) => load(FAV, []).includes(id),
  /** Returns the new state. */
  toggleFav(id) {
    const list = load(FAV, []);
    const i = list.indexOf(id);
    if (i < 0) list.push(id); else list.splice(i, 1);
    save(FAV, list);
    return i < 0;
  },
  /** { time: seconds played, last: timestamp of the last launch (0 = never) } */
  stat(id) { const s = load(STAT, {})[id]; return { time: s?.t || 0, last: s?.l || 0 }; },
  /** A game was opened. Returns the function to call when it is closed; play time is added then. */
  begin(id) {
    let t0 = Date.now(), open = true;
    const all = load(STAT, {});
    all[id] = { t: all[id]?.t || 0, l: t0 };
    save(STAT, all);
    const flush = () => {
      if (!open) return;
      const now = Date.now(), cur = load(STAT, {});
      cur[id] = { t: (cur[id]?.t || 0) + Math.max(0, (now - t0) / 1000), l: cur[id]?.l || now };
      save(STAT, cur);
      t0 = now;
    };
    // time in a hidden tab is not play time
    const onVis = () => { if (document.hidden) flush(); else t0 = Date.now(); };
    document.addEventListener('visibilitychange', onVis);
    addEventListener('pagehide', flush);
    return () => {
      if (!document.hidden) flush();
      open = false;
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pagehide', flush);
    };
  },
};
