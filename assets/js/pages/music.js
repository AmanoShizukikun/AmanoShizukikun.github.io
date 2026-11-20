// Music player. The eclipse of the world is the turntable (markup: src/pages/music.mjs, content: data/music.js,
// analysis: tools/music-scan.mjs → data/music-scan.js + assets/music/<id>.bin).
//
// On the rest of the site the scroll position drives the picture. Here the playhead does:
//   · the corona is drawn clockwise from 12 o'clock as far as the song has played — it closes when the song ends
//   · inside the disc, the next seconds of the song approach as rings (one ring = the spectrum at one moment, bass at
//     the bottom, treble at the top, mirrored left and right); the yellow ring at the limb is what is sounding now
// Both come from the playhead and from an analysis of the whole file made ahead of time, so they hold while the
// song is paused, run backwards when it is scrubbed backwards, and show the song ahead before it has been played.
// Nothing here moves unless the song does.
import { world } from '../home/world.js';
import { store, quality, reducedMotion } from '../core/store.js';
import { tracks, album } from '../data/music.js';
import { scan, scans } from '../data/music-scan.js';

const T = 6.6;                    // where the world holds: chapter 07 of the home timeline, facing the eclipse
const PAD = 1.34;                 // the disc's canvas reaches this far past the limb (for the playhead mark)
const RIM = 0.955;                // radius of the ring that is sounding now, as a fraction of the limb
const AHEAD = 8.4, STEP = 0.14;   // seconds of the song inside the disc, and the time between two rings
const DEPTH = 0.66;               // perspective: a ring τ seconds ahead is drawn at RIM / (1 + τ·DEPTH)
const AMP = 0.4;                  // how far the loudest band pushes a ring inward
const RINGS = Math.round(AHEAD / STEP);
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, k) => a + (b - a) * k;
const two = (i) => String(i).padStart(2, '0');
const clock = (s) => `${Math.floor(s / 60)}:${two(Math.floor(s % 60))}`;
const metaOf = (t) => [t.year, t.bpm ? `${t.bpm} BPM` : null, t.genre ? t.genre.toUpperCase() : null].filter(Boolean).join(' · ');

