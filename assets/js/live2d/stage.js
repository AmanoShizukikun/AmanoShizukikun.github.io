// WebGL renderer for a Puppet (see puppet.js), written for the Live2D page.
// Besides drawing the model the way Cubism does (render order, clipping masks, blend modes, multiply /
// screen colours), it can take the model apart, because the page is about how such a model is built:
//   sheet  every mesh travels to where it lies on the texture atlas — the character as its parts
//   wire   the triangles of every mesh
//   fan    the draw order pulled apart sideways, like a deck of layers
// All three are plain numbers (0…1) that the page scrubs with the scroll position.
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (k) => k * k * (3 - 2 * k);

const VERT = `
attribute vec2 aPos;
attribute vec2 aUv;
uniform vec4 uView;    // model units → clip space: scale.xy, offset.xy
uniform vec4 uSheet;   // atlas square in model units: centre.xy, side, amount
uniform vec4 uFan;     // cos, sin × spread, lift, depth of this mesh
uniform float uSkew;   // the sheets lean back as they fan out
uniform vec4 uClip;    // model units → mask texture: scale.xy, offset.xy
varying vec2 vUv;
varying vec2 vClip;
void main() {
  vec2 p = mix(aPos, uSheet.xy + (aUv - 0.5) * uSheet.z, uSheet.w);
  p = vec2(p.x * uFan.x + uFan.y * uFan.w, p.y + uFan.z * uFan.w + p.x * uSkew);
  gl_Position = vec4(p * uView.xy + uView.zw, 0.0, 1.0);
  vUv = aUv;
  vClip = aPos * uClip.xy + uClip.zw;
}`;
const FILL = `
precision mediump float;
uniform sampler2D uTex;
uniform sampler2D uMask;
uniform vec4 uBase;      // premultiplied opacity
uniform vec3 uMul;
uniform vec3 uScr;
uniform float uMaskAmt;
uniform float uGlow;
varying vec2 vUv;
varying vec2 vClip;
void main() {
  vec4 t = texture2D(uTex, vUv);
  t.rgb *= uMul;
  t.rgb = t.rgb + uScr * t.a - t.rgb * uScr;
  vec4 c = t * uBase;
  if (uMaskAmt > 0.0) c *= mix(1.0, 1.0 - texture2D(uMask, vClip).r, uMaskAmt);
  c.rgb += vec3(1.0, 0.77, 0.0) * uGlow * c.a;
  gl_FragColor = c;
}`;
const MASK = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(uTex, vUv).a); }`;
const LINE = `
precision mediump float;
uniform vec4 uColor;
void main() { gl_FragColor = uColor; }`;

const MASK_SIZE = 2048;

export function createStage(canvas, { maxDpr = 2 } = {}) {
  const opts = { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
  if (!gl) return null;
  const gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  function program(fs) {
    const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.bindAttribLocation(p, 1, 'aUv');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }
  const fill = program(FILL), mask = program(MASK), line = program(LINE);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND);

  // mask target: one tile per clipping context
  const maskTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, maskTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MASK_SIZE, MASK_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const maskFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, maskFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, maskTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // guides: the model's canvas, and the atlas square with its grid (model units; unit square, scaled by uniforms)
  const guide = (() => {
    const frame = [-0.5, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5];
    const grid = [];
    for (let i = 1; i < 8; i++) { const t = i / 8 - 0.5; grid.push(t, -0.5, t, 0.5, -0.5, t, 0.5, t); }
    const ticks = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16 - 0.5, l = i % 4 ? 0.012 : 0.024; ticks.push(t, -0.5, t, -0.5 - l, -0.5, t, -0.5 - l, t); }
    const data = new Float32Array([...frame, ...grid, ...ticks]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { buf, frame: [0, frame.length / 2], grid: [frame.length / 2, grid.length / 2], ticks: [(frame.length + grid.length) / 2, ticks.length / 2] };
  })();

  let pup = null, tex = null, meshes = [], contexts = [], order = [], rank = new Float32Array(0), amount = new Float32Array(0), alpha = new Float32Array(0);
  let cssW = 1, cssH = 1, dpr = 1;
  const U = () => pup.core.Utils;

  function resize() {
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function clear() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function dropModel() {
    meshes.forEach((m) => { gl.deleteBuffer(m.pos); gl.deleteBuffer(m.uv); gl.deleteBuffer(m.idx); gl.deleteBuffer(m.wire); });
    if (tex) gl.deleteTexture(tex);
    meshes = []; contexts = []; tex = null; pup = null;
  }

  /**
   * @param puppet  Puppet
   * @param image   the atlas (HTMLImageElement / ImageBitmap)
   * @param crop    used square of the original atlas, as a fraction of its side from the top-left corner
   */
  function setPuppet(puppet, image, crop = 1) {
    dropModel();
    pup = puppet;
    const d = pup.d;

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const pot = (n) => (n & (n - 1)) === 0;
    const mips = gl2 || (pot(image.width) && pot(image.height));
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));

    for (let i = 0; i < d.count; i++) {
      // UVs: v runs up from the bottom of the atlas; the web texture is the top-left `crop` of it
      const src = d.vertexUvs[i], uv = new Float32Array(src.length);
      for (let k = 0; k < src.length; k += 2) { uv[k] = src[k] / crop; uv[k + 1] = (src[k + 1] - (1 - crop)) / crop; }
      const idx = d.indices[i];
      const seen = new Set(), edges = [];
      for (let k = 0; k < idx.length; k += 3) {
        for (const [a, b] of [[idx[k], idx[k + 1]], [idx[k + 1], idx[k + 2]], [idx[k + 2], idx[k]]]) {
          const key = a < b ? a * 65536 + b : b * 65536 + a;
          if (!seen.has(key)) { seen.add(key); edges.push(a, b); }
        }
      }
      const m = { pos: gl.createBuffer(), uv: gl.createBuffer(), idx: gl.createBuffer(), wire: gl.createBuffer(), n: idx.length, lines: edges.length, uvs: uv, ctx: null };
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.bufferData(gl.ARRAY_BUFFER, d.vertexPositions[i], gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.uv); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.wire); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(edges), gl.STATIC_DRAW);
      meshes.push(m);
    }

    // clipping contexts: meshes that share the same set of masks share one tile
    const byKey = new Map();
    for (let i = 0; i < d.count; i++) {
      if (d.maskCounts[i] <= 0) continue;
      const ids = Array.from(d.masks[i]).filter((k) => k >= 0).sort((a, b) => a - b);
      if (!ids.length) continue;
      const key = ids.join(',');
      if (!byKey.has(key)) byKey.set(key, { masks: ids, targets: [], clip: [0, 0, 0, 0] });
      byKey.get(key).targets.push(i);
      meshes[i].ctx = byKey.get(key);
    }
    contexts = [...byKey.values()];
    const side = Math.max(1, Math.ceil(Math.sqrt(contexts.length)));
    contexts.forEach((c, k) => { c.tile = [k % side, Math.floor(k / side), side]; });

    order = Array.from({ length: d.count }, (_, i) => i);
    rank = new Float32Array(d.count);
    amount = new Float32Array(d.count);
    alpha = new Float32Array(d.count);
  }

  const bind = (m) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.uv); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  };

  // per-mesh numbers for this frame: place in the draw order, how far it has travelled to the sheet, opacity
  function prepare(s) {
    const d = pup.d, n = d.count, ro = d.renderOrders;
    order.sort((a, b) => ro[a] - ro[b]);
    for (let k = 0; k < n; k++) rank[order[k]] = n > 1 ? k / (n - 1) : 0;
    const st = 0.55, go = clamp01((s.sheet - 0.1) / 0.9);
    // veiled meshes (the base body under the clothes) step out before anything is taken apart
    const veil = 1 - Math.max(clamp01(s.sheet / 0.1), clamp01(s.fan / 0.12), clamp01((1 - s.fill) / 0.15));
    for (let i = 0; i < n; i++) {
      const k = go <= 0 ? 0 : go >= 1 ? 1 : ease(clamp01(go * (1 + st) - st * (1 - rank[i])));
      amount[i] = k;
      const o = U().hasIsVisibleBit(d.dynamicFlags[i]) ? d.opacities[i] : 0;
      // on the sheet every part is shown, also the ones the current pose hides
      alpha[i] = (pup.veil.has(i) ? o * veil : o + (1 - o) * k) * s.fill;
    }
  }

  function viewOf(s) {
    const c = s.cam;
    return [(2 * c.s) / cssW, (2 * c.s) / cssH, (2 * (c.sx - c.cx * c.s)) / cssW - 1, 1 - (2 * (c.sy + c.cy * c.s)) / cssH];
  }
  const fanOf = (s) => { const a = s.fan * s.angle; return [Math.cos(a), Math.sin(a) * s.spread, s.fan * s.lift, s.fan * s.skew]; };

  /**
   * Draw one frame.
   * s = { cam: { cx, cy, sx, sy, s }   model point (cx, cy) sits at CSS pixel (sx, sy), s pixels per model unit
   *       sheet, sheetSide             0…1, side of the atlas square in model units
   *       wire, fill, fan              0…1 each;  angle, spread, lift, skew: how the layers fan out (radians, model units)
   *       hi                           index of the highlighted mesh, or −1
   *       frame, grid }                opacity of the canvas outline / the atlas outline
   */
  function draw(s) {
    if (!pup) { clear(); return; }
    const d = pup.d;
    prepare(s);
    const view = viewOf(s), fan = fanOf(s);

    for (let i = 0; i < d.count; i++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, meshes[i].pos);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.vertexPositions[i]);
    }

    // ---- masks
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (contexts.length) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, maskFbo);
      gl.viewport(0, 0, MASK_SIZE, MASK_SIZE);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(mask.p);
      gl.uniform1i(mask.u.uTex, 0);
      gl.uniform4f(mask.u.uSheet, 0, 0, 1, 0);
      gl.uniform4f(mask.u.uFan, 1, 0, 0, 0);
      gl.uniform1f(mask.u.uSkew, 0);
      gl.uniform4f(mask.u.uClip, 0, 0, 0, 0);
      gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
      for (const c of contexts) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const t of c.targets) {
          const a = d.vertexPositions[t];
          for (let k = 0; k < a.length; k += 2) { if (a[k] < x0) x0 = a[k]; if (a[k] > x1) x1 = a[k]; if (a[k + 1] < y0) y0 = a[k + 1]; if (a[k + 1] > y1) y1 = a[k + 1]; }
        }
        const mx = (x1 - x0) * 0.05 + 1e-4, my = (y1 - y0) * 0.05 + 1e-4;
        x0 -= mx; x1 += mx; y0 -= my; y1 += my;
        const [tx, ty, side] = c.tile, size = MASK_SIZE / side;
        gl.viewport(tx * size, ty * size, size, size);
        gl.uniform4f(mask.u.uView, 2 / (x1 - x0), 2 / (y1 - y0), -(x1 + x0) / (x1 - x0), -(y1 + y0) / (y1 - y0));
        // where a clipped mesh finds this tile in the mask texture
        c.clip[0] = 1 / ((x1 - x0) * side); c.clip[1] = 1 / ((y1 - y0) * side);
        c.clip[2] = tx / side - x0 * c.clip[0]; c.clip[3] = ty / side - y0 * c.clip[1];
        for (const k of c.masks) {
          const m = meshes[k];
          if (!m) continue;
          bind(m);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
          gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
        }
      }
    }

    // ---- the model
    clear();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.activeTexture(gl.TEXTURE0);
    const Ut = U();
    const lineOn = s.wire > 0.004;
    for (const i of order) {
      const a = alpha[i], m = meshes[i];
      if (a < 0.004 && !(lineOn && amount[i] > 0)) continue;
      const depth = rank[i] - 0.5;
      bind(m);
      if (a >= 0.004) {
        gl.useProgram(fill.p);
        gl.uniform1i(fill.u.uTex, 0);
        gl.uniform1i(fill.u.uMask, 1);
        gl.uniform4fv(fill.u.uView, view);
        gl.uniform4f(fill.u.uSheet, 0, 0, s.sheetSide, amount[i]);
        gl.uniform4f(fill.u.uFan, fan[0], fan[1], fan[2], depth);
        gl.uniform1f(fill.u.uSkew, fan[3]);
        const f = d.constantFlags[i];
        if (Ut.hasBlendAdditiveBit(f)) gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
        else if (Ut.hasBlendMultiplicativeBit(f)) gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
        else gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform4f(fill.u.uBase, a, a, a, a);
        const mc = d.multiplyColors, sc = d.screenColors;
        if (mc) gl.uniform3f(fill.u.uMul, mc[i * 4], mc[i * 4 + 1], mc[i * 4 + 2]); else gl.uniform3f(fill.u.uMul, 1, 1, 1);
        if (sc) gl.uniform3f(fill.u.uScr, sc[i * 4], sc[i * 4 + 1], sc[i * 4 + 2]); else gl.uniform3f(fill.u.uScr, 0, 0, 0);
        if (m.ctx) { gl.uniform4fv(fill.u.uClip, m.ctx.clip); gl.uniform1f(fill.u.uMaskAmt, 1 - amount[i]); }
        else gl.uniform1f(fill.u.uMaskAmt, 0);
        gl.uniform1f(fill.u.uGlow, i === s.hi ? 0.5 : 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
        gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
      }
      if (lineOn && (a >= 0.004 || s.fill < 0.004)) {
        const on = i === s.hi;
        const la = on ? 0.95 : s.wire * (0.14 + 0.26 * Math.min(1, a / Math.max(0.001, s.fill)));
        gl.useProgram(line.p);
        gl.uniform4fv(line.u.uView, view);
        gl.uniform4f(line.u.uSheet, 0, 0, s.sheetSide, amount[i]);
        gl.uniform4f(line.u.uFan, fan[0], fan[1], fan[2], depth);
        gl.uniform1f(line.u.uSkew, fan[3]);
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        if (on) gl.uniform4f(line.u.uColor, la, la, la, la); else gl.uniform4f(line.u.uColor, la, la * 0.77, 0, la);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.wire);
        gl.drawElements(gl.LINES, m.lines, gl.UNSIGNED_SHORT, 0);
      }
    }

    // ---- guides
    if (s.frame > 0.004 || s.grid > 0.004) {
      gl.useProgram(line.p);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform4f(line.u.uSheet, 0, 0, 1, 0);
      gl.uniform4f(line.u.uFan, 1, 0, 0, 0);
      gl.uniform1f(line.u.uSkew, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, guide.buf);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      const box = (w, h, a, parts) => {
        if (a < 0.004) return;
        gl.uniform4f(line.u.uView, view[0] * w, view[1] * h, view[2], view[3]);
        for (const [part, k] of parts) {
          const c = a * k;
          gl.uniform4f(line.u.uColor, c, c, c, c);
          gl.drawArrays(gl.LINES, guide[part][0], guide[part][1]);
        }
      };
      box(pup.canvas.w, pup.canvas.h, s.frame, [['frame', 0.34], ['ticks', 0.34]]);
      box(s.sheetSide, s.sheetSide, s.grid, [['grid', 0.1], ['frame', 0.5], ['ticks', 0.5]]);
    }
  }

  /** Which mesh is under CSS pixel (x, y) of the canvas, for the state last drawn; −1 for none. */
  function pick(x, y, s) {
    if (!pup) return -1;
    const d = pup.d, c = s.cam, fan = fanOf(s);
    for (let o = order.length - 1; o >= 0; o--) {
      const i = order[o];
      if (alpha[i] < 0.05 * Math.max(0.2, s.fill) && s.fill > 0.004) continue;
      const pos = d.vertexPositions[i], uv = meshes[i].uvs, idx = d.indices[i], k = amount[i], depth = rank[i] - 0.5;
      const n = pos.length / 2;
      const px = new Float32Array(n), py = new Float32Array(n);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let j = 0; j < n; j++) {
        let mx = pos[j * 2] + ((uv[j * 2] - 0.5) * s.sheetSide - pos[j * 2]) * k;
        let my = pos[j * 2 + 1] + ((uv[j * 2 + 1] - 0.5) * s.sheetSide - pos[j * 2 + 1]) * k;
        my += fan[2] * depth + mx * fan[3]; mx = mx * fan[0] + fan[1] * depth;
        const sx = c.sx + (mx - c.cx) * c.s, sy = c.sy - (my - c.cy) * c.s;
        px[j] = sx; py[j] = sy;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      for (let t = 0; t < idx.length; t += 3) {
        const ax = px[idx[t]], ay = py[idx[t]], bx = px[idx[t + 1]], by = py[idx[t + 1]], cx = px[idx[t + 2]], cy = py[idx[t + 2]];
        const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
        const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
        const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return i;
      }
    }
    return -1;
  }

  resize();
  return {
    gl, resize, setPuppet, draw, pick, clear,
    get size() { return { w: cssW, h: cssH, dpr }; },
    get lost() { return gl.isContextLost(); },
    dispose() {
      dropModel();
      gl.deleteTexture(maskTex); gl.deleteFramebuffer(maskFbo); gl.deleteBuffer(guide.buf);
      [fill, mask, line].forEach((p) => gl.deleteProgram(p.p));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
