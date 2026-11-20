// Local preview server (no dependencies). Mirrors GitHub Pages: directory index.html and 404.html fallback.
//   node tools/serve.mjs [port]      → http://localhost:4173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
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
