// The Observer's ring (chapter 03): a machine, not a hoop. From the eye outwards —
//
//   bezel      a machined lip that holds the lens                                   static
//   race       a toothed ring with an index tooth every 30°                          turns against the armour
//   armour     the flat ring itself: a black carrier, and on its face twelve coated armour plates (dark grey,
//              bolted, each with a lit slot and a raised cement-grey tier stencilled 01–12) alternating with
//              twelve recessed service bays (cooling fins, or hazard striping) that carry the emitters on the
//              rim                                                                        turns with t
//   cradle     the rail behind the armour, six bogies and the two legs that carry it   static
//   crown      armour that has let go of the ring and hangs over it, open at the foot   rocks
//   sigil      drafting line-work: a dashed circle, bearings every 30°, three long arcs   turns slowly
//
// The palette is a field one: blacks and coated greys carry it, bare steel is dull, and the only pale surface is
// a matt cement grey used sparingly (the numbered tiers, a hairline on the crown, the shin plates). Paint and
// light are the yellow accents.
//
// Everything is built here from a few shapes (annular sectors with cut corners, lathed profiles with crisp
// edges, wedges, hex bolts) and drawn instanced. The ring lies in the XY plane and faces +Z, towards the camera
// that approaches it; nothing moves on its own — `update(rot)` places every part from the timeline value.
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const SEG7 = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' };
// a seven-segment digit in a box 1 wide and 2 high, centred: [x0, y0, x1, y1] per segment
const BARS = { a: [-0.5, 1, 0.5, 1], b: [0.5, 1, 0.5, 0], c: [0.5, 0, 0.5, -1], d: [-0.5, -1, 0.5, -1], e: [-0.5, 0, -0.5, -1], f: [-0.5, 1, -0.5, 0], g: [-0.5, 0, 0.5, 0] };

