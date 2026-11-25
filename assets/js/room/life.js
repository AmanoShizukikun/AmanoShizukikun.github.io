// Her day, as numbers: the clock, five needs, what she wants to do next, what the visitor asked her to do, and a
// diary. Nothing here draws or moves; room/agent.js carries the decisions out and tells this file what she is doing.
//
// How she decides (when nobody asked her to do anything): every activity promises to restore some needs. A need
// counts more the emptier it is (squared), so a tired Sakura goes to bed long before a bored one picks up a book.
// The hour matters (she sleeps at night, she does not nap at noon unless she is exhausted), what she just did counts
// against doing it again, and a little chance keeps her from being a machine.
const clamp = (v) => Math.max(0, Math.min(100, v));

export function createLife(data, saved) {
  const { needs, activities } = data;
  const now = new Date();
  const s = {
    day: saved?.day || 1,
    minute: saved?.minute ?? now.getHours() * 60 + now.getMinutes(),     // the first visit starts at the visitor's own time
    needs: Object.fromEntries(needs.map((n) => [n.id, clamp(saved?.needs?.[n.id] ?? 72 + Math.random() * 16)])),
  };
  // a first visit late at night finds her sleepy
  if (!saved) { const h = s.minute / 60; if (h >= 23 || h < 6) s.needs.energy = 30 + Math.random() * 15; else if (h >= 21) s.needs.energy = 50 + Math.random() * 10; }
  Object.assign(s, {
    queue: [],
    recent: saved?.recent || [],
    log: saved?.log?.slice(-30) || [],
  });
  const hour = () => (s.minute / 60) % 24;
  const inHours = (h, [a, b]) => (a < b ? h >= a && h < b : h >= a || h < b);
  const stamp = () => `${String(Math.floor(hour())).padStart(2, '0')}:${String(Math.floor(s.minute % 60)).padStart(2, '0')}`;

  // ---------- time passes ----------
  // `doing`: an activity id while she does it; 'walk' / 'stand' otherwise. `seated`: off her feet.
  function tick(minutes, doing, seated) {
    if (minutes <= 0) return;
    const a = activities[doing];
    const sleeping = doing === 'sleep' || doing === 'nap';
    for (const n of needs) {
      let rate = -n.decay / 60;
      if (n.id === 'energy' && sleeping) rate = 0;
      if (n.id === 'comfort' && seated) rate = 0;
      if (n.id === 'social' && sleeping) rate *= 0.3;
      if (a && a.gains[n.id]) rate += a.gains[n.id] / 60;
      s.needs[n.id] = clamp(s.needs[n.id] + rate * minutes);
    }
    s.minute += minutes;
    if (s.minute >= 1440) { s.minute -= 1440; s.day += 1; }
  }
  function boost(gains, minutes = 60) { for (const [k, v] of Object.entries(gains)) s.needs[k] = clamp(s.needs[k] + v * minutes / 60); }

  // ---------- mood ----------
  const W = { energy: 1.2, fun: 1, social: 0.8, comfort: 0.8, mind: 0.6 };
  function mood() {
    let t = 0, w = 0;
    for (const [k, v] of Object.entries(s.needs)) { t += v * (W[k] || 1); w += W[k] || 1; }
    const v = t / w, low = Object.entries(s.needs).sort((a, b) => a[1] - b[1])[0];
    const word = v > 80 ? '元氣滿滿' : v > 62 ? '心情不錯' : v > 45 ? '普普通通' : low[1] < 25 ? { energy: '好睏', fun: '好無聊', social: '有點寂寞', comfort: '腰好痠', mind: '好想學點什麼' }[low[0]] : '有點累了';
    return { value: v, word, low: low[0] };
  }

  // ---------- what next ----------
  function choose() {
    const h = hour(), n = s.needs;
    let best = 'idle', bestScore = 0.6;
    for (const [id, a] of Object.entries(activities)) {
      if (id === 'idle') continue;
      if (a.hours && !inHours(h, a.hours)) continue;
      if ((id === 'sleep' || id === 'nap') && s.day * 1440 + s.minute < (s.awakeUntil || 0)) continue;   // just woken by the visitor
      if (id === 'sleep' && n.energy > (inHours(h, [23, 6]) ? 92 : 78)) continue;   // late at night she goes to bed unless wide awake
      if (id === 'nap' && (n.energy > 32 || inHours(h, [21.5, 9]))) continue;
      let score = 0;
      for (const [k, g] of Object.entries(a.gains)) {
        const u = ((100 - n[k]) / 100) ** 2;
        score += g > 0 ? g * u : g * 0.12;
      }
      if (id === 'sleep' && inHours(h, [22.5, 7])) score *= 2.4;
      const seen = s.recent.indexOf(id);
      if (seen >= 0) score *= [0.35, 0.6, 0.8][seen] ?? 1;
      score *= 0.85 + Math.random() * 0.3;
      if (score > bestScore) { best = id; bestScore = score; }
    }
    return best;
  }
  // woken up by the visitor: she stays up for a while before she goes back to bed
  function stayAwake(minutes = 90) { s.awakeUntil = s.day * 1440 + s.minute + minutes; }
  function done(id) { s.recent = [id, ...s.recent.filter((x) => x !== id)].slice(0, 3); }
  function shouldStop(id, minutes) {
    const a = activities[id];
    if (!a) return true;
    if (minutes < a.min) return false;
    if (minutes >= a.max) return true;
    if (id === 'sleep') return s.needs.energy >= 99 || (inHours(hour(), [7, 11]) && s.needs.energy >= 85);
    return !!a.until && s.needs[a.until] >= 95;
  }

  function note(text) { s.log.push({ t: stamp(), day: s.day, text }); if (s.log.length > 30) s.log.shift(); return s.log.at(-1); }

  return {
    state: s, tick, boost, mood, choose, done, shouldStop, note, stamp, stayAwake,
    get hour() { return hour(); },
    daypart() { const h = hour(); return [...data.dayparts].reverse().find((d) => h >= d.from)?.zh || data.dayparts.at(-1).zh; },
    queue: {
      list: () => s.queue,
      push(id, by = 'you', extra = {}) { if (s.queue.length < 5) s.queue.push({ id, by, ...extra }); },
      shift: () => s.queue.shift(),
      drop(k) { s.queue.splice(k, 1); },
      clear() { s.queue.length = 0; },
    },
    save: () => JSON.stringify({ day: s.day, minute: s.minute, needs: s.needs, recent: s.recent, log: s.log.slice(-12) }),
  };
}
