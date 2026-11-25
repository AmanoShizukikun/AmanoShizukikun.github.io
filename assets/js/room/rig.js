// Her body in the room: a skinned glTF character posed in code, without any animation file.
//
//   root  ─ where she is in the room and which way she faces (yaw)
//   └ pivot   ─ at her pelvis: lowered to sit, tipped over to lie down
//     └ offset  ─ undoes the pelvis position, so the model hangs from the pivot
//       └ model   (the glTF scene)
//
// Every pose (room/poses.js) is written in "body space": +Y up, +Z the way she faces, +X her left — as if she stood
// upright. A pose names, for a few bones, which way that bone should point ("aim", towards its child joint) and adds
// a few turns ("rot"); every other bone keeps its rest pose. Solving runs from the hips outwards, so an arm aimed
// down stays down whatever the spine above it did. Changing pose blends from what is on screen to the new one.
//
// The face is shape keys (blink, smile, visemes, ears…), driven by an expression, a blink timer and a talking flag.
// The materials are made shadeless (the colours of the textures, unlit) and tinted by the room's light.
import * as THREE from 'three';

// which joint each aimed bone points at
const CHILD = {
  clavicle_l: 'upperarm_l', clavicle_r: 'upperarm_r', upperarm_l: 'lowerarm_l', upperarm_r: 'lowerarm_r',
  lowerarm_l: 'hand_l', lowerarm_r: 'hand_r', hand_l: 'middle_01_l', hand_r: 'middle_01_r',
  thigh_l: 'calf_l', thigh_r: 'calf_r', calf_l: 'foot_l', calf_r: 'foot_r', foot_l: 'ball_l', foot_r: 'ball_r',
  spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'head',
};
// expressions → shape keys
const FACES = {
  calm: { V40_Smile: 0.12 },
  smile: { V40_Smile: 0.65 },
  joy: { V40_Joy: 0.75, Ear_Alert_L: 0.5, Ear_Alert_R: 0.5 },
  bliss: { V40_SmileClosed: 1, Ear_Relax_L: 0.8, Ear_Relax_R: 0.8 },
  focus: { V40_Smile: 0.08, V40_LookDown: 0.35, Ear_Forward_L: 0.5, Ear_Forward_R: 0.5 },
  sad: { V40_Sad: 0.7, Ear_Relax_L: 1, Ear_Relax_R: 1 },
  sleepy: { V40_Blink: 0.45, Ear_Relax_L: 0.6, Ear_Relax_R: 0.6 },
  sleep: { V40_Blink: 1, V40_SmileClosed: 0.25, Ear_Relax_L: 0.9, Ear_Relax_R: 0.9 },
  surprised: { V40_Surprised: 0.8, Ear_Alert_L: 1, Ear_Alert_R: 1 },
};
const VISEMES = ['V40_A', 'V40_I', 'V40_U', 'V40_E', 'V40_O'];

