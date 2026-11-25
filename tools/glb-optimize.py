"""Makes a .glb small enough for the web without opening it in Blender.

  python tools/glb-optimize.py <in.glb> <out.glb> [--max-texture 2048] [--max-normal 1024] [--quality 86]
                                [--strip-animations] [--drop-morph-normals] [--no-pack]

  · textures: scaled down to --max-texture (normal maps to --max-normal) and re-encoded as WebP; the file then
    declares EXT_texture_webp, which the site's viewer reads. Images nothing uses are dropped.
  · shape keys: a shape key that moves only part of a mesh (an expression moves the face, not the legs) is stored
    as a sparse accessor — only the vertices it moves. A key that moves nothing is stored as no data at all.
  · packing (unless --no-pack): indices in 16 bits where a primitive has fewer than 65536 vertices, bone indices in
    8 bits, bone weights in 8 bits, normals in 8 bits and texture coordinates in 16 bits (the last two declare
    KHR_mesh_quantization, which three.js reads). Positions stay as they are.
  · --strip-animations drops the animations (test clips, for example).
  · --drop-morph-normals drops what shape keys do to normals: only lighting on a moved face changes slightly, and an
    unlit (shadeless) model does not use normals at all.
  · geometry, skins and materials are otherwise left exactly as they are.
Needs Pillow. Used for the 3D works (assets/models/<id>/model.glb) — see README「3D 作品頁面」.
"""
import io, json, struct, sys
from array import array
from PIL import Image

args = sys.argv[1:]
if len(args) < 2:
    raise SystemExit(__doc__)
src, dst = args[0], args[1]
opt = lambda name, default: type(default)(args[args.index(name) + 1]) if name in args else default
MAX, MAX_N, Q, STRIP = opt('--max-texture', 2048), opt('--max-normal', 1024), opt('--quality', 86), '--strip-animations' in args
PACK, NO_MORPH_N = '--no-pack' not in args, '--drop-morph-normals' in args

data = open(src, 'rb').read()
magic, version, length = struct.unpack_from('<4sII', data, 0)
if magic != b'glTF':
    raise SystemExit('not a .glb file')
off, gltf, bin_ = 12, None, b''
while off < length:
    clen, ctype = struct.unpack_from('<II', data, off)
    chunk = data[off + 8: off + 8 + clen]
    if ctype == 0x4E4F534A: gltf = json.loads(chunk)
    elif ctype == 0x004E4942: bin_ = chunk
    off += 8 + clen

views = gltf.get('bufferViews', [])
accessors = gltf.get('accessors', [])
images = gltf.get('images', [])
textures = gltf.get('textures', [])
mats = gltf.get('materials', [])
view_bytes = lambda v: bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
fresh = []                               # new blobs: their view index is len(views) + position, fixed up at the end
def new_view(blob, **extra):
    fresh.append((blob, extra))
    return len(views) + len(fresh) - 1
def read(a, fmt, n):
    # the values of a plain (non-sparse) accessor, `n` components per element, as an array of type `fmt`
    v = views[a['bufferView']]
    size = array(fmt).itemsize
    stride = v.get('byteStride', size * n)
    raw = view_bytes(v)[a.get('byteOffset', 0):]
    out = array(fmt)
    if stride == size * n: out.frombytes(raw[:a['count'] * stride])
    else:
        for i in range(a['count']): out.frombytes(raw[i * stride: i * stride + size * n])
    return out

if STRIP and gltf.get('animations'):
    print(f"animations removed: {len(gltf['animations'])}")
    gltf.pop('animations')

# ---------- shape keys → sparse ----------
saved = 0
for mesh in gltf.get('meshes', []):
    for prim in mesh['primitives']:
        for target in prim.get('targets', []):
            for key, ai in target.items():
                a = accessors[ai]
                if a.get('sparse') or 'bufferView' not in a or a['componentType'] != 5126 or a['type'] != 'VEC3':
                    continue
                v = views[a['bufferView']]
                stride = v.get('byteStride', 12)
                raw = view_bytes(v)[a.get('byteOffset', 0):]
                vals = array('f')
                if stride == 12: vals.frombytes(raw[:a['count'] * 12])
                else:
                    for i in range(a['count']): vals.frombytes(raw[i * stride: i * stride + 12])
                moved = [i for i in range(a['count']) if abs(vals[3 * i]) > 1e-7 or abs(vals[3 * i + 1]) > 1e-7 or abs(vals[3 * i + 2]) > 1e-7]
                big = a['count'] > 65535
                if len(moved) * (12 + (4 if big else 2)) >= a['count'] * 12 * 0.8:
                    continue                                    # moves most of the mesh: dense is smaller
                before = a['count'] * 12
                a.pop('bufferView'); a.pop('byteOffset', None)
                if moved:
                    idx = array('I' if big else 'H', moved)
                    out = array('f')
                    for i in moved: out.extend(vals[3 * i: 3 * i + 3])
                    a['sparse'] = {
                        'count': len(moved),
                        'indices': {'bufferView': new_view(idx.tobytes()), 'componentType': 5125 if big else 5123},
                        'values': {'bufferView': new_view(out.tobytes())},
                    }
                    saved += before - len(moved) * (12 + (4 if big else 2))
                else:
                    saved += before                             # all zero: an accessor without data is all zeros
