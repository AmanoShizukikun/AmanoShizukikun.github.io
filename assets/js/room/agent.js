// Sakura herself: turns what room/life.js decides into what she does in the room (room/room.js) with her body
// (room/rig.js, room/poses.js). Each decision becomes a small plan of steps:
//   walk   to a point on the floor, along the room's path            face   turn to a direction
//   grab   reach for something (a book from the shelf)                enter  sit down / climb onto the bed
//   do     the activity itself, for as long as life.js says           exit   get up again, back onto the floor
// The visitor can ask for an activity (it joins the queue and she finishes or leaves what she is doing) or turn to
// her directly (wave, pat, talk): she stops, faces the camera and answers, then carries on.
import * as THREE from 'three';
import { poses } from './poses.js';

const WALK = 1.05;            // m/s at 1×
const STRIDE = 1.1;           // metres per full walking cycle (two steps)
const TURN = 7;               // rad/s

export function createAgent({ rig, room, life, data, scene, say, note }) {
  const { activities, interactions, lines } = data;
  const pos = new THREE.Vector3(), seatPos = new THREE.Vector3();
  let yaw = 0, plan = [], step = null, doing = null, walked = 0, sayIn = 6, interact = null, mood = null, surface = null, byYou = false;
  let camera = null;
  const start = room.randomFloor();
  pos.set(start[0], 0, start[1]);
  scene.add(rig.root);
  rig.setPose(poses.stand, 0);

  // ---------- a soft shadow under her ----------
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(0,0,0,0.42)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 1;
  scene.add(shadow);

  // ---------- the book she reads (made here: the shelf's books are part of the shelf) ----------
  const book = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.23, 0.028), new THREE.MeshBasicMaterial({ color: 0xe48fb2, toneMapped: false }));
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.03), new THREE.MeshBasicMaterial({ color: 0xfbf6ec, toneMapped: false }));
  pages.position.x = 0.006;
  book.add(cover, pages); book.visible = false;
  scene.add(book);

  const place = () => {
    rig.root.position.copy(pos);
    rig.root.rotation.y = yaw;
  };
  place();
  const turnTo = (target, dt) => {
    let d = ((target - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const s = Math.sign(d) * Math.min(Math.abs(d), TURN * dt);
    yaw += s;
    return Math.abs(d) < 0.04;
  };
  const yawToCamera = () => (camera ? Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z) : yaw);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // ---------- plans ----------
  function planFor(id) {
    const a = activities[id], out = [];
    if (!a) return out;
    if (a.fetch === 'shelf') { const s = room.spots.shelf; out.push({ type: 'walk', to: s.approach }, { type: 'face', yaw: s.yaw }, { type: 'grab', secs: 1.3 }); }
    const sp = a.spot ? room.spots[a.spot] : null;
    if (sp) {
      out.push({ type: 'walk', to: sp.approach });
      if (sp.surface) out.push({ type: 'enter', spot: sp, id });
      else out.push({ type: 'face', yaw: sp.yaw });
    }
    out.push({ type: 'do', id, seated: !!sp?.surface });
    if (sp?.surface) out.push({ type: 'exit', spot: sp });
    return out;
  }
  function walkTo(x, z) { plan = [{ type: 'walk', to: [x, z] }, { type: 'face', yaw: null }, { type: 'do', id: 'idle', seated: false }]; step = null; }

  // whatever she is doing, wind it down so that the next thing in the queue can start
  function interrupt() {
    if (!step) { plan = []; return; }
    if (step.type === 'do') { step.stop = true; plan = plan.filter((s) => s.type === 'exit').slice(0, 1); }
    else if (step.type === 'enter') { plan = plan.filter((s) => s.type === 'do' || s.type === 'exit').slice(0, 2); if (plan[0]) plan[0].stop = true; }
    else if (step.type !== 'exit') { plan = []; step = null; book.visible = false; rig.setPose(poses.stand, 0.35); }
    else plan = [];
  }

  // ---------- the visitor turns to her ----------
  // the pose that belongs to the step she is in (to go back to after a visit)
  const walkPose = () => poses.walk(0, 0, (walked / STRIDE) * Math.PI * 2);
  function poseOf(s) {
    if (!s) return poses.stand;
    if (s.type === 'walk') return walkPose;
    if (s.type === 'grab') return poses.tidy;
    if (s.type === 'do') return poses[activities[s.id].pose] || poses.stand;
    return poses.stand;
  }
  function meet(kind) {
    const it = interactions[kind];
    if (!it) return;
    if (step?.type === 'do' && (step.id === 'sleep' || step.id === 'nap')) { wake(); return; }
    if (it.queue) { life.queue.clear(); life.queue.push(it.queue, 'you'); interrupt(); say(pick(it.lines)); return; }
    const seated = step?.type === 'do' && step.seated;
    interact = { kind, t: 0, secs: 3.8 + Math.min(4, it.minutes / 4), seated, prevPose: null };
    if (!seated && step?.type !== 'enter' && step?.type !== 'exit') rig.setPose(poses[it.pose], 0.35);
    rig.expression = it.face;
    rig.look = camera ? camera.position : null;
    life.boost(it.gains, it.minutes);
    say(pick(it.lines), 3.2);
    note(`${it.zh}：${{ wave: '她開心地揮了揮手。', pat: '她瞇起眼睛，耳朵垂了下來。', talk: '她跟你聊了一會兒。' }[kind] || ''}`);
  }
  function wake() {
    if (!(step?.type === 'do' && (step.id === 'sleep' || step.id === 'nap'))) return;
    step.stop = true; plan = plan.filter((s) => s.type === 'exit').slice(0, 1);
    life.stayAwake(90);
    say(pick(['唔……主人？', '欸……天亮了嗎……']), 2.6);
    note('你叫醒了她。');
  }

  // ---------- each frame ----------
  function update(dt, minutes, mul) {
    const seated = (step?.type === 'do' && step.seated) || step?.type === 'enter';
    life.tick(minutes, step?.type === 'do' ? step.id : step?.type === 'walk' ? 'walk' : 'stand', seated);
    mood = life.mood();

    // a visit from the visitor holds everything else for a few seconds
    if (interact) {
      interact.t += dt;
      if (!interact.seated && step?.type !== 'enter' && step?.type !== 'exit') turnTo(yawToCamera(), dt);
      if (interact.t >= interact.secs) {
        if (!interact.seated) rig.setPose(poseOf(step), 0.45);
        rig.expression = step?.type === 'do' ? activities[step.id].face || 'calm' : 'calm';
        rig.look = null;
        interact = null;
      } else { place(); rig.update(dt, 0); follow(); return; }
    }

    if (!step) {
      if (!plan.length) {
        const q = life.queue.shift();
        const id = q ? q.id : life.choose();
        byYou = !!q;
        if (q?.walk) walkTo(q.walk[0], q.walk[1]); else plan = planFor(id);
        if (q && !q.walk) note(`你請她${activities[id].zh}。`);
      }
      step = plan.shift() || { type: 'do', id: 'idle', seated: false };
      step.t = 0;
      begin(step);
    }
    step.t += dt;

    switch (step.type) {
      case 'walk': {
        let left = WALK * mul * dt;
        while (left > 0 && step.path.length) {
          const [tx, tz] = step.path[0], dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
          if (d < 1e-3) { step.path.shift(); continue; }
          const go = Math.min(d, left);
          pos.x += (dx / d) * go; pos.z += (dz / d) * go; left -= go; walked += go;
          turnTo(Math.atan2(dx, dz), dt);
          if (go >= d) step.path.shift();
        }
        if (!step.path.length) next();
        break;
      }
      case 'face': {
        const target = step.yaw == null ? yawToCamera() : step.yaw;
        if (turnTo(target, dt * mul) || step.t > 2) next();
        break;
      }
      case 'grab':
        if (step.t > step.secs * 0.6) book.visible = true;
        if (step.t >= step.secs / Math.max(1, mul * 0.8)) { rig.setPose(poses.stand, 0.3); next(); }
        break;
      case 'enter': case 'exit': {
        const k = Math.min(1, step.t / (step.type === 'enter' ? 0.9 : 0.75) * Math.max(1, mul * 0.7)), e = k * k * (3 - 2 * k);
        pos.lerpVectors(step.from, step.to, e);
        yaw = step.yawFrom + angle(step.yawFrom, step.yawTo) * e;
        if (k >= 1) next();
        break;
      }
      case 'do': {
        step.minutes += minutes;
        const a = activities[step.id];
        if (step.stop || life.shouldStop(step.id, step.minutes)) {
          if (step.id !== 'idle') life.done(step.id);
          if (step.id === 'sleep' && !step.stop) say(pick(lines.wake), 3);
          finishDo();
          next();
          break;
        }
        // she speaks now and then, about what she does or how she feels
        sayIn -= dt;
        if (sayIn <= 0) {
          sayIn = 11 + Math.random() * 12;
          if (Math.random() < 0.45) {
            const low = mood.low, worry = life.state.needs[low] < 28 && step.id === 'idle' ? { energy: lines.tired, fun: lines.bored, social: lines.lonely }[low] : null;
            say(pick(worry || a.lines), 2.8);
          }
        }
        if (step.id === 'idle') {
          if (Math.random() < dt * 0.15) rig.look = rig.look ? null : camera?.position || null;
          if (step.minutes > a.max * 0.5 && Math.random() < dt * 0.25) { const p = room.randomFloor(); plan = [{ type: 'walk', to: p }, { type: 'face', yaw: null }]; step = null; return update(0, 0, mul); }
        }
        break;
      }
    }
    place();
    rig.update(dt, walked);
    follow();
  }
  const angle = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  function next() { step = null; }

  function begin(s) {
    if (s.type === 'walk') {
      s.path = room.path([pos.x, pos.z], s.to);
      if (s.path.length) rig.setPose(walkPose, 0.25);
    } else if (s.type === 'face' || s.type === 'grab') {
      rig.setPose(s.type === 'grab' ? poses.tidy : poses.stand, 0.35);
      rig.look = s.type === 'face' && s.yaw == null ? camera?.position || null : null;
    } else if (s.type === 'enter') {
      const sp = s.spot, a = activities[s.id];
      s.from = pos.clone(); s.to = seatPos.set(sp.pos[0], sp.pos[1], sp.pos[2]).clone();
      s.yawFrom = yaw; s.yawTo = sp.yaw;
      rig.setPose(poses[a.pose], 0.85);
      rig.look = null;
      surface = sp.surface;
    } else if (s.type === 'exit') {
      s.from = pos.clone(); s.to = new THREE.Vector3(s.spot.approach[0], 0, s.spot.approach[1]);
      s.yawFrom = yaw; s.yawTo = yaw;
      rig.setPose(poses.stand, 0.7);
      surface = null;
    } else if (s.type === 'do') {
      const a = activities[s.id];
      s.minutes = 0;
      if (!s.seated) rig.setPose(poses[a.pose] || poses.stand, 0.45);
      rig.expression = a.face || 'calm';
      if (a.prop === 'plush' && room.plush.children.length) { scene.attach(room.plush); s.plush = true; }
      if (a.prop === 'book') book.visible = true;
      if (a.log) note(a.log);
      sayIn = 2 + Math.random() * 4;
      if (s.id !== 'idle' && Math.random() < 0.5) say(pick(a.lines), 2.6);
      doing = s.id;
    }
  }
  function finishDo() {
    if (step.plush) {
      room.plushHome.parent.attach(room.plush);
      room.plush.position.copy(room.plushHome.pos); room.plush.quaternion.copy(room.plushHome.q);
    }
    book.visible = false;
    rig.expression = 'calm';
    doing = null;
  }

  // props and shadow follow her body
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), fwd = new THREE.Vector3();
  function follow() {
    const lying = step?.type === 'do' && activities[step.id]?.pose === 'lie';
    const pel = rig.worldOf('pelvis', tv);
    shadow.position.set(pel.x, (surface === 'bed' ? pos.y : 0) + 0.006, pel.z);
    shadow.scale.set(lying ? 0.6 : 0.62, lying ? 1.7 : 0.62, 1);
    shadow.rotation.z = lying ? yaw : 0;
    fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    if (book.visible) {
      const l = rig.worldOf('hand_l', tv), r = rig.worldOf('hand_r', tv2);
      book.position.addVectors(l, r).multiplyScalar(0.5).addScaledVector(fwd, 0.03);
      const head = rig.worldOf('head', new THREE.Vector3());
      book.lookAt(head);
    }
    if (step?.plush) {
      const chest = rig.worldOf('spine_03', tv);
      room.plush.position.copy(chest).addScaledVector(fwd, 0.17).add(tv2.set(0, -0.06, 0));
      room.plush.rotation.set(0, yaw, 0);
    }
  }

  let lastLabel = '想一想要做什麼';
  const label = () => (lastLabel = labelNow() || lastLabel);
  const labelNow = () => {
    if (interact) return { wave: '正在跟你打招呼', pat: '正在被你摸頭', talk: '正在跟你聊天' }[interact.kind];
    if (!step) return plan.length ? null : '想一想要做什麼';
    if (step.type === 'enter') return { lie: '躺到床上', kneel: '爬上床', sit: '坐下' }[activities[step.id]?.pose] || '坐下';
    if (step.type === 'walk') { const d = plan.find((s) => s.type === 'do'); return d && d.id !== 'idle' ? `正要去${activities[d.id].zh}` : '在房間裡走走'; }
    if (step.type === 'grab') return '正在挑書';
    if (step.type === 'do') return step.id === 'idle' ? '正在發呆' : `正在${activities[step.id].zh}`;
    if (step.type === 'exit') return '起身';
    return '準備中';
  };

  return {
    update, interrupt, meet, wake, walkTo,
    set camera(c) { camera = c; },
    get label() { return label(); },
    get doing() { return step?.type === 'do' ? step.id : null; },
    get byYou() { return byYou; },
    get debug() { return { step: step && { type: step.type, id: step.id, t: +step.t?.toFixed(2), path: step.path?.length }, plan: plan.map((x) => x.type + (x.id ? ':' + x.id : '')), interact: interact?.kind }; },
    get sleeping() { return step?.type === 'do' && (step.id === 'sleep' || step.id === 'nap'); },
    get mood() { return mood || life.mood(); },
    get position() { return pos; },
    head: (out) => rig.worldOf('head', out),
    dispose() { shadow.geometry.dispose(); shadow.material.dispose(); shadowTex.dispose(); book.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); },
  };
}
