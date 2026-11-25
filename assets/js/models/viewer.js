// The model viewer of the 3D works pages (assets/js/pages/model.js drives it). One glTF binary, lit and framed:
//   light    an image-based room light (RoomEnvironment) plus a key and a rim light, in three presets
//   frame    the camera fits the model's bounding box from a three-quarter view, or takes `view.camera`
//   modes    shadeless (the colours of the textures, no light at all: how an anime character is meant to look, and
//            what characters open in) · material (as authored, lit) · clay · wireframe · normals
//   ground   a shadow catcher under the model, nothing else: the background is the page's own (CSS)
// It only draws when something moves: the camera easing out, a slow spin, an animation, a shape key being dragged.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const LIGHTS = {
  //        image light, exposure, key colour / strength / direction,       rim colour / strength / direction
  studio: { env: 1.0, exposure: 1.0, key: [0xfff3e2, 2.2, [0.9, 1.6, 1.3]], rim: [0xc4d6ff, 1.3, [-1.3, 1.1, -1.5]] },
  dusk: { env: 0.5, exposure: 1.05, key: [0xffa66e, 2.8, [1.7, 0.7, 1.0]], rim: [0x8f7dff, 1.6, [-1.6, 1.0, -1.1]] },
  night: { env: 0.2, exposure: 1.15, key: [0x9db6ff, 1.7, [-0.9, 2.0, 1.2]], rim: [0xffc480, 1.0, [1.4, 0.5, -1.3]] },
};

