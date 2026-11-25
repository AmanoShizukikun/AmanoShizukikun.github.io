// Local preview server (no dependencies). Mirrors GitHub Pages: directory index.html and 404.html fallback.
//   node tools/serve.mjs [port]      → http://localhost:4173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const port = Number(process.argv[2] || 4173);
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(3).length ? process.argv.slice(3) : ['=' + here];
const mounts = args.map((a) => {
  const i = a.indexOf('=');
  return { prefix: a.slice(0, i), root: path.resolve(a.slice(i + 1)) };
}).sort((a, b) => b.prefix.length - a.prefix.length);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary', '.moc3': 'application/octet-stream', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

// The 3D works viewer's 設為封面 button (assets/js/models/viewer.js, shown only on this server) posts a WebP of what
// it shows here, and it is written to assets/models/<id>/poster.webp. Nothing else can be written: one path, one
// file name, a model id that exists in data/models.js, a WebP body, a request from this server's own pages.
async function savePoster(req, res, url) {
  const done = (code, body) => { res.writeHead(code, { 'content-type': MIME['.json'] }); res.end(JSON.stringify(body)); };
  const m = /^\/__models\/([a-z0-9-]+)\/poster$/.exec(url);
  const origin = req.headers.origin || '';
  if (!m || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || req.headers['content-type'] !== 'image/webp') return done(403, { ok: false, error: 'not allowed' });
  const { models } = await import(`${pathToFileURL(path.join(here, 'assets/js/data/models.js')).href}?t=${Date.now()}`);
  if (!models.some((x) => x.id === m[1])) return done(404, { ok: false, error: `no model "${m[1]}" in assets/js/data/models.js` });
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 8 * 1048576) return done(413, { ok: false, error: 'too large' }); chunks.push(c); }
  const body = Buffer.concat(chunks);
  if (body.toString('ascii', 0, 4) !== 'RIFF' || body.toString('ascii', 8, 12) !== 'WEBP') return done(400, { ok: false, error: 'not a WebP image' });
  const dir = path.join(here, 'assets/models', m[1]);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'poster.webp'), body);
  console.log(`poster: assets/models/${m[1]}/poster.webp (${(body.length / 1024).toFixed(0)} KB)`);
  done(200, { ok: true, file: `/assets/models/${m[1]}/poster.webp`, bytes: body.length });
}

http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (req.method === 'POST') { savePoster(req, res, url); return; }
  const m = mounts.find((x) => url === x.prefix || url.startsWith(x.prefix.endsWith('/') ? x.prefix : x.prefix + '/'));
  if (!m) { res.writeHead(404).end('no mount'); return; }
  let rel = url.slice(m.prefix.length).replace(/^\/+/, '');
  let file = path.join(m.root, rel);
  if (!file.startsWith(m.root)) { res.writeHead(403).end(); return; }
  let st;
  try { st = fs.statSync(file); } catch { st = null; }
  if (st && st.isDirectory()) {
    const idx = path.join(file, 'index.html');
    if (fs.existsSync(idx)) { file = idx; st = fs.statSync(idx); }
    else if (req.headers.accept && req.headers.accept.includes('json')) {
      res.writeHead(200, { 'content-type': MIME['.json'] });
      res.end(JSON.stringify(fs.readdirSync(file)));
      return;
    } else st = null;
  }
  if (!st) {
    // GitHub Pages behaviour: serve 404.html from the mount root
    const nf = path.join(m.root, '404.html');
    if (fs.existsSync(nf)) { res.writeHead(404, { 'content-type': MIME['.html'] }); fs.createReadStream(nf).pipe(res); }
    else res.writeHead(404).end('not found');
    return;
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'content-length': st.size });
    fs.createReadStream(file).pipe(res);
  }
}).listen(port, '127.0.0.1', () => console.log('listening', port, mounts));
