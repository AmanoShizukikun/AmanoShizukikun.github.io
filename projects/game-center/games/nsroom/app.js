/**
 * app.js
 * Interactive 3D Web Tour for Nagato Sakura's Room (長門櫻的房間)
 * Powered by Three.js, OrbitControls, GLTFLoader, and Tween.js
 */

// --- 1. Scene, Camera, Renderer Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0edf2);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// --- Inverted Hull Outline System (MiSide Anime Style) ---
// Each mesh gets a BackSide expanded clone. Color is derived from the
// surface material's own color — darkened dramatically — so red cloth
// gets dark wine outlines, blue gets deep navy, wood gets chocolate brown.
// This matches MiSide's characteristic "deep tinted outline" look.

// Shared GLSL shader strings (reused across per-mesh material instances)
const _OUTLINE_VS = /* glsl */`
  uniform float outlineThickness;
  void main() {
    vec4 mvPos  = modelViewMatrix * vec4(position, 1.0);
    vec3 mvNorm = normalize(normalMatrix * normal);
    mvPos.xyz  += mvNorm * outlineThickness;
    gl_Position = projectionMatrix * mvPos;
  }
`;
const _OUTLINE_FS = /* glsl */`
  uniform vec3 outlineColor;
  void main() {
    gl_FragColor = vec4(outlineColor, 1.0);
  }
`;
const OUTLINE_THICKNESS = 0.0028;

// Derive a MiSide-style outline color from the surface material.
// Logic: keep the hue, boost saturation slightly, crush lightness to ~8–22%.
// For white/near-white materials (texture-driven), fall back to warm dark brown.
function getDerivedOutlineColor(mat) {
  if (!mat || !mat.color) return new THREE.Color(0x251a14);

  const hsl = {};
  mat.color.getHSL(hsl);

  // White or very pale color = texture-only material, use warm dark fallback
  if (hsl.l > 0.82) {
    return new THREE.Color(0x251a14); // warm dark brown
  }

  // Keep hue characteristic, richly saturate, crush brightness
  const newL = hsl.l * 0.18 + 0.04;   // maps 0–1 → roughly 0.04–0.22
  const newS = Math.min(1, hsl.s * 1.4 + 0.15); // push saturation
  return new THREE.Color().setHSL(hsl.h, newS, newL);
}

// Create a ShaderMaterial instance for one mesh's outline
function makeOutlineMaterial(mat) {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor:     { value: getDerivedOutlineColor(mat) },
      outlineThickness: { value: OUTLINE_THICKNESS }
    },
    vertexShader:   _OUTLINE_VS,
    fragmentShader: _OUTLINE_FS,
    side: THREE.BackSide
  });
}

let outlineEnabled = false;
const outlineMeshList = []; // tracks every outline child mesh

// Build outline meshes after GLB is loaded.
// Adds a per-mesh BackSide clone as a child of each source Mesh.
function buildOutlineMeshes(root) {
  outlineMeshList.length = 0;
  root.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    if (child.userData.isOutline) return;

    // Skip highly transparent materials (curtains/glass look wrong with inverted hull)
    const mat = Array.isArray(child.material) ? child.material[0] : child.material;
    if (mat && mat.transparent && mat.opacity < 0.5) return;

    // Ensure geometry has normals (needed for the expand direction)
    if (!child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    const outlineMesh = new THREE.Mesh(child.geometry, makeOutlineMaterial(mat));
    outlineMesh.visible = false;
    outlineMesh.castShadow = false;
    outlineMesh.receiveShadow = false;
    outlineMesh.userData.isOutline = true;
    child.add(outlineMesh); // inherits all parent transforms automatically
    outlineMeshList.push(outlineMesh);
  });
}

function setOutlineVisible(visible) {
  outlineMeshList.forEach(m => { m.visible = visible; });
}