export function createRig(gltfScene) {
  const root = new THREE.Group(), pivot = new THREE.Group(), offset = new THREE.Group();
  root.add(pivot); pivot.add(offset); offset.add(gltfScene);
  root.updateMatrixWorld(true);

  // ---------- bones, in parent-before-child order, with their rest pose ----------
  const bones = [], byName = {};
  gltfScene.traverse((o) => { if (o.isBone && !byName[o.name]) { bones.push(o); byName[o.name] = o; } });
  const restL = new Map(), restWQ = new Map(), constQ = new Map();
  const offsetInv = new THREE.Quaternion();
  const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
  offsetInv.copy(wq(offset)).invert();
  for (const b of bones) {
    restL.set(b, b.quaternion.clone());
    restWQ.set(b, offsetInv.clone().multiply(wq(b)));
    if (!b.parent.isBone) constQ.set(b, offsetInv.clone().multiply(wq(b.parent)));
  }
  // direction of each aimed bone in its own frame (towards its child joint)
  const dirLocal = new Map();
  for (const [name, child] of Object.entries(CHILD)) if (byName[name] && byName[child]) dirLocal.set(byName[name], byName[child].position.clone().normalize());
  // where her pelvis is at rest, in body space: the pivot sits there
  const pelvis = byName.pelvis || bones[0];
  const restPelvis = offset.worldToLocal(pelvis.getWorldPosition(new THREE.Vector3()));
  pivot.position.copy(restPelvis);
  offset.position.copy(restPelvis).negate();
  // the model may face another way than +Z: turn it so it does (left = her left thigh minus her right)
  const tl = byName.thigh_l, tr = byName.thigh_r;
  if (tl && tr) {
    const left = offset.worldToLocal(tl.getWorldPosition(new THREE.Vector3())).sub(offset.worldToLocal(tr.getWorldPosition(new THREE.Vector3())));
    left.y = 0;
    const fwd = new THREE.Vector3().crossVectors(left.normalize(), new THREE.Vector3(0, 1, 0));
    const turn = Math.atan2(fwd.x, fwd.z);
    if (Math.abs(turn) > 0.01) {
      gltfScene.rotation.y = -turn;
      // turning the model turns every rest direction: measure again
      root.updateMatrixWorld(true);
      for (const b of bones) { restWQ.set(b, offsetInv.clone().multiply(wq(b))); if (!b.parent.isBone) constQ.set(b, offsetInv.clone().multiply(wq(b.parent))); }
      // the offset frame is the root frame at rest (pivot +pelvis, offset −pelvis), so this is the pelvis in body space
      restPelvis.copy(offset.worldToLocal(pelvis.getWorldPosition(new THREE.Vector3())));
      pivot.position.copy(restPelvis);
      offset.position.copy(restPelvis).negate();
    }
  }
  root.updateMatrixWorld(true);
  const restHeight = (() => { const b = new THREE.Box3().setFromObject(gltfScene); return b.max.y - b.min.y; })();
  // skirt bones (their direction round the hips decides how much they lift when she sits)
  const skirt = bones.filter((b) => /^skirt_\d+_01$/.test(b.name)).map((b) => {
    const p = offset.worldToLocal(b.getWorldPosition(new THREE.Vector3())).sub(restPelvis);
    return { b, front: Math.max(0, p.z / Math.hypot(p.x, p.z || 1e-6)), side: p.x / Math.hypot(p.x, p.z || 1e-6) };
  });

  // ---------- solving a pose ----------
  const L = new Map(bones.map((b) => [b, new THREE.Quaternion()])), W = new Map(bones.map((b) => [b, new THREE.Quaternion()]));
  const tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), ax = new THREE.Vector3();
  function solve(spec, out) {
    const aim = spec.aim || {}, rot = spec.rot || {};
    for (const b of bones) {
      const Wp = b.parent.isBone ? W.get(b.parent) : constQ.get(b);
      const l = out.get(b).copy(restL.get(b));
      const w = W.get(b).copy(Wp).multiply(l);
      const want = aim[b.name];
      if (want && dirLocal.has(b)) {
        tv.copy(dirLocal.get(b)).applyQuaternion(w);
        tv2.set(want[0], want[1], want[2]).normalize();
        tq.setFromUnitVectors(tv, tv2);
        w.premultiply(tq);
      }
      const r = rot[b.name];
      if (r) for (const [x, y, z, a] of (Array.isArray(r[0]) ? r : [r])) { tq.setFromAxisAngle(ax.set(x, y, z).normalize(), a); w.premultiply(tq); }
      if (want || r) l.copy(tq2.copy(Wp).invert().multiply(w));
    }
  }

  // ---------- poses and blending ----------
  let poseFn = () => ({}), poseT = 0, blendK = 1, blendDur = 0.4;
  const target = new Map(bones.map((b) => [b, new THREE.Quaternion()])), from = new Map(bones.map((b) => [b, new THREE.Quaternion()]));
  const pv = { pos: new THREE.Vector3().copy(restPelvis), q: new THREE.Quaternion() }, pvFrom = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
  function setPose(fn, blend = 0.45) {
    for (const b of bones) from.get(b).copy(b.quaternion);
    pvFrom.pos.copy(pivot.position); pvFrom.q.copy(pivot.quaternion);
    poseFn = fn; poseT = 0; blendK = blend > 0 ? 0 : 1; blendDur = blend;
  }

  // ---------- looking at something ----------
  let lookAt = null; const look = { yaw: 0, pitch: 0 };
  const head = byName.head, neck = byName.neck_01;

  // ---------- face ----------
  const morphs = new Map();
  gltfScene.traverse((o) => { if (o.isMesh && o.morphTargetDictionary) for (const [n, i] of Object.entries(o.morphTargetDictionary)) (morphs.get(n) || morphs.set(n, []).get(n)).push([o, i]); });
  const faceNow = new Map(), faceWant = new Map();
  let expression = 'calm', talking = 0, blinkT = 2 + Math.random() * 3, blinkK = 0, vis = 0, visT = 0, earT = 4;
  const setMorph = (n, v) => { for (const [o, i] of morphs.get(n) || []) o.morphTargetInfluences[i] = v; };

  // ---------- shadeless materials, tinted by the room ----------
  const flats = [];
  gltfScene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;                   // a posed skinned mesh moves out of its rest bounding sphere
    const conv = (m) => {
      const f = new THREE.MeshBasicMaterial({
        map: m.map || null, color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1), alphaMap: m.alphaMap || null,
        transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite, toneMapped: false,
      });
      flats.push({ m: f, base: f.color.clone() });
      m.dispose();
      return f;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
  function setTint(c) { for (const f of flats) f.m.color.copy(f.base).multiply(c); }

  // ---------- each frame ----------
  function update(dt, t) {
    poseT += dt;
    const spec = { ...(poseFn(poseT, t) || {}) };            // a copy: the additions below must not stick to the pose
    // look: turn the head (and a little of the neck) towards a point, within what a neck can do
    if (lookAt && head && !spec.noLook) {
      const hp = head.getWorldPosition(tv);
      const d = tv2.copy(lookAt).sub(hp);
      root.worldToLocal(d.add(root.getWorldPosition(new THREE.Vector3())));
      const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -1.0, 1.0), pitch = THREE.MathUtils.clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.45, 0.5);
      look.yaw += (yaw - look.yaw) * Math.min(1, dt * 5); look.pitch += (pitch - look.pitch) * Math.min(1, dt * 5);
    } else { look.yaw *= Math.max(0, 1 - dt * 4); look.pitch *= Math.max(0, 1 - dt * 4); }
    if (Math.abs(look.yaw) + Math.abs(look.pitch) > 0.002) {
      spec.rot = { ...(spec.rot || {}) };
      const add = (name, k) => { const r = spec.rot[name]; const list = r ? (Array.isArray(r[0]) ? [...r] : [r]) : []; list.push([0, 1, 0, look.yaw * k], [1, 0, 0, look.pitch * k]); spec.rot[name] = list; };
      add('neck_01', 0.35); add('head', 0.65);
    }
    // skirt: lifts over the thighs as they come forward
    if (spec.skirt) {
      spec.rot = { ...(spec.rot || {}) };
      for (const s of skirt) spec.rot[s.b.name] = [[1, 0, 0, -spec.skirt * (0.25 + 0.85 * s.front)], [0, 0, 1, spec.skirt * 0.25 * s.side]];
    }
    solve(spec, target);
    // pivot: pelvis height / offset / tilt
    const p = spec.pivot || {};
    tv.set(restPelvis.x + (p.x || 0), (p.y != null ? p.y : restPelvis.y) + (p.dy || 0), restPelvis.z + (p.z || 0));
    tq.identity();
    if (p.tilt) for (const [x, y, z, a] of (Array.isArray(p.tilt[0]) ? p.tilt : [p.tilt])) tq.premultiply(tq2.setFromAxisAngle(ax.set(x, y, z).normalize(), a));
    if (blendK < 1) {
      blendK = Math.min(1, blendK + dt / blendDur);
      const k = blendK * blendK * (3 - 2 * blendK);
      for (const b of bones) b.quaternion.slerpQuaternions(from.get(b), target.get(b), k);
      pivot.position.lerpVectors(pvFrom.pos, tv, k);
      pivot.quaternion.slerpQuaternions(pvFrom.q, tq, k);
    } else {
      for (const b of bones) b.quaternion.copy(target.get(b));
      pivot.position.copy(tv); pivot.quaternion.copy(tq);
    }

    // face
    faceWant.clear();
    for (const [n, v] of Object.entries(FACES[spec.face || expression] || {})) faceWant.set(n, v);
    blinkT -= dt;
    if (blinkT <= 0) { blinkK = 1; blinkT = 2.5 + Math.random() * 4; }
    blinkK = Math.max(0, blinkK - dt * 7);
    const blink = Math.sin(Math.min(1, blinkK) * Math.PI);
    faceWant.set('V40_Blink', Math.max(faceWant.get('V40_Blink') || 0, blink));
    if (talking > 0) {
      talking -= dt; visT -= dt;
      if (visT <= 0) { vis = (vis + 1 + Math.floor(Math.random() * 3)) % VISEMES.length; visT = 0.09 + Math.random() * 0.08; }
      faceWant.set(VISEMES[vis], 0.55);
    }
    earT -= dt;
    if (earT <= 0) { earT = 3 + Math.random() * 6; faceNow.set('Ear_Alert_L', 1); }   // a twitch of one ear
    for (const n of new Set([...faceNow.keys(), ...faceWant.keys()])) {
      const want = faceWant.get(n) || 0, now = faceNow.get(n) || 0;
      const k = n === 'V40_Blink' ? 1 : Math.min(1, dt * (VISEMES.includes(n) ? 18 : 6));
      const v = now + (want - now) * k;
      if (Math.abs(v) < 0.001 && !want) { faceNow.delete(n); setMorph(n, 0); } else { faceNow.set(n, v); setMorph(n, v); }
    }
  }

  // a ray against her body: the segments head–pelvis–each foot, each with a radius (cheaper than skinned meshes)
  const seg = (ray, a, b, r) => {
    const u = tv.copy(b).sub(a), w0 = tv2.copy(a).sub(ray.origin);          // closest points of the segment a→b and the ray
    const aa = u.dot(u), bb = u.dot(ray.direction), cc = ray.direction.dot(ray.direction), dd = u.dot(w0), ee = ray.direction.dot(w0);
    const den = aa * cc - bb * bb;
    let s = den > 1e-9 ? (bb * ee - cc * dd) / den : 0, t = den > 1e-9 ? (aa * ee - bb * dd) / den : ee / cc;
    s = THREE.MathUtils.clamp(s, 0, 1); if (t < 0) return Infinity;
    const p = a.clone().addScaledVector(u, s), q = ray.origin.clone().addScaledVector(ray.direction, t);
    return p.distanceTo(q) < r ? t : Infinity;
  };
  function hit(ray) {
    const P = (n) => (byName[n] ? byName[n].getWorldPosition(new THREE.Vector3()) : null);
    const hp = P('head'), pp = P('pelvis'), fl = P('foot_l'), fr = P('foot_r');
    if (!hp || !pp) return Infinity;
    return Math.min(seg(ray, pp, hp, 0.24), fl ? seg(ray, pp, fl, 0.14) : Infinity, fr ? seg(ray, pp, fr, 0.14) : Infinity);
  }

  return {
    root, pivot, bones: byName, restPelvis, height: restHeight,
    setPose, update, setTint, hit,
    get poseTime() { return poseT; },
    set look(v) { lookAt = v; },
    set expression(v) { expression = FACES[v] ? v : 'calm'; },
    talk(seconds = 2.5) { talking = Math.max(talking, seconds); },
    worldOf(name, out = new THREE.Vector3()) { return byName[name] ? byName[name].getWorldPosition(out) : out.copy(root.position); },
    dispose() { gltfScene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); }); } }); },
  };
}
