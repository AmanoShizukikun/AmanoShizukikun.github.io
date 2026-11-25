// Reads every model of the 3D works gallery (assets/js/data/models.js) and writes what can be counted from the
// file itself — triangles, vertices, materials, textures, bones, animations, size — to assets/js/data/models-scan.js.
//   node tools/models-scan.mjs            scan every model
//   node tools/models-scan.mjs <id> …     scan only these (the others keep what they had)
// No dependencies: a .glb is a small header, a JSON chunk and a binary chunk, and everything counted here is in the
// JSON (plus the headers of the embedded images, for their size). Run it again whenever a model file changes;
// tools/build.mjs warns when a file no longer matches what was scanned.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'assets/js/data/models-scan.js');
const { models, fileOf } = await import(pathToFileURL(path.join(root, 'assets/js/data/models.js')).href);

// ---------- reading a .glb ----------
function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a binary glTF (.glb) file');
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  if (!json) throw new Error('the file has no JSON chunk');
  return { json, bin };
}

// width × height from the first bytes of a PNG, JPEG or WebP
function imageSize(b) {
  if (!b || b.length < 30) return null;
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
    return null;
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  }
  return null;
}

// 4 × 4 column-major matrices, enough to place the bounding box of each mesh in the scene
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

function scanGlb(file) {
  const buf = fs.readFileSync(file);
  const { json: g, bin } = readGlb(buf);
  const acc = g.accessors || [];
  let tris = 0, verts = 0, drawn = 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const meshTris = (m) => {
    let t = 0, v = 0;
    for (const p of m.primitives) {
      const mode = p.mode ?? 4, n = p.indices != null ? acc[p.indices].count : acc[p.attributes.POSITION]?.count || 0;
      if (mode === 4) t += Math.floor(n / 3);
      else if (mode === 5 || mode === 6) t += Math.max(0, n - 2);
      v += acc[p.attributes.POSITION]?.count || 0;
    }
    return [t, v];
  };
  // walk the scene the way a viewer draws it: a mesh used by two nodes is drawn (and counted) twice
  const scene = (g.scenes || [])[g.scene ?? 0] || { nodes: [] };
  const walk = (i, parent) => {
    const n = g.nodes[i], m = mul(parent, local(n));
    if (n.mesh != null) {
      const mesh = g.meshes[n.mesh], [t, v] = meshTris(mesh);
      tris += t; verts += v; drawn++;
      for (const p of mesh.primitives) {
        const a = acc[p.attributes.POSITION];
        if (!a?.min || !a?.max) continue;
        for (let k = 0; k < 8; k++) {
          const c = apply(m, [k & 1 ? a.max[0] : a.min[0], k & 2 ? a.max[1] : a.min[1], k & 4 ? a.max[2] : a.min[2]]);
          for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], c[j]); hi[j] = Math.max(hi[j], c[j]); }
        }
      }
    }
    (n.children || []).forEach((c) => walk(c, m));
  };
  scene.nodes.forEach((i) => walk(i, I4()));

  const images = (g.images || []).map((im) => {
    if (im.bufferView != null && bin) { const bv = g.bufferViews[im.bufferView]; return imageSize(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)); }
    if (im.uri && !im.uri.startsWith('data:')) { try { return imageSize(fs.readFileSync(path.join(path.dirname(file), decodeURIComponent(im.uri)))); } catch { return null; } }
    return null;
  });
  const maxTex = images.reduce((m, s) => (s ? Math.max(m, s[0], s[1]) : m), 0);
  const animations = (g.animations || []).map((a, i) => ({
    name: a.name || `動畫 ${i + 1}`,
    duration: +Math.max(0, ...a.samplers.map((s) => acc[s.input]?.max?.[0] || 0)).toFixed(2),
  }));
  const size = hi[0] > lo[0] ? hi.map((h, j) => +(h - lo[j]).toFixed(3)) : null;
  return {
    bytes: buf.length,
    sum: createHash('sha1').update(buf).digest('hex').slice(0, 12),
    tris, verts, meshes: drawn,
    materials: (g.materials || []).length,
    textures: (g.images || []).length, maxTexture: maxTex,
    joints: (g.skins || []).reduce((m, s) => Math.max(m, s.joints.length), 0),
    morphs: (g.meshes || []).reduce((m, me) => Math.max(m, ...me.primitives.map((p) => (p.targets || []).length)), 0),
    animations,
    size,
    extensions: g.extensionsUsed || [],
    generator: g.asset?.generator || '',
  };
}

// ---------- write ----------
let old = {};
try { old = (await import(pathToFileURL(OUT).href + `?t=${Date.now()}`)).scan; } catch { /* first run */ }
const only = process.argv.slice(2);
const scan = {};
let failed = 0;
for (const m of models) {
  if (only.length && !only.includes(m.id)) { if (old[m.id]) scan[m.id] = old[m.id]; continue; }
  const file = path.join(root, fileOf(m).replace(/^\//, ''));
  try {
    scan[m.id] = { file: fileOf(m), ...scanGlb(file) };
    const s = scan[m.id];
    console.log(`${m.id.padEnd(18)} ${String(s.tris).padStart(8)} tris  ${String(s.verts).padStart(8)} verts  ${(s.bytes / 1048576).toFixed(1).padStart(5)} MB  ${s.textures} tex ≤ ${s.maxTexture}px  ${s.joints} bones  ${s.animations.length} anim`);
    const odd = s.extensions.filter((e) => /draco|meshopt|ktx|basisu/i.test(e));
    if (odd.length) console.warn(`  ! ${m.id} uses ${odd.join(', ')} — the viewer has no decoder for these; export without compression`);
  } catch (e) {
    failed++;
    console.error(`${m.id}: ${e.message} (${fileOf(m)})`);
  }
}
const body = `// GENERATED by tools/models-scan.mjs — what each model file of the 3D works gallery contains, counted from the
// file itself. Do not edit by hand: run \`node tools/models-scan.mjs\` after adding or changing a model.
export const scan = ${JSON.stringify(scan, null, 2)};
`;
fs.writeFileSync(OUT, body);
console.log(`${Object.keys(scan).length} models → ${path.relative(root, OUT)}${failed ? ` (${failed} failed)` : ''}`);
if (failed) process.exitCode = 1;
