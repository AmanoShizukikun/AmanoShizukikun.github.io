// Point-cloud generators for the home sequence. Everything is procedural and deterministic
// (seeded), except the figure, which is sampled from the character illustration.

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => (r() + r() + r() + r() - 2) * 0.866; // ~N(0, 0.5)

// A — snow / dust volume the camera flies through
export function genField(n, r) {
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    p[i * 3] = (r() - 0.5) * 340;
    p[i * 3 + 1] = r() * 130;
    p[i * 3 + 2] = 120 - r() * 350;
  }
  return p;
}

// B — the Sacred Tree: recursive branching skeleton, sampled into points
export function genTree(n, r, C) {
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const bend = (dir, angle, az) => {
    const ref = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(dir, ref));
    const v = cross(dir, u);
    const s = Math.sin(angle), c = Math.cos(angle);
    return norm([
      dir[0] * c + (u[0] * Math.cos(az) + v[0] * Math.sin(az)) * s,
      dir[1] * c + (u[1] * Math.cos(az) + v[1] * Math.sin(az)) * s,
      dir[2] * c + (u[2] * Math.cos(az) + v[2] * Math.sin(az)) * s,
    ]);
  };

  function skeleton(up, len0, rad0, maxDepth, spreadMin, spreadVar, lift) {
    const segs = [], tips = [];
    (function grow(a, dir, len, rad, depth) {
      const b = add(a, dir, len);
      segs.push({ a, b, r0: rad, r1: rad * 0.72, w: len * (rad + 0.25) });
      if (depth >= maxDepth) { tips.push(b); return; }
      const kids = depth < 2 ? 3 : 2 + (r() < 0.3 ? 1 : 0);
      const az0 = r() * 6.283;
      for (let k = 0; k < kids; k++) {
        let d = bend(dir, spreadMin + r() * spreadVar, az0 + (k / kids) * 6.283 + (r() - 0.5) * 0.9);
        d = norm([d[0], d[1] + lift, d[2]]);
        grow(b, d, len * (0.66 + r() * 0.16), rad * 0.64, depth + 1);
      }
    })([0, 0, 0], up, len0, rad0, 0);
    let total = 0;
    for (const s of segs) { total += s.w; s.c = total; }
    return { segs, tips, total };
  }

  const crown = skeleton([0, 1, 0], 30, 2.6, 7, 0.34, 0.42, 0.1);
  const roots = skeleton([0, -1, 0], 12, 2.4, 5, 0.55, 0.5, -0.02);

  const pickSeg = (sk) => {
    const x = r() * sk.total;
    let lo = 0, hi = sk.segs.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sk.segs[m].c < x) lo = m + 1; else hi = m; }
    return sk.segs[lo];
  };

  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = r();
    let x, y, z;
    if (k < 0.5 || (k >= 0.86 && k < 0.95)) {
      const s = pickSeg(k < 0.5 ? crown : roots);
      const t = r();
      const rad = (s.r0 + (s.r1 - s.r0) * t) * Math.sqrt(r());
      const a = r() * 6.283, e = (r() - 0.5) * 2;
      const q = Math.sqrt(1 - e * e);
      x = s.a[0] + (s.b[0] - s.a[0]) * t + q * Math.cos(a) * rad;
      y = s.a[1] + (s.b[1] - s.a[1]) * t + e * rad;
      z = s.a[2] + (s.b[2] - s.a[2]) * t + q * Math.sin(a) * rad;
    } else if (k < 0.86) {
      const tip = crown.tips[(r() * crown.tips.length) | 0];
      x = tip[0] + gauss(r) * 4.4; y = tip[1] + gauss(r) * 3.6; z = tip[2] + gauss(r) * 4.4;
    } else {
      x = gauss(r) * 70; y = 34 + gauss(r) * 52; z = gauss(r) * 70;
    }
    p[i * 3] = C[0] + x; p[i * 3 + 1] = C[1] + y; p[i * 3 + 2] = C[2] + z;
  }
  return p;
}