// Environment Reflection Texture for metallic shine (applied selectively to metals, not whole scene)
let envTexture = null;
if (typeof THREE.RoomEnvironment !== 'undefined') {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomEnv = new THREE.RoomEnvironment();
  envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
  // NOTE: Do NOT set scene.environment = envTexture! That washes out the whole room with white IBL.
}

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.01; // Don't flip below floor
controls.minDistance = 1.0;
controls.maxDistance = 22.0;

// --- 2. Lighting Setup ---
// Gentle warm ambient base
const ambientLight = new THREE.AmbientLight(0xfff2ea, 0.35);
scene.add(ambientLight);

// Hemisphere light for soft sky/ground bounce (prevents harsh dark corners without washing out surfaces)
const hemiLight = new THREE.HemisphereLight(0xfff6ee, 0xdfd3c5, 0.22);
scene.add(hemiLight);

// Main Sun streaming through the window
const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.15);
sunLight.position.set(-1.5, 5.0, -4.5);
sunLight.target.position.set(-1.2, 0.5, 1.8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 25;
sunLight.shadow.camera.left = -5;
sunLight.shadow.camera.right = 5;
sunLight.shadow.camera.top = 5;
sunLight.shadow.camera.bottom = -5;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);
scene.add(sunLight.target);

// Soft indoor fill light placed high in room center
const roomFillLight = new THREE.PointLight(0xffecd2, 0.35, 12, 1.8);
roomFillLight.position.set(-2.0, 2.3, 2.0);
scene.add(roomFillLight);

// Desk lamp accent (for night mode or evening vibe)
const deskLampLight = new THREE.PointLight(0xffb86c, 0, 3, 2);
deskLampLight.position.set(-3.0, 1.1, 0.35);
scene.add(deskLampLight);

// --- 3. Camera Presets (Position & Orbit Target) ---
const CAMERA_PRESETS = {
  iso: {
    name: "全景原畫",
    pos: new THREE.Vector3(-8.8, 6.2, 8.8),
    target: new THREE.Vector3(-2.2, 1.0, 2.2),
    fov: 42
  },
  charm: {
    name: "櫻花吊飾",
    pos: new THREE.Vector3(-1.30, 0.95, 3.35),
    target: new THREE.Vector3(-0.655, 0.88, 3.61),
    fov: 38
  },
  bed: {
    name: "櫻花大床",
    pos: new THREE.Vector3(-2.6, 1.65, 2.3),
    target: new THREE.Vector3(-0.85, 0.65, 0.90),
    fov: 40
  },
  desk: {
    name: "書桌工作區",
    pos: new THREE.Vector3(-2.35, 1.55, 1.9),
    target: new THREE.Vector3(-3.00, 0.95, 0.35),
    fov: 40
  },
  bookshelf: {
    name: "書架收藏",
    pos: new THREE.Vector3(-1.95, 1.45, 2.5),
    target: new THREE.Vector3(-0.30, 1.15, 2.55),
    fov: 40
  },
  window: {
    name: "窗台晨景",
    pos: new THREE.Vector3(-1.20, 1.65, 2.2),
    target: new THREE.Vector3(-1.20, 1.62, -0.05),
    fov: 42
  }
};

// Initial camera position
camera.position.copy(CAMERA_PRESETS.iso.pos);
controls.target.copy(CAMERA_PRESETS.iso.target);

// Camera smooth fly function
let isCameraMoving = false;
function flyToCamera(presetKey, duration = 1400) {
  const preset = CAMERA_PRESETS[presetKey];
  if (!preset) return;

  isCameraMoving = true;
  controls.enabled = false;

  new TWEEN.Tween(camera.position)
    .to(preset.pos, duration)
    .easing(TWEEN.Easing.Cubic.InOut)
    .start();

  new TWEEN.Tween(controls.target)
    .to(preset.target, duration)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => controls.update())
    .onComplete(() => {
      controls.enabled = true;
      isCameraMoving = false;
    })
    .start();

  if (preset.fov && camera.fov !== preset.fov) {
    new TWEEN.Tween(camera)
      .to({ fov: preset.fov }, duration)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => camera.updateProjectionMatrix())
      .start();
  }

  // Update button state
  document.querySelectorAll('#views-group .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === presetKey);
  });
}

