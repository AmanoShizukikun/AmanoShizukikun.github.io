// A small Cubism runtime, used by the Live2D works page and by the mascot (shell/mascot.js). It exists because
// the page needs the model's data itself — every mesh, every parameter, every pendulum — not just a picture
// of it; the mascot then got the same engine instead of a second, much larger one.
// It drives a model through the official Core: parameter values in, deformed meshes out.
//   • a pose the page sets parameter by parameter      • look-at, breathing, blinking
//   • the physics3 pendulums (hair, ears, tail, cloth), ported from the Cubism framework's algorithm
const CORE_URL = '/assets/live2d/live2dcubismcore.min.js';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

let corePromise = null;
/** The Cubism Core: one script, loaded once, shared by everything that shows a model. */
export function loadCore() {
  corePromise ||= new Promise((resolve, reject) => {
    const started = () => { try { window.Live2DCubismCore.Version.csmGetVersion(); return true; } catch { return false; } };
    const wait = (n = 0) => {
      if (window.Live2DCubismCore && started()) resolve(window.Live2DCubismCore);
      else if (n > 480) reject(new Error('Cubism Core did not start'));
      else setTimeout(wait, 25, n + 1);
    };
    if (window.Live2DCubismCore || document.querySelector('script[src*="live2dcubismcore"]')) { wait(); return; }
    const s = document.createElement('script');
    s.src = CORE_URL;
    s.onload = () => wait();
    s.onerror = () => reject(new Error('Cubism Core failed to load'));
    document.head.append(s);
  }).catch((e) => { corePromise = null; throw e; });
  return corePromise;
}

// ---------------------------------------------------------------- physics (physics3.json)
const AIR = 5, THRESHOLD = 0.001, STEP = 1 / 60;
const toRad = (d) => (d * Math.PI) / 180;
function dirToRad(fx, fy, tx, ty) {
  let r = Math.atan2(ty, tx) - Math.atan2(fy, fx);
  while (r < -Math.PI) r += Math.PI * 2;
  while (r > Math.PI) r -= Math.PI * 2;
  return r;
}
function normalize(value, pMin, pMax, nMin, nMax, nDef, inverted) {
  const max = Math.max(pMax, pMin), min = Math.min(pMax, pMin);
  const v = clamp(value, min, max);
  const lo = Math.min(nMin, nMax), hi = Math.max(nMin, nMax);
  const mid = min + (max - min) / 2;
  const d = v - mid;
  let out = nDef;
  if (d > 0) { const len = max - mid; if (len !== 0) out = d * ((hi - nDef) / len) + nDef; }
  else if (d < 0) { const len = min - mid; if (len !== 0) out = d * ((lo - nDef) / len) + nDef; }
  return inverted ? out : -out;
}

class Physics {
  constructor(json, puppet) {
    const names = new Map((json.Meta?.PhysicsDictionary || []).map((d) => [d.Id, d.Name]));
    this.wind = 0;                                    // sideways force added to every pendulum
    // (a group without an input or an output does nothing, so it is not counted or simulated)
    this.settings = (json.PhysicsSettings || []).map((s) => ({
      id: s.Id,
      name: names.get(s.Id) || s.Id,
      pos: s.Normalization.Position,
      ang: s.Normalization.Angle,
      inputs: s.Input.map((i) => ({ i: puppet.index(i.Source.Id), w: i.Weight / 100, type: i.Type, reflect: !!i.Reflect })).filter((i) => i.i >= 0),
      outputs: s.Output.map((o) => ({ i: puppet.index(o.Destination.Id), id: o.Destination.Id, vertex: o.VertexIndex, scale: o.Scale, w: o.Weight / 100, reflect: !!o.Reflect, type: o.Type })).filter((o) => o.i >= 0),
      particles: s.Vertices.map((v) => ({ mobility: v.Mobility, delay: v.Delay, acc: v.Acceleration, radius: v.Radius, x: 0, y: 0, lx: 0, ly: 0, gx: 0, gy: 1, vx: 0, vy: 0 })),
      swing: 0,                                       // last output of the first pendulum, −1…1 of its range (for display)
    })).filter((s) => s.inputs.length && s.outputs.length && s.particles.length > 1);
    this.reset();
  }

