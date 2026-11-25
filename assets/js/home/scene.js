// The world: one continuous 3D space, driven entirely by a timeline value `t`
// (chapter index + progress inside the chapter). Nothing here advances on its own except
// small ambient motion (snow drift, grain); the storyboard only moves when `t` moves.
import * as THREE from 'three';
import { rng, genField, genTree, genFigure, buildHelixMesh, genHelix, genCorona } from './gen.js';
import * as S from './shaders.js';
import { buildGate } from './gate.js';
import { works } from '../data/site.js';

const FOG = new THREE.Color(0.012, 0.013, 0.015);
// The light grade: the same world drawn on paper. This is the sheet, as the scene has to draw it for the
// final grade to turn it into the page's own background (#e9e8e2).
const PAPER_FOG = new THREE.Color(0.941, 0.909, 0.736);
const SIGNAL_LIN = new THREE.Color(0.85, 0.42, 0.0);
const GATE = new THREE.Vector3(0, 24, -120);
const TREE = [0, -18, -300];
const FIGURE = { cx: 0, cy: 33, cz: -300, w: 54, h: 72 };
// archive helix: a double helix of particles around the vertical axis through HUB. One panel per work is
// strutted off the helix. Work 01 is at the top; each later one sits `dY` lower and `dAng` further round to
// the viewer's right. Advancing a work is a screw motion: the helix turns clockwise (seen from above) and
// rises while the next panel swings in from the right, so the visitor travels down the helix.
const HUB = new THREE.Vector3(0, 30, -300);
const HELIX = { rs: 20, rp: 46, w: 36, h: 22.5, dAng: (Math.PI * 2) / 5.5, dY: 15, below: 80, above: 80, rung: 6.5, from: 5.3, to: 5.72 };
// eclipse: xy = centre, z = limb radius; it lies in the plane z = ECLIPSE_Z
const CORONA = new THREE.Vector3(0, 44, 34);
const ECLIPSE_Z = -330;

// ---------- timeline helpers ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function track(keys, t, out, eased = true) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  let k = clamp01((t - a[0]) / (b[0] - a[0]));
  if (eased) k = ease(k);
  for (let j = 0; j < out.length; j++) out[j] = a[j + 1] + (b[j + 1] - a[j + 1]) * k;
  return out;
}

//            t     px    py    pz     tx   ty    tz   fov  back
// `back` = how far a portrait screen pulls the camera away so the subject still fits.
// From 4.25 on, the x offset only exists to seat the subject right of the copy; portrait screens centre it.
const CAM = [
  [0.00,       0,  215,   36,     0,   0,   -6,  38, 0.55],
  [0.80,       0,  178,   52,     0,   0,  -14,  38, 0.55],
  [1.25,     -34,   62,   92,     0,   6,  -40,  44, 0.55],
  [1.75,     -14,   26,   36,     0,  18, -120,  48, 0.55],
  [2.20,       0,   22,  -40,     0,  24, -120,  46, 0.55],
  [2.60,       0, 23.5,  -78,     0,  24, -120,  42, 0.55],
  [2.80,       0,   24,  -92,     0,  24, -120,  40, 0.55],
  [2.95,       0, 24.3, -110,     0,  25, -160,  42, 0.55],
  [3.08,       0, 24.5, -131,     0,  30, -300,  46, 0.55],
  [3.35,      26,   30, -196,     0,  34, -300,  48, 0.55],
  [3.80,     -24,   46, -214,     0,  36, -300,  46, 0.55],
  [4.25,     -32,   34, -162,   -32,  33, -300,  37, 0.55],   // the whole figure, head to toe
  [4.55,     -34,   33, -154,   -34,  33, -300,  36, 0.55],
  [4.93,     -34, 33.5, -160,   -34,33.5, -300,  35, 0.55],
  [5.30,     -26,   30, -180,   -26,  30, -300,  42, 1.1],    // level with the active panel, square on to it
  [5.88,     -26,   30, -180,   -26,  30, -300,  42, 1.1],
  [6.36,     -46,   40, -148,   -46,  44, -330,  37, 0.7],    // facing the eclipse
  [7.00,     -44,   42, -164,   -44,  44, -330,  37, 0.7],
];
const STAGE = [[0, 0], [2.42, 0], [3.18, 1], [3.98, 1], [4.28, 2], [4.96, 2], [5.3, 3], [5.92, 3], [6.3, 4], [7, 4]];
const FOGK = [[0, 0.0011], [0.8, 0.0012], [1.6, 0.0034], [7, 0.0034]];