// --- 4. Interactive Hotspots ---
const HOTSPOTS_DATA = [
  {
    id: "hotspot-charm",
    worldPos: new THREE.Vector3(-0.66, 0.88, 3.61),
    title: "和風五瓣櫻花吊飾",
    badge: "匠心細節",
    desc: "懸掛於衣櫃把手上的立體櫻花飾品，由 5 瓣帶有微凹缺口特徵的立體花瓣、中央金色花蕊、金屬隔珠與 18 條縱向細緻絲線的垂順流蘇（Fusa）精製而成。",
    viewKey: "charm"
  },
  {
    id: "hotspot-bed",
    worldPos: new THREE.Vector3(-0.85, 0.65, 0.90),
    title: "櫻花花瓣雙人被褥",
    badge: "舒適臥眠",
    desc: "繪有淡粉櫻花花瓣與水彩藍櫻漸層的柔軟純棉被褥，搭配同系列櫻花枕頭、星形抱枕以及可愛的長門櫻白貓玩偶。",
    viewKey: "bed"
  },
  {
    id: "hotspot-desk",
    worldPos: new THREE.Vector3(-3.00, 1.05, 0.35),
    title: "創作用書桌與筆電",
    badge: "靈感空間",
    desc: "淺橡木工作桌上配備了輕薄筆記型電腦、銀色檯燈、手帳本與文具杯；牆面展示著長門櫻的高畫質角色立繪海報與櫻花捲軸畫。",
    viewKey: "desk"
  },
  {
    id: "hotspot-bookshelf",
    worldPos: new THREE.Vector3(-0.28, 1.45, 2.55),
    title: "收藏書架與常春藤盆栽",
    badge: "少女日常",
    desc: "五層開放式書架收納著輕小說、藝術設定集、相框與分類文件盒，頂部放置著向下垂掛綠意盎然的常春藤白瓷盆栽。",
    viewKey: "bookshelf"
  },
  {
    id: "hotspot-rug",
    worldPos: new THREE.Vector3(-1.80, 0.08, 2.65),
    title: "手繪櫻花水彩地毯",
    badge: "和風軟裝",
    desc: "鋪設在橫向日系淺橡木地板上的短絨印花地毯，宛如微風吹落的櫻花飄散在純白畫布上，襯托出明亮溫馨的房間格調。",
    viewKey: "iso"
  },
  {
    id: "hotspot-window",
    worldPos: new THREE.Vector3(-1.20, 1.62, -0.05),
    title: "窗台晨景與春櫻",
    badge: "治癒窗景",
    desc: "雙層淺橡木窗框旁懸掛著天空藍窗簾與白紗簾，透過玻璃能欣賞到春日晴朗藍天與微風中搖曳的粉嫩櫻花樹梢，是房間採光與晨讀的最佳角落。",
    viewKey: "window"
  }
];

const hotspotsLayer = document.getElementById('hotspots-layer');
const hotspotElements = [];

function createHotspots() {
  hotspotsLayer.innerHTML = '';
  HOTSPOTS_DATA.forEach(data => {
    const pin = document.createElement('div');
    pin.className = 'hotspot-pin';
    pin.id = data.id;
    pin.innerHTML = `
      <div class="pin-pulse"></div>
      <div class="pin-core">📍</div>
      <div class="pin-label">${data.title}</div>
    `;

    pin.addEventListener('click', () => {
      openHotspotModal(data);
      flyToCamera(data.viewKey);
    });

    hotspotsLayer.appendChild(pin);
    hotspotElements.push({ element: pin, data: data });
  });
}