// C — the figure, sampled from the cut-out illustration (alpha decides what is figure).
// rect = { cx, cy, cz, w, h } in world units.
export function genFigure(n, r, img, rect) {
  const W = 320, H = Math.round((W * img.height) / img.width);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const fg = [];
  for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 140) fg.push(i);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const idx = fg[(r() * fg.length) | 0];
    const px = (idx % W) + r(), py = ((idx / W) | 0) + r();
    const j = idx * 4;
    const lum = (0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) / 255;
    pos[i * 3] = rect.cx + (px / W - 0.5) * rect.w;
    pos[i * 3 + 1] = rect.cy + (0.5 - py / H) * rect.h;
    pos[i * 3 + 2] = rect.cz + 0.3 + lum * 1.2 + (r() - 0.5) * 0.6;
    col[i * 3] = d[j] / 255; col[i * 3 + 1] = d[j + 1] / 255; col[i * 3 + 2] = d[j + 2] / 255;
  }
  return { pos, col, coverage: fg.length / (W * H) };
}

// D — the archive: a double helix built as a low-poly wireframe solid.
// Each backbone is a flattened tube swept along the helix (rings of `sides` vertices, every quad split
// into two triangles), each rung a three-sided bar between the strands; vertices are jittered so the
// triangulation looks hand-faceted. Returns positions relative to the helix origin plus edge and
// triangle indices, so scene.js can draw the wireframe and its faint faces, and genHelix() can put
// particles on the same vertices and edges.
// o = { rs, k (radians of twist per unit height; sign = handedness), y0, y1, rung }
// Angle convention matches the panels: a point at angle a sits at (sin a, cos a).
export function buildHelixMesh(r, o) {
  const verts = [], edges = [], tris = [], weight = [];
  const jit = (m) => (r() - 0.5) * 2 * m;
  const tube = (rings, sides, ringAt) => {
    const base = verts.length / 3;
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < sides; j++) {
        const v = ringAt(i, j);
        verts.push(v[0], v[1], v[2]);
        weight.push(Math.pow(r(), 5));          // a few vertices get big bright dots, most small ones
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < sides; j++) {
        const a = base + i * sides + j, b = base + i * sides + ((j + 1) % sides);
        edges.push(a, b);
        if (i < rings - 1) {
          const c = a + sides, d = b + sides;
          edges.push(a, c, a, d);
          tris.push(a, c, d, a, d, b);
        }
      }
    }
  };
  // backbones
  const SIDES = 4, stepY = 2.8, rings = Math.floor((o.y1 - o.y0) / stepY) + 1;
  for (const phase of [0, Math.PI]) {
    tube(rings, SIDES, (i, j) => {
      const y = o.y0 + i * stepY, a = y * o.k + phase;
      const sa = Math.sin(a), ca = Math.cos(a);
      const P = [sa * o.rs, y, ca * o.rs];
      let T = [ca * o.rs * o.k, 1, -sa * o.rs * o.k];
      const tl = Math.hypot(T[0], T[1], T[2]); T = [T[0] / tl, T[1] / tl, T[2] / tl];
      const N = [sa, 0, ca];
      const B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
      const phi = (j / SIDES) * 6.283 + i * 0.5;
      const cx = Math.cos(phi) * 1.7, cy = Math.sin(phi) * 3.1;       // flattened: thin radially, wide along the strand
      return [P[0] + N[0] * cx + B[0] * cy + jit(0.5), P[1] + N[1] * cx + B[1] * cy + jit(0.5), P[2] + N[2] * cx + B[2] * cy + jit(0.5)];
    });
  }
  // rungs
  const count = Math.floor((o.y1 - o.y0) / o.rung), RR = 4, reach = o.rs - 1.0;
  for (let q = 0; q < count; q++) {
    const y = o.y0 + (q + 0.5) * o.rung, a = y * o.k;
    const D = [Math.sin(a), 0, Math.cos(a)], S = [D[2], 0, -D[0]];
    const tw = r() * 6.283;
    tube(RR, 3, (i, j) => {
      const t = (i / (RR - 1)) * 2 - 1, phi = (j / 3) * 6.283 + tw + i * 0.5, rad = 1.25;
      const u = Math.cos(phi) * rad, v = Math.sin(phi) * rad;
      return [D[0] * reach * t + S[0] * u + jit(0.3), y + v + jit(0.3), D[2] * reach * t + S[2] * u + jit(0.3)];
    });
  }
  return { verts: new Float32Array(verts), edges: new Uint32Array(edges), tris: new Uint32Array(tris), weight };
}