print(f'shape keys: {saved / 1048576:.1f} MB saved by storing only the moved vertices')

# ---------- what shape keys do to normals ----------
if NO_MORPH_N:
    dropped = 0
    for mesh in gltf.get('meshes', []):
        for prim in mesh['primitives']:
            for target in prim.get('targets', []):
                for key in ('NORMAL', 'TANGENT'):
                    ai = target.pop(key, None)
                    if ai is None: continue
                    dropped += key == 'NORMAL'
                    for k in ('bufferView', 'byteOffset', 'sparse'): accessors[ai].pop(k, None)   # nothing points at it now: no data
    print(f'shape keys: normals dropped from {dropped} keys')

# ---------- packing ----------
quantized = False
if PACK:
    done, won = set(), 0
    for mesh in gltf.get('meshes', []):
        for prim in mesh['primitives']:
            nverts = accessors[prim['attributes']['POSITION']]['count']
            ii = prim.get('indices')
            if ii is not None and ii not in done:
                a = accessors[ii]; done.add(ii)
                if a['componentType'] == 5125 and nverts < 65536 and 'bufferView' in a:
                    vals = read(a, 'I', 1)
                    a['bufferView'] = new_view(array('H', vals).tobytes(), target=34963); a.pop('byteOffset', None)
                    a['componentType'] = 5123; won += a['count'] * 2
            for key, ai in list(prim['attributes'].items()):
                a = accessors[ai]
                if ai in done or 'bufferView' not in a or a.get('sparse'): continue
                done.add(ai)
                if key.startswith('JOINTS_') and a['componentType'] == 5123:
                    vals = read(a, 'H', 4)
                    if max(vals) < 256:
                        a['bufferView'] = new_view(array('B', vals).tobytes(), target=34962, byteStride=4); a.pop('byteOffset', None)
                        a['componentType'] = 5121; won += a['count'] * 4
                elif key.startswith('WEIGHTS_') and a['componentType'] == 5126:
                    vals = read(a, 'f', 4); out = array('B')
                    for i in range(a['count']):
                        w = [max(0.0, vals[4 * i + k]) for k in range(4)]; t = sum(w) or 1.0
                        q = [round(x / t * 255) for x in w]
                        q[q.index(max(q))] += 255 - sum(q)           # the four still add up to exactly one
                        out.extend(q)
                    a['bufferView'] = new_view(out.tobytes(), target=34962, byteStride=4); a.pop('byteOffset', None)
                    a['componentType'] = 5121; a['normalized'] = True; won += a['count'] * 12
                elif key == 'NORMAL' and a['componentType'] == 5126:
                    vals = read(a, 'f', 3); out = array('b')
                    for i in range(a['count']):
                        x, y, z = vals[3 * i], vals[3 * i + 1], vals[3 * i + 2]; l = (x * x + y * y + z * z) ** 0.5 or 1.0
                        out.extend((round(x / l * 127), round(y / l * 127), round(z / l * 127), 0))
                    a['bufferView'] = new_view(out.tobytes(), target=34962, byteStride=4); a.pop('byteOffset', None)
                    a['componentType'] = 5120; a['normalized'] = True; a.pop('min', None); a.pop('max', None)
                    won += a['count'] * 8; quantized = True
                elif key.startswith('TEXCOORD_') and a['componentType'] == 5126:
                    vals = read(a, 'f', 2)
                    if vals and min(vals) >= 0.0 and max(vals) <= 1.0:
                        a['bufferView'] = new_view(array('H', (round(v * 65535) for v in vals)).tobytes(), target=34962, byteStride=4); a.pop('byteOffset', None)
                        a['componentType'] = 5123; a['normalized'] = True; a.pop('min', None); a.pop('max', None)
                        won += a['count'] * 4; quantized = True
    print(f'packing: {won / 1048576:.1f} MB saved')