export function createViewer(canvas, { kind = 'other', view = {}, hi = true, onSpin = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  const camera = new THREE.PerspectiveCamera(kind === 'character' ? 30 : 36, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotateSpeed = 1.2;
  controls.listenToKeyEvents(canvas);

  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0004;
  const rim = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(key, key.target, rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.32 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let model = null, mixer = null, clips = [], playing = null, raf = 0, last = 0, idle = 0, alive = true;
  let mode = view.mode || (kind === 'character' ? 'flat' : 'material'), light = view.light || 'studio', spin = view.spin !== false;
  const box = new THREE.Box3(), center = new THREE.Vector3(), size = new THREE.Vector3();
  let radius = 1, focus = null;
  const originals = new Map();                     // mesh → its own material(s), while another mode is shown
  const morphs = new Map();                        // shape key name → [[mesh, index]]

  // ---------- drawing ----------
  const render = () => renderer.render(scene, camera);
  function tick(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    if (focus) {                                   // easing the pivot to a double-clicked point
      focus.k = Math.min(1, focus.k + dt * 4);
      const e = 1 - (1 - focus.k) ** 3;
      controls.target.lerpVectors(focus.from, focus.to, e);
      camera.position.lerpVectors(focus.camFrom, focus.camTo, e);
      if (focus.k >= 1) focus = null;
    }
    const moved = controls.update(dt);
    if (mixer && playing) mixer.update(dt);
    render();
    const busy = moved || focus || (mixer && playing) || controls.autoRotate;
    idle = busy ? 0 : idle + 1;
    if (idle < 3) ask();
  }
  const ask = () => { if (!raf && alive) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  controls.addEventListener('change', ask);
  controls.addEventListener('start', () => { if (controls.autoRotate) setSpin(false); focus = null; });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const cap = Math.min(devicePixelRatio || 1, hi ? 2 : 1.25);
    renderer.setPixelRatio(Math.min(cap, Math.sqrt((hi ? 6e6 : 2.6e6) / (w * h))));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ask();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ---------- light ----------
  function setLight(name) {
    light = LIGHTS[name] ? name : 'studio';
    const L = LIGHTS[light];
    scene.environmentIntensity = L.env;
    renderer.toneMappingExposure = L.exposure;
    const place = (lamp, [c, k, d]) => {
      lamp.color.set(c); lamp.intensity = k;
      lamp.position.copy(center).add(new THREE.Vector3(...d).normalize().multiplyScalar(radius * 3));
      lamp.target.position.copy(center);
      lamp.target.updateMatrixWorld();
    };
    place(key, L.key); place(rim, L.rim);
    const cam = key.shadow.camera;
    cam.left = cam.bottom = -radius * 1.4; cam.right = cam.top = radius * 1.4;
    cam.near = radius * 0.5; cam.far = radius * 6;
    cam.updateProjectionMatrix();
    ask();
    return light;
  }

  // ---------- framing ----------
  // the distance at which every corner of the box fits the frame, looking along `dir` at `target`
  function fit(dir, target, fov) {
    const f = dir.clone().normalize(), r = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f).normalize(), u = new THREE.Vector3().crossVectors(f, r);
    const tv = Math.tan(THREE.MathUtils.degToRad(fov) / 2), th = tv * Math.max(0.45, camera.aspect);
    let d = 0;
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(target);
      const cf = c.dot(f);
      d = Math.max(d, cf + Math.abs(c.dot(u)) / tv, cf + Math.abs(c.dot(r)) / th);
    }
    return d * 1.06;
  }
  // Where the camera rests for the current shape of the frame. `view.camera` is kept as written on a frame at least
  // as wide as 16:9; a narrower one (a phone, a tablet held upright) steps back along the same line until it shows
  // as much across as 16:9 would — but never further than it takes to fit the whole model.
  function homeView() {
    if (view.camera) {
      const pos = new THREE.Vector3().fromArray(view.camera.position), target = new THREE.Vector3().fromArray(view.camera.target);
      const fov = view.camera.fov || camera.fov, dir = pos.clone().sub(target);
      let d = dir.length();
      if (camera.aspect < 16 / 9) d = Math.min(d * (16 / 9) / camera.aspect, Math.max(d, fit(dir, target, fov)));
      return { pos: target.clone().add(dir.normalize().multiplyScalar(d)), target, fov };
    }
    const dir = kind === 'character' ? new THREE.Vector3(0.22, 0.06, 1) : new THREE.Vector3(0.75, 0.55, 1);
    const target = center.clone();
    return { pos: target.clone().add(dir.clone().normalize().multiplyScalar(fit(dir, target, camera.fov))), target, fov: camera.fov };
  }
  function frame() {
    const h = homeView();
    camera.fov = h.fov;
    camera.position.copy(h.pos);
    controls.target.copy(h.target);
    camera.near = radius / 200; camera.far = radius * 60;
    camera.updateProjectionMatrix();
    controls.minDistance = radius * 0.12;
    controls.maxDistance = radius * 8;
    controls.update();
    ask();
  }
  function reset() {
    if (!model) return;
    const h = homeView();
    if (h.fov !== camera.fov) { camera.fov = h.fov; camera.updateProjectionMatrix(); }
    focus = { k: 0, from: controls.target.clone(), to: h.target, camFrom: camera.position.clone(), camTo: h.pos };
    ask();
  }
  // double click: turn round the point that was clicked
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    if (!model) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(model, true)[0];
    if (!hit) return;
    const shift = hit.point.clone().sub(controls.target);
    focus = { k: 0, from: controls.target.clone(), to: hit.point.clone(), camFrom: camera.position.clone(), camTo: camera.position.clone().add(shift) };
    ask();
  }
  canvas.addEventListener('dblclick', pick);

  // ---------- modes ----------
  const clay = new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: 0.82, metalness: 0 });
  // half transparent, so a dense mesh still shows where its triangles crowd and where they thin out
  const wire = new THREE.MeshBasicMaterial({ color: 0xffc400, wireframe: true, transparent: true, opacity: 0.5, depthWrite: false });
  const normal = new THREE.MeshNormalMaterial();
  // shadeless: each material's own colour and texture, unlit and untouched by tone mapping
  const flats = new Map();
  const flatOf = (m) => {
    if (!flats.has(m)) {
      flats.set(m, new THREE.MeshBasicMaterial({
        map: m.map || null, color: m.color ? m.color.clone() : new THREE.Color(0xffffff), alphaMap: m.alphaMap || null,
        transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite,
        vertexColors: m.vertexColors, toneMapped: false,
      }));
    }
    return flats.get(m);
  };
  function setMode(name) {
    mode = name;
    model?.traverse((o) => {
      if (!o.isMesh) return;
      if (!originals.has(o)) originals.set(o, o.material);
      const own = originals.get(o);
      const stand = { clay, wire, normal }[name];
      o.material = name === 'flat' ? (Array.isArray(own) ? own.map(flatOf) : flatOf(own))
        : stand ? (Array.isArray(own) ? own.map(() => stand) : stand) : own;
      o.castShadow = name !== 'wire';
    });
    ground.visible = name !== 'wire' && view.ground !== false;
    ask();
  }
  function setWireColor(c) { wire.color.set(c); ask(); }

  function setSpin(v) { spin = !!v; controls.autoRotate = spin; onSpin(spin); ask(); }

  // ---------- loading ----------
  async function load(url, onProgress) {
    const gltf = await new Promise((ok, fail) => new GLTFLoader().load(url, ok, (e) => onProgress?.(e.loaded, e.total), fail));
    if (!alive) return null;
    model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.morphTargetDictionary) for (const [name, i] of Object.entries(o.morphTargetDictionary)) (morphs.get(name) || morphs.set(name, []).get(name)).push([o, i]);
      }
      if (o.isLight || o.isCamera) o.visible = false;
    });
    scene.add(model);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    box.getCenter(center); box.getSize(size);
    radius = Math.max(1e-3, size.length() / 2);
    ground.scale.setScalar(radius * 8);
    ground.position.set(center.x, box.min.y - radius * 0.002, center.z);
    ground.visible = view.ground !== false;
    clips = gltf.animations || [];
    if (clips.length) mixer = new THREE.AnimationMixer(model);
    resize();
    setLight(light);
    frame();
    setSpin(spin);
    setMode(mode);
    render();
    // corrective keys (CORR_…) follow the skeleton; they are not for posing by hand, so the page does not list them
    return { morphs: [...morphs.keys()].filter((n) => !/^CORR_/i.test(n)), clips: clips.map((c) => ({ name: c.name, duration: c.duration })) };
  }

  function setMorph(name, v) { for (const [o, i] of morphs.get(name) || []) o.morphTargetInfluences[i] = v; ask(); }
  function play(i) {
    if (!mixer) return null;
    mixer.stopAllAction();
    if (i == null || i === playing?.i) { playing = null; ask(); return null; }
    mixer.clipAction(clips[i]).reset().play();
    playing = { i };
    ask();
    return i;
  }

  // ---------- the cover picture (preview server only) ----------
  // `paint(ctx, w, h)` draws the background the page shows behind the canvas, so the picture carries it too
  async function capture(paint, w = 1600, h = 1000) {
    const keep = { w: canvas.clientWidth, h: canvas.clientHeight, ratio: renderer.getPixelRatio() };
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    render();
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    paint(ctx, w, h);
    ctx.drawImage(canvas, 0, 0, w, h);
    renderer.setPixelRatio(keep.ratio);
    renderer.setSize(keep.w, keep.h, false);
    camera.aspect = keep.w / keep.h; camera.updateProjectionMatrix();
    render();
    return new Promise((ok) => out.toBlob(ok, 'image/webp', 0.9));
  }
  const round = (v) => v.toArray().map((x) => +x.toFixed(3));
  const cameraJSON = () => ({ position: round(camera.position), target: round(controls.target), fov: +camera.fov.toFixed(1) });
  // put the camera somewhere ({ position, target, fov }, the shape cameraJSON gives and `view.camera` takes)
  function setCamera(v) {
    camera.position.fromArray(v.position);
    controls.target.fromArray(v.target);
    if (v.fov) { camera.fov = v.fov; camera.updateProjectionMatrix(); }
    controls.update();
    ask();
  }
  // orbit to look from a direction ([x, y, z], pointing from the model to the camera), keeping the distance
  function lookFrom(dir) {
    const d = camera.position.distanceTo(controls.target);
    camera.position.copy(controls.target).add(new THREE.Vector3(...dir).normalize().multiplyScalar(d));
    controls.update();
    ask();
  }

  function dispose() {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('dblclick', pick);
    controls.dispose();
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      for (const m of [].concat(originals.get(o) || o.material || [])) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        for (const v of Object.values(m)) if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); }
        m.dispose();
      }
    });
    [clay, wire, normal, ...flats.values()].forEach((m) => m.dispose());
    scene.environment?.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return {
    load, setMode, setLight, setSpin, setMorph, play, reset, resize, capture, cameraJSON, setCamera, lookFrom, dispose, setWireColor,
    get mode() { return mode; }, get light() { return light; }, get spin() { return spin; }, redraw: ask,
    get scene() { return scene; },          // for the console of the preview server
  };
}