function updateHotspots() {
  const tempV = new THREE.Vector3();
  const widthHalf = window.innerWidth / 2;
  const heightHalf = window.innerHeight / 2;

  hotspotElements.forEach(item => {
    // Don't update pins that haven't entered yet
    if (!item.element.classList.contains('entered')) return;

    tempV.copy(item.data.worldPos);
    tempV.project(camera);

    // Check if hotspot is in front of camera
    if (tempV.z < 1.0) {
      const x = (tempV.x * widthHalf) + widthHalf;
      const y = -(tempV.y * heightHalf) + heightHalf;
      item.element.style.left = `${x}px`;
      item.element.style.top = `${y}px`;
      item.element.style.visibility = 'visible';
      item.element.style.pointerEvents = 'auto';
    } else {
      item.element.style.visibility = 'hidden';
      item.element.style.pointerEvents = 'none';
    }
  });
}

// Modal logic
const modal = document.getElementById('hotspot-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalBadge = document.getElementById('modal-badge');
const modalFocusBtn = document.getElementById('modal-focus-btn');
const modalClose = document.getElementById('modal-close');

let currentActiveHotspot = null;

function openHotspotModal(data) {
  currentActiveHotspot = data;
  modalTitle.textContent = data.title;
  modalDesc.textContent = data.desc;
  modalBadge.textContent = data.badge;
  modal.classList.remove('hidden');
}

modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modalFocusBtn.addEventListener('click', () => {
  if (currentActiveHotspot) {
    flyToCamera(currentActiveHotspot.viewKey);
    modal.classList.add('hidden');
  }
});

// Help modal logic
const helpModal = document.getElementById('help-modal');
const btnHelp = document.getElementById('btn-help');
const helpClose = document.getElementById('help-close');
const helpConfirmBtn = document.getElementById('help-confirm-btn');

btnHelp.addEventListener('click', () => helpModal.classList.remove('hidden'));
helpClose.addEventListener('click', () => helpModal.classList.add('hidden'));
helpConfirmBtn.addEventListener('click', () => helpModal.classList.add('hidden'));

// --- 5. Lighting / Time of Day Switcher ---
const ATMOSPHERES = {
  morning: {
    bg: 0xf2eef4,
    ambientColor: 0xfff2ea,
    ambientIntensity: 0.35,
    hemiSky: 0xfff6ee,
    hemiGround: 0xdfd3c5,
    hemiIntensity: 0.22,
    sunColor: 0xfff5e6,
    sunIntensity: 1.15,
    sunPos: new THREE.Vector3(-1.5, 5.0, -4.5),
    fillColor: 0xffecd2,
    fillIntensity: 0.35,
    deskLampIntensity: 0.0,
    exposure: 0.88
  },
  sunset: {
    bg: 0xf5e2da,
    ambientColor: 0xffd8c4,
    ambientIntensity: 0.32,
    hemiSky: 0xffc4a8,
    hemiGround: 0xb8806a,
    hemiIntensity: 0.22,
    sunColor: 0xff7d4d,
    sunIntensity: 1.40,
    sunPos: new THREE.Vector3(-2.6, 3.4, -5.2),
    fillColor: 0xffb085,
    fillIntensity: 0.45,
    deskLampIntensity: 0.6,
    exposure: 0.86
  },
  night: {
    bg: 0x181726,
    ambientColor: 0x4d5578,
    ambientIntensity: 0.20,
    hemiSky: 0x333b5c,
    hemiGround: 0x1e2030,
    hemiIntensity: 0.15,
    sunColor: 0x768ec5,
    sunIntensity: 0.30,
    sunPos: new THREE.Vector3(-1.2, 4.2, -3.8),
    fillColor: 0xffd39b,
    fillIntensity: 0.70,
    deskLampIntensity: 2.0,
    exposure: 0.84
  }
};

function setAtmosphere(modeKey) {
  const atmo = ATMOSPHERES[modeKey];
  if (!atmo) return;

  new TWEEN.Tween(ambientLight)
    .to({ intensity: atmo.ambientIntensity }, 1000)
    .start();
  ambientLight.color.setHex(atmo.ambientColor);

  new TWEEN.Tween(hemiLight)
    .to({ intensity: atmo.hemiIntensity }, 1000)
    .start();
  hemiLight.color.setHex(atmo.hemiSky);
  hemiLight.groundColor.setHex(atmo.hemiGround);

  new TWEEN.Tween(sunLight)
    .to({ intensity: atmo.sunIntensity }, 1000)
    .start();
  sunLight.color.setHex(atmo.sunColor);
  sunLight.position.copy(atmo.sunPos);

  new TWEEN.Tween(roomFillLight)
    .to({ intensity: atmo.fillIntensity }, 1000)
    .start();
  roomFillLight.color.setHex(atmo.fillColor);

  new TWEEN.Tween(deskLampLight)
    .to({ intensity: atmo.deskLampIntensity }, 1000)
    .start();

  new TWEEN.Tween(renderer)
    .to({ toneMappingExposure: atmo.exposure }, 1000)
    .start();

  // Smooth background color interpolation
  const targetBg = new THREE.Color(atmo.bg);
  new TWEEN.Tween(scene.background)
    .to({ r: targetBg.r, g: targetBg.g, b: targetBg.b }, 1000)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();

  // Update button active state
  document.querySelectorAll('#lighting-group .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.light === modeKey);
  });
}