export async function mount(main) {
  const mu = main.querySelector('.mu');
  if (!mu) return null;
  const $ = (name) => mu.querySelector(`[data-mu="${name}"]`);
  const off = [];
  const on = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); off.push(() => target.removeEventListener(type, fn, opt)); };
  let dead = false;

  const audio = $('audio'), stageEl = $('stage'), disc = $('disc'), canvas = $('canvas'), wave = $('wave'), scrub = $('scrub');
  const out = {
    title: $('title'), no: $('no'), meta: $('meta'), cover: $('cover'), cur: $('cur'), dur: $('dur'), head: $('head'), tip: $('tip'),
    tagTime: $('tag-time'), tagState: $('tag-state'), repeat: $('repeat'), vol: $('vol'), volume: $('volume'), msg: $('msg'),
  };
  const rows = [...mu.querySelectorAll('.mu-list li')];
  const toggles = [...mu.querySelectorAll('[data-act="toggle"]')];
  const muteBtn = mu.querySelector('[data-act="mute"]'), repeatBtn = mu.querySelector('[data-act="repeat"]');
  const ctx = canvas.getContext('2d'), wctx = wave.getContext('2d');

  // ---------------- state ----------------
  let index = 0, dur = scans[tracks[0].id].duration;
  let playing = false;              // what the visitor asked for (the element may still be buffering)
  let waiting = false;
  let pos = 0;                      // the playhead as shown, in seconds
  let pending = null;               // a position asked for before the file was loaded
  let grab = null;                  // { at } while the playhead is being dragged (scrub bar or limb)
  let hover = null;                 // seconds under the pointer on the scrub bar or the limb
  let data = null;                  // the spectrogram of the current track (Uint8Array), once it has arrived
  let dirty = true;                 // the disc has to be redrawn
  let waveDirty = true;
  let repeat = store.get('nxMusicRepeat') === 'one' ? 'one' : 'all';
  let volume = clamp(Number(store.get('nxMusicVol')) || 0, 0, 100);
  let muted = store.bool('nxMusicMute');
  let msgTimer = 0;
  let shownSec = -1;                // the tenth of a second the clocks last showed

  const say = (text, ms = 4200) => {
    out.msg.textContent = text;
    mu.classList.toggle('has-msg', !!text);
    clearTimeout(msgTimer);
    if (text && ms) msgTimer = setTimeout(() => say(''), ms);
  };

  // ---------------- the analysis of each track ----------------
  const bins = new Map();
  const loadScan = (id) => {
    if (!bins.has(id)) {
      bins.set(id, fetch(`/assets/music/${id}.bin`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((b) => new Uint8Array(b)).catch((e) => { console.warn('[music] no analysis for', id, e); return null; }));
    }
    return bins.get(id);
  };
  const B = scan.bands;
  const lev = new Float32Array(B), raw = new Float32Array(B);
  // the spectrum at `time` → lev[]; returns the overall level (0–1)
  function levels(time) {
    const frames = data.length / B;
    const f = clamp(time * scan.fps, 0, frames - 1), i0 = Math.floor(f), i1 = Math.min(frames - 1, i0 + 1), k = f - i0;
    let sum = 0;
    for (let b = 0; b < B; b++) { const v = (data[i0 * B + b] * (1 - k) + data[i1 * B + b] * k) / 255; raw[b] = v; sum += v; }
    // a little smoothing across neighbouring bands: the rings read as contours, not as noise
    for (let b = 0; b < B; b++) lev[b] = raw[Math.max(0, b - 1)] * 0.25 + raw[b] * 0.5 + raw[Math.min(B - 1, b + 1)] * 0.25;
    return sum / B;
  }

  // ---------------- playback ----------------
  function syncPlay() {
    const state = grab ? 'SCRUB' : !playing ? (pos > 0.05 ? 'PAUSED' : 'STANDBY') : waiting ? 'BUFFERING' : 'PLAYING';
    mu.classList.toggle('is-playing', playing);
    out.tagState.textContent = state;
    toggles.forEach((b) => b.setAttribute('aria-label', playing ? '暫停' : '播放'));
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }

  async function start() {
    playing = true; syncPlay();
    try { await audio.play(); } catch (e) {
      if (dead || e.name === 'AbortError') return;        // a newer track or a pause replaced this request
      playing = false; syncPlay();
      say(e.name === 'NotAllowedError' ? '瀏覽器擋下了播放，請再按一次。' : '這個音檔無法播放。');
    }
  }
  function stop() { playing = false; audio.pause(); syncPlay(); }
  const toggle = () => (playing ? stop() : start());

  function seek(s) {
    pos = clamp(s, 0, Math.max(0, dur - 0.05));
    if (audio.readyState >= 1) { audio.currentTime = pos; pending = null; } else pending = pos;   // applied once the file is known
    dirty = waveDirty = true;
    syncPlay();
    position();
  }

  function setTrack(i, { play = playing, hash = true } = {}) {
    index = (i + tracks.length) % tracks.length;
    const t = tracks[index];
    dur = scans[t.id].duration;
    pos = 0; pending = null; waiting = false; hover = null;
    audio.src = `/assets/music/${t.id}.mp3`;              // preload="none": nothing is downloaded before it is asked for
    out.title.textContent = t.title;
    if (t.sub) { const s = document.createElement('small'); s.textContent = t.sub; out.title.append(s); }
    out.no.textContent = two(index + 1);
    out.meta.textContent = metaOf(t);
    out.cover.src = `/assets/img/music/${t.id}.webp`;
    out.dur.textContent = clock(dur);
    scrub.setAttribute('aria-valuemax', Math.round(dur));
    rows.forEach((li, n) => {
      li.classList.toggle('is-on', n === index);
      const b = li.querySelector('.mu-track');
      if (n === index) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    if (hash) history.replaceState(history.state, '', `#${t.id}`);
    if ('mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.sub ? `${t.title} — ${t.sub}` : t.title, artist: album.artist, album: album.title,
        artwork: [{ src: `/assets/img/music/${t.id}.webp`, sizes: '720x720', type: 'image/webp' }],
      });
    }
    data = null;
    loadScan(t.id).then((d) => { if (!dead && tracks[index] === t) { data = d; dirty = true; } });
    mu.classList.remove('is-swap'); void mu.offsetWidth; mu.classList.add('is-swap');     // the title and cover come in again
    dirty = waveDirty = true;
    say('', 0);
    if (play) start(); else { playing = false; syncPlay(); }
    shownSec = -1;
  }
  const step = (d) => setTrack(index + d);
  // "previous" first goes back to the start of the song, like every player does
  const prev = () => (pos > 3 ? seek(0) : step(-1));

  function setVolume(v, mute = muted) {
    volume = clamp(Math.round(v), 0, 100); muted = mute;
    audio.volume = volume / 100; audio.muted = muted;
    out.volume.value = volume;
    out.volume.style.setProperty('--v', `${volume}%`);
    out.vol.textContent = muted ? 'MUTE' : String(volume);
    muteBtn.setAttribute('aria-pressed', String(muted));
    store.set('nxMusicVol', volume); store.set('nxMusicMute', muted);
  }
  function setRepeat(r) {
    repeat = r;
    out.repeat.textContent = r === 'one' ? 'ONE' : 'ALL';
    repeatBtn.setAttribute('aria-label', r === 'one' ? '循環：單曲' : '循環：全部曲目');
    store.set('nxMusicRepeat', r);
  }

  function position() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    try { navigator.mediaSession.setPositionState({ duration: dur, position: clamp(pos, 0, dur), playbackRate: 1 }); } catch { /* not ready */ }
  }

  on(audio, 'loadedmetadata', () => { if (pending != null) { audio.currentTime = pending; pending = null; } position(); });
  on(audio, 'playing', () => { waiting = false; if (!playing) { playing = true; } syncPlay(); position(); });
  on(audio, 'waiting', () => { waiting = true; syncPlay(); });
  // paused from outside the page (media keys, the system's controls, the browser itself)
  on(audio, 'pause', () => { if (playing && !audio.ended && audio.readyState >= 1 && audio.currentTime > 0) { playing = false; syncPlay(); } });
  on(audio, 'ended', () => { if (repeat === 'one') { seek(0); start(); } else setTrack(index + 1, { play: true }); });
  on(audio, 'error', () => { if (!audio.getAttribute('src')) return; playing = false; syncPlay(); say('音檔載入失敗，請檢查網路後再試一次。', 0); });

  if ('mediaSession' in navigator) {
    const set = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch { /* not supported */ } };
    set('play', start); set('pause', stop); set('previoustrack', prev); set('nexttrack', () => step(1));
    set('seekto', (e) => { if (e.seekTime != null) seek(e.seekTime); });
    off.push(() => ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'].forEach((n) => set(n, null)));
  }

  // ---------------- controls ----------------
  on(mu, 'click', (e) => {
    const track = e.target.closest('[data-track]');
    if (track) { const i = Number(track.dataset.track); if (i === index) toggle(); else setTrack(i, { play: true }); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') { if (!disc.dataset.dragged) toggle(); }
    else if (act === 'prev') prev();
    else if (act === 'next') step(1);
    else if (act === 'repeat') setRepeat(repeat === 'all' ? 'one' : 'all');
    else if (act === 'mute') setVolume(volume, !muted);
  });
  on(out.volume, 'input', () => setVolume(Number(out.volume.value), false));

  // the scrub bar: the loudness of the whole song, the played part in yellow
  const tipAt = (s, x) => { out.tip.textContent = clock(s); out.tip.style.left = `${x}px`; };
  const barTime = (e) => { const r = scrub.getBoundingClientRect(); return { s: clamp((e.clientX - r.left) / r.width, 0, 1) * dur, x: clamp(e.clientX - r.left, 0, r.width) }; };
  on(scrub, 'pointerdown', (e) => {
    if (e.button) return;
    scrub.setPointerCapture(e.pointerId);
    const { s, x } = barTime(e);
    grab = { at: s }; tipAt(s, x); mu.classList.add('is-scrub'); dirty = waveDirty = true; syncPlay();
  });
  on(scrub, 'pointermove', (e) => {
    const { s, x } = barTime(e);
    tipAt(s, x);
    if (grab) grab.at = s; else hover = s;
    dirty = waveDirty = true;
  });
  const release = () => { if (!grab) return; const s = grab.at; grab = null; mu.classList.remove('is-scrub'); seek(s); };
  on(scrub, 'pointerup', release);
  on(scrub, 'pointercancel', () => { grab = null; mu.classList.remove('is-scrub'); dirty = waveDirty = true; syncPlay(); });
  on(scrub, 'pointerleave', () => { hover = null; waveDirty = true; });
  on(scrub, 'keydown', (e) => {
    const jump = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -15, PageUp: 15 }[e.key];
    if (jump != null) seek(pos + jump); else if (e.key === 'Home') seek(0); else if (e.key === 'End') seek(dur - 0.5); else return;
    e.preventDefault(); e.stopPropagation();
  });

  // the limb: the corona ends where the playhead is, so dragging round the disc drags the playhead
  const limb = (e) => {
    const r = disc.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    return { k: Math.hypot(dx, dy) / (r.width / 2 / PAD), turn: (Math.atan2(dx, -dy) / TAU + 1) % 1 };
  };
  on(disc, 'pointerdown', (e) => {
    if (e.button) return;
    const p = limb(e);
    delete disc.dataset.dragged;
    if (p.k < 0.86 || p.k > 1.3) return;                 // inside: the play button · further out: nothing
    e.preventDefault();
    disc.setPointerCapture(e.pointerId);
    disc.dataset.dragged = '1';
    grab = { at: p.turn * dur, turn: p.turn }; mu.classList.add('is-scrub'); dirty = waveDirty = true; syncPlay();
  });
  on(disc, 'pointermove', (e) => {
    const p = limb(e);
    if (grab && grab.turn != null) {
      // take the short way round, and stop at both ends instead of jumping across 12 o'clock
      let d = p.turn - (grab.turn % 1 + 1) % 1; if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
      grab.turn = clamp(grab.turn + d, 0, 0.999); grab.at = grab.turn * dur;
      dirty = waveDirty = true;
    } else {
      const near = p.k >= 0.86 && p.k <= 1.3;
      disc.classList.toggle('is-limb', near);
      const h = near ? p.turn * dur : null;
      if (h !== hover) { hover = h; dirty = true; }
    }
  });
  on(disc, 'pointerup', () => { if (grab && grab.turn != null) release(); });
  on(disc, 'pointercancel', () => { grab = null; mu.classList.remove('is-scrub'); dirty = waveDirty = true; syncPlay(); });
  on(disc, 'pointerleave', () => { if (!grab) { hover = null; disc.classList.remove('is-limb'); dirty = true; } });

  on(window, 'keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    const onButton = tag === 'BUTTON' || tag === 'A';
    switch (e.code) {
      case 'Space': if (onButton) return; toggle(); break;
      case 'KeyK': toggle(); break;
      case 'ArrowLeft': seek(pos - 5); break;
      case 'ArrowRight': seek(pos + 5); break;
      case 'ArrowUp': setVolume(volume + 5, false); break;
      case 'ArrowDown': setVolume(volume - 5, false); break;
      case 'KeyN': step(1); break;
      case 'KeyP': prev(); break;
      case 'KeyM': setVolume(volume, !muted); break;
      case 'KeyR': setRepeat(repeat === 'all' ? 'one' : 'all'); break;
      case 'Home': seek(0); break;
      default: return;
    }
    e.preventDefault();
  });
  on(window, 'hashchange', () => {
    const i = tracks.findIndex((t) => t.id === location.hash.slice(1));
    if (i >= 0 && i !== index) setTrack(i, { hash: false });
  });

  // ---------------- the scrub bar's picture ----------------
  function drawWave() {
    const w = wave.clientWidth, h = wave.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (!w || !h) return;
    if (wave.width !== Math.round(w * dpr) || wave.height !== Math.round(h * dpr)) { wave.width = Math.round(w * dpr); wave.height = Math.round(h * dpr); }
    const peaks = scans[tracks[index].id].peaks, pitch = w < 420 ? 3 : 4, n = Math.max(1, Math.floor(w / pitch));
    const at = (grab ? grab.at : pos) / dur, ghost = hover != null && !grab && hover / dur;
    const css = getComputedStyle(mu);
    const ink = css.getPropertyValue('--ink').trim() || '#ecebe5', signal = css.getPropertyValue('--signal').trim() || '#ffc400';
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
      let v = 0; for (let j = a; j < b; j++) v = Math.max(v, peaks[j]);
      const bh = Math.max(2, (v / 99) * (h - 2)), x = i * pitch, k = (i + 0.5) / n;
      wctx.globalAlpha = k <= at ? 1 : ghost !== false && k <= ghost ? 0.62 : 0.3;
      wctx.fillStyle = k <= at ? signal : ink;
      wctx.fillRect(x, (h - bh) / 2, pitch - 1.5, bh);
    }
    wctx.globalAlpha = 1;
    out.head.style.left = `${at * 100}%`;
  }

  // ---------------- the disc ----------------
  // geometry: unit = limb radius. The canvas is a square of side 2·PAD around the centre of the eclipse.
  let own = false;                                       // no world: the disc draws its own limb and progress arc
  let R = 0;                                             // the limb radius the layout asks for, CSS px
  const ring = new Float32Array((B * 2 + 1) * 2);

  function sizeCanvas() {
    const dpr = Math.min(quality() === 'low' ? 1.5 : 2, devicePixelRatio || 1);
    const side = Math.max(64, Math.round(R * PAD * 2 * dpr));
    if (canvas.width !== side) { canvas.width = canvas.height = side; dirty = true; }
  }

  // one ring: the spectrum in lev[] bent round a circle of radius `base` (px), pushed inward by `amp`
  function tracePath(c, base, amp) {
    const n = B * 2;
    for (let j = 0; j < n; j++) {
      // clockwise from 12 o'clock: treble at the top, bass at the bottom, the left half mirrors the right
      const band = j < B ? B - 1 - j : j - B;
      const a = ((j + 0.5) / n) * TAU, v = lev[band];
      const r = base * (1 - amp * v * Math.sqrt(v));
      ring[j * 2] = c + Math.sin(a) * r; ring[j * 2 + 1] = c - Math.cos(a) * r;
    }
    ring[n * 2] = ring[0]; ring[n * 2 + 1] = ring[1];
    ctx.beginPath();
    ctx.moveTo((ring[n * 2 - 2] + ring[0]) / 2, (ring[n * 2 - 1] + ring[1]) / 2);
    for (let j = 0; j < n; j++) ctx.quadraticCurveTo(ring[j * 2], ring[j * 2 + 1], (ring[j * 2] + ring[j * 2 + 2]) / 2, (ring[j * 2 + 1] + ring[j * 2 + 3]) / 2);
    ctx.closePath();
  }

  function drawDisc(t) {
    const side = canvas.width, c = side / 2, u = c / PAD, px = side / (R * PAD * 2);      // px = device px per CSS px
    const css = getComputedStyle(mu);
    // Outside the limb the dial is drawn on the page (ink and the legible signal of the theme); inside it the
    // rings are drawn on the dark body, which is black on either grade of the world.
    const ink = css.getPropertyValue('--ink').trim() || '#ecebe5', signal = '#ffc400';
    const mark = css.getPropertyValue('--mark').trim() || signal, inner = '#ecebe5';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, side, side);
    ctx.lineJoin = 'round';

    if (own) {
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(c, c, u, 0, TAU); ctx.fill();
      ctx.strokeStyle = ink; ctx.globalAlpha = 0.5; ctx.lineWidth = px; ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = mark; ctx.lineWidth = 2 * px;
      ctx.beginPath(); ctx.arc(c, c, u * 1.045, -Math.PI / 2, -Math.PI / 2 + (t / dur) * TAU); ctx.stroke();
    }

    // the dial round the limb: 72 ticks, the ones the song has passed in yellow
    const turn = t / dur;
    ctx.lineWidth = px;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU, sx = Math.sin(a), sy = -Math.cos(a), long = i % 6 === 0, done = i / 72 <= turn && turn > 0;
      ctx.strokeStyle = done ? mark : ink; ctx.globalAlpha = done ? (long ? 0.95 : 0.6) : long ? 0.55 : 0.28;
      ctx.beginPath(); ctx.moveTo(c + sx * u * 1.04, c + sy * u * 1.04); ctx.lineTo(c + sx * u * (long ? 1.085 : 1.06), c + sy * u * (long ? 1.085 : 1.06)); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, u * 0.982, 0, TAU); ctx.clip();
    if (data) {
      // the song ahead, far to near: each ring hides what lies behind its own relief
      const first = Math.ceil(t / STEP - 1e-6) * STEP;
      const calm = reducedMotion() && playing;             // reduced motion: only the ring that is sounding moves
      for (let i = calm ? -1 : RINGS - 1; i >= 0; i--) {
        const time = first + i * STEP, tau = time - t;
        if (time > dur) continue;
        const base = (RIM * u) / (1 + tau * DEPTH), near = 1 - tau / AHEAD;
        levels(time);
        tracePath(c, base, AMP);
        ctx.arc(c, c, base, 0, TAU, true);
        ctx.fillStyle = '#000'; ctx.globalAlpha = 0.94; ctx.fill('evenodd');
        tracePath(c, base, AMP);
        ctx.globalAlpha = 0.05 + 0.68 * near * near * Math.min(1, (AHEAD - tau) / 1.2) * Math.min(1, 0.35 + tau / 0.35);
        ctx.strokeStyle = inner; ctx.lineWidth = (0.5 + 0.8 * near) * px; ctx.stroke();
      }
      // what is sounding now
      const level = levels(t);
      tracePath(c, RIM * u, AMP);
      ctx.arc(c, c, RIM * u, 0, TAU, true);
      ctx.fillStyle = '#000'; ctx.globalAlpha = 0.94; ctx.fill('evenodd');
      tracePath(c, RIM * u, AMP);
      ctx.globalAlpha = 1; ctx.strokeStyle = signal; ctx.lineWidth = 1.8 * px;
      ctx.shadowColor = signal; ctx.shadowBlur = (4 + 26 * level) * px;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = signal; ctx.lineWidth = 1.4 * px;
      ctx.beginPath(); ctx.arc(c, c, RIM * u, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // the playhead on the limb, and where the pointer would move it to
    const hand = (turn, color, alpha, len) => {
      const a = turn * TAU, sx = Math.sin(a), sy = -Math.cos(a);
      ctx.globalAlpha = alpha; ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = 1.5 * px;
      ctx.beginPath(); ctx.moveTo(c + sx * u * 1.0, c + sy * u * 1.0); ctx.lineTo(c + sx * u * len, c + sy * u * len); ctx.stroke();
      ctx.beginPath(); ctx.arc(c + sx * u * len, c + sy * u * len, 3 * px, 0, TAU); ctx.fill();
    };
    if (hover != null && !grab) hand(hover / dur, ink, 0.7, 1.12);
    hand(turn, mark, 1, grab ? 1.22 : 1.16);
    ctx.globalAlpha = 1;
  }

  // ---------------- the world ----------------
  let scene = null;                                      // arrives a moment after the deck is ready (see "go")
  const wide = matchMedia('(min-aspect-ratio: 1/1)');
  const view = [{ shift: 0, lift: 0, pull: 0 }, { shift: 0, lift: 0, pull: 0 }];     // paused · playing
  const hit = { x: 0, y: 0, r: 0 }, spot = { x: 0, y: 0, r: 0, on: 0 };
  let push = 0, sweep = 0, placed = '';

  // Seat the eclipse in the stage box: solve for the lens shift and the camera distance that put its centre on
  // the centre of the box at the wanted radius. Twice — the camera stands a little closer while a song plays.
  function layout() {
    const box = stageEl.getBoundingClientRect();
    if (!box.width || !box.height) return;
    R = Math.max(40, Math.min(box.width * (wide.matches ? 0.3 : 0.34), box.height * (wide.matches ? 0.31 : 0.36)));
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    hit.x = cx; hit.y = cy; hit.r = R;
    sizeCanvas();
    if (scene) {
      view.forEach((v, n) => {
        const want = R * (n ? 1 : 0.92), probe = { seat: 0, shift: 0, lift: 0, pull: 0 };
        for (let i = 0; i < 5; i++) {
          let e = scene.eclipseFor(T, probe, spot);
          probe.pull = clamp((1 + probe.pull) * (e.r / want) - 1, -0.7, 4);
          e = scene.eclipseFor(T, probe, spot);
          probe.shift += (cx - e.x) / innerWidth; probe.lift += (e.y - cy) / innerHeight;
        }
        Object.assign(v, probe);
      });
    }
    waveDirty = dirty = true;
    place(cx, cy, R * mix(0.92, 1, push));
  }
  function place(x, y, r) {
    const side = r * PAD * 2, key = `${x.toFixed(1)},${y.toFixed(1)},${side.toFixed(1)}`;
    if (key === placed) return;
    placed = key;
    disc.style.width = disc.style.height = `${side}px`;
    disc.style.transform = `translate(${x - side / 2}px, ${y - side / 2}px)`;
  }

  const takeWheel = () => world.drive({
    frame() {
      const a = view[0], b = view[1];
      return { t: T, speed: 0, seat: 0, shift: mix(a.shift, b.shift, push), lift: mix(a.lift, b.lift, push), pull: mix(a.pull, b.pull, push), sweep };
    },
    // the disc follows the eclipse wherever the camera has it — also on the flight in from another page
    state(st, sc) { const e = sc.eclipse(spot); mu.style.setProperty('--arrive', e.on.toFixed(3)); if (e.r > 4) place(e.x, e.y, e.r); },
    resize: layout,
  });

  // ---------------- the clock ----------------
  let raf = 0, last = performance.now(), lastCalm = 0;
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // the element's clock is coarse; run alongside it and only correct what drifts
    if (audio.readyState >= 1 && pending == null) {
      const a = audio.currentTime;
      if (playing && !audio.paused && !waiting) { pos += dt; pos = Math.abs(pos - a) > 0.15 ? a : pos + (a - pos) * 0.12; dirty = true; }
      else if (pos !== a && !audio.seeking) { pos = a; dirty = true; }
    }
    const t = clamp(grab ? grab.at : pos, 0, dur);

    const k = 1 - Math.exp(-dt * 5);
    const wantPush = playing ? 1 : 0;
    if (Math.abs(wantPush - push) > 0.001) push += (wantPush - push) * (reducedMotion() ? 1 : k); else push = wantPush;
    const wantSweep = (t / dur) * 1.035;
    sweep = Math.abs(wantSweep - sweep) > 0.0005 ? sweep + (wantSweep - sweep) * (reducedMotion() ? 1 : 1 - Math.exp(-dt * 16)) : wantSweep;
    if (own) place(hit.x, hit.y, hit.r * mix(0.92, 1, push));

    const sec = Math.floor(t * 10);
    if (sec !== shownSec) {
      shownSec = sec;
      out.cur.textContent = clock(t);
      out.tagTime.textContent = `${clock(t)}.${Math.floor((t % 1) * 10)}`;
      scrub.setAttribute('aria-valuenow', Math.round(t));
      scrub.setAttribute('aria-valuetext', `${clock(t)} / ${clock(dur)}`);
      waveDirty = true;
      if (sec % 50 === 0) position();
    }
    if (waveDirty) { waveDirty = false; drawWave(); }
    if (dirty && R) {
      if (reducedMotion() && playing && now - lastCalm < 120) return;      // a calmer redraw rate
      lastCalm = now;
      dirty = false;
      drawDisc(t);
    }
  };

  // ---------------- go ----------------
  setVolume(volume, muted);
  setRepeat(repeat);
  const want = tracks.findIndex((t) => t.id === location.hash.slice(1));
  setTrack(want >= 0 ? want : 0, { play: false, hash: false });
  mu.classList.remove('is-swap');
  raf = requestAnimationFrame(tick);
  // the other track's analysis, once the page is idle
  const idle = setTimeout(() => tracks.forEach((t) => loadScan(t.id)), 1500);

  // The deck works from here on. The world may still be building (first visit): the turntable joins when it is up.
  scene = await world.ready();
  own = !scene;
  mu.classList.toggle('mu--own', own);
  if (scene) off.push(takeWheel());
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(stageEl); ro.observe(scrub);
  on(wide, 'change', layout);
  off.push(store.on('nxQuality', () => { sizeCanvas(); dirty = true; }));

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    clearTimeout(idle); clearTimeout(msgTimer);
    ro.disconnect();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; }
    off.forEach((f) => f());
  };
}