  reset() {
    for (const s of this.settings) {
      let y = 0;
      s.particles.forEach((p, k) => {
        if (k) y += p.radius;
        p.x = p.lx = 0; p.y = p.ly = y; p.gx = 0; p.gy = 1; p.vx = p.vy = 0;
      });
      s.swing = 0;
    }
  }

  /** One simulation step; reads the driving parameters from `v`, writes the driven ones back. */
  step(v, P, dt) {
    for (const s of this.settings) {
      let tx = 0, ty = 0, angle = 0;
      for (const inp of s.inputs) {
        const val = v[inp.i], lo = P.min[inp.i], hi = P.max[inp.i];
        if (inp.type === 'X') tx += normalize(val, lo, hi, s.pos.Minimum, s.pos.Maximum, s.pos.Default, inp.reflect) * inp.w;
        else if (inp.type === 'Y') ty += normalize(val, lo, hi, s.pos.Minimum, s.pos.Maximum, s.pos.Default, inp.reflect) * inp.w;
        else angle += normalize(val, lo, hi, s.ang.Minimum, s.ang.Maximum, s.ang.Default, inp.reflect) * inp.w;
      }
      const ra = toRad(-angle);
      tx = tx * Math.cos(ra) - ty * Math.sin(ra);
      ty = tx * Math.sin(ra) + ty * Math.cos(ra);       // (the framework reuses the rotated x here; kept as is)

      const ps = s.particles;
      const limit = THRESHOLD * s.pos.Maximum;
      ps[0].x = tx; ps[0].y = ty;
      const tr = toRad(angle);
      let gx = Math.sin(tr), gy = Math.cos(tr);
      const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
      for (let k = 1; k < ps.length; k++) {
        const p = ps[k], q = ps[k - 1];
        const fx = gx * p.acc + this.wind, fy = gy * p.acc;
        p.lx = p.x; p.ly = p.y;
        const delay = p.delay * dt * 30;
        let dx = p.x - q.x, dy = p.y - q.y;
        const r = dirToRad(p.gx, p.gy, gx, gy) / AIR;
        dx = Math.cos(r) * dx - dy * Math.sin(r);
        dy = Math.sin(r) * dx + dy * Math.cos(r);
        p.x = q.x + dx + p.vx * delay + fx * delay * delay;
        p.y = q.y + dy + p.vy * delay + fy * delay * delay;
        let nx = p.x - q.x, ny = p.y - q.y;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        p.x = q.x + nx * p.radius; p.y = q.y + ny * p.radius;
        if (Math.abs(p.x) < limit) p.x = 0;
        if (delay !== 0) { p.vx = ((p.x - p.lx) / delay) * p.mobility; p.vy = ((p.y - p.ly) / delay) * p.mobility; }
        p.gx = gx; p.gy = gy;
      }

      for (const o of s.outputs) {
        const k = o.vertex;
        if (k < 1 || k >= ps.length) continue;
        const ax = ps[k].x - ps[k - 1].x, ay = ps[k].y - ps[k - 1].y;
        let px = 0, py = 1;
        if (k >= 2) { px = ps[k - 1].x - ps[k - 2].x; py = ps[k - 1].y - ps[k - 2].y; }
        let out = o.type === 'X' ? ax : o.type === 'Y' ? ay : dirToRad(px, py, ax, ay);
        if (o.reflect) out *= -1;
        const value = clamp(out * o.scale, P.min[o.i], P.max[o.i]);
        v[o.i] = o.w >= 1 ? value : v[o.i] * (1 - o.w) + value * o.w;
      }
      const o0 = s.outputs[0];
      if (o0) { const span = Math.max(Math.abs(P.min[o0.i]), Math.abs(P.max[o0.i])) || 1; s.swing = clamp(v[o0.i] / span, -1, 1); }
    }
  }
}