// --- 6. Load GLTF/GLB Model ---
const loadingScreen = document.getElementById('loading-screen');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

const loader = new THREE.GLTFLoader();
const modelUrl = 'nagato_sakura_room.glb';

loader.load(
  modelUrl,
  gltf => {
    const roomModel = gltf.scene;

    // 1. Strip any lights embedded in the GLTF/GLB to prevent duplicate / blowout illumination
    const lightsToRemove = [];
    roomModel.traverse(child => {
      if (child.isLight) {
        lightsToRemove.push(child);
      }
    });
    lightsToRemove.forEach(l => {
      if (l.parent) l.parent.remove(l);
    });

    // 2. Apply shadow properties and retain original model textures & materials
    roomModel.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          // Keep all original textures, UV transforms, colors, roughness and metalness as authored in the model
          const matName = (child.material.name || '').toLowerCase();
          const isMetal = (child.material.metalness !== undefined && child.material.metalness > 0.5) ||
                          matName.includes('metal');

          // For metals, assign environment reflection
          if (isMetal && envTexture) {
            child.material.envMap = envTexture;
            child.material.envMapIntensity = 1.0;
          }

          // DoubleSide for transparent/thin elements like curtains and leaves
          if (matName.includes('curtain') || matName.includes('leaf') || matName.includes('glass')) {
            child.material.side = THREE.DoubleSide;
          }
        }

        // Disable shadow on glass & window sky view
        const name = child.name.toLowerCase();
        if (name.includes('glass') || name.includes('sky') || name.includes('backdrop') || name.includes('sheer')) {
          child.castShadow = false;
        }
      }
    });

    scene.add(roomModel);
    buildOutlineMeshes(roomModel); // Build inverted-hull outline meshes (hidden until toggled)
    createHotspots();

    // Fade out loading screen, then trigger stagger entrance animations
    setTimeout(() => {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 1000);

      // Stagger entrance for hotspot pins after loading screen fades
      setTimeout(() => {
        hotspotElements.forEach((item, index) => {
          setTimeout(() => {
            item.element.classList.add('entered');
          }, index * 100);
        });
      }, 800);
    }, 400);
  },
  xhr => {
    if (xhr.lengthComputable) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      progressBar.style.width = `${pct}%`;
      progressText.textContent = `${pct}%`;
    }
  },
  error => {
    console.error('Error loading 3D model:', error);
    loadingScreen.innerHTML = `
      <div class="loading-content">
        <h2 style="color:#ff4d6d">載入模型失敗</h2>
        <p style="color:#555;margin-top:10px">請確認 nagato_sakura_room.glb 檔案存在，或在本地伺服器環境下開啟。</p>
      </div>
    `;
  }
);

