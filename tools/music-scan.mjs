// Analyses the tracks of the music player ahead of time, so the page can draw a whole song without decoding it.
//   node tools/music-scan.mjs            (needs ffmpeg on PATH, or FFMPEG=<path to ffmpeg>)
//
// For every track in assets/js/data/music.js it reads assets/music/<id>.mp3 and writes
//   assets/music/<id>.bin            the spectrogram: FRAMES × BANDS bytes, one row per frame (FPS frames a second),
//                                    BANDS log-spaced bands from F_LO to F_HI, 0–255 = the bottom RANGE dB of the track
//   assets/js/data/music-scan.js     per track: duration, frame count and the loudness envelope for the scrub bar
// Because the picture is computed from the file and not from what happens to be playing, the page can show any
// moment of a song — ahead of the playhead, while paused, while scrubbing backwards.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { tracks } = await import(pathToFileURL(path.join(root, 'assets/js/data/music.js')).href);

const SR = 22050, N = 2048, FPS = 24, BANDS = 56, F_LO = 45, F_HI = 10000, RANGE = 54, PEAKS = 240;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

function decode(file) {
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.error || r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${r.error?.message || r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength >> 2);
}

// in-place radix-2 FFT
const rev = new Uint32Array(N);
for (let i = 0, bits = Math.log2(N); i < N; i++) { let x = i, y = 0; for (let b = 0; b < bits; b++) { y = (y << 1) | (x & 1); x >>= 1; } rev[i] = y; }
const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / N); sinT[i] = Math.sin((2 * Math.PI * i) / N); }
function fft(re, im) {
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { const a = re[i]; re[i] = re[j]; re[j] = a; } }
  im.fill(0);
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let s = 0; s < N; s += size) {
      for (let k = 0; k < half; k++) {
        const c = cosT[k * step], sn = -sinT[k * step];
        const xr = re[s + k + half] * c - im[s + k + half] * sn, xi = re[s + k + half] * sn + im[s + k + half] * c;
        re[s + k + half] = re[s + k] - xr; im[s + k + half] = im[s + k] - xi;
        re[s + k] += xr; im[s + k] += xi;
      }
    }
  }
}
const hann = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
const edge = (b) => F_LO * (F_HI / F_LO) ** (b / BANDS);

function scan(pcm) {
  const duration = pcm.length / SR;
  const frames = Math.ceil(duration * FPS);
  const db = new Float32Array(frames * BANDS);
  const re = new Float64Array(N), im = new Float64Array(N), mag = new Float64Array(N / 2);
  const at = (f) => { const x = Math.min(N / 2 - 2, (f * N) / SR), i = Math.floor(x); return mag[i] + (mag[i + 1] - mag[i]) * (x - i); };
  for (let f = 0; f < frames; f++) {
    const start = Math.round((f / FPS) * SR) - N / 2;                // the window is centred on the frame's time
    for (let i = 0; i < N; i++) { const s = start + i; re[i] = s >= 0 && s < pcm.length ? pcm[s] * hann[i] : 0; }
    fft(re, im);
    for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
    for (let b = 0; b < BANDS; b++) {
      // the loudest of a few points across the band: narrow low bands read between bins, wide high bands keep their peaks
      const lo = edge(b), hi = edge(b + 1);
      let m = 0;
      for (let k = 0; k <= 6; k++) m = Math.max(m, at(lo + ((hi - lo) * k) / 6));
      // music falls off by roughly 3 dB an octave; lift the top so the whole ring moves, not only the bass
      db[f * BANDS + b] = 20 * Math.log10(m + 1e-9) + 3 * Math.log2(Math.sqrt(lo * hi) / 1000);
    }
  }
  const sorted = Float32Array.from(db).sort();
  const top = sorted[Math.floor(sorted.length * 0.999)];
  const out = new Uint8Array(frames * BANDS);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(255 * Math.min(1, Math.max(0, (db[i] - (top - RANGE)) / RANGE)));

  // loudness envelope for the scrub bar
  const peaks = new Array(PEAKS), span = pcm.length / PEAKS;
  let max = 0;
  for (let p = 0; p < PEAKS; p++) {
    let sum = 0; const a = Math.floor(p * span), b = Math.floor((p + 1) * span);
    for (let i = a; i < b; i++) sum += pcm[i] * pcm[i];
    peaks[p] = Math.sqrt(sum / Math.max(1, b - a));
    max = Math.max(max, peaks[p]);
  }
  return { duration, frames, out, peaks: peaks.map((v) => Math.round((v / max) * 99)) };
}

const lines = [];
for (const t of tracks) {
  const file = path.join(root, 'assets/music', `${t.id}.mp3`);
  const s = scan(decode(file));
  fs.writeFileSync(path.join(root, 'assets/music', `${t.id}.bin`), s.out);
  lines.push(`  '${t.id}': { duration: ${s.duration.toFixed(3)}, frames: ${s.frames}, peaks: [${s.peaks.join(',')}] },`);
  console.log(`${t.id}: ${s.duration.toFixed(2)} s, ${s.frames} frames × ${BANDS} bands → ${(s.out.length / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(path.join(root, 'assets/js/data/music-scan.js'), `// Generated by tools/music-scan.mjs — do not edit by hand.
// fps / bands / lo / hi describe every assets/music/<id>.bin; peaks is the loudness envelope (0–99) across the track.
export const scan = { fps: ${FPS}, bands: ${BANDS}, lo: ${F_LO}, hi: ${F_HI} };
export const scans = {
${lines.join('\n')}
};
`);
