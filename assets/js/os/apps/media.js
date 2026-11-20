// Media player: the site's own tracks, the audio and video in the home folder, and anything opened from the
// file manager. One media element plays everything; for audio the picture is a live spectrum.
import { h, tool, btn } from '../ui.js';
import { span, clamp } from '../kernel.js';
import { tracks, album } from '../../data/music.js';

export async function start(os, win, args = {}) {
  const { fs } = os;
  const state = os.cfg.app('media');
  let list = [], cur = -1, repeat = state.get('repeat', 'all'), own = state.get('vol', 100) / 100, job = 0, seeking = false;
  const extra = [];

  const media = h('video', { class: 'md-video', playsinline: true, preload: 'metadata' });
  const cover = h('img', { class: 'md-cover', alt: '' });
  const canvas = h('canvas', { class: 'md-scope' });
  const glyph = h('div', { class: 'md-glyph', html: tool('music', '').innerHTML });
  const title = h('b'), sub = h('span');
  const seek = h('input', { type: 'range', min: 0, max: 1000, value: 0, step: 1, 'aria-label': '播放位置' });
  const tCur = h('span', null, '0:00'), tDur = h('span', null, '0:00');
  const playBtn = tool('play', '播放', { class: 'os-tool md-play', onclick: () => toggle() });
  const repBtn = tool('repeat', '循環', { onclick: () => { repeat = repeat === 'all' ? 'one' : repeat === 'one' ? 'off' : 'all'; state.set('repeat', repeat); sync(); } });
  const vol = h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(own * 100), 'aria-label': '播放器音量' });
  const rows = h('ol', { class: 'md-list' });
  const stage = h('div', { class: 'md-stage' }, canvas, cover, glyph, media);
  win.body.append(h('div', { class: 'md' },
    h('div', { class: 'md-main' }, stage,
      h('div', { class: 'md-info' }, title, sub),
      h('div', { class: 'md-seek' }, tCur, seek, tDur),
      h('div', { class: 'md-ctl' }, repBtn, tool('prev', '上一首', { onclick: () => step(-1, true) }), playBtn, tool('next', '下一首', { onclick: () => step(1, true) }), h('label', { class: 'md-vol' }, tool('vol', '音量', { tabindex: '-1' }), vol))),
    h('div', { class: 'md-side' }, h('header', null, h('b', null, '播放清單'), btn('加入', { icon: 'upload', cls: 'is-quiet', onclick: () => os.ops.addFiles(fs.dir('music'), 'audio/*,video/*') })), rows)));

  // ---------------- the list
  function collect() {
    const out = fs.children(fs.get('sys:music')).map((n) => ({ node: n, track: tracks.find((t) => t.id === n.track) }));
    const walk = (d) => fs.children(d).forEach((n) => { if (n.dir) walk(n); else if (['audio', 'video'].includes(fs.kind(n))) out.push({ node: n }); });
    walk(fs.home);
    for (const n of extra) if (fs.get(n.id) && !out.some((x) => x.node === n)) out.push({ node: n });
    return out;
  }
  const nameOf = (it) => (it.track ? `${it.track.title}${it.track.sub ? ` – ${it.track.sub}` : ''}` : it.node.name.replace(/\.[^.]+$/, ''));
  function drawList() {
    const now = cur >= 0 ? list[cur]?.node : null;
    list = collect();
    cur = now ? list.findIndex((x) => x.node === now) : -1;
    rows.replaceChildren(...(list.length ? list.map((it, i) => h('li', { class: i === cur ? 'is-on' : '' }, h('button', { type: 'button', data: { i } }, h('i', null, String(i + 1).padStart(2, '0')), h('span', null, nameOf(it)), h('em', null, it.track ? album.artist : fs.kind(it.node) === 'video' ? 'VIDEO' : 'FILE')))) : [h('li', { class: 'md-none' }, '清單是空的')]));
    if (now && cur < 0) stop();
  }

  // ---------------- playback
  const applyVol = () => { media.volume = clamp(os.sound.level() * own, 0, 1); };
  function sync() {
    const playing = !media.paused && !media.ended;
    playBtn.innerHTML = tool(playing ? 'pause' : 'play', '').innerHTML;
    playBtn.title = playing ? '暫停' : '播放'; playBtn.setAttribute('aria-label', playBtn.title);
    repBtn.setAttribute('aria-pressed', String(repeat !== 'off'));
    repBtn.title = repeat === 'all' ? '循環：整個清單' : repeat === 'one' ? '循環：單曲' : '循環：關閉';
    repBtn.classList.toggle('is-one', repeat === 'one');
    win.body.firstChild.classList.toggle('is-playing', playing);
    const it = list[cur];
    os.media = it ? { title: nameOf(it), playing, toggle, next: () => step(1, true), prev: () => step(-1, true) } : null;
    os.bus.emit('media');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
  async function load(i, play = true) {
    if (!list.length) return;
    cur = (i + list.length) % list.length;
    const it = list[cur], my = ++job, video = fs.kind(it.node) === 'video';
    stage.classList.toggle('is-video', video);
    title.textContent = nameOf(it);
    sub.textContent = it.track ? [album.artist, it.track.year, it.track.bpm ? `${it.track.bpm} BPM` : null].filter(Boolean).join(' · ') : fs.path(it.node);
    cover.hidden = !it.track; glyph.hidden = !!it.track || video;
    if (it.track) cover.src = `/assets/img/music/${it.track.id}.webp`;
    win.setTitle(`${nameOf(it)} — 媒體播放器`);
    rows.querySelectorAll('li').forEach((li, k) => li.classList.toggle('is-on', k === cur));
    seek.value = 0; tCur.textContent = '0:00'; tDur.textContent = '0:00';
    try {
      const u = await fs.url(it.node);
      if (my !== job) return;
      media.src = u;
      if ('mediaSession' in navigator && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: nameOf(it), artist: it.track ? album.artist : 'WebOS', album: it.track ? album.title : '' });
      if (play) await start_();
    } catch (e) { if (my === job) { sub.textContent = '這個檔案無法播放'; sync(); } }
  }
  async function start_() {
    applyVol();
    scope();
    try { await media.play(); } catch (e) { if (e.name !== 'AbortError') sub.textContent = e.name === 'NotAllowedError' ? '瀏覽器擋下了播放，請再按一次播放' : '這個檔案無法播放'; }
    sync();
  }
  function toggle() { if (cur < 0) { load(0); return; } if (media.paused) start_(); else { media.pause(); sync(); } }
  function stop() { media.pause(); media.removeAttribute('src'); media.load(); cur = -1; title.textContent = '沒有在播放'; sub.textContent = '從右邊的清單選一首'; cover.hidden = true; glyph.hidden = false; stage.classList.remove('is-video'); win.setTitle('媒體播放器'); sync(); }
  function step(d, byUser) {
    if (!list.length) return;
    if (!byUser && repeat === 'one') { media.currentTime = 0; start_(); return; }
    const next = cur + d;
    if (!byUser && repeat === 'off' && next >= list.length) { sync(); return; }
    load(next, true);
  }

  // ---------------- the spectrum (built on the first play: an AudioContext needs a gesture)
  let actx = null, analyser = null, bins = null, raf = 0;
  function scope() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = actx.createAnalyser();
        analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
        actx.createMediaElementSource(media).connect(analyser);
        analyser.connect(actx.destination);
        bins = new Uint8Array(analyser.frequencyBinCount);
      } catch { actx = null; analyser = null; }
    }
    actx?.resume?.();
    if (!raf) raf = requestAnimationFrame(paint);
  }
  function paint() {
    raf = 0;
    if (!win.el.isConnected) return;
    const playing = !media.paused && !media.ended;
    const w = canvas.clientWidth, hh = canvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (w && hh && !stage.classList.contains('is-video') && !win.min) {
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, hh);
      const tint = getComputedStyle(win.el).getPropertyValue('--signal').trim() || '#ffc400';
      const n = 48, gap = 3, bw = (w - gap * (n - 1)) / n;
      if (analyser) analyser.getByteFrequencyData(bins);
      for (let i = 0; i < n; i++) {
        const v = analyser ? bins[Math.floor((i / n) ** 1.6 * (bins.length * 0.72))] / 255 : 0;
        const bh = Math.max(2, v * hh * 0.86);
        g.fillStyle = v > 0.66 ? tint : 'rgba(236, 235, 229, 0.42)';
        g.fillRect(i * (bw + gap), hh - bh, bw, bh);
      }
    }
    if (playing) raf = requestAnimationFrame(paint);
  }

  // ---------------- events
  rows.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) load(Number(b.dataset.i)); });
  media.addEventListener('timeupdate', () => { if (seeking || !media.duration) return; seek.value = Math.round((media.currentTime / media.duration) * 1000); tCur.textContent = span(media.currentTime); });
  media.addEventListener('durationchange', () => { tDur.textContent = Number.isFinite(media.duration) ? span(media.duration) : '—'; });
  media.addEventListener('ended', () => step(1, false));
  ['play', 'pause', 'playing', 'waiting'].forEach((t) => media.addEventListener(t, () => { sync(); if (t === 'play' || t === 'playing') scope(); }));
  media.addEventListener('error', () => { if (media.src) { sub.textContent = '這個檔案無法播放'; sync(); } });
  seek.addEventListener('input', () => { seeking = true; if (media.duration) tCur.textContent = span((seek.value / 1000) * media.duration); });
  seek.addEventListener('change', () => { if (media.duration) media.currentTime = (seek.value / 1000) * media.duration; seeking = false; });
  vol.addEventListener('input', () => { own = vol.value / 100; state.set('vol', Number(vol.value)); applyVol(); });
  stage.addEventListener('click', () => { if (stage.classList.contains('is-video')) toggle(); });
  stage.addEventListener('dblclick', () => { if (stage.classList.contains('is-video')) (document.fullscreenElement ? document.exitFullscreen() : media.requestFullscreen?.())?.catch?.(() => {}); });
  win.body.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' && media.duration) { e.preventDefault(); media.currentTime = Math.min(media.duration, media.currentTime + 5); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); media.currentTime = Math.max(0, media.currentTime - 5); }
    else if (e.key.toLowerCase() === 'n') step(1, true); else if (e.key.toLowerCase() === 'p') step(-1, true);
  });
  win.body.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  win.body.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); os.importFiles([...e.dataTransfer.files].filter((f) => /^(audio|video)\//.test(f.type)), fs.dir('music')); } });
  win.cleanup.push(os.bus.on('fs', drawList), os.bus.on('cfg:vol', applyVol), os.bus.on('cfg:mute', applyVol), () => {
    cancelAnimationFrame(raf);
    media.pause(); media.removeAttribute('src'); media.load();
    try { actx?.close(); } catch { /* closed */ }
    os.media = null; os.bus.emit('media');
    if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; }
  });

  const openNode = (n) => { if (!n) return; if (!collect().some((x) => x.node === n)) extra.push(n); drawList(); load(list.findIndex((x) => x.node === n)); };
  drawList();
  applyVol();
  stop();
  if (args.node) openNode(args.node);
  return { open: (a) => openNode(a.node) };
}