// --- 7. Falling Sakura Petals 2D Canvas Physics ---
const sakuraCanvas = document.getElementById('sakura-canvas');
const ctx = sakuraCanvas.getContext('2d');

let sakuraWidth = (sakuraCanvas.width = window.innerWidth);
let sakuraHeight = (sakuraCanvas.height = window.innerHeight);

let isSakuraRainActive = true;
const NUM_PETALS = 36;
const petals = [];

class SakuraPetal {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = Math.random() * sakuraWidth;
    this.y = initial ? Math.random() * sakuraHeight : -20;
    this.size = Math.random() * 9 + 8;
    this.speedY = Math.random() * 1.2 + 0.8;
    this.speedX = Math.random() * 1.5 - 0.5;
    this.angle = Math.random() * Math.PI * 2;
    this.angularSpeed = (Math.random() - 0.5) * 0.04;
    this.sway = Math.random() * Math.PI * 2;
    this.swaySpeed = Math.random() * 0.03 + 0.01;
    this.opacity = Math.random() * 0.4 + 0.55;
    this.flip = Math.random() * Math.PI;
    this.flipSpeed = Math.random() * 0.03 + 0.01;
  }

  update() {
    this.y += this.speedY;
    this.sway += this.swaySpeed;
    this.x += this.speedX + Math.sin(this.sway) * 0.8;
    this.angle += this.angularSpeed;
    this.flip += this.flipSpeed;

    if (this.y > sakuraHeight + 20 || this.x > sakuraWidth + 20 || this.x < -20) {
      this.reset();
    }
  }

  draw(context) {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.scale(Math.sin(this.flip), 1);

    context.beginPath();
    context.moveTo(0, 0);
    context.bezierCurveTo(-this.size / 2, -this.size / 3, -this.size / 2, -this.size, 0, -this.size);
    context.bezierCurveTo(this.size / 2, -this.size, this.size / 2, -this.size / 3, 0, 0);

    context.fillStyle = `rgba(255, 183, 197, ${this.opacity})`;
    context.fill();

    // Petal notch
    context.beginPath();
    context.arc(0, -this.size + 1, 2, 0, Math.PI);
    context.fillStyle = 'rgba(255, 255, 255, 0.4)';
    context.fill();

    context.restore();
  }
}

for (let i = 0; i < NUM_PETALS; i++) {
  petals.push(new SakuraPetal());
}

function animateSakura() {
  if (isSakuraRainActive) {
    ctx.clearRect(0, 0, sakuraWidth, sakuraHeight);
    petals.forEach(p => {
      p.update();
      p.draw(ctx);
    });
  } else {
    ctx.clearRect(0, 0, sakuraWidth, sakuraHeight);
  }
  requestAnimationFrame(animateSakura);
}
animateSakura();

// --- 8. Event Listeners & Controls ---
// View buttons
document.querySelectorAll('#views-group .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => flyToCamera(btn.dataset.view));
});

// Lighting buttons
document.querySelectorAll('#lighting-group .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => setAtmosphere(btn.dataset.light));
});

// Feature toggles
const btnAutoRotate = document.getElementById('btn-auto-rotate');
btnAutoRotate.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  controls.autoRotateSpeed = 1.0;
  btnAutoRotate.classList.toggle('active', controls.autoRotate);
});

const btnSakuraRain = document.getElementById('btn-sakura-rain');
btnSakuraRain.addEventListener('click', () => {
  isSakuraRainActive = !isSakuraRainActive;
  btnSakuraRain.classList.toggle('active', isSakuraRainActive);
});