export function buildGate(THREE, { hi = true, keep = (x) => x, tint = (c) => c } = {}) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const SEGS = hi ? 256 : 144;

  // ---------------------------------------------------------------- materials
  const std = (color, metalness, roughness) => keep(new THREE.MeshStandardMaterial({ color, metalness, roughness }));
  /**
   * Gives a material an uneven surface: cloudy tone, a matching drift in roughness and (for cement) pin-holes.
   * The pattern is solid noise read at the position on the ring, so it stays put on a part as the part turns.
   */
  function worn(mat, { scale = 1, tone = 0.2, rough = 0.1, pits = 0 }) {
    const n = (v) => v.toFixed(3);
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vGate;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 gatePos = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            gatePos = instanceMatrix * gatePos;
          #endif
          vGate = gatePos.xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vGate;
          float gateHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          float gateNoise(vec3 p){
            vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(gateHash(i), gateHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(gateHash(i + vec3(0.0, 1.0, 0.0)), gateHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                       mix(mix(gateHash(i + vec3(0.0, 0.0, 1.0)), gateHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(gateHash(i + vec3(0.0, 1.0, 1.0)), gateHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 gateP = vGate * ${n(scale)};
          float gateCloud = gateNoise(gateP) * 0.55 + gateNoise(gateP * 2.7 + 11.0) * 0.3 + gateNoise(gateP * 8.0 + 5.0) * 0.15;
          float gatePit = smoothstep(0.8, 0.9, gateNoise(gateP * 19.0 + 3.0));
          diffuseColor.rgb *= 1.0 + (gateCloud - 0.5) * ${n(tone * 2)} - gatePit * ${n(pits)};`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + (gateCloud - 0.5) * ${n(rough * 2)}, 0.05, 1.0);`);
    };
    mat.customProgramCacheKey = () => `gate-worn-${n(scale)}-${n(tone)}-${n(rough)}-${n(pits)}`;
    return mat;
  }
  const M = {
    dark: std(0x191b1e, 0.85, 0.46),                // black gunmetal: carrier, bays, housings
    steel: std(0x5d6167, 0.85, 0.42),               // dull machined steel: teeth, fins, bolts, rail
    plate: worn(std(0x26282c, 0.7, 0.6), { scale: 0.7, tone: 0.18, rough: 0.12 }),                // coated armour, grey-black
    cement: worn(std(0x656765, 0, 0.94), { scale: 1.15, tone: 0.22, rough: 0.05, pits: 0.32 }),   // the pale tier: matt, cloudy, pin-holed
    ink: std(0x0b0c0d, 0.2, 0.7),                   // matt black: inlays, numerals
    paint: std(0xf2b705, 0.1, 0.55),                // hazard yellow, painted (not lit)
    glow: keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.02) })),
    line: keep(new THREE.LineBasicMaterial({ color: 0xbdbbb4, transparent: true, opacity: 0.55 })),
    lineHot: keep(new THREE.LineBasicMaterial({ color: new THREE.Color(1.5, 0.78, 0.04), transparent: true, opacity: 0.8 })),
  };
  // on the light grade the drafting line-work is drawn in ink and amber instead of light
  tint(M.line.color, 0x1c1d1f);
  tint(M.lineHot.color, new THREE.Color(0.7, 0.3, 0.0));
  M.plate.envMapIntensity = 0.55;                   // a coating, not a mirror: it takes little from the surroundings

  // ---------------------------------------------------------------- shapes
  const pol = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  /** An annular sector centred on angle 0, its four corners cut, standing from z0 to z0 + depth. */
  function sector(r0, r1, span, depth, z0, { cut = 0.2, bevel = 0.05, curve = hi ? 10 : 6 } = {}) {
    const a0 = -span / 2, a1 = span / 2, s = new THREE.Shape();
    const c = Math.min(cut, (r1 - r0) * 0.45), c0 = c / r0, c1 = c / r1;
    s.moveTo(...pol(r0 + c, a0));
    s.lineTo(...pol(r1 - c, a0));
    s.absarc(0, 0, r1, a0 + c1, a1 - c1, false);
    s.lineTo(...pol(r1 - c, a1));
    s.lineTo(...pol(r0 + c, a1));
    s.absarc(0, 0, r0, a1 - c0, a0 + c0, true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1, curveSegments: curve });
    g.translate(0, 0, z0 + bevel);
    return keep(g);
  }
  /** A ring swept from a closed profile [[r, z], …] (counter-clockwise, r to the right, z up): every edge keeps its own normal. */
  function lathe(profile, segs = SEGS) {
    const pos = [], nor = [], n = profile.length;
    for (let i = 0; i < n; i++) {
      const [r0, z0] = profile[i], [r1, z1] = profile[(i + 1) % n];
      let nr = z1 - z0, nz = r0 - r1;
      const len = Math.hypot(nr, nz) || 1;
      nr /= len; nz /= len;
      for (let j = 0; j < segs; j++) {
        const a = (j / segs) * TAU, b = ((j + 1) / segs) * TAU, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const p00 = [r0 * ca, r0 * sa, z0], p10 = [r1 * ca, r1 * sa, z1], p11 = [r1 * cb, r1 * sb, z1], p01 = [r0 * cb, r0 * sb, z0];
        pos.push(...p00, ...p11, ...p10, ...p00, ...p01, ...p11);
        const na = [nr * ca, nr * sa, nz], nb = [nr * cb, nr * sb, nz];
        nor.push(...na, ...nb, ...na, ...na, ...nb, ...nb);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return keep(g);
  }
  /** A wedge: 1 long (along +y from 0), w0 wide at its foot, w1 at its tip, 1 deep (centred on z), edges eased. */
  function wedge(w0, w1, bevel = 0.04) {
    const s = new THREE.Shape();
    s.moveTo(-w0 / 2, 0); s.lineTo(w0 / 2, 0); s.lineTo(w1 / 2, 1); s.lineTo(-w1 / 2, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1 - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1 });
    g.translate(0, 0, -0.5 + bevel);
    return keep(g);
  }
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const hex = keep(new THREE.CylinderGeometry(1, 1, 1, 6).rotateX(Math.PI / 2));          // a bolt head, axis along z
  const drum = keep(new THREE.CylinderGeometry(1, 1, 1, hi ? 28 : 16).rotateX(Math.PI / 2)); // a pin or a hinge, axis along z
  const rod = keep(new THREE.CylinderGeometry(1, 1, 1, hi ? 16 : 10));                     // a strut, axis along y

  // ---------------------------------------------------------------- placing
  /** Instances of `geo` listed as [angle, u, radius, z, sx, sy, sz, turn] — u runs clockwise along the ring, y points outwards. */
  function scatter(geo, mat, list) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([A, u, v, z, sx, sy, sz, turn = 0], i) => {
      const c = Math.cos(A), s = Math.sin(A);
      dummy.position.set(c * v + s * u, s * v - c * u, z);
      dummy.rotation.set(0, 0, A - Math.PI / 2 + turn);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
  /** One sector geometry, turned to each of `angles`. */
  function fan(geo, mat, angles) {
    const mesh = new THREE.InstancedMesh(geo, mat, angles.length);
    angles.forEach((A, i) => { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, A); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
  const ring = (profile, mat) => new THREE.Mesh(lathe(profile), mat);
  const lines = (pts, mat) => { const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return new THREE.LineSegments(g, mat); };
  /** Appends to `out` the strokes of `text` (digits) as line segments, in the same frame `scatter` uses. */
  function strokes(out, text, A, radius, size, z = 0) {
    const c = Math.cos(A), s = Math.sin(A), w = size * 0.5, h = size, gap = size * 0.34;
    const x0 = -((text.length - 1) * (w + gap)) / 2;
    [...text].forEach((ch, k) => {
      for (const seg of SEG7[ch] || '') {
        const b = BARS[seg];
        for (const [bx, by] of [[b[0], b[1]], [b[2], b[3]]]) {
          const u = x0 + k * (w + gap) + bx * w, v = radius + (by * h) / 2;
          out.push(c * v + s * u, s * v - c * u, z);
        }
      }
    });
  }

  // ================================================================ bezel (static)
  const frame = new THREE.Group();
  frame.add(
    ring([[20.92, -0.75], [21.9, -0.75], [21.9, 0.3], [21.68, 0.58], [21.24, 0.58], [21.24, 0.2], [20.92, 0.2]], M.dark),
    ring([[21.3, 0.58], [21.62, 0.58], [21.62, 0.66], [21.3, 0.66]], M.steel),                 // a bright land on the lip
    new THREE.Mesh(keep(new THREE.TorusGeometry(23.46, 0.06, 6, SEGS)), M.glow),                // the hairline between race and armour
  );

  // ================================================================ race (turns against the armour)
  const race = new THREE.Group();
  {
    const N = 120, teeth = [], tips = [];
    for (let i = 0; i < N; i++) {
      const A = (i / N) * TAU, index = i % 10 === 0;
      teeth.push([A, 0, 22.42, 0.12, 1, index ? 0.86 : 0.6, index ? 0.86 : 0.62]);
      if (index) tips.push([A, 0, 23.32, 0.42, 0.34, 0.1, 0.1]);
    }
    race.add(
      ring([[21.98, -0.5], [22.46, -0.5], [22.46, 0.44], [22.34, 0.56], [22.1, 0.56], [21.98, 0.44]], M.steel),
      scatter(wedge(0.52, 0.3), M.steel, teeth),
      scatter(box, M.glow, tips),
    );
  }

  // ================================================================ armour (turns with t)
  const armour = new THREE.Group();
  {
    const major = 17.4 * DEG, minor = 10.6 * DEG;
    const majors = Array.from({ length: 12 }, (_, i) => (i * 30) * DEG), minors = majors.map((a) => a + 15 * DEG);
    // the carrier: one continuous dark ring; what shows of it are the seams between the plates
    armour.add(ring([[23.72, -1.0], [27.5, -1.0], [27.5, 0.72], [27.22, 1.0], [24.0, 1.0], [23.72, 0.72]], M.dark));
    // the armour, two tiers: a coated plate, and on it a cement-grey tier that carries the number
    armour.add(
      fan(sector(23.58, 27.66, major, 0.56, 1.0, { cut: 0.42, bevel: 0.07 }), M.plate, majors),
      fan(sector(25.72, 27.36, major * 0.74, 0.3, 1.56, { cut: 0.26, bevel: 0.05 }), M.cement, majors),
      // a panel line between the two zones of the lower tier
      fan(sector(25.44, 25.51, major * 0.88, 0.02, 1.56, { cut: 0.02, bevel: 0 }), M.ink, majors),
      // a black inlay holding a lit slot, on the lower tier
      fan(sector(24.14, 25.28, major * 0.6, 0.06, 1.56, { cut: 0.16, bevel: 0.02 }), M.ink, majors),
      fan(sector(24.62, 24.8, major * 0.46, 0.05, 1.62, { cut: 0.04, bevel: 0 }), M.glow, majors),
    );
    // the service bays between them, set back from the armour
    armour.add(fan(sector(24.06, 27.3, minor, 0.26, 1.0, { cut: 0.22, bevel: 0.05 }), M.dark, minors));

    const bolts = [], fins = [], stripes = [], pads = [], digits = [], marks = [], housings = [], slits = [], masts = [], caps = [];
    majors.forEach((A, i) => {
      // four bolts per plate, and two on the upper tier
      for (const [da, r] of [[-7.3, 24.02], [7.3, 24.02], [-7.3, 27.2], [7.3, 27.2]]) bolts.push([A + da * DEG, 0, r, 1.6, 0.12, 0.12, 0.1]);
      for (const da of [-5.6, 5.6]) bolts.push([A + da * DEG, 0, 26.54, 1.9, 0.085, 0.085, 0.08]);
      // its number, stencilled in seven-segment bars
      const text = String(i + 1).padStart(2, '0'), w = 0.42, h = 0.84, t = 0.1, gap = 0.27, x0 = -((text.length - 1) * (w + gap)) / 2;
      [...text].forEach((ch, k) => {
        for (const seg of SEG7[ch]) {
          const b = BARS[seg], flat = b[1] === b[3];
          const u = x0 + k * (w + gap) + ((b[0] + b[2]) / 2) * w, v = 26.62 + ((b[1] + b[3]) / 2) * (h / 2);
          digits.push([A, u, v, 1.875, flat ? w + t : t, flat ? t : h / 2 + t, 0.03]);
        }
      });
      // painted marks: a rule under the number, and a registration block at each end of the plate
      marks.push([A, 0, 25.98, 1.875, 1.7, 0.07, 0.03], [A - 7.25 * DEG, 0, 25.6, 1.575, 0.2, 0.62, 0.03], [A + 7.25 * DEG, 0, 25.6, 1.575, 0.2, 0.62, 0.03]);
    });
    minors.forEach((A, i) => {
      if (i % 3 === 1) {
        // every third bay is marked instead of finned: hazard striping on a black pad
        pads.push([A, 0, 25.68, 1.27, 3.5, 2.5, 0.04]);
        for (let k = -2; k <= 2; k++) stripes.push([A, k * 0.56, 25.68, 1.3, 0.2, 2.5, 0.03, 0.62]);
      } else {
        for (let k = -2; k <= 2; k++) fins.push([A + k * 1.75 * DEG, 0, 25.68, 1.42, 0.14, 2.5, 0.42]);
        caps.push([A, 0, 24.5, 1.34, 3.6, 0.2, 0.3], [A, 0, 26.86, 1.34, 3.9, 0.2, 0.3]);
      }
      // the emitter on the rim of each bay
      housings.push([A, 0, 27.3, 0.62, 1, 1.86, 0.84]);
      slits.push([A, 0, 28.4, 1.06, 0.14, 0.86, 0.06]);
      caps.push([A, 0, 27.56, 1.08, 1.5, 0.16, 0.12]);
      if (i % 3 === 0) masts.push([A, 0, 30.3, 0.62, 0.07, 2.5, 0.07]);
    });
    armour.add(
      scatter(hex, M.steel, bolts),
      scatter(box, M.ink, digits),
      scatter(box, M.ink, pads),
      scatter(box, M.steel, [...fins, ...caps, ...masts]),
      scatter(box, M.paint, [...stripes, ...marks]),
      scatter(wedge(1.5, 0.74, 0.05), M.dark, housings),
      scatter(box, M.glow, slits),
    );
    // drafting ticks around the ring, turning with it
    const pts = [];
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * TAU, r0 = 30.2, r1 = i % 15 === 0 ? 33 : i % 5 === 0 ? 31.6 : 30.9;
      pts.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
    }
    armour.add(lines(pts, M.line));
  }

  // ================================================================ cradle (static): rail, bogies, legs
  const cradle = new THREE.Group();
  {
    cradle.add(
      ring([[27.02, -1.96], [28.92, -1.96], [28.92, -1.3], [28.62, -1.0], [27.02, -1.0]], M.steel),
      ring([[28.2, -1.0], [28.5, -1.0], [28.5, -0.9], [28.2, -0.9]], M.ink),                 // the track the armour rides
    );
    const bodies = [], lids = [], lamps = [], pins = [];
    for (let i = 0; i < 6; i++) {
      const A = (30 + i * 60) * DEG;
      bodies.push([A, 0, 29.0, -1.42, 2.3, 1.7, 1.3]);
      lids.push([A, 0, 29.72, -1.42, 2.56, 0.26, 1.46], [A, -0.72, 28.9, -0.72, 0.5, 1.1, 0.1], [A, 0.72, 28.9, -0.72, 0.5, 1.1, 0.1]);
      lamps.push([A, 0, 29.2, -0.74, 0.5, 0.1, 0.06]);
      pins.push([A, -0.72, 28.5, -0.7, 0.2, 0.2, 0.16], [A, 0.72, 28.5, -0.7, 0.2, 0.2, 0.16]);
    }
    cradle.add(scatter(box, M.dark, bodies), scatter(box, M.steel, lids), scatter(box, M.glow, lamps), scatter(hex, M.steel, pins));

    // legs: a column to the rail, a shin plate, a hinge where it takes the load, a telescopic strut and a foot
    const part = (geo, mat, x, y, z, sx, sy, sz, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.scale.set(sx, sy, sz); cradle.add(m); return m; };
    for (const sx of [-1, 1]) {
      const tilt = sx * 0.42, ux = -Math.sin(tilt), uy = Math.cos(tilt);        // the leg's own axis
      const at = (s, off = 0) => [sx * 22.5 + ux * s + uy * off * sx, -21 + uy * s - ux * off * sx];
      part(box, M.dark, ...at(0), -3.1, 3.4, 15, 3.4, tilt);
      part(box, M.cement, ...at(-1.4), -1.3, 2.3, 8.4, 0.3, tilt);
      part(box, M.ink, ...at(-1.4), -1.13, 0.5, 6.2, 0.06, tilt);
      part(box, M.glow, ...at(-4.0), -1.09, 0.5, 0.12, 0.05, tilt);
      part(box, M.steel, ...at(3.3), -1.32, 2.7, 0.5, 0.34, tilt);
      part(drum, M.steel, ...at(3.05), -3.1, 1.5, 1.5, 4.0);                    // the hinge on the rail
      part(drum, M.ink, ...at(3.05), -3.1, 0.62, 0.62, 4.1);
      part(drum, M.steel, ...at(-6.4), -3.1, 1.05, 1.05, 4.0);                  // the ankle
      part(box, M.steel, sx * 26.5, -27.6, -1.6, 11, 0.8, 9);
      part(box, M.dark, sx * 26.5, -27.05, -1.6, 7.4, 0.5, 6.2);
      part(box, M.paint, sx * 26.5, -27.6, 2.93, 11, 0.5, 0.06);
      for (let k = -4; k <= 4; k++) part(box, M.ink, sx * 26.5 + k * 1.2, -27.6, 2.97, 0.3, 0.5, 0.03, 0.45);
      // the actuator beside it: from the outer end of the foot up to the bogie at 30° below the horizon —
      // a sleeve, and the rod that slides in it
      const fx = sx * 31, fy = -27.2, bx = sx * 25.6, by = -14.8, len = Math.hypot(bx - fx, by - fy);
      const vx = (bx - fx) / len, vy = (by - fy) / len, st = Math.atan2(-vx, vy), mx = (fx + bx) / 2, my = (fy + by) / 2;
      part(rod, M.steel, mx, my, -2.7, 0.2, len, 0.2, st);
      part(rod, M.dark, mx - vx * len * 0.24, my - vy * len * 0.24, -2.7, 0.44, len * 0.5, 0.44, st);
      part(rod, M.paint, mx + vx * 0.3, my + vy * 0.3, -2.7, 0.47, 0.22, 0.47, st);
      part(drum, M.steel, fx, fy, -2.7, 0.66, 0.66, 1.5);
      part(drum, M.steel, bx, by, -2.7, 0.52, 0.52, 1.3);
    }
  }

  // ================================================================ crown (rocks): armour that has let go of the ring
  const crown = new THREE.Group();
  {
    const from = -22, pitch = 9.1, skip = new Set([3, 8, 9, 15, 20]), plates = [], thin = [], studs = [];
    for (let i = 0; i < 25; i++) {
      if (skip.has(i)) continue;
      const A = (from + i * pitch + pitch / 2) * DEG;
      plates.push(A);
      if (i % 2 === 0) thin.push(A);
      studs.push([A, 0, 34.86, 0.5, 0.09, 0.09, 0.08]);
    }
    crown.add(
      fan(sector(34.2, 35.5, 8.3 * DEG, 0.34, 0.1, { cut: 0.24, bevel: 0.05 }), M.plate, plates),
      fan(sector(35.62, 35.86, 8.3 * DEG, 0.2, 0.12, { cut: 0.06, bevel: 0.02 }), M.cement, plates),
      fan(sector(33.9, 34.02, 6.4 * DEG, 0.08, 0.2, { cut: 0.03, bevel: 0 }), M.glow, thin),
      scatter(hex, M.steel, studs),
    );
  }

  // ================================================================ sigil (turns slowly): drafting line-work
  const sigil = new THREE.Group();
  {
    const cool = [], hot = [];
    const arc = (out, r, a0, a1, step = 1.5) => { for (let a = a0; a < a1 - 1e-6; a += step) { const b = Math.min(a1, a + step); out.push(...pol(r, a * DEG), 0, ...pol(r, b * DEG), 0); } };
    // a dashed circle
    for (let a = 0; a < 360; a += 5) arc(cool, 37.1, a, a + 3, 1.5);
    // bearings: a pointer and a three-digit heading every 30°
    for (let d = 0; d < 360; d += 30) {
      const A = d * DEG, tip = pol(36.5, A), l = pol(37.0, A - 0.7 * DEG), r = pol(37.0, A + 0.7 * DEG);
      hot.push(...tip, 0, ...l, 0, ...tip, 0, ...r, 0, ...l, 0, ...r, 0);
      strokes(cool, String(d).padStart(3, '0'), A, 38.25, 0.74);
    }
    // three long arcs with stops at their ends, and a fine inner circle
    for (const a0 of [8, 128, 248]) {
      arc(cool, 39.4, a0, a0 + 74, 2);
      for (const a of [a0, a0 + 74]) cool.push(...pol(39.0, a * DEG), 0, ...pol(39.8, a * DEG), 0);
      arc(hot, 39.75, a0 + 24, a0 + 50, 2);
    }
    arc(cool, 33.45, 0, 360, 1.5);
    sigil.add(lines(cool, M.line), lines(hot, M.lineHot));
    sigil.position.z = -0.2;
  }

  group.add(cradle, frame, race, armour, crown, sigil);
  return {
    group,
    /** Every moving part is keyed to the timeline. */
    update(rot) {
      armour.rotation.z = rot * 0.5;
      race.rotation.z = -rot * 0.9;
      crown.rotation.z = Math.sin(rot * 1.7) * 0.085;
      sigil.rotation.z = -rot * 0.21;
    },
  };
}
