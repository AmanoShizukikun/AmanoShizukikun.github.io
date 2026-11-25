// 長門櫻的日常 (/apps/ns-room/): she lives in her room, and the visitor can watch, ask and talk.
// Markup: src/pages/room.mjs · data: data/room.js · the simulation: room/life.js (needs, clock, choices),
// room/agent.js (carrying them out), room/rig.js + room/poses.js (her body), room/room.js (the room).
// This file builds the scene, loads the two models (the room and her, both from the 3D works), runs the clock,
// and joins the interface to it: menus on furniture and on her, the queue, the needs, the diary, the camera.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { store } from '../core/store.js';
import * as data from '../data/room.js';
import { createRoom } from '../room/room.js';
import { createRig } from '../room/rig.js';
import { createLife } from '../room/life.js';
import { createAgent } from '../room/agent.js';

const FILES = { room: '/assets/models/ns-room/model.glb', sakura: '/assets/models/nagato-sakura/model.glb' };
const SPEEDS = [0, 1, 4, 12];           // game minutes per real second
const MOVE = [0, 1, 1.5, 2.1];          // how much faster she walks at each speed
const KEY = 'nxRoom';
const esc = (s) => String(s).replace(/[<&>"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]));

export async function mount(main) {
  const el = main.querySelector('.rm');
  if (!el) return null;
  const $ = (k) => el.querySelector(`[data-rm="${k}"]`);
  const stage = $('stage'), canvas = $('canvas'), menu = $('menu'), bubble = $('bubble'), mark = $('mark');
  const off = [];
  const on = (t, type, fn, opt) => { t.addEventListener(type, fn, opt); off.push(() => t.removeEventListener(type, fn, opt)); };
  const current = () => el.isConnected && main.id === 'view';
  const fail = (msg) => { $('load').classList.add('is-error'); $('msg').textContent = msg; };
  const gl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  if (!gl2) { fail('這個瀏覽器無法顯示 3D（需要 WebGL 2）。'); return () => off.forEach((f) => f()); }
  el.classList.add('rm--ui');

  // ---------- scene ----------
  const hi = (() => { const q = store.get('nxQuality'); return q === 'high' || (q === 'auto' && !matchMedia('(pointer: coarse)').matches); })();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const paintBg = () => { scene.background = new THREE.Color(store.get('theme') === 'light' ? 0xdedcd4 : 0x0b0c0e); };
  paintBg();
  off.push(store.on('theme', paintBg));
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.minDistance = 2.6; controls.maxDistance = 12;
  controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.3;
  controls.minAzimuthAngle = -1.5; controls.maxAzimuthAngle = -0.08;     // only from the open corner of the room
  controls.screenSpacePanning = false;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, hi ? 1.75 : 1.25, Math.sqrt((hi ? 4.5e6 : 2.2e6) / (w * h))));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a narrow screen steps back so the whole room stays in view
    camera.fov = 32 + Math.max(0, 1.1 - camera.aspect) * 22;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage); off.push(() => ro.disconnect());
  resize();

  // ---------- load ----------
  const got = { room: 0, sakura: 0 }, total = { room: 0, sakura: 0 };
  const showLoad = () => {
    const a = got.room + got.sakura, b = total.room + total.sakura;
    $('bar').style.width = b ? `${Math.min(100, (a / b) * 100).toFixed(1)}%` : '10%';
    $('bytes').textContent = b ? `${(a / 1048576).toFixed(1)} / ${(b / 1048576).toFixed(1)} MB` : '';
  };
  const load = (k) => new Promise((ok, no) => new GLTFLoader().load(FILES[k], ok, (e) => { got[k] = e.loaded; total[k] = e.total || total[k]; showLoad(); }, no));
  let roomG, sakuraG;
  try { [roomG, sakuraG] = await Promise.all([load('room'), load('sakura')]); }
  catch (e) { console.error('[room] could not load', e); fail('模型載入失敗。請檢查網路後重新整理。'); return () => { off.forEach((f) => f()); renderer.dispose(); }; }
  if (!current()) { renderer.dispose(); return null; }

  const room = createRoom(roomG.scene, renderer);
  scene.add(room.model, room.lights, room.helper);
  const rig = createRig(sakuraG.scene);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* private mode */ }
  const life = createLife(data, saved);

  // ---------- speech bubble, diary ----------
  let bubbleT = 0;
  function say(text, secs = 2.8) {
    if (!text) return;
    bubble.textContent = text;
    bubble.hidden = false;
    bubble.classList.remove('is-in'); void bubble.offsetWidth; bubble.classList.add('is-in');
    bubbleT = secs + text.length * 0.06;
    rig.talk(Math.min(3, 0.5 + text.length * 0.12));
  }
  const logEl = $('log');
  function note(text) {
    const n = life.note(text);
    logEl.insertAdjacentHTML('afterbegin', `<li><time>${n.t}</time>${esc(text)}</li>`);
    while (logEl.children.length > 6) logEl.lastElementChild.remove();
  }
  for (const n of life.state.log.slice(-6)) logEl.insertAdjacentHTML('afterbegin', `<li><time>${n.t}</time>${esc(n.text)}</li>`);

  const agent = createAgent({ rig, room, life, data, scene, say, note });
  agent.camera = camera;

  // ---------- camera ----------
  const home = () => {
    controls.target.copy(room.centre).add(new THREE.Vector3(0, 0.55, 0));
    camera.position.copy(controls.target).add(new THREE.Vector3(-0.62, 0.5, 0.62).normalize().multiplyScalar(camera.aspect < 0.8 ? 10.5 : 8.2));
    controls.update();
  };
  home();
  let follow = false;
  const followBtn = el.querySelector('[data-act="follow"]');
  const setFollow = (v) => { follow = v; followBtn.setAttribute('aria-pressed', String(v)); };
  const clampTarget = () => {
    const b = room.floor;
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, b.min.x, b.max.x);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, b.min.z, b.max.z);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.2, 1.6);
  };
  on(controls, 'change', clampTarget);
  on(controls, 'start', () => { if (follow && controls.getState?.() === 2) setFollow(false); });

  // ---------- time ----------
  let speed = 1;
  try { speed = Math.max(0, Math.min(3, +(localStorage.getItem('nxRoomSpeed') ?? 1))); } catch { /* private mode */ }
  const speedBtns = [...el.querySelectorAll('[data-speed]')];
  const setSpeed = (v) => {
    speed = v;
    speedBtns.forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.speed === v)));
    try { localStorage.setItem('nxRoomSpeed', String(v)); } catch { /* private mode */ }
  };
  setSpeed(speed);
  speedBtns.forEach((b) => on(b, 'click', () => setSpeed(+b.dataset.speed)));

  // ---------- the interface ----------
  const needEls = Object.fromEntries([...el.querySelectorAll('[data-need]')].map((n) => [n.dataset.need, { bar: n.querySelector('b'), num: n.querySelector('em') }]));
  const queueEl = $('queue');
  let queueKey = '';
  const moodColor = (v) => (v > 62 ? '#7fd38a' : v > 40 ? '#ffc400' : '#ff6a4a');
  function hud() {
    const s = life.state, m = agent.mood;
    for (const [k, v] of Object.entries(s.needs)) {
      const e = needEls[k];
      if (!e) continue;
      e.bar.style.width = `${v.toFixed(1)}%`;
      e.bar.style.background = moodColor(v);
      e.num.textContent = Math.round(v);
    }
    const h = Math.floor(life.hour), mm = Math.floor(s.minute % 60);
    $('time').textContent = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('day').textContent = `DAY ${s.day} · ${life.daypart()}`;
    $('doing').textContent = agent.label;
    $('mood').textContent = m.word;
    $('dot').style.background = moodColor(m.value);
    mark.style.setProperty('--c', moodColor(m.value));
    const q = life.queue.list(), key = q.map((x) => x.id + (x.walk || '')).join(',');
    if (key !== queueKey) {
      queueKey = key;
      queueEl.innerHTML = q.map((x, k) => `<li><span>${esc(x.walk ? '走過去' : data.activities[x.id]?.zh || x.id)}</span><button type="button" data-drop="${k}" aria-label="取消：${esc(x.walk ? '走過去' : data.activities[x.id]?.zh || x.id)}">×</button></li>`).join('');
    }
  }
  on(queueEl, 'click', (e) => { const b = e.target.closest('[data-drop]'); if (b) { life.queue.drop(+b.dataset.drop); hud(); } });

  // ---------- menus: on furniture, on her, on the floor ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const aim = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const herT = rig.hit(ray.ray);
    const hit = ray.intersectObjects(room.meshes, false)[0];
    // she wins over the furniture right around her (a chair back, the bed she lies on)
    if (herT < (hit ? hit.distance + 0.6 : Infinity)) return { her: true };
    if (!hit) return null;
    const what = room.menuOf(hit.object);
    return what ? { what, point: hit.point } : null;
  };
  let menuFor = null;
  function closeMenu() { menu.hidden = true; menuFor = null; }
  function openMenu(e, target) {
    menuFor = target;
    const items = [];
    if (target.her) {
      if (agent.sleeping) items.push(['wake', '叫醒她'], ['close', '讓她繼續睡']);
      else items.push(['wave', data.interactions.wave.zh], ['pat', data.interactions.pat.zh], ['talk', data.interactions.talk.zh], ['rest', data.interactions.rest.zh]);
      menu.innerHTML = `<p>長門櫻</p>${items.map(([k, t]) => `<button type="button" role="menuitem" data-meet="${k}">${esc(t)}</button>`).join('')}`;
    } else if (target.what === 'floor') {
      menu.innerHTML = `<p>地板</p><button type="button" role="menuitem" data-walk="1">走到這裡</button>`;
    } else {
      const f = data.furniture[target.what];
      menu.innerHTML = `<p>${esc(f.zh)}</p>${f.actions.map((a) => `<button type="button" role="menuitem" data-act-id="${a}">${esc(data.activities[a].zh)}</button>`).join('')}`;
    }
    menu.hidden = false;
    const r = stage.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = `${Math.max(8, Math.min(r.width - mw - 8, e.clientX - r.left + 10))}px`;
    menu.style.top = `${Math.max(8, Math.min(r.height - mh - 8, e.clientY - r.top + 10))}px`;
    menu.querySelector('button')?.focus({ preventScroll: true });
  }
  function ask(id, extra) {
    if (!agent.byYou || !life.queue.list().length) agent.interrupt();
    life.queue.push(id, 'you', extra);
    hud();
  }
  on(menu, 'click', (e) => {
    const b = e.target.closest('button');
    if (!b || !menuFor) return;
    if (b.dataset.meet) {
      const k = b.dataset.meet;
      if (k === 'wake') agent.wake(); else if (k !== 'close') agent.meet(k);
    } else if (b.dataset.walk) ask('idle', { walk: [menuFor.point.x, menuFor.point.z] });
    else if (b.dataset.actId) ask(b.dataset.actId);
    closeMenu(); hud();
  });
  on(menu, 'keydown', (e) => {
    const list = [...menu.querySelectorAll('button')], i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') { closeMenu(); canvas.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus(); }
  });
  let down = null, lastHover = 0;
  on(canvas, 'pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  on(canvas, 'pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 500 || e.button !== 0) { down = null; return; }
    down = null;
    const t = aim(e);
    if (t) openMenu(e, t); else closeMenu();
  });
  on(canvas, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons || performance.now() - lastHover < 60) return;
    lastHover = performance.now();
    const t = aim(e);
    room.hover(t && !t.her && t.what !== 'floor' ? t.what : null);
    canvas.style.cursor = t && (t.her || t.what !== 'floor') ? 'pointer' : '';
  });
  on(canvas, 'pointerleave', () => room.hover(null));
  on(document, 'pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== canvas) closeMenu(); });

  // ---------- buttons and keys ----------
  const help = $('help'), helpBtn = el.querySelector('[data-act="help"]');
  const showHelp = (v) => { help.hidden = !v; helpBtn.setAttribute('aria-expanded', String(v)); if (v) help.querySelector('button')?.focus(); };
  on(el, 'click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'follow') setFollow(!follow);
    else if (b.dataset.act === 'view') { setFollow(false); home(); }
    else if (b.dataset.act === 'help') showHelp(help.hidden);
    else if (b.dataset.act === 'help-close') { showHelp(false); try { localStorage.setItem('nxRoomHelp', '1'); } catch { /* private */ } canvas.focus(); }
  });
  on(window, 'keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === ' ' && (e.target === canvas || e.target === document.body)) { e.preventDefault(); setSpeed(speed ? 0 : 1); }
    else if (/^[1-3]$/.test(e.key)) setSpeed(+e.key);
    else if (e.key.toLowerCase() === 'f' && e.target === canvas) setFollow(!follow);
    else if (e.key.toLowerCase() === 'r' && e.target === canvas) { setFollow(false); home(); }
    else if (e.key === 'Escape' && !help.hidden) showHelp(false);
  });

  // ---------- each frame ----------
  let raf = 0, last = performance.now(), hudT = 0, saveT = 0;
  const head = new THREE.Vector3(), scr = new THREE.Vector3();
  const place = (node, worldPos, lift) => {
    scr.copy(worldPos).add(new THREE.Vector3(0, lift, 0)).project(camera);
    const vis = scr.z < 1 && Math.abs(scr.x) < 1.2 && Math.abs(scr.y) < 1.2;
    node.style.transform = `translate(${((scr.x + 1) / 2) * stage.clientWidth}px, ${((1 - scr.y) / 2) * stage.clientHeight}px)`;
    return vis;
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!document.hidden) step(dt);
  }
  function step(dt) {
    if (speed > 0) agent.update(dt, dt * SPEEDS[speed], MOVE[speed]);
    const hr = life.hour;
    const tint = room.setTime(life.state.minute, {
      ceilingOn: !agent.sleeping && (hr >= 18.3 || hr < 6.3),
      lampOn: (agent.doing === 'laptop' || agent.doing === 'study') && (hr >= 17.3 || hr < 7.2),
      screenOn: agent.doing === 'laptop',
    }, scene);
    rig.setTint(tint);
    if (follow) {
      const p = agent.position;
      controls.target.lerp(new THREE.Vector3(p.x, 0.75, p.z), Math.min(1, dt * 3));
    }
    controls.update();
    renderer.render(scene, camera);
    agent.head(head);
    mark.hidden = !place(mark, head, 0.42);
    if (bubbleT > 0) { bubbleT -= dt; const v = place(bubble, head, 0.3); bubble.hidden = !v || bubbleT <= 0; }
    hudT -= dt; if (hudT <= 0) { hudT = 0.25; hud(); }
    saveT -= dt; if (saveT <= 0) { saveT = 15; save(); }
  }
  const save = () => { try { localStorage.setItem(KEY, life.save()); } catch { /* private mode */ } };
  on(window, 'pagehide', save);

  $('hud').hidden = false;
  $('load').classList.add('is-done');
  let firstVisit = true;
  try { firstVisit = !localStorage.getItem('nxRoomHelp'); } catch { /* private mode */ }
  if (firstVisit) showHelp(true);
  setTimeout(() => say(data.lines.welcome[Math.floor(Math.random() * data.lines.welcome.length)], 3), 700);
  if (!saved) note('你推開了她房間的門。');
  hud();
  raf = requestAnimationFrame(frame);
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.nsroom = { life, agent, rig, room, camera, controls, setSpeed, data, step };

  return () => {
    cancelAnimationFrame(raf);
    save();
    off.forEach((f) => f());
    controls.dispose();
    agent.dispose(); rig.dispose();
    scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach((m) => { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); }); } });
    scene.environment?.dispose(); pmrem.dispose();
    renderer.dispose(); renderer.forceContextLoss();
    if (window.nsroom?.life === life) delete window.nsroom;
  };
}