export async function createScene(canvas, { quality = 'high' } = {}) {
  const hi = quality === 'high';
  const N = hi ? 56000 : 30000;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(FOG, 1);
  // Resolution: device pixels up to a ratio, and never more pixels than the budget — a 4K screen is drawn at
  // about 1440p-and-a-half and scaled up, instead of four times the work for the same picture.
  const maxRatio = Math.min(devicePixelRatio || 1, hi ? 1.5 : 1.25), budget = hi ? 5.0e6 : 3.2e6;
  let pixelRatio = maxRatio;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1400);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  // Two grades of one world. `light` (0 dark · 1 paper) is one more number of the picture: colours that differ
  // between the grades are registered here and set from it every time it changes; shaders read it as uLight.
  const tints = [], lit = [];
  const tint = (color, onPaper) => { tints.push([color, color.clone(), new THREE.Color(onPaper)]); return color; };
  const fogNow = FOG.clone();
  tints.push([fogNow, FOG.clone(), PAPER_FOG.clone()]);
  let ambient = 0, graded = -1;

  // ---------- assets ----------
  const loader = new THREE.TextureLoader();
  const [eyeTex, figTex] = await Promise.all([
    loader.loadAsync('/assets/img/amano-eye.webp'),
    loader.loadAsync('/assets/img/sakura-cut.webp'),
  ]);
  for (const tex of [eyeTex, figTex]) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; keep(tex); }
  figTex.premultiplyAlpha = true;

  // ---------- image-based lighting for the metal (tiny procedural studio) ----------
  {
    const env = new THREE.Scene();
    const box = new THREE.BoxGeometry(1, 1, 1);
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ color: 0x08090a, side: THREE.BackSide })));
    const panel = (x, y, z, sx, sy, sz, c) => { const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); env.add(m); };
    panel(-18, 22, 14, 14, 1, 14, new THREE.Color(9, 8.4, 7.4));
    panel(24, 6, 10, 1, 18, 8, new THREE.Color(3, 3.4, 4.2));
    panel(0, -20, 6, 30, 1, 10, new THREE.Color(1.6, 1.2, 0.5));
    panel(0, 4, 30, 26, 10, 1, new THREE.Color(2.2, 2.2, 2.2));
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = keep(pmrem.fromScene(env, 0.03).texture);
    scene.environmentIntensity = 0.9;
    pmrem.dispose();
    env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }
  const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
  key.position.set(-60, 110, 60);
  key.target.position.copy(GATE);
  const sky = new THREE.HemisphereLight(0x93a4bd, 0x070707, 0.55);
  tint(sky.groundColor, 0x8f8e88);                  // on paper the ground throws light back up
  scene.add(key, key.target, sky);

  // ---------- terrain ----------
  const seg = hi ? 240 : 170;
  const terrainGeo = keep(new THREE.PlaneGeometry(760, 760, seg, seg));
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, -130);
  const terrainMat = keep(new THREE.ShaderMaterial({
    vertexShader: S.terrainVert, fragmentShader: S.terrainFrag,
    uniforms: {
      uRelief: { value: 0 }, uFogK: { value: 0.0011 }, uFade: { value: 1 }, uLight: { value: 0 },
      uSignal: { value: tint(SIGNAL_LIN.clone(), new THREE.Color(0.62, 0.24, 0.0)) }, uLine: { value: new THREE.Color(0.8, 0.79, 0.76) }, uFogCol: { value: fogNow },
    },
  }));
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.frustumCulled = false;
  lit.push(terrainMat);
  scene.add(terrain);

  // ---------- the gate: ring megastructure ----------
  const gate = new THREE.Group();
  gate.position.copy(GATE);
  scene.add(gate);
  // the ring itself — bezel, toothed race, armour, cradle and legs, crown, line-work — is built in gate.js
  const ring = buildGate(THREE, { hi, keep, tint });
  const metalLight = keep(new THREE.MeshStandardMaterial({ color: 0x8d9299, metalness: 0.85, roughness: 0.3 }));
  const unitBox = keep(new THREE.BoxGeometry(1, 1, 1));
  const dummy = new THREE.Object3D();
  // floating slabs orbiting the gate
  const slabs = new THREE.InstancedMesh(unitBox, metalLight, 54);
  {
    const r = rng(11);
    for (let i = 0; i < 54; i++) {
      const a = r() * Math.PI * 2, rad = 34 + r() * 30;
      dummy.position.set(Math.cos(a) * rad, Math.sin(a) * rad * 0.8 + 6, (r() - 0.5) * 60);
      dummy.rotation.set(r() * 3, r() * 3, r() * 3);
      dummy.scale.set(0.6 + r() * 3.2, 0.12 + r() * 0.2, 0.5 + r() * 1.6);
      dummy.updateMatrix();
      slabs.setMatrixAt(i, dummy.matrix);
    }
  }
  const eyeMat = keep(new THREE.ShaderMaterial({
    vertexShader: S.eyeVert, fragmentShader: S.eyeFrag, alphaToCoverage: hi,
    uniforms: { map: { value: eyeTex }, uOpen: { value: 0 }, uHole: { value: 0 }, uTurn: { value: 0 }, uSignal: { value: SIGNAL_LIN } },
  }));
  const eye = new THREE.Mesh(keep(new THREE.CircleGeometry(21, 128)), eyeMat);
  eye.position.z = -0.4;
  gate.add(ring.group, slabs, eye);

  // ---------- halo circles around the tree / figure ----------
  const halo = new THREE.Group();
  halo.position.set(0, 34, -300);
  const haloMat = keep(new THREE.LineBasicMaterial({ color: 0xd9d6cc, transparent: true, opacity: 0 }));
  tint(haloMat.color, 0x1c1d1f);
  [[58, 0.0, 0.0], [72, 1.1, 0.25], [90, 0.5, -0.6]].forEach(([rad, rx, ry]) => {
    const pts = [];
    for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2; pts.push(Math.cos(a) * rad, Math.sin(a) * rad, 0); }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.Line(g, haloMat);
    l.rotation.set(rx, ry, 0);
    halo.add(l);
  });
  scene.add(halo);

  // ---------- sharp illustration plane ----------
  const PAPER = new THREE.Color(0xffc400);                 // the poster's field; the figure prints in it and in ink
  const figMat = keep(new THREE.ShaderMaterial({
    vertexShader: S.eyeVert, fragmentShader: S.figureFrag, transparent: true, depthWrite: false, premultipliedAlpha: true,
    uniforms: { map: { value: figTex }, uOpacity: { value: 0 }, uPoster: { value: 0 }, uPaper: { value: PAPER }, uLight: { value: 0 } },
  }));
  lit.push(figMat);
  const figure =new THREE.Mesh(keep(new THREE.PlaneGeometry(FIGURE.w, FIGURE.h)), figMat);
  figure.position.set(FIGURE.cx, FIGURE.cy, FIGURE.cz);
  figure.renderOrder = 1;
  figure.visible = false;
  // poster backdrop: a flat field of the signal colour behind the figure
  const dropMat = keep(new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  const drop = new THREE.Mesh(keep(new THREE.PlaneGeometry(1400, 900)), dropMat);
  drop.position.set(FIGURE.cx, FIGURE.cy, FIGURE.cz - 1.5);
  drop.renderOrder = 0;
  drop.visible = false;
  scene.add(drop, figure);

  // ---------- archive helix: the work panels ----------
  const carousel = new THREE.Group();
  carousel.position.copy(HUB);
  carousel.visible = false;
  scene.add(carousel);
  const count = works.length;
  // the helix twists the opposite way to the order of the panels, so every panel sits on a strand
  const helixRng = rng(606);
  const helixMesh = buildHelixMesh(helixRng, {
    rs: HELIX.rs, k: -HELIX.dAng / HELIX.dY, y0: -(count - 1) * HELIX.dY - HELIX.below, y1: HELIX.above, rung: HELIX.rung,
  });
  const helixMat = keep(new THREE.LineBasicMaterial({ color: 0xf2f1ec, transparent: true, opacity: 0, depthWrite: false }));
  const helixFill = keep(new THREE.MeshBasicMaterial({ color: 0xf2f1ec, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  {
    // wireframe: every edge of the triangulated solid; faces: a faint additive skin that gives it body
    const e = helixMesh.edges, v = helixMesh.verts, pts = new Float32Array(e.length * 3);
    for (let i = 0; i < e.length; i++) { pts[i * 3] = v[e[i] * 3]; pts[i * 3 + 1] = v[e[i] * 3 + 1]; pts[i * 3 + 2] = v[e[i] * 3 + 2]; }
    const wire = keep(new THREE.BufferGeometry());
    wire.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const skin = keep(new THREE.BufferGeometry());
    skin.setAttribute('position', new THREE.BufferAttribute(v, 3));
    skin.setIndex(new THREE.BufferAttribute(helixMesh.tris, 1));
    carousel.add(new THREE.Mesh(skin, helixFill), new THREE.LineSegments(wire, helixMat));
  }
  tint(helixMat.color, 0x18191b);
  const lineMat = keep(new THREE.LineBasicMaterial({ color: 0xcfccc2, transparent: true, opacity: 0 }));
  tint(lineMat.color, 0x1c1d1f);
  const panelGeo = keep(new THREE.PlaneGeometry(HELIX.w, HELIX.h));
  const blankTexture = (w) => {   // drawn placeholder for works that have no capture yet
    const cv = document.createElement('canvas');
    cv.width = 960; cv.height = 600;
    const c = cv.getContext('2d');
    c.fillStyle = '#131517'; c.fillRect(0, 0, 960, 600);
    c.strokeStyle = 'rgba(236,235,229,0.09)'; c.lineWidth = 1;
    for (let x = -600; x < 960; x += 22) { c.beginPath(); c.moveTo(x, 600); c.lineTo(x + 600, 0); c.stroke(); }
    c.strokeStyle = 'rgba(236,235,229,0.4)';
    c.beginPath(); c.arc(480, 300, 190, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(480, 60); c.lineTo(480, 540); c.moveTo(240, 300); c.lineTo(720, 300); c.stroke();
    c.fillStyle = '#ecebe5'; c.textAlign = 'center';
    c.font = '600 58px "Noto Serif TC", "Songti TC", "PMingLiU", serif';
    c.fillText(w.title, 480, 292);
    c.font = '600 26px "Barlow Condensed", sans-serif';
    c.fillStyle = '#ffc400'; c.fillText(w.en.split('').join(' '), 480, 346);
    c.font = '500 16px "IBM Plex Mono", monospace';
    c.fillStyle = 'rgba(236,235,229,0.45)'; c.fillText('NO CAPTURE ON FILE', 480, 566);
    return new THREE.CanvasTexture(cv);
  };
  const panels = works.map((w, i) => {
    const mat = keep(new THREE.ShaderMaterial({
      vertexShader: S.eyeVert, fragmentShader: S.panelFrag, transparent: true,
      uniforms: { map: { value: keep(blankTexture(w)) }, uOpacity: { value: 0 }, uFocus: { value: 0 }, uLight: { value: 0 }, uCover: { value: new THREE.Vector2(1, 1) } },
    }));
    lit.push(mat);
    mat.uniforms.map.value.colorSpace = THREE.SRGBColorSpace;
    if (w.img) {
      loader.load(`/assets/img/${w.img}`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; keep(tex);
        const ia = tex.image.width / tex.image.height, pa = HELIX.w / HELIX.h;
        mat.uniforms.uCover.value.set(ia > pa ? pa / ia : 1, ia > pa ? 1 : ia / pa);
        mat.uniforms.map.value = tex;
        renderer.initTexture(tex);      // upload now, not on the frame the panel first comes into view
      });
    }
    const a = i * HELIX.dAng;
    const mesh = new THREE.Mesh(panelGeo, mat);
    mesh.position.set(Math.sin(a) * HELIX.rp, -i * HELIX.dY, Math.cos(a) * HELIX.rp);
    mesh.rotation.y = a;
    carousel.add(mesh);
    return mat;
  });
  {
    // drafting: frame + corner brackets per panel, and the strut that ties it to the helix
    const pts = [];
    const hw = HELIX.w / 2 + 1.1, hh = HELIX.h / 2 + 1.1, b = 4;
    const local = [
      [-hw, -hh, hw, -hh], [hw, -hh, hw, hh], [hw, hh, -hw, hh], [-hw, hh, -hw, -hh],
      [-hw - 2, hh + 2, -hw - 2 + b, hh + 2], [-hw - 2, hh + 2, -hw - 2, hh + 2 - b],
      [hw + 2, -hh - 2, hw + 2 - b, -hh - 2], [hw + 2, -hh - 2, hw + 2, -hh - 2 + b],
    ];
    for (let i = 0; i < count; i++) {
      const a = i * HELIX.dAng, s = Math.sin(a), c = Math.cos(a), y = -i * HELIX.dY;
      for (const [x0, y0, x1, y1] of local) {
        pts.push(s * HELIX.rp + c * x0, y + y0, c * HELIX.rp - s * x0, s * HELIX.rp + c * x1, y + y1, c * HELIX.rp - s * x1);
      }
      pts.push(s * HELIX.rs, y, c * HELIX.rs, s * (HELIX.rp - 0.6), y, c * (HELIX.rp - 0.6));
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    carousel.add(new THREE.LineSegments(g, lineMat));
  }

  // ---------- eclipse: the dark body in front of the corona ----------
  const moonMat = keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }));
  const moon = new THREE.Mesh(keep(new THREE.CircleGeometry(CORONA.z * 0.985, 160)), moonMat);
  moon.position.set(CORONA.x, CORONA.y, ECLIPSE_Z + 0.6);
  moon.visible = false;
  scene.add(moon);

  // ---------- particles ----------
  const r = rng(20261116);
  const geo = keep(new THREE.BufferGeometry());
  const fig = genFigure(N, r, figTex.image, FIGURE);
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = r();
  geo.setAttribute('position', new THREE.BufferAttribute(genField(N, r), 3));
  geo.setAttribute('aB', new THREE.BufferAttribute(genTree(N, r, TREE), 3));
  geo.setAttribute('aC', new THREE.BufferAttribute(fig.pos, 3));
  geo.setAttribute('aD', new THREE.BufferAttribute(genHelix(N, r, [HUB.x, HUB.y, HUB.z], helixMesh), 3));
  geo.setAttribute('aE', new THREE.BufferAttribute(genCorona(N, r, [CORONA.x, CORONA.y, ECLIPSE_Z], CORONA.z), 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(fig.col, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const pointsMat = keep(new THREE.ShaderMaterial({
    vertexShader: S.pointsVert, fragmentShader: S.pointsFrag,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uStage: { value: 0 }, uStageB: { value: 0 }, uBlend: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1000 }, uFigDim: { value: 0 },
      uSnow: { value: 0 }, uSpin: { value: 0 }, uLift: { value: 0 }, uSweep: { value: 0 }, uLight: { value: 0 }, uCenter: { value: HUB }, uCorona: { value: CORONA },
      // the same helix buildHelixMesh drew: twist, then its lowest and highest point around HUB
      uScrew: { value: new THREE.Vector3(-HELIX.dAng / HELIX.dY, -(count - 1) * HELIX.dY - HELIX.below, HELIX.above) },
    },
  }));
  lit.push(pointsMat);
  const points = new THREE.Points(geo, pointsMat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);

  // ---------- post ----------
  const target = keep(new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: hi ? 4 : 0 }));
  const postMat = keep(new THREE.ShaderMaterial({
    vertexShader: S.postVert, fragmentShader: S.postFrag, depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: target.texture }, uPoster: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 },
      uGrain: { value: 0.028 }, uVig: { value: 0.75 }, uRes: { value: new THREE.Vector2(1, 1) },
      uGlitch: { value: 0 }, uLight: { value: 0 },
    },
  }));
  lit.push(postMat);
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 2)), postMat));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------- frame ----------
  const cam = new Float32Array(8), one = new Float32Array(1);
  const lookAt = new THREE.Vector3();
  const state = { poster: 0, work: 0 };
  let height = 1, aspect = 1;

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    pixelRatio = Math.min(maxRatio, Math.sqrt(budget / Math.max(1, w * h)));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    target.setSize(Math.round(w * pixelRatio), Math.round(h * pixelRatio));
    postMat.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
    camera.aspect = aspect = w / h;
    height = h * pixelRatio;
  }

  // ---------- the frame, in three steps ----------
  // sample(t)  → P: every number the picture depends on at timeline value t (camera, materials, particles)
  // mix(a,b,k) → P: the same numbers part-way between two such states
  // render(P)  → draws it
  // Scrolling renders sample(t) directly. A flight between two pages renders mix(from, sample(t), k), so the
  // camera and every object travel straight from where they are to where the next page needs them: one
  // continuous shot, nothing hidden and nothing cut.
  //
  // `view` lets a page re-frame the world without touching the timeline:
  //   shift / lift  move the picture sideways / up as a fraction of the frame (lens shift, no perspective change)
  //   seat          0 = centre the subject instead of seating it beside the copy
  //   pull          step the camera back along its line of sight by this fraction (a wider shot of the same subject)
  //   sweep         how far round the corona is drawn (0–1), instead of what the timeline says (the music player's progress)
  //   light         the grade (0 dark · 1 paper), instead of the site's theme — for a page that is always one of them
  //   turn          which work the archive helix has in front (0 … count − 1, fractional while turning), instead of
  //                 what the timeline says — pages that scroll through the works glide it themselves (home/glide.js)
  const NUM = ['px', 'py', 'pz', 'lx', 'ly', 'lz', 'fov', 'shift', 'lift', 'relief', 'fogK', 'tFade', 'gateOn', 'rot',
    'eyeOpen', 'eyeHole', 'eyeOn', 'halo', 'cOp', 'spin', 'hLift', 'snow', 'sweep', 'moon', 'sharp', 'poster', 'flash', 'glitch', 'light'];
  const newState = () => { const p = { stage: 0, stageB: 0, blend: 0, work: 0 }; for (const k of NUM) p[k] = 0; return p; };

  function sample(t, speed, view, P) {
    track(CAM, t, cam);
    // portrait screens: pull the camera back so wide subjects still fit, and drop the sideways seat
    const narrow = Math.max(0, 1 - aspect) * 0.9;
    // The sideways seat is authored for 16:9. Narrower landscape screens (4:3 tablets) get a proportionally
    // smaller offset and a slightly longer shot, so the subject is never pushed off the right edge.
    const seated = smooth(4.0, 4.25, t);
    const fit = clamp01((aspect - 1.05) / 0.2) * Math.min(1, aspect / 1.78);
    const seat = (1 - seated * (1 - fit)) * (view && view.seat != null ? view.seat : 1);
    const mid = clamp01((1.6 - aspect) / 0.6) * seated;
    // Chapter 05 on phones and tablets: she is a tall subject, and the pull-backs above and below (`mid`, `narrow`)
    // exist for wide ones — with them she would stand small above the copy. Upright screens (copy below her) drop
    // them and come in closer; landscape tablets (copy beside her) only come in a little.
    const close = seated * (1 - smooth(4.93, 5.25, t));
    const upright = clamp01((1.05 - aspect) / 0.25) * close;
    const beside = mid * close * (1 - upright);
    camera.position.set(cam[0] * seat, cam[1], cam[2]);
    lookAt.set(cam[3] * seat, cam[4], cam[5]);
    if (mid > 0) camera.position.lerp(lookAt, -mid * 0.3 * (1 - upright) + beside * 0.25);
    if (narrow > 0) {
      camera.position.lerp(lookAt, -narrow * cam[7] * (1 - upright));
      // portrait: lift the eclipse into the upper half, clear of the copy
      const up = narrow * smooth(6.0, 6.36, t) * 80;
      camera.position.y -= up; lookAt.y -= up;
    }
    if (view && view.pull) camera.position.lerp(lookAt, -view.pull);
    P.px = camera.position.x; P.py = camera.position.y; P.pz = camera.position.z;
    P.lx = lookAt.x; P.ly = lookAt.y; P.lz = lookAt.z;
    P.fov = cam[6] + narrow * 14 * (1 - upright);
    P.shift = view ? view.shift || 0 : 0;
    P.lift = view ? view.lift || 0 : 0;

    // terrain
    P.relief = smooth(0.62, 1.38, t);
    P.fogK = track(FOGK, t, one, false)[0];
    P.tFade = 1 - smooth(2.6, 2.95, t);

    // gate: every moving part is keyed to t
    P.gateOn = t < 3.5 ? 1 : 0;
    P.rot = t;
    P.eyeOpen = smooth(1.95, 2.45, t);
    // the pupil opens as a fraction of the visible frame, so its lit rim sweeps outward past the lens.
    // `reach` is how far from the pupil's centre the frame's farthest corner lies on the lens: half the frame's
    // diagonal there, plus how far the middle of the frame sits from the pupil (the camera is not quite on axis).
    const dist = P.pz - (GATE.z - 0.4);
    const ax = P.lx - P.px, ay = P.ly - P.py, az = P.lz - P.pz;
    const along = az < 0 ? -dist / az : 0;                          // the view axis meets the lens here
    const off = Math.hypot(P.px + ax * along - GATE.x, P.py + ay * along - GATE.y);
    const reach = dist * Math.tan((P.fov * Math.PI) / 360) * Math.hypot(1, aspect) * 1.06 + off;
    // Once fully open it stays open. The camera then flies on into the lens, the frame there shrinks to nothing,
    // and a hole still sized to it would close back in from the corners: the lit rim sweeping inward (≈ 43.0 %).
    const open = smooth(2.7, 2.99, t);
    P.eyeHole = dist > 0 && open < 1 ? (open * reach) / 21 : 2;
    P.eyeOn = t > 1.95 && dist > 0.2 ? 1 : 0;

    // halo
    P.halo = 0.42 * smooth(3.1, 3.5, t) * (1 - smooth(5.0, 5.3, t));

    // archive helix: one work per step. The screw (turn + lift) is a pure function of t.
    // The helix rises into place on entry and keeps rising away on exit (the view keeps descending).
    const cIn = smooth(5.06, 5.3, t), cOut = smooth(5.9, 6.04, t);
    P.cOp = cIn * (1 - cOut);
    // each work dwells square-on at the front, then the helix turns to the next one
    const raw = clamp01((t - HELIX.from) / (HELIX.to - HELIX.from)) * (count - 1);
    const turn = view && view.turn != null
      ? Math.min(count - 1, Math.max(0, view.turn))
      : Math.min(count - 1, Math.floor(raw) + smooth(0.3, 0.7, raw - Math.floor(raw)));
    P.spin = -turn * HELIX.dAng + (1 - cIn) * 1.3 - cOut * 0.9;
    P.hLift = turn * HELIX.dY - (1 - cIn) * 34 + cOut * 46;
    P.work = Math.round(turn);

    // particles
    P.stage = P.stageB = track(STAGE, t, one, false)[0];
    P.blend = 0;
    P.snow = smooth(0.55, 1.02, t);
    P.sweep = view && view.sweep != null ? view.sweep : smooth(6.2, 6.9, t) * 1.04;

    // eclipse body
    P.moon = smooth(6.02, 6.28, t);

    // the figure: particles gather (to 4.28), resolve into the sharp cut-out (4.26–4.4),
    // hold in full colour, then the frame flips to the poster: a yellow field, the figure printed on it in ink
    P.sharp = smooth(4.26, 4.4, t) * (1 - smooth(4.95, 5.06, t));
    P.poster = smooth(4.57, 4.66, t) * (1 - smooth(4.93, 5.02, t));
    P.flash = 0.55 * (Math.exp(-(((t - 4.61) / 0.03) ** 2)) + Math.exp(-(((t - 4.98) / 0.03) ** 2)) + Math.exp(-(((t - 2.99) / 0.03) ** 2)));
    // opening: the chart tears while it is being scrolled, and only then
    P.glitch = (1 - smooth(0.5, 0.95, t)) * Math.min(1, speed * 6);
    P.light = view && view.light != null ? view.light : ambient;
    return P;
  }

  function mix(A, B, k, P) {
    for (const key of NUM) P[key] = A[key] + (B[key] - A[key]) * k;
    // the particle cloud is blended per particle in the shader; a state that was itself caught mid-flight
    // counts as whichever formation it was closer to
    P.stage = A.blend > 0.5 ? A.stageB : A.stage;
    P.stageB = B.stage;
    P.blend = k;
    P.work = k < 0.5 ? A.work : B.work;
    // flashes belong to the storyboard, not to the journey between two points of it
    P.flash *= Math.abs(k - 0.5) * 2;
    return P;
  }

  function render(P, time, fx) {
    const L = P.light;
    if (L !== graded) {
      graded = L;
      for (const [c, dark, paper] of tints) c.copy(dark).lerp(paper, L);
      for (const m of lit) m.uniforms.uLight.value = L;
      renderer.setClearColor(fogNow, 1);
      sky.intensity = 0.55 + 0.75 * L;
      scene.environmentIntensity = 0.9 + 0.35 * L;
    }
    camera.position.set(P.px, P.py, P.pz);
    lookAt.set(P.lx, P.ly, P.lz);
    camera.fov = P.fov;
    // (setViewOffset derives the aspect from its full size, so it is given the real one)
    if (P.shift || P.lift) camera.setViewOffset(aspect, 1, -P.shift * aspect, P.lift, aspect, 1); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.lookAt(lookAt);

    const tu = terrainMat.uniforms;
    tu.uRelief.value = P.relief;
    tu.uFogK.value = P.fogK;
    tu.uFade.value = P.tFade;
    terrain.visible = P.tFade > 0.002;

    gate.visible = P.gateOn > 0.02;
    ring.update(P.rot);
    slabs.rotation.z = P.rot * 0.22;
    eyeMat.uniforms.uOpen.value = P.eyeOpen;
    eyeMat.uniforms.uHole.value = P.eyeHole;
    eyeMat.uniforms.uTurn.value = P.rot * 0.8;
    eye.visible = P.eyeOn > 0.02;

    haloMat.opacity = P.halo;
    halo.visible = P.halo > 0.002;
    halo.rotation.set(P.rot * 0.35, P.rot * 0.5, P.rot * 0.2);

    carousel.visible = P.cOp > 0.002;
    if (carousel.visible) {
      carousel.rotation.y = P.spin;
      carousel.position.y = HUB.y + P.hLift;
      lineMat.opacity = 0.5 * P.cOp;
      helixMat.opacity = (0.085 + 0.1 * L) * P.cOp;
      helixFill.opacity = 0.006 * P.cOp * (1 - L);            // the skin is additive light: there is none on paper
      for (let i = 0; i < count; i++) {
        const u = panels[i].uniforms;
        u.uOpacity.value = P.cOp;
        const dy = Math.abs(-i * HELIX.dY + P.hLift);
        u.uFocus.value = Math.pow(Math.max(0, Math.cos(i * HELIX.dAng + P.spin)), 5) * (1 - smooth(8, 24, dy));
      }
    }

    const pu = pointsMat.uniforms;
    pu.uStage.value = P.stage;
    pu.uStageB.value = P.stageB;
    pu.uBlend.value = P.blend;
    pu.uTime.value = time;
    pu.uPx.value = height / (2 * Math.tan((P.fov * Math.PI) / 360));
    pu.uSnow.value = P.snow;
    pu.uSpin.value = P.spin;
    pu.uLift.value = P.hLift;
    pu.uSweep.value = P.sweep;
    pu.uFigDim.value = Math.max(P.sharp * 0.97, P.poster);

    moonMat.opacity = P.moon;
    moon.visible = P.moon > 0.002;

    figMat.uniforms.uOpacity.value = P.sharp;
    figMat.uniforms.uPoster.value = P.poster;
    figure.visible = P.sharp > 0.002;
    dropMat.opacity = P.poster;
    drop.visible = P.poster > 0.002;

    const po = postMat.uniforms;
    po.uPoster.value = P.poster;
    po.uFlash.value = P.flash + (fx ? fx.flash || 0 : 0);
    po.uGlitch.value = Math.max(P.glitch, fx ? fx.glitch || 0 : 0);
    po.uTime.value = time;

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
    state.poster = P.poster;
    state.work = P.work;
    return state;
  }

  // one-call form, for anything that only wants the storyboard at t
  const scratch = newState();
  const update = (t, time, speed = 0, view = null) => render(sample(t, speed, view, scratch), time, view);

  // where the gate sits on screen (fractions of the frame), for instruments that track it
  const pv = new THREE.Vector3();
  function gateOnScreen(out) {
    pv.copy(GATE).project(camera);
    out.x = pv.x * 0.5 + 0.5; out.y = 0.5 - pv.y * 0.5; out.front = pv.z < 1;
    pv.set(GATE.x, GATE.y + 30.2, GATE.z).project(camera);
    out.r = Math.abs(0.5 - pv.y * 0.5 - out.y);                     // drafting-tick radius, fraction of frame height
    out.range = camera.position.distanceTo(GATE);
    out.open = eyeMat.uniforms.uOpen.value;
    return out;
  }

  // where the eclipse sits on screen: centre and limb radius in CSS pixels of the canvas
  function eclipseOnScreen(out) {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    pv.set(CORONA.x, CORONA.y, ECLIPSE_Z).project(camera);
    out.x = (pv.x * 0.5 + 0.5) * w; out.y = (0.5 - pv.y * 0.5) * h; out.front = pv.z < 1;
    pv.set(CORONA.x, CORONA.y + CORONA.z, ECLIPSE_Z).project(camera);
    out.r = Math.abs((0.5 - pv.y * 0.5) * h - out.y);
    out.on = moonMat.opacity;
    return out;
  }

  // the same for a framing that is not on screen: lets a page solve for the view that seats the eclipse where
  // it wants it. (It leaves the camera on that framing; the next render puts it back.)
  const probe = newState();
  function eclipseFor(t, view, out) {
    sample(t, 0, view, probe);
    camera.position.set(probe.px, probe.py, probe.pz);
    lookAt.set(probe.lx, probe.ly, probe.lz);
    camera.fov = probe.fov;
    if (probe.shift || probe.lift) camera.setViewOffset(aspect, 1, -probe.shift * aspect, probe.lift, aspect, 1); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    return eclipseOnScreen(out);
  }

  resize();

  // Warm-up. Compile every program and upload every buffer and texture ahead of need. Otherwise the
  // first frame of each chapter — and the frame a route change lands on — pays for it with a visible
  // hitch. It runs after the first frames are on screen (see world.js), in two steps that each fit
  // between frames: programs first (compiled off-thread where the driver allows), then one hidden render.
  let warmed = false;
  async function warm() {
    if (warmed) return;
    warmed = true;
    const all = [terrain, gate, eye, halo, figure, drop, carousel, moon];
    const wide = new THREE.PerspectiveCamera(60, aspect, 0.5, 1400);
    wide.position.set(0, 80, 420);
    wide.lookAt(0, 30, -160);
    wide.updateMatrixWorld();
    const everything = (fn) => {
      const was = all.map((o) => o.visible);
      all.forEach((o) => { o.visible = true; });
      try { return fn(); } finally { all.forEach((o, i) => { o.visible = was[i]; }); }
    };
    try { await everything(() => renderer.compileAsync(scene, wide)); } catch { /* the render below compiles instead */ }
    scene.traverse((o) => {
      const u = o.material && o.material.uniforms;
      if (u && u.map && u.map.value) renderer.initTexture(u.map.value);
    });
    everything(() => {
      renderer.setRenderTarget(target);
      renderer.render(scene, wide);
      renderer.setRenderTarget(null);
    });
  }

  return {
    update, sample, mix, render, newState, resize, warm, camera, gate: gateOnScreen, eclipse: eclipseOnScreen, eclipseFor,
    /** The grade pages get when they do not ask for one: 0 dark, 1 paper (world.js eases it when the theme changes). */
    set light(v) { ambient = v; },
    get light() { return ambient; },
    info: { particles: N, coverage: fig.coverage },
    dispose() {
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
    },
  };
}