// ---------------------------------------------------------------- the model
export class Puppet {
  /**
   * @param core     Live2DCubismCore
   * @param moc      ArrayBuffer of the .moc3
   * @param physics  parsed physics3.json (or null)
   * @param def      { eyes: [left, right] parameter ids, veil: [drawable ids kept out of the sheet view] }
   */
  constructor(core, moc, physics, def = {}) {
    this.core = core;
    this.moc = core.Moc.fromArrayBuffer(moc);
    if (!this.moc) throw new Error('not a moc3 file');
    this.model = core.Model.fromMoc(this.moc);
    const p = this.model.parameters;
    this.P = { count: p.count, ids: Array.from(p.ids), min: p.minimumValues, max: p.maximumValues, def: p.defaultValues, values: p.values };
    this.map = new Map(this.P.ids.map((id, i) => [id, i]));
    this.d = this.model.drawables;
    const info = this.model.canvasinfo;
    this.canvas = { w: info.CanvasWidth / info.PixelsPerUnit, h: info.CanvasHeight / info.PixelsPerUnit, px: [info.CanvasWidth, info.CanvasHeight] };

    this.pose = Float32Array.from(this.P.def);           // what the page asks for; everything else is added on top
    this.look = { x: 0, y: 0 };                           // where she is asked to look, −1…1
    this.eye = { x: 0, y: 0 };                            // … and where she is looking (eased)
    this.idle = true;                                     // breathing + blinking
    this.hook = null;                                     // (puppet) => void, called each frame before physics
    this.time = 0;
    this.blink = { t: 2 + Math.random() * 3, phase: 0, k: 1 };
    this.eyes = (def.eyes || ['ParamEyeLOpen', 'ParamEyeROpen']).map((id) => this.index(id)).filter((i) => i >= 0);
    this.role = Object.fromEntries(['ParamAngleX', 'ParamAngleY', 'ParamAngleZ', 'ParamBodyAngleX', 'ParamEyeBallX', 'ParamEyeBallY', 'ParamBreath'].map((id) => [id, this.index(id)]));
    this.physics = physics ? new Physics(physics, this) : null;
    this.left = 0;                                        // simulation time not yet stepped

    this.veil = new Set((def.veil || []).map((id) => this.d.ids.indexOf(id)).filter((i) => i >= 0));
    this.measure();
  }

  index(id) { const i = this.map.get(id); return i == null ? -1 : i; }
  has(id) { return this.map.has(id); }
  setPose(id, value) { const i = this.index(id); if (i >= 0) this.pose[i] = clamp(value, this.P.min[i], this.P.max[i]); }
  resetPose(keep = []) {
    const kept = keep.map((id) => [this.index(id), 0]).filter((k) => k[0] >= 0).map(([i]) => [i, this.pose[i]]);
    this.pose.set(this.P.def);
    kept.forEach(([i, v]) => { this.pose[i] = v; });
  }
  /** For hooks: nudge a parameter on top of the pose for this frame. */
  add(id, value) { const i = this.index(id); if (i >= 0) this.P.values[i] += value; }
  /** For hooks: blend a parameter towards a value for this frame. */
  blend(id, value, k) { const i = this.index(id); if (i >= 0) this.P.values[i] += (value - this.P.values[i]) * k; }

  // Body bounds and where the face is, read from the model itself: the face is wherever the eyes are,
  // and the eyes are whatever moves when the eye parameters close.
  measure() {
    const d = this.d, v = this.P.values, U = this.core.Utils;
    v.set(this.P.def);
    this.model.update();
    const rest = d.vertexPositions.map((a) => Float32Array.from(a));
    const b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    let verts = 0, tris = 0, masked = 0;
    for (let i = 0; i < d.count; i++) {
      verts += d.vertexCounts[i]; tris += d.indexCounts[i] / 3; if (d.maskCounts[i] > 0) masked++;
      if (!U.hasIsVisibleBit(d.dynamicFlags[i]) || d.opacities[i] < 0.02) continue;
      const a = rest[i];
      for (let k = 0; k < a.length; k += 2) { b.x0 = Math.min(b.x0, a[k]); b.x1 = Math.max(b.x1, a[k]); b.y0 = Math.min(b.y0, a[k + 1]); b.y1 = Math.max(b.y1, a[k + 1]); }
    }
    this.bounds = b;
    this.stats = { meshes: d.count, verts, tris, params: this.P.count, masked, physics: this.physics ? this.physics.settings.length : 0 };

    const e = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    if (this.eyes.length) {
      this.eyes.forEach((i) => { v[i] = this.P.min[i]; });
      this.model.update();
      for (let i = 0; i < d.count; i++) {
        const a = rest[i], c = d.vertexPositions[i];
        for (let k = 0; k < a.length; k += 2) {
          if (Math.abs(a[k] - c[k]) + Math.abs(a[k + 1] - c[k + 1]) < 0.0015) continue;
          e.x0 = Math.min(e.x0, a[k]); e.x1 = Math.max(e.x1, a[k]); e.y0 = Math.min(e.y0, a[k + 1]); e.y1 = Math.max(e.y1, a[k + 1]);
        }
      }
    }
    const w = e.x1 - e.x0;
    this.face = w > 0 && w < this.canvas.w
      ? { x: (e.x0 + e.x1) / 2, y: (e.y0 + e.y1) / 2, r: w * 0.86 }
      : { x: (b.x0 + b.x1) / 2, y: b.y1 - (b.y1 - b.y0) * 0.14, r: (b.y1 - b.y0) * 0.1 };
    v.set(this.P.def);
    d.resetDynamicFlags();
    this.model.update();
  }

