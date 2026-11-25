// The room she lives in: the room model of the 3D works (assets/models/ns-room/model.glb), made into a place.
//   furniture  meshes grouped by the names they were built with in Blender (SM_Bed_…, SM_Desk_…), so a click on
//              any part of the bed is a click on the bed
//   spots      where she stands, sits or lies for each activity, measured from the furniture itself, and the
//              point on the floor she walks to before she sits down or climbs on
//   floor      a 10 cm grid of where she can walk (the furniture, grown by her radius, is in the way) and an A*
//              search over it, straightened afterwards
//   light      the time of day: sun through the window, sky, the ceiling light and the desk lamp at night, the
//              colour of the window, the hands of the alarm clock — and the tint her unlit materials take
import * as THREE from 'three';

const GROUPS = {
  bed: /^(SM_Bed_|SM_Pillow|SM_Star_Cushion|PROP_Main_Plush)/,
  slippers: /^SM_Slippers/,
  bedside: /^SM_Bedside_/,
  shelf: /^(SM_Bookshelf_|SM_Book_|SM_Bookend|SM_Storage_Box|ENV_Plant|SM_Trinket)/,
  wardrobe: /^(SM_Wardrobe|PROP_Sakura_Charm)/,
  desk: /^(SM_Desk_|SM_Laptop_|SM_Notebook|SM_Pen|SM_Pencil|SM_Sketchpad|PROP_Photo_Frame|PROP_Badge)/,
  chair: /^SM_Chair_/,
  rug: /^SM_Pastel_Rug/,
  window: /^(SM_Window_|SM_Curtain_)/,
};
// which group a click lands on, for the menus (data/room.js `furniture`)
const MENU = { bed: 'bed', bedside: 'bed', desk: 'desk', chair: 'desk', shelf: 'shelf', wardrobe: 'wardrobe', rug: 'rug', window: 'window' };
// what she cannot walk through: every part of these lower than her chest, each by its own outline
const SOLID = ['bed', 'bedside', 'shelf', 'wardrobe', 'desk', 'chair'];
const CELL = 0.1, RADIUS = 0.22;

// the day: [hour, sky, ground, sky light, sun colour, sun light, image light, exposure, window, her tint]
const DAY = [
  [0, '#1b2350', '#0b0c14', 0.28, '#6f86c8', 0.0, 0.14, 0.95, '#0d1536', '#7c86b8'],
  [5, '#2a2f62', '#141420', 0.32, '#8a96d0', 0.05, 0.2, 0.95, '#3a3f78', '#9aa0c8'],
  [6.5, '#f6c2a4', '#5a4a50', 0.55, '#ffb98a', 0.9, 0.55, 1.0, '#f4b99a', '#f2d8cc'],
  [9, '#e4ecff', '#8a7f74', 0.9, '#fff1dc', 2.2, 0.95, 1.0, '#c4e4ff', '#ffffff'],
  [15, '#eef1ff', '#8a7f74', 0.9, '#fff0d6', 2.0, 0.9, 1.0, '#c8e6ff', '#ffffff'],
  [17.5, '#ffb48a', '#6a4a44', 0.62, '#ff9550', 1.7, 0.6, 1.0, '#ffa070', '#ffd9bf'],
  [19, '#5a4a8a', '#1c1824', 0.38, '#8a6aa8', 0.15, 0.3, 0.95, '#3c3478', '#a8a0cc'],
  [21, '#232a5c', '#0d0e16', 0.3, '#6f86c8', 0.0, 0.18, 0.95, '#141b44', '#8790c0'],
  [24, '#1b2350', '#0b0c14', 0.28, '#6f86c8', 0.0, 0.14, 0.95, '#0d1536', '#7c86b8'],
];
const C = (h) => new THREE.Color(h);
const DAYC = DAY.map(([h, a, b, k, s, sk, env, ex, win, tint]) => ({ h, sky: C(a), ground: C(b), k, sun: C(s), sk, env, ex, win: C(win), tint: C(tint) }));

