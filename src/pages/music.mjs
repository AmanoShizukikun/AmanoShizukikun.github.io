// Markup of the music player (/apps/music/). Behaviour: assets/js/pages/music.js · styles: assets/css/music.css
// · content: assets/js/data/music.js · analysis: tools/music-scan.mjs → assets/js/data/music-scan.js
//
// Without JavaScript the page is the track list with the browser's own audio controls; with it, .mu becomes a
// fixed frame: the eclipse of the world is the turntable, the copy names what is on it, the deck drives it.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const two = (i) => String(i).padStart(2, '0');
const clock = (s) => `${Math.floor(s / 60)}:${two(Math.floor(s % 60))}`;

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5h2.6v14H5.5zM19 5v14L8.6 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.9 5h2.6v14h-2.6zM5 5l10.4 7L5 19z"/></svg>',
};

export const metaOf = (t) => [t.year, t.bpm ? `${t.bpm} BPM` : null, t.genre ? t.genre.toUpperCase() : null].filter(Boolean).join(' · ');

export function musicBody({ tracks, album }, { scans }) {
  const first = tracks[0];
  const total = tracks.reduce((s, t) => s + scans[t.id].duration, 0);
  return `<div class="mu" id="mu">
  <h1 class="nx-sr">音樂播放器 MUSIC WORKS</h1>
  <div class="mu-scrim" aria-hidden="true"></div>

  <!-- the turntable: JavaScript seats the eclipse of the world in this box and lays the disc over it -->
  <div class="mu-stage" data-mu="stage">
    <div class="mu-disc" data-mu="disc">
      <canvas data-mu="canvas" aria-hidden="true"></canvas>
      <button type="button" class="mu-disc__hit" data-act="toggle" aria-label="播放">${ICON.play}${ICON.pause}</button>
    </div>
    <p class="mu-tag" aria-hidden="true"><b data-mu="tag-time">0:00.0</b><span data-mu="tag-state">STANDBY</span></p>
  </div>

  <div class="mu-copy">
    <p class="pg-kicker">MUSIC WORKS / ${esc(album.title)}</p>
    <section class="mu-now" aria-label="目前曲目">
      <span class="mu-cover"><img data-mu="cover" src="/assets/img/music/${first.id}.webp" alt="" width="720" height="720" decoding="async"></span>
      <div class="mu-now__text" aria-live="polite">
        <p class="mu-no"><b data-mu="no">01</b><i>/ ${two(tracks.length)}</i></p>
        <h2 class="mu-title" data-mu="title">${esc(first.title)}${first.sub ? `<small>${esc(first.sub)}</small>` : ''}</h2>
        <p class="mu-meta"><span data-mu="meta">${esc(metaOf(first))}</span></p>
        <p class="mu-by">作曲 ${esc(album.artist)}<i>${esc(album.made)}</i></p>
      </div>
    </section>

    <ol class="mu-list" data-mu="list" aria-label="曲目">${tracks.map((t, i) => `
      <li id="${t.id}"${i === 0 ? ' class="is-on"' : ''}>
        <button type="button" class="mu-track" data-track="${i}"${i === 0 ? ' aria-current="true"' : ''}>
          <i>${two(i + 1)}</i>
          <span class="mu-track__img"><img src="/assets/img/music/${t.id}.webp" alt="" width="720" height="720" loading="lazy" decoding="async"></span>
          <strong>${esc(t.title)}${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</strong>
          <span class="mu-track__meta">${esc(metaOf(t))}</span>
          <b>${clock(scans[t.id].duration)}</b>
        </button>
        <audio class="mu-native" controls preload="none" src="/assets/music/${t.id}.mp3"></audio>
        <a class="mu-track__ext" href="${esc(t.video)}" target="_blank" rel="noopener noreferrer" aria-label="在 YouTube 觀看 ${esc(t.title)}">YouTube ↗</a>
      </li>`).join('')}
    </ol>
    <p class="mu-sum">${tracks.length} 首 · 共 ${clock(total)}</p>
  </div>

  <!-- the deck -->
  <div class="mu-deck" role="group" aria-label="播放控制">
    <div class="mu-ctl">
      <button type="button" data-act="prev" aria-label="上一首">${ICON.prev}</button>
      <button type="button" class="mu-play" data-act="toggle" aria-label="播放">${ICON.play}${ICON.pause}</button>
      <button type="button" data-act="next" aria-label="下一首">${ICON.next}</button>
    </div>
    <div class="mu-bar">
      <b class="mu-clock" data-mu="cur">0:00</b>
      <div class="mu-scrub" data-mu="scrub" role="slider" tabindex="0" aria-label="播放位置" aria-valuemin="0" aria-valuemax="${Math.round(scans[first.id].duration)}" aria-valuenow="0" aria-valuetext="0:00 / ${clock(scans[first.id].duration)}">
        <canvas data-mu="wave" aria-hidden="true"></canvas>
        <i class="mu-scrub__head" data-mu="head" aria-hidden="true"></i>
        <span class="mu-scrub__tip" data-mu="tip" aria-hidden="true"></span>
      </div>
      <span class="mu-clock" data-mu="dur">${clock(scans[first.id].duration)}</span>
    </div>
    <div class="mu-opt">
      <button type="button" class="mu-txt" data-act="repeat" aria-label="循環：全部曲目"><i>LOOP</i><b data-mu="repeat">ALL</b></button>
      <button type="button" class="mu-txt" data-act="mute" aria-pressed="false" aria-label="靜音"><i>VOL</i><b data-mu="vol">80</b></button>
      <input type="range" class="mu-range" data-mu="volume" min="0" max="100" step="1" value="80" aria-label="音量">
    </div>
  </div>
  <p class="mu-keys" aria-hidden="true"><span><kbd>SPACE</kbd>播放</span><span><kbd>←</kbd><kbd>→</kbd>5 秒</span><span><kbd>↑</kbd><kbd>↓</kbd>音量</span><span><kbd>N</kbd><kbd>P</kbd>換曲</span><span><kbd>M</kbd>靜音</span><span><kbd>R</kbd>循環</span></p>
  <p class="mu-msg" data-mu="msg" role="status"></p>
  <audio data-mu="audio" preload="none"></audio>
</div>`;
}