# ---------- textures ----------
used, normal = set(), set()
def tex(info, is_normal=False):
    if not info: return
    t = textures[info['index']]
    s = t.get('source', t.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
    if s is not None:
        used.add(s)
        if is_normal: normal.add(s)
for m in mats:
    p = m.get('pbrMetallicRoughness', {})
    tex(p.get('baseColorTexture')); tex(p.get('metallicRoughnessTexture'))
    tex(m.get('normalTexture'), True); tex(m.get('occlusionTexture')); tex(m.get('emissiveTexture'))
    for ext in m.get('extensions', {}).values():
        if isinstance(ext, dict):
            for k, v in ext.items():
                if isinstance(v, dict) and 'index' in v: tex(v)

before_tex = after_tex = 0
image_remap, new_images = {}, []
for i, im in enumerate(images):
    if i not in used:
        print(f'image dropped (unused): {im.get("name", i)}')
        continue
    if 'bufferView' not in im:
        image_remap[i] = len(new_images); new_images.append(im); continue
    raw = view_bytes(views[im['bufferView']])
    pic = Image.open(io.BytesIO(raw))
    limit = MAX_N if i in normal else MAX
    w, h = pic.size
    if max(w, h) > limit:
        k = limit / max(w, h)
        pic = pic.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    has_alpha = pic.mode in ('RGBA', 'LA') or (pic.mode == 'P' and 'transparency' in pic.info)
    pic = pic.convert('RGBA' if has_alpha else 'RGB')
    if has_alpha and pic.getchannel('A').getextrema() == (255, 255): pic = pic.convert('RGB')
    buf = io.BytesIO()
    pic.save(buf, 'WEBP', quality=Q, method=5)
    blob = buf.getvalue()
    before_tex += len(raw); after_tex += len(blob)
    nim = {k: v for k, v in im.items() if k not in ('bufferView', 'mimeType')}
    nim['bufferView'] = new_view(blob); nim['mimeType'] = 'image/webp'
    image_remap[i] = len(new_images); new_images.append(nim)
print(f'textures: {before_tex / 1048576:.1f} MB → {after_tex / 1048576:.1f} MB ({len(new_images)} images)')
for t in textures:
    s = t.pop('source', None)
    ext = t.setdefault('extensions', {})
    if 'EXT_texture_webp' in ext: s = ext['EXT_texture_webp']['source']
    if s is not None and s in image_remap: ext['EXT_texture_webp'] = {'source': image_remap[s]}
    elif not ext: t.pop('extensions')
gltf['images'] = new_images

# ---------- pack: only the views still used, in their old order, then the new ones ----------
refs = set()
for a in accessors:
    if 'bufferView' in a: refs.add(a['bufferView'])
    sp = a.get('sparse')
    if sp: refs.add(sp['indices']['bufferView']); refs.add(sp['values']['bufferView'])
for im in new_images:
    if 'bufferView' in im: refs.add(im['bufferView'])
out_bin, out_views, remap = bytearray(), [], {}
def put(blob):
    while len(out_bin) % 4: out_bin.append(0)
    start = len(out_bin); out_bin.extend(blob); return start
for i in sorted(refs):
    if i < len(views):
        v = dict(views[i]); blob = view_bytes(views[i]); v['byteOffset'] = put(blob)
    else:
        blob, extra = fresh[i - len(views)]; v = {'buffer': 0, 'byteOffset': put(blob), 'byteLength': len(blob), **extra}
    remap[i] = len(out_views); out_views.append(v)
for a in accessors:
    if 'bufferView' in a: a['bufferView'] = remap[a['bufferView']]
    sp = a.get('sparse')
    if sp:
        sp['indices']['bufferView'] = remap[sp['indices']['bufferView']]
        sp['values']['bufferView'] = remap[sp['values']['bufferView']]
for im in new_images:
    if 'bufferView' in im: im['bufferView'] = remap[im['bufferView']]
gltf['bufferViews'] = out_views
gltf['buffers'] = [{'byteLength': len(out_bin)}]
for ext, on in (('EXT_texture_webp', bool(new_images)), ('KHR_mesh_quantization', quantized)):
    if not on: continue
    for key in ('extensionsUsed', 'extensionsRequired'):
        s = set(gltf.get(key, [])); s.add(ext); gltf[key] = sorted(s)

js = json.dumps(gltf, separators=(',', ':')).encode('utf8')
js += b' ' * ((4 - len(js) % 4) % 4)
while len(out_bin) % 4: out_bin.append(0)
total = 12 + 8 + len(js) + 8 + len(out_bin)
with open(dst, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(out_bin), 0x004E4942)); f.write(out_bin)
print(f'file: {len(data) / 1048576:.1f} MB → {total / 1048576:.1f} MB')