  update(dt) {
    const P = this.P, v = P.values, R = this.role;
    this.time += dt;
    v.set(this.pose);

    // look-at: head, body and eyes follow, each by its own amount
    const k = 1 - Math.exp(-dt * 7);
    this.eye.x += (this.look.x - this.eye.x) * k;
    this.eye.y += (this.look.y - this.eye.y) * k;
    const lx = this.eye.x, ly = this.eye.y;
    if (R.ParamAngleX >= 0) v[R.ParamAngleX] += lx * 30;
    if (R.ParamAngleY >= 0) v[R.ParamAngleY] += ly * 30;
    if (R.ParamAngleZ >= 0) v[R.ParamAngleZ] += lx * ly * -30;
    if (R.ParamBodyAngleX >= 0) v[R.ParamBodyAngleX] += lx * 10;
    if (R.ParamEyeBallX >= 0) v[R.ParamEyeBallX] += lx;
    if (R.ParamEyeBallY >= 0) v[R.ParamEyeBallY] += ly;

    if (this.idle) {
      const t = this.time * Math.PI * 2;
      if (R.ParamAngleX >= 0) v[R.ParamAngleX] += 7.5 * Math.sin(t / 6.5345);
      if (R.ParamAngleY >= 0) v[R.ParamAngleY] += 4 * Math.sin(t / 3.5345);
      if (R.ParamAngleZ >= 0) v[R.ParamAngleZ] += 5 * Math.sin(t / 5.5345);
      if (R.ParamBodyAngleX >= 0) v[R.ParamBodyAngleX] += 2 * Math.sin(t / 15.5345);
      if (R.ParamBreath >= 0) v[R.ParamBreath] = 0.5 + 0.5 * Math.sin(t / 3.2345);

      const b = this.blink;
      b.t -= dt;
      if (b.phase === 0 && b.t <= 0) { b.phase = 1; b.t = 0.1; }
      else if (b.phase === 1) { b.k = Math.max(0, b.t / 0.1); if (b.t <= 0) { b.phase = 2; b.t = 0.05; } }
      else if (b.phase === 2) { b.k = 0; if (b.t <= 0) { b.phase = 3; b.t = 0.15; } }
      else if (b.phase === 3) { b.k = 1 - Math.max(0, b.t / 0.15); if (b.t <= 0) { b.phase = 0; b.k = 1; b.t = 1.5 + Math.random() * 5; } }
      this.eyes.forEach((i) => { v[i] *= b.k; });
    }

    if (this.hook) this.hook(this);
    for (let i = 0; i < P.count; i++) v[i] = clamp(v[i], P.min[i], P.max[i]);

    if (this.physics) {
      this.left = Math.min(this.left + dt, 0.1);
      while (this.left > 1e-6) { const h = Math.min(STEP, this.left); this.physics.step(v, P, h); this.left -= h; }
    }
    this.d.resetDynamicFlags();
    this.model.update();
  }

  release() {
    try { this.model.release(); this.moc._release(); } catch { /* already gone */ }
  }
}

/** Fetch a model's files and build it. `def`: { moc, physics } URLs plus the Puppet options. */
export async function loadPuppet(def, signal) {
  const [core, moc, physics] = await Promise.all([
    loadCore(),
    fetch(def.moc, { signal }).then((r) => { if (!r.ok) throw new Error(`${def.moc} ${r.status}`); return r.arrayBuffer(); }),
    def.physics ? fetch(def.physics, { signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
  ]);
  return new Puppet(core, moc, physics, def);
}