// Particles for the helix: most gather into dots on the mesh vertices (dot size follows the vertex
// weight), the rest lie along its edges; a few drift far out for depth.
export function genHelix(n, r, C, mesh) {
  const p = new Float32Array(n * 3);
  const { verts, edges, weight } = mesh;
  const nv = weight.length, ne = edges.length / 2;
  const cum = new Float32Array(nv);
  let total = 0;
  for (let i = 0; i < nv; i++) { total += 0.25 + weight[i] * 6; cum[i] = total; }
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 1; i < verts.length; i += 3) { yMin = Math.min(yMin, verts[i]); yMax = Math.max(yMax, verts[i]); }
  for (let i = 0; i < n; i++) {
    const u = r();
    let x, y, z;
    if (u < 0.34) {
      const t = r() * total;
      let lo = 0, hi = nv - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; }
      const rad = 0.1 + weight[lo] * 0.42;
      x = verts[lo * 3] + gauss(r) * rad; y = verts[lo * 3 + 1] + gauss(r) * rad; z = verts[lo * 3 + 2] + gauss(r) * rad;
    } else if (u < 0.56) {
      const e = (r() * ne) | 0, a = edges[e * 2] * 3, b = edges[e * 2 + 1] * 3, t = r();
      x = verts[a] + (verts[b] - verts[a]) * t; y = verts[a + 1] + (verts[b + 1] - verts[a + 1]) * t; z = verts[a + 2] + (verts[b + 2] - verts[a + 2]) * t;
    } else {
      const a = r() * 6.283, rad = 44 + r() * 110;
      x = Math.sin(a) * rad; z = Math.cos(a) * rad; y = yMin + r() * (yMax - yMin);
    }
    p[i * 3] = C[0] + x; p[i * 3 + 1] = C[1] + y; p[i * 3 + 2] = C[2] + z;
  }
  return p;
}

// E — eclipse corona: a bright limb, radial streamers of uneven length, and faint outer dust.
// Lies in the XY plane, facing the camera.
export function genCorona(n, r, C, R) {
  const p = new Float32Array(n * 3);
  const RAYS = 46;
  const rays = [];
  for (let k = 0; k < RAYS; k++) rays.push({ a: r() * 6.283, len: 5 + Math.pow(r(), 2.2) * 46, w: 0.012 + r() * 0.03 });
  for (let i = 0; i < n; i++) {
    const u = r();
    let a, rad, z = (r() - 0.5) * 0.6;
    if (u < 0.5) {
      a = r() * 6.283; rad = R + Math.abs(gauss(r)) * 0.9;
    } else if (u < 0.9) {
      const ray = rays[(r() * RAYS) | 0];
      a = ray.a + gauss(r) * ray.w;
      rad = R + 0.4 + Math.pow(r(), 1.8) * ray.len;
    } else {
      a = r() * 6.283; rad = R + 2 + r() * 62; z = (r() - 0.5) * 30;
    }
    p[i * 3] = C[0] + Math.cos(a) * rad; p[i * 3 + 1] = C[1] + Math.sin(a) * rad; p[i * 3 + 2] = C[2] + z;
  }
  return p;
}