const btnToggleHotspots = document.getElementById('btn-toggle-hotspots');
let areHotspotsVisible = true;
btnToggleHotspots.addEventListener('click', () => {
  areHotspotsVisible = !areHotspotsVisible;
  hotspotsLayer.style.display = areHotspotsVisible ? 'block' : 'none';
  btnToggleHotspots.classList.toggle('active', areHotspotsVisible);
});

const btnResetView = document.getElementById('btn-reset-view');
btnResetView.addEventListener('click', () => flyToCamera('iso'));

// --- Procedural Healing Ambient BGM (Web Audio API) ---
class HealingAudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.timer = null;
    // Fmaj9, G6, Em7, Am9 (frequencies in Hz)
    this.chords = [
      [174.61, 220.00, 261.63, 329.63, 392.00],
      [196.00, 246.94, 293.66, 329.63, 392.00],
      [164.81, 196.00, 246.94, 293.66, 329.63],
      [220.00, 261.63, 329.63, 392.00, 493.88]
    ];
    this.chordIndex = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    // Warm lowpass filter to create a cozy lofi bedroom aesthetic
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(550, this.ctx.currentTime);
    this.filter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.masterGain.connect(this.filter);
    this.filter.connect(this.ctx.destination);
  }

  playNote(freq, time, duration = 3.8, type = 'sine', volume = 0.05) {
    if (!this.ctx || !this.isPlaying) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  playChime(freq, time) {
    if (!this.ctx || !this.isPlaying) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.035, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.2);

    osc.connect(gain);
    gain.connect(this.filter);

    osc.start(time);
    osc.stop(time + 2.2);
  }

  scheduleNextChord() {
    if (!this.isPlaying || !this.ctx) return;
    const now = this.ctx.currentTime;
    const chord = this.chords[this.chordIndex];
    this.chordIndex = (this.chordIndex + 1) % this.chords.length;

    chord.forEach((freq, idx) => {
      this.playNote(freq, now + idx * 0.12, 4.2, 'sine', 0.045);
    });

    // Add random soft spring wind chime
    const chimeFreqs = [523.25, 659.25, 783.99, 880.00, 1046.50];
    if (Math.random() > 0.25) {
      const chime = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];
      this.playChime(chime, now + 1.2 + Math.random() * 1.5);
    }

    this.timer = setTimeout(() => this.scheduleNextChord(), 4000);
  }

  start() {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isPlaying = true;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.70, this.ctx.currentTime + 1.0);
    this.scheduleNextChord();
  }

  stop() {
    if (!this.ctx || !this.isPlaying) return;
    this.isPlaying = false;
    clearTimeout(this.timer);
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
  }
}

const healingAudio = new HealingAudioSystem();

// BGM toggle with audio playback
const btnSoundtrack = document.getElementById('btn-soundtrack');
let isAudioPlaying = false;
btnSoundtrack.addEventListener('click', () => {
  isAudioPlaying = !isAudioPlaying;
  btnSoundtrack.classList.toggle('active', isAudioPlaying);
  btnSoundtrack.querySelector('.btn-text').textContent = isAudioPlaying ? '播放中' : 'BGM';
  if (isAudioPlaying) {
    healingAudio.start();
  } else {
    healingAudio.stop();
  }
});

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  sakuraWidth = sakuraCanvas.width = window.innerWidth;
  sakuraHeight = sakuraCanvas.height = window.innerHeight;
});

// --- Outline Toggle Button ---
const btnOutline = document.getElementById('btn-outline');
btnOutline.addEventListener('click', () => {
  outlineEnabled = !outlineEnabled;
  btnOutline.classList.toggle('active', outlineEnabled);
  setOutlineVisible(outlineEnabled);
});

// --- 9. Main Animation Loop ---
function animate(time) {
  requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();

  if (areHotspotsVisible) {
    updateHotspots();
  }

  renderer.render(scene, camera);
}

animate();