export function createRoom(model, renderer) {
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) { meshes.push(o); o.matrixAutoUpdate = true; } });
  model.updateMatrixWorld(true);
  const group = (name) => meshes.filter((m) => GROUPS[name].test(m.name));
  const boxOf = (list) => list.reduce((b, m) => b.union(new THREE.Box3().setFromObject(m)), new THREE.Box3());
  const byName = (re) => meshes.filter((m) => re.test(m.name));
  const box = {};
  for (const g of Object.keys(GROUPS)) box[g] = boxOf(group(g));
  const floor = boxOf(byName(/^SM_Floor$/));
  const groupOfMesh = new Map();
  for (const g of Object.keys(GROUPS)) for (const m of group(g)) groupOfMesh.set(m, g);

  // ---------- spots ----------
  const seat = boxOf(byName(/^SM_Chair_Seat$/)), mattress = boxOf(byName(/^SM_Bed_Mattress$/)), blanket = boxOf(byName(/^SM_Bed_Blanket_Main$/));
  const pink = boxOf(byName(/^SM_Pillow_Pink$/)), win = boxOf(byName(/^SM_Window_Sill$/));
  const cx = (b) => (b.min.x + b.max.x) / 2, cz = (b) => (b.min.z + b.max.z) / 2;
  const bedTop = blanket.isEmpty() ? mattress.max.y : blanket.max.y;
  const deskDir = boxOf(byName(/^SM_Desk_Top$/)).getCenter(new THREE.Vector3()).sub(seat.getCenter(new THREE.Vector3()));
  // yaw: which way +Z of her body points (0 = +Z, π/2 = +X)
  const spots = {
    desk: { pos: [cx(seat), seat.max.y, cz(seat) + 0.02], yaw: Math.abs(deskDir.z) >= Math.abs(deskDir.x) ? (deskDir.z < 0 ? Math.PI : 0) : (deskDir.x < 0 ? -Math.PI / 2 : Math.PI / 2), approach: [seat.max.x + 0.36, cz(seat)], surface: 'chair' },
    bedSit: { pos: [cx(win) || -1.2, bedTop - 0.02, mattress.max.z - 0.14], yaw: 0, approach: [cx(win) || -1.2, mattress.max.z + 0.4], surface: 'bed' },
    bedLie: { pos: [mattress.max.x - 0.88, bedTop - 0.03, pink.isEmpty() ? cz(mattress) : cz(pink) - 0.05], yaw: -Math.PI / 2, approach: [cx(win) || -1.2, mattress.max.z + 0.4], surface: 'bed' },
    bedKneel: { pos: [cx(win) || -1.2, bedTop - 0.03, mattress.min.z + 0.5], yaw: Math.PI, approach: [cx(win) || -1.2, mattress.max.z + 0.4], surface: 'bed' },
    shelf: { pos: [box.shelf.min.x - 0.42, 0, cz(box.shelf)], yaw: Math.PI / 2 },
    wardrobe: { pos: [box.wardrobe.min.x - 0.45, 0, cz(box.wardrobe)], yaw: Math.PI / 2 },
    rug: { pos: [cx(box.rug), 0, cz(box.rug)], yaw: -Math.PI / 4 },
  };
  for (const s of Object.values(spots)) s.approach ||= [s.pos[0], s.pos[2]];

  // ---------- the floor grid ----------
  const x0 = floor.min.x + 0.12, z0 = floor.min.z + 0.12, nx = Math.floor((floor.max.x - 0.12 - x0) / CELL), nz = Math.floor((floor.max.z - 0.12 - z0) / CELL);
  const blocked = new Uint8Array(nx * nz);
  for (const g of SOLID) for (const m of group(g)) {
    const b = new THREE.Box3().setFromObject(m);
    if (b.min.y > 1.1) continue;                  // above her head height for walking into
    const i0 = Math.max(0, Math.floor((b.min.x - RADIUS - x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((b.max.x + RADIUS - x0) / CELL));
    const j0 = Math.max(0, Math.floor((b.min.z - RADIUS - z0) / CELL)), j1 = Math.min(nz - 1, Math.floor((b.max.z + RADIUS - z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * nx + i] = 1;
  }
  const cellOf = (x, z) => [Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / CELL))), Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / CELL)))];
  const centre = (i, j) => [x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL];
  const free = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !blocked[j * nx + i];
  function nearestFree(i, j) {
    if (free(i, j)) return [i, j];
    for (let r = 1; r < Math.max(nx, nz); r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) === r && free(i + di, j + dj)) return [i + di, j + dj];
    }
    return [i, j];
  }
  const clear = (a, b) => {                       // nothing in the way on the straight line between two points
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL * 0.5));
    for (let k = 1; k < n; k++) { const [i, j] = cellOf(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n); if (!free(i, j)) return false; }
    return true;
  };
  function path(from, to) {
    const [si, sj] = nearestFree(...cellOf(from[0], from[1])), [gi, gj] = nearestFree(...cellOf(to[0], to[1]));
    const start = sj * nx + si, goal = gj * nx + gi;
    const g = new Float32Array(nx * nz).fill(Infinity), came = new Int32Array(nx * nz).fill(-1), shut = new Uint8Array(nx * nz);
    const open = [start]; g[start] = 0;
    const h = (c) => Math.hypot((c % nx) - gi, Math.floor(c / nx) - gj);
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (g[open[k]] + h(open[k]) < g[open[bi]] + h(open[bi])) bi = k;
      const c = open.splice(bi, 1)[0];
      if (c === goal) break;
      shut[c] = 1;
      const ci = c % nx, cj = Math.floor(c / nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ci + di, j = cj + dj;
        if (!free(i, j) || (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj)))) continue;
        const n = j * nx + i;
        if (shut[n]) continue;
        const ng = g[c] + (di && dj ? 1.4142 : 1);
        if (ng < g[n]) { g[n] = ng; came[n] = c; if (!open.includes(n)) open.push(n); }
      }
    }
    const cells = [];
    for (let c = goal; c >= 0; c = came[c]) { cells.push(c); if (c === start) break; }
    if (cells.at(-1) !== start) return [to.slice()];
    const pts = cells.reverse().map((c) => centre(c % nx, Math.floor(c / nx)));
    pts[0] = from.slice(); pts[pts.length - 1] = free(...cellOf(to[0], to[1])) ? to.slice() : pts.at(-1);
    // straighten: skip every corner that can be seen past
    const out = [pts[0]];
    for (let k = 1; k < pts.length; k++) if (k === pts.length - 1 || !clear(out.at(-1), pts[k + 1])) out.push(pts[k]);
    return out.slice(1);
  }
  const walkable = (x, z) => free(...cellOf(x, z));
  const randomFloor = () => { for (let k = 0; k < 200; k++) { const i = Math.floor(Math.random() * nx), j = Math.floor(Math.random() * nz); if (free(i, j)) return centre(i, j); } return [cx(floor), cz(floor)]; };

  // ---------- things that change ----------
  const own = (m) => { m.material = m.material.clone(); return m.material; };
  const glass = byName(/^SM_Window_Glass/).map(own);
  const screen = byName(/^SM_Laptop_Screen$/).map(own);
  const bulb = byName(/^SM_Desk_Lamp_Bulb$/).map(own);
  const lampBox = boxOf(byName(/^SM_Desk_Lamp_Bulb$/));
  // the plush cat on the bed: gathered under one group so she can pick it up
  const plush = new THREE.Group();
  const plushMeshes = byName(/^PROP_Main_Plush_/);
  if (plushMeshes.length) {
    plush.position.copy(boxOf(plushMeshes).getCenter(new THREE.Vector3()));
    model.add(plush); plush.updateMatrixWorld(true);
    plushMeshes.forEach((m) => plush.attach(m));
  }
  const plushHome = { pos: plush.position.clone(), q: plush.quaternion.clone(), parent: model };
  // the alarm clock's hands turn round the hub
  const hub = boxOf(byName(/^SM_Bedside_Clock_Hub$/)).getCenter(new THREE.Vector3());
  const hands = ['Hour', 'Min', 'Sec'].map((n) => {
    const m = byName(new RegExp(`^SM_Bedside_Clock_Hand_${n}$`))[0];
    if (!m) return null;
    const pivot = new THREE.Group(); pivot.position.copy(hub); model.add(pivot); pivot.updateMatrixWorld(true); pivot.attach(m);
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).sub(hub);
    return { pivot, rest: Math.atan2(c.z, c.y) };          // the clock faces −X: 12 o'clock is +Y, 3 o'clock is +Z
  });

  // lights: sky, sun through the window, ceiling light, desk lamp
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const wc = win.isEmpty() ? new THREE.Vector3(-1.2, 1.4, 0) : win.getCenter(new THREE.Vector3());
  sun.position.set(wc.x - 0.6, wc.y + 3.2, wc.z - 3.5);
  sun.target.position.set(wc.x - 0.4, 0, wc.z + 2.2);
  const ceiling = new THREE.PointLight(0xffe6c8, 0, 9, 1.4);
  ceiling.position.set(cx(floor), 2.5, cz(floor));
  const lamp = new THREE.PointLight(0xffd29a, 0, 3.2, 1.6);
  lamp.position.copy(lampBox.isEmpty() ? new THREE.Vector3() : lampBox.getCenter(new THREE.Vector3()));
  const lights = new THREE.Group();
  lights.add(hemi, sun, sun.target, ceiling, lamp);
  // the sky outside the window: a plane behind the glass, coloured by the hour
  const glassBox = boxOf(byName(/^SM_Window_Glass/));
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x88aadd, toneMapped: false }));
  if (!glassBox.isEmpty()) {
    const c = glassBox.getCenter(new THREE.Vector3()), size = glassBox.getSize(new THREE.Vector3());
    sky.scale.set(size.x + 0.8, size.y + 0.8, 1);
    sky.position.set(c.x, c.y, glassBox.min.z - 0.35);          // the window is in the wall at z ≈ 0, the outside is −Z
    lights.add(sky);
  }

  const tint = new THREE.Color(), tmp = new THREE.Color(), tmp2 = new THREE.Color();
  // set the time of day; returns the colour her unlit materials should take
  function setTime(minute, { ceilingOn = false, lampOn = false, screenOn = false } = {}, scene) {
    const hr = ((minute / 60) % 24 + 24) % 24;
    let a = DAYC[0], b = DAYC[1];
    for (let k = 0; k < DAYC.length - 1; k++) if (hr >= DAYC[k].h && hr < DAYC[k + 1].h) { a = DAYC[k]; b = DAYC[k + 1]; break; }
    const t = (hr - a.h) / (b.h - a.h), e = t * t * (3 - 2 * t);
    hemi.color.lerpColors(a.sky, b.sky, e); hemi.groundColor.lerpColors(a.ground, b.ground, e);
    hemi.intensity = THREE.MathUtils.lerp(a.k, b.k, e) + (ceilingOn ? 0.35 : 0);
    sun.color.lerpColors(a.sun, b.sun, e); sun.intensity = THREE.MathUtils.lerp(a.sk, b.sk, e);
    if (scene) scene.environmentIntensity = THREE.MathUtils.lerp(a.env, b.env, e) + (ceilingOn ? 0.3 : 0);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(a.ex, b.ex, e);
    ceiling.intensity = ceilingOn ? 5.5 : 0;
    lamp.intensity = lampOn ? 2.2 : 0;
    tmp.lerpColors(a.win, b.win, e);
    for (const g of glass) { g.emissive?.copy(tmp); if (g.emissive) g.emissiveIntensity = 0.35; }
    sky.material.color.copy(tmp);
    for (const s of screen) { if (s.emissive) { s.emissive.set(screenOn ? 0xbfe0ff : 0x000000); s.emissiveIntensity = screenOn ? 0.9 : 0; } }
    for (const s of bulb) { if (s.emissive) { s.emissive.set(lampOn ? 0xffd29a : 0x000000); s.emissiveIntensity = lampOn ? 2 : 0; } }
    tint.lerpColors(a.tint, b.tint, e);
    if (ceilingOn) tint.lerp(tmp2.set(0xfff0e0), 0.75);
    else if (lampOn) tint.lerp(tmp2.set(0xffe2bc), 0.35);
    // the clock
    const h12 = hr % 12, mins = minute % 60;
    const set = (k, ang) => { if (hands[k]) hands[k].pivot.rotation.x = ang - hands[k].rest; };
    set(0, (h12 / 12) * Math.PI * 2); set(1, (mins / 60) * Math.PI * 2); set(2, ((minute * 60) % 60) / 60 * Math.PI * 2);
    return tint;
  }

  // the outline of a piece of furniture under the pointer
  const helper = new THREE.Box3Helper(new THREE.Box3(), 0xffc400);
  helper.visible = false;
  function hover(name) {
    const g = name && Object.entries(MENU).find(([k, v]) => v === name)?.[0];
    if (!g) { helper.visible = false; return; }
    const b = name === 'desk' ? box.desk.clone().union(box.chair) : name === 'bed' ? box.bed.clone().union(box.bedside) : box[g].clone();
    helper.box.copy(b.expandByScalar(0.03)); helper.visible = true;
  }

  return {
    model, meshes, box, spots, lights, helper, plush, plushHome, floor,
    centre: new THREE.Vector3(cx(floor), 0, cz(floor)),
    path, walkable, randomFloor, setTime, hover,
    menuOf: (mesh) => MENU[groupOfMesh.get(mesh)] || (mesh && /^SM_Floor$|^SM_Pastel_Rug$/.test(mesh.name) ? 'floor' : null),
    isFloor: (mesh) => !!mesh && /^SM_Floor$|^SM_Pastel_Rug$|^SM_Slippers/.test(mesh.name),
  };
}
