// ============================================================
// Firebase Config
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBQAPizSGyQZG6-rGL3sZ8fDxQWht-KD_k",
  authDomain: "vievo-3fc93.firebaseapp.com",
  projectId: "vievo-3fc93",
  storageBucket: "vievo-3fc93.appspot.com",
  messagingSenderId: "383293723646",
  appId: "1:383293723646:web:123abc456def789"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ============================================================
// Game State
// ============================================================
let gameActive = false;
let gamePaused = false;
let animationFrameId = null;
let currentLevel = 1;

const player = {
  height: 1.6, speed: 0.07, runSpeed: 0.13, crawlSpeed: 0.04,
  stamina: 100, flashlight: false, flashlightBattery: 100,
  noise: 0, inventory: [], activeSlot: 1, hiding: false,
  currentLocker: null, hearts: 3, maxHearts: 3,
  speedMultiplier: 1.0, noiseMultiplier: 1.0,
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Vector2(0, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  isGrounded: true, onLadder: false, isCrawling: false,
  jumpStrength: 5.2
};

const keys = { w: false, a: false, s: false, d: false, shift: false, ctrl: false };

const koce = {
  mesh: null, position: new THREE.Vector3(10, 0, 10),
  speed: 0.03, chaseSpeed: 0.065, state: 'patrol',
  lastKnownPlayerPos: null, searchTimer: 0,
  patrolTarget: new THREE.Vector3(), soundTimer: 0,
  visionRange: 16, angerLevel: 0
};

const voiceLines = {
  patrol: ["Хм...", "Кой вдига шум?", "Тихо ли е?"],
  search: ["Чух те!", "Къде си бе?", "Излез!"],
  chase: ["Спри се!", "Хващам те!", "Бягай, бягай!"]
};

let levelMap = [];
let interactiveObjects = [];
let hoveredObject = null;
let gameTime = 0;
let timerInterval = null;
let clock = new THREE.Clock();
let scene, camera, renderer;
let currentUser = null;
let userCredits = 0;

// ============================================================
// Firebase Auth
// ============================================================
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    loadCredits();
  }
  updateMenuCredits();
});

function loadCredits() {
  if (!currentUser) return;
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    if (doc.exists) {
      userCredits = doc.data().credits || 0;
      updateMenuCredits();
    }
  });
}

function addCredits(amount, reason = 'game_reward') {
  if (!currentUser) return;
  userCredits += amount;
  db.collection('users').doc(currentUser.uid).set({ credits: userCredits }, { merge: true });
  updateMenuCredits();
  showNotification(`<i class="fas fa-coins"></i> +${amount} кредита`, 'success');
}

function updateMenuCredits() {
  const el = document.getElementById('menuCreditsAmount');
  const shopEl = document.getElementById('shopCreditsAmount');
  const hudEl = document.getElementById('creditsAmount');
  const val = userCredits.toString();
  if (el) el.textContent = val;
  if (shopEl) shopEl.textContent = val;
  if (hudEl) hudEl.textContent = val;
}

// ============================================================
// Toast Notifications
// ============================================================
function showNotification(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

// ============================================================
// Three.js Setup
// ============================================================
const canvas = document.getElementById('gameCanvas');
scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a10);
scene.fog = new THREE.Fog(0x0a0a10, 20, 35);

camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 50);
camera.rotation.order = "YXZ";

renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lights
const ambient = new THREE.AmbientLight(0x404060, 0.3);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xffeeb1, 0x080820, 0.6);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffeedd, 1.0);
dir.position.set(10, 15, 5);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
scene.add(dir);

// ============================================================
// Pointer Lock
// ============================================================
canvas.addEventListener('click', () => {
  if (gameActive && !gamePaused) canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && gameActive && !gamePaused) {
    gamePaused = true;
  }
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const sensitivity = 0.002;
  player.rotation.x -= e.movementX * sensitivity;
  player.rotation.y -= e.movementY * sensitivity;
  player.rotation.y = Math.max(-1.5, Math.min(1.5, player.rotation.y));
  camera.rotation.y = player.rotation.y;
  camera.rotation.x = player.rotation.x;
});

// ============================================================
// Keyboard Input
// ============================================================
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const c = e.code;
  if (k === 'w' || c === 'KeyW') keys.w = true;
  if (k === 'a' || c === 'KeyA') keys.a = true;
  if (k === 's' || c === 'KeyS') keys.s = true;
  if (k === 'd' || c === 'KeyD') keys.d = true;
  if (e.key === 'Shift') keys.shift = true;
  if (e.key === 'Control') { keys.ctrl = true; player.isCrawling = true; }
  if (c === 'Space' && gameActive && !gamePaused && player.isGrounded && !player.hiding) {
    player.velocity.y = player.jumpStrength;
    player.isGrounded = false;
  }
  if (k === 'f') toggleFlashlight();
  if (k === 'e') performInteraction();
  if (k === '1') player.activeSlot = 1;
  if (k === '2') player.activeSlot = 2;
  if (k === '3') player.activeSlot = 3;
  if (k === '4') player.activeSlot = 4;
  if (e.key === 'Escape' && gameActive) {
    backToMenu();
  }
  updateHUD();
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  const c = e.code;
  if (k === 'w' || c === 'KeyW') keys.w = false;
  if (k === 'a' || c === 'KeyA') keys.a = false;
  if (k === 's' || c === 'KeyS') keys.s = false;
  if (k === 'd' || c === 'KeyD') keys.d = false;
  if (e.key === 'Shift') keys.shift = false;
  if (e.key === 'Control') { keys.ctrl = false; player.isCrawling = false; }
});

// ============================================================
// Build Level
// ============================================================
function buildLevel(level) {
  // Clear previous
  if (scene.children.length > 3) {
    while (scene.children.length > 3) {
      const c = scene.children[scene.children.length - 1];
      if (c.type === 'Scene' || c === camera || c.type === 'AmbientLight' || c.type === 'HemisphereLight' || c.type === 'DirectionalLight') break;
      scene.remove(c);
    }
  }
  levelMap = [];
  interactiveObjects = [];

  const S = 20;
  // Floor
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  levelMap.push(floor);

  // Ceiling
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9, side: THREE.DoubleSide });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(S, S), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 5;
  scene.add(ceil);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.8 });
  const wg = new THREE.BoxGeometry(S, 5, 0.2);
  const sg = new THREE.BoxGeometry(0.2, 5, S);
  const hal = S / 2;

  const walls = [
    { pos: [0, 2.5, -hal], geo: wg },
    { pos: [0, 2.5, hal], geo: wg },
    { pos: [-hal, 2.5, 0], geo: sg },
    { pos: [hal, 2.5, 0], geo: sg }
  ];
  walls.forEach(w => {
    const m = new THREE.Mesh(w.geo, wallMat);
    m.position.set(w.pos[0], w.pos[1], w.pos[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    levelMap.push(m);
  });

  // === LIBRARY FURNITURE ===

  // Shelves along walls
  const shelfPositions = [
    [-8, 7], [-8, 3], [-8, -1], [-8, -5], [-8, -8],
    [8, 7], [8, 3], [8, -1], [8, -5], [8, -8],
    [-3, 7], [3, 7], [-3, -8], [3, -8]
  ];
  shelfPositions.forEach(p => createShelf(p[0], 1, p[1]));

  // Desk
  createDesk(-5, 4, 0);
  createDesk(5, 4, 0);
  createDesk(-5, -4, 0);
  createDesk(5, -4, 0);

  // Sofa
  createSofa(0, 6, 0);
  createSofa(0, -6, Math.PI);

  // Columns
  createColumn(-6, -6);
  createColumn(6, -6);
  createColumn(-6, 6);
  createColumn(6, 6);

  // Exit door
  createExitDoor(0, 0, -S / 2 + 0.2);

  // Flashlight (on a desk)
  createFlashlight(-5, 0.8, 4.5);

  // Key (hanging on wall or on shelf)
  createKey(6, 1.5, -8.6);

  // Books (throwable)
  for (let i = 0; i < 8; i++) {
    createThrowableBook(
      -7 + Math.random() * 2,
      0.95 + Math.random() * 0.3,
      6 + Math.random() * 1.5
    );
  }

  // Ladder to upper area
  createLadder(-5, -2.5);
}

// ============================================================
// Furniture Builders
// ============================================================
function createShelf(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
  const bookMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
  const bookColors = [0xc62828, 0x1565c0, 0x2e7d32, 0xf9a825, 0x6a1b9a, 0x4e342e];

  // Frame
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
  for (let s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.3), sideMat);
    side.position.set(s * 0.33, 0.8, 0);
    g.add(side);
  }
  // Shelves
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.3), woodMat);
    s.position.set(0, i * 0.35 + 0.18, 0);
    g.add(s);
  }
  // Top
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.34), woodMat);
  top.position.set(0, 1.6, 0);
  g.add(top);

  // Books
  for (let i = 0; i < 6; i++) {
    const bMat = new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length], roughness: 0.7 });
    const bh = 0.15 + Math.random() * 0.2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, bh, 0.12), bMat);
    b.position.set(-0.15 + i * 0.06, 0.18 + bh / 2 + Math.floor(i / 2) * 0.35, 0);
    b.rotation.y = (Math.random() - 0.5) * 0.1;
    g.add(b);
  }

  scene.add(g);

  // Collider
  const coll = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.6, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  coll.position.set(x, y + 0.8, z);
  scene.add(coll);
  levelMap.push(coll);
}

function createDesk(x, y, z, rot = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot;
  const mat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.6 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
  // Top
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), mat);
  top.position.y = 0.75;
  top.castShadow = true;
  g.add(top);
  // Legs
  for (let lx of [-0.5, 0.5]) {
    for (let lz of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.7, 6), legMat);
      leg.position.set(lx, 0.35, lz);
      g.add(leg);
    }
  }
  scene.add(g);
  const coll = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  coll.position.set(x, y + 0.375, z);
  coll.rotation.y = rot;
  scene.add(coll);
  levelMap.push(coll);
}

function createSofa(x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 });
  const cushMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.7), mat);
  base.position.set(0, 0.15, 0);
  base.castShadow = true;
  g.add(base);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.12), mat);
  back.position.set(0, 0.4, -0.3);
  g.add(back);
  for (let s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.7), mat);
    arm.position.set(s * 0.8, 0.2, 0);
    g.add(arm);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.55), cushMat);
  seat.position.set(0, 0.33, 0.03);
  g.add(seat);
  scene.add(g);
  const coll = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  coll.position.set(x, 0.25, z);
  coll.rotation.y = rot;
  scene.add(coll);
  levelMap.push(coll);
}

function createColumn(x, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a7f7a, roughness: 0.7 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x6d5f5a, roughness: 0.8 });
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 4.5, 8), mat);
  c.position.set(x, 2.25, z);
  c.castShadow = true;
  scene.add(c);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 8), baseMat);
  b.position.set(x, 0.03, z);
  scene.add(b);
  const t = b.clone();
  t.position.y = 4.5;
  scene.add(t);
  const coll = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 4.5, 6), new THREE.MeshBasicMaterial({ visible: false }));
  coll.position.set(x, 2.25, z);
  scene.add(coll);
  levelMap.push(coll);
}

function createLadder(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.7 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
  for (let s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.8, 0.05), railMat);
    rail.position.set(s * 0.25, 1.4, 0);
    g.add(rail);
  }
  for (let i = 0; i <= 11; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), mat);
    rung.position.set(0, i * 0.25, 0);
    rung.rotation.x = Math.PI / 2;
    g.add(rung);
  }
  scene.add(g);
  const coll = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.8, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  coll.position.set(x, 1.4, z);
  scene.add(coll);
  levelMap.push(coll);
}

function createExitDoor(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5e2c04, roughness: 0.7 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12), doorMat);
  door.position.y = 1.1;
  door.castShadow = true;
  group.add(door);
  // Frame
  const fg = new THREE.BoxGeometry(0.06, 1.2, 0.06);
  const ft = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 0.12), frameMat);
  ft.position.set(0, 2.23, 0);
  group.add(ft);
  for (let s of [-1, 1]) {
    const f = new THREE.Mesh(fg, frameMat);
    f.position.set(s * 0.66, 1.1, 0);
    group.add(f);
  }
  // Handle
  const hm = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
  const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.04, 6), hm);
  hb.position.set(0.35, 1.0, 0.08);
  hb.rotation.x = Math.PI / 2;
  group.add(hb);
  const hbr = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), hm);
  hbr.position.set(0.39, 1.0, 0.05);
  hbr.rotation.z = Math.PI / 2;
  group.add(hbr);
  scene.add(group);

  interactiveObjects.push({
    type: 'exit_door', mesh: door, locked: true, name: 'Изходна врата', radius: 1.5
  });
}

function createFlashlight(x, y, z, rotY = 0.4, rotX = -0.3) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.023, 0.18, 8), bodyMat);
  handle.rotation.x = Math.PI / 2;
  group.add(handle);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.025, 0.07, 8), headMat);
  head.position.z = 0.12;
  head.rotation.x = Math.PI / 2;
  group.add(head);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lensMat);
  lens.position.z = 0.16;
  group.add(lens);
  group.position.set(x, y, z);
  group.rotation.x = rotX;
  group.rotation.z = rotY;
  scene.add(group);
  interactiveObjects.push({
    type: 'item', name: 'Фенерче', itemId: 'flashlight',
    icon: 'fa-lightbulb', mesh: group, radius: 0.6
  });
}

function createKey(x, y, z) {
  const group = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.15 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 12), goldMat);
  ring.rotation.y = Math.PI / 2;
  group.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.11), goldMat);
  shaft.position.set(0, 0, -0.065);
  group.add(shaft);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.025), goldMat);
  tooth.position.set(0, 0.008, -0.1);
  group.add(tooth);
  const tooth2 = tooth.clone();
  tooth2.position.set(0, -0.008, -0.09);
  group.add(tooth2);
  group.position.set(x, y, z);
  group.rotation.y = Math.PI / 4;
  scene.add(group);
  interactiveObjects.push({
    type: 'item', name: 'Ключ', itemId: 'door_key',
    icon: 'fa-key', mesh: group, radius: 0.6
  });
}

function createThrowableBook(x, y, z) {
  const colors = [0xc62828, 0x1565c0, 0x2e7d32, 0xf9a825, 0x6a1b9a];
  const mat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.7 });
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.16), mat);
  book.position.set(x, y, z);
  book.rotation.set(Math.random() * 0.5, Math.random() * 0.5, 0);
  book.castShadow = true;
  scene.add(book);
  interactiveObjects.push({
    type: 'throwable', name: 'Книга', mesh: book,
    physics: { velocity: new THREE.Vector3(), grabbed: false },
    radius: 0.3
  });
}

// ============================================================
// Koce Character
// ============================================================
function createKoceModel() {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xef5350, roughness: 0.4 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.5 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

  // Body
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.19), shirtMat);
  chest.position.set(0, 0.56, 0);
  chest.castShadow = true;
  group.add(chest);
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.16), pantsMat);
  waist.position.set(0, 0.28, 0);
  group.add(waist);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
  head.position.set(0, 0.87, 0);
  head.scale.set(1, 1.05, 0.92);
  head.castShadow = true;
  group.add(head);

  // Eyes (big, expressive)
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x4a7db4 });
  for (let side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), whiteMat);
    eye.position.set(side * 0.055, 0.88, 0.115);
    eye.scale.set(1, 0.85, 0.5);
    group.add(eye);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), irisMat);
    iris.position.set(side * 0.055, 0.88, 0.125);
    iris.scale.set(1, 0.9, 0.4);
    group.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), pupilMat);
    pupil.position.set(side * 0.055, 0.88, 0.13);
    pupil.scale.set(1, 0.9, 0.3);
    group.add(pupil);
  }

  // Mouth (smile)
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xd94f5a });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.01), mouthMat);
  mouth.position.set(0, 0.80, 0.12);
  group.add(mouth);

  // Hair (brown)
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), hairMat);
  hair.position.set(0, 0.94, 0);
  hair.scale.set(1, 0.35, 0.95);
  group.add(hair);

  // Arms
  for (let side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), skinMat);
    arm.position.set(side * 0.22, 0.48, 0);
    group.add(arm);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.07), shirtMat);
    sleeve.position.set(side * 0.22, 0.38, 0);
    group.add(sleeve);
  }

  // Legs
  for (let side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.07), pantsMat);
    leg.position.set(side * 0.1, 0.1, 0);
    group.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.1), shoeMat);
    shoe.position.set(side * 0.1, 0, 0.02);
    group.add(shoe);
  }

  return group;
}

// ============================================================
// Start Game
// ============================================================
function startGame() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('victoryOverlay').style.display = 'none';
  document.getElementById('gameOverOverlay').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';

  gameActive = true;
  gamePaused = false;
  gameTime = 0;
  clock.getDelta();

  // Reset player
  player.position.set(-8, player.height, 8);
  player.rotation.set(0, 0);
  camera.rotation.y = 0;
  camera.rotation.x = 0;
  player.stamina = 100;
  player.flashlightBattery = 100;
  player.flashlight = false;
  player.hearts = player.maxHearts;
  player.inventory = [{ id: 'hand', name: 'Ръце', icon: 'fa-hand' }];
  player.activeSlot = 1;
  player.hiding = false;
  player.onLadder = false;
  player.isGrounded = true;
  player.velocity.set(0, 0, 0);

  // Reset Koce
  koce.position.set(9, 0, 9);
  koce.state = 'patrol';
  koce.patrolTarget.set(0, 0, 0);
  koce.lastKnownPlayerPos = null;
  koce.searchTimer = 0;
  koce.soundTimer = 0;

  buildLevel(1);

  // Create Koce
  if (koce.mesh) {
    scene.remove(koce.mesh);
  }
  koce.mesh = createKoceModel();
  scene.add(koce.mesh);
  koce.mesh.position.copy(koce.position);

  // Flashlight light
  const spot = new THREE.SpotLight(0xffeb3b, 0, 18, Math.PI / 6, 0.5, 1);
  spot.target.position.set(0, 0, -1);
  camera.add(spot.target);
  camera.add(spot);
  scene.add(camera);

  if (!gameActive) return;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  gameLoop();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    gameTime += 1;
  }, 1000);

  canvas.requestPointerLock();
  updateHUD();
  showNotification('Намери фенерче и ключ, за да избягаш от Коце!', 'warn');
}

// ============================================================
// Game Loop
// ============================================================
function gameLoop() {
  if (!gameActive) return;
  animationFrameId = requestAnimationFrame(gameLoop);
  const delta = Math.min(clock.getDelta(), 0.05);

  if (!gamePaused) {
    if (!player.hiding) {
      handleMovement(delta);
    }
    updateKoceAI(delta);
    updateInteractionPrompt();
    updateNoise();
    updateBattery(delta);
    updateHUD();
  }

  renderer.render(scene, camera);
}

// ============================================================
// Player Movement
// ============================================================
function handleMovement(delta) {
  let speed = player.speed;
  if (keys.shift && player.stamina > 0) {
    speed = player.runSpeed;
    player.stamina = Math.max(0, player.stamina - delta * 25);
    player.noise = Math.min(100, player.noise + delta * 50);
  } else {
    player.stamina = Math.min(100, player.stamina + delta * 12);
    if (keys.ctrl) {
      speed = player.crawlSpeed;
      player.noise = Math.max(0, player.noise - delta * 15);
    } else {
      if (keys.w || keys.a || keys.s || keys.d) {
        player.noise = Math.min(40, player.noise + delta * 20);
      } else {
        player.noise = Math.max(0, player.noise - delta * 25);
      }
    }
  }

  speed *= player.speedMultiplier;

  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.x);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.x);
  const moveDir = new THREE.Vector3();
  if (keys.w) moveDir.add(forward);
  if (keys.s) moveDir.add(forward.clone().negate());
  if (keys.d) moveDir.add(right);
  if (keys.a) moveDir.add(right.clone().negate());

  // Horizontal movement (skip when on ladder)
  if (!player.onLadder && moveDir.lengthSq() > 0.001) {
    moveDir.normalize();
    const prev = player.position.clone();

    player.position.x += moveDir.x * speed;
    if (checkCollision()) player.position.x = prev.x;

    player.position.z += moveDir.z * speed;
    if (checkCollision()) player.position.z = prev.z;
  }

  // Ladder climbing
  const onLadder = player.position.x >= -5.3 && player.position.x <= -4.7 &&
    player.position.z >= -2.7 && player.position.z <= -2.3 &&
    player.position.y < 2.5 + player.height;

  if (keys.w && onLadder && player.position.y < 2.5 + player.height) {
    player.onLadder = true;
  }
  if (player.onLadder && !onLadder && !keys.w && !keys.s) {
    player.onLadder = false;
  }

  if (player.onLadder && onLadder) {
    if (keys.w) player.position.y += speed;
    if (keys.s && player.position.y > player.height) player.position.y -= speed;
    player.velocity.y = 0;
    player.isGrounded = false;
    if (player.position.y >= 2.5 + player.height) {
      player.position.y = 2.5 + player.height;
      player.onLadder = false;
      player.isGrounded = true;
    }
    if (player.position.y <= player.height) {
      player.position.y = player.height;
      player.onLadder = false;
      player.isGrounded = true;
    }
  }

  // Gravity
  if (!player.onLadder) {
    if (!player.isGrounded) {
      player.velocity.y -= 9.8 * 2.0 * delta;
      player.position.y += player.velocity.y * delta;
      let standY = player.height;
      if (player.position.x >= -8 && player.position.x <= 8 &&
          player.position.z >= -15 && player.position.z <= -5 &&
          player.position.y >= 2.5 + player.height - 0.2 && player.velocity.y <= 0) {
        standY = 2.5 + player.height;
      }
      if (player.position.y <= standY) {
        player.position.y = standY;
        player.velocity.y = 0;
        player.isGrounded = true;
      }
    } else {
      let expectedY = player.height;
      if (player.position.y > 2.0 && player.position.x >= -8 && player.position.x <= 8 &&
          player.position.z >= -15 && player.position.z <= -5) {
        expectedY = 2.5 + player.height;
      }
      if (Math.abs(player.position.y - expectedY) > 0.05) {
        if (player.position.y > expectedY) {
          player.isGrounded = false;
          player.velocity.y = 0;
        } else {
          player.position.y = expectedY;
        }
      }
    }
  }

  // Camera
  camera.position.copy(player.position);
  if (player.isCrawling) camera.position.y -= 0.6;
}

function checkCollision() {
  for (const m of levelMap) {
    if (m === levelMap[0] || m === levelMap[1]) continue;
    const box = new THREE.Box3().setFromObject(m);
    const pb = new THREE.Box3(
      new THREE.Vector3(player.position.x - 0.25, player.position.y - player.height, player.position.z - 0.25),
      new THREE.Vector3(player.position.x + 0.25, player.position.y + 0.4, player.position.z + 0.25)
    );
    if (box.intersectsBox(pb)) return true;
  }
  return false;
}

// ============================================================
// Koce AI
// ============================================================
function getRandomPatrolTarget() {
  const nodes = [
    [7, 7], [-7, 7], [7, -7], [-7, -7],
    [0, 7], [7, 0], [-7, 0], [0, -7],
    [4, 4], [-4, 4], [4, -4], [-4, -4],
    [0, 0]
  ];
  const n = nodes[Math.floor(Math.random() * nodes.length)];
  return new THREE.Vector3(n[0], 0, n[1]);
}

function updateKoceAI(delta) {
  if (!koce.mesh) return;
  const dist = koce.position.distanceTo(player.position);

  // Vision
  let playerVisible = false;
  if (dist < koce.visionRange && !player.hiding) {
    const dir = player.position.clone().sub(koce.position).normalize();
    const ray = new THREE.Raycaster(
      koce.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
      dir, 0.1, koce.visionRange
    );
    const hits = ray.intersectObjects(levelMap);
    if (hits.length === 0 || hits[0].distance > dist) {
      playerVisible = true;
    }
  }

  // Hearing
  let playerHeard = false;
  if (player.noise > 15 && dist < player.noise * 0.3) {
    playerHeard = true;
    koce.lastKnownPlayerPos = player.position.clone();
  }

  // State transitions
  if (playerVisible) {
    if (koce.state !== 'chase') {
      koce.state = 'chase';
      showNotification('Коце те видя!', 'warn');
    }
    koce.lastKnownPlayerPos = player.position.clone();
  } else if (playerHeard) {
    if (koce.state === 'patrol') {
      koce.state = 'search';
      showNotification('Коце чу нещо...', 'warn');
    }
  }

  // Movement
  let cSpeed = koce.state === 'chase' ? koce.chaseSpeed : koce.speed;
  let target = new THREE.Vector3();

  if (koce.state === 'chase' && koce.lastKnownPlayerPos) {
    target.copy(koce.lastKnownPlayerPos);
    if (koce.position.distanceTo(target) < 1.0 && !playerVisible) {
      koce.state = 'search';
      koce.searchTimer = 4;
    }
  } else if (koce.state === 'search' && koce.lastKnownPlayerPos) {
    target.copy(koce.lastKnownPlayerPos);
    koce.searchTimer -= delta;
    if (koce.searchTimer <= 0) {
      koce.state = 'patrol';
      koce.patrolTarget.copy(getRandomPatrolTarget());
    }
  } else {
    target.copy(koce.patrolTarget);
    if (koce.position.distanceTo(target) < 1.0) {
      koce.patrolTarget.copy(getRandomPatrolTarget());
    }
  }

  // Move Koce
  const dir = new THREE.Vector3(target.x - koce.position.x, 0, target.z - koce.position.z);
  if (dir.lengthSq() > 0.01) {
    dir.normalize();
    const px = koce.position.x + dir.x * cSpeed;
    const pz = koce.position.z + dir.z * cSpeed;

    // Collision for Koce
    let bx = false, bz = false;
    const kr = 0.4;
    for (const obj of levelMap) {
      if (!obj.geometry) continue;
      const box = new THREE.Box3().setFromObject(obj);
      const tx = new THREE.Vector3(px, koce.position.y, koce.position.z);
      const tz = new THREE.Vector3(koce.position.x, koce.position.y, pz);
      if (box.containsPoint(tx) || box.distanceToPoint(tx) < kr) bx = true;
      if (box.containsPoint(tz) || box.distanceToPoint(tz) < kr) bz = true;
    }
    koce.position.x = bx ? koce.position.x : px;
    koce.position.z = bz ? koce.position.z : pz;
    koce.mesh.position.copy(koce.position);

    const angle = Math.atan2(dir.x, dir.z);
    koce.mesh.rotation.y = angle;
  }

  // Voice lines
  koce.soundTimer -= delta;
  if (koce.soundTimer <= 0) {
    koce.soundTimer = 6 + Math.random() * 8;
    const pool = voiceLines[koce.state];
    const msg = pool[Math.floor(Math.random() * pool.length)];
    showNotification(`Коце: "${msg}"`, 'warn');
  }

  // Catch player
  const hDist = new THREE.Vector2(koce.position.x, koce.position.z)
    .distanceTo(new THREE.Vector2(player.position.x, player.position.z));
  const vDist = Math.abs(koce.position.y - (player.position.y - player.height));
  if (hDist < 1.0 && vDist < 1.5 && !player.hiding) {
    player.hearts--;
    updateHUD();
    if (player.hearts <= 0) {
      triggerGameOver();
    } else {
      showNotification(`Коце те хвана! Остават ${player.hearts} живота!`, 'error');
      player.position.set(-8, player.height, 8);
      koce.position.set(9, 0, 9);
      koce.state = 'patrol';
      koce.patrolTarget.copy(getRandomPatrolTarget());
    }
  }
}

// ============================================================
// Interaction
// ============================================================
function updateInteractionPrompt() {
  const el = document.getElementById('interactionPrompt');
  const ch = document.getElementById('crosshair');
  if (!el) return;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);

  const meshes = [];
  interactiveObjects.forEach(o => {
    if (o.mesh.isGroup) {
      o.mesh.traverse(c => { if (c.isMesh) meshes.push(c); });
    } else {
      meshes.push(o.mesh);
    }
  });

  const hits = ray.intersectObjects(meshes);
  if (hits.length > 0 && hits[0].distance < 3.0) {
    const hit = hits[0].object;
    const obj = interactiveObjects.find(o => {
      if (o.mesh === hit) return true;
      let f = false;
      o.mesh.traverse(c => { if (c === hit) f = true; });
      return f;
    });
    if (obj) {
      hoveredObject = obj;
      if (ch) ch.classList.add('interactable');
      el.classList.add('active');
      const action = obj.type === 'item' ? 'Вземи' :
        obj.type === 'exit_door' ? 'Отключи' :
        obj.type === 'throwable' ? 'Вдигни' : '';
      el.innerHTML = `${action} ${obj.name} <span>[E]</span>`;
      return;
    }
  }
  hoveredObject = null;
  if (ch) ch.classList.remove('interactable');
  el.classList.remove('active');
}

function performInteraction() {
  if (player.hiding) {
    player.hiding = false;
    canvas.requestPointerLock();
    updateHUD();
    return;
  }

  let nearest = hoveredObject;
  if (!nearest) {
    let md = Infinity;
    interactiveObjects.forEach(obj => {
      const d = new THREE.Vector3(player.position.x, 0, player.position.z)
        .distanceTo(new THREE.Vector3(obj.mesh.position.x, 0, obj.mesh.position.z));
      if (d < (obj.radius + 1.2) && d < md) { md = d; nearest = obj; }
    });
  }

  if (!nearest) return;

  if (nearest.type === 'item') {
    player.inventory.push({ id: nearest.itemId, name: nearest.name, icon: nearest.icon });
    scene.remove(nearest.mesh);
    interactiveObjects = interactiveObjects.filter(o => o !== nearest);
    showNotification(`<i class="fas fa-hand"></i> Взе: ${nearest.name}`, 'success');
    updateHUD();
  } else if (nearest.type === 'exit_door') {
    const item = player.inventory[player.activeSlot - 1];
    if (item && item.id === 'door_key') {
      showNotification('Вратата е отключена! Бягай!', 'success');
      triggerVictory();
    } else {
      showNotification('Вратата е заключена! Трябва ти ключ!', 'error');
    }
  } else if (nearest.type === 'throwable') {
    // Book throw - makes noise
    const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.x);
    nearest.mesh.position.copy(player.position).add(dir.multiplyScalar(2));
    nearest.mesh.position.y = player.position.y - 0.5;
    player.noise = Math.min(100, player.noise + 50);
    showNotification('Книгата вдигна шум!', 'warn');
  }
}

// ============================================================
// Flashlight
// ============================================================
function toggleFlashlight() {
  const hasFlashlight = player.inventory.some(i => i.id === 'flashlight');
  if (!hasFlashlight) {
    showNotification('Нямаш фенерче!', 'error');
    return;
  }
  const active = player.inventory[player.activeSlot - 1];
  if (!active || active.id !== 'flashlight') {
    showNotification('Избери фенерчето в хотбара (1-4)', 'warn');
    return;
  }
  player.flashlight = !player.flashlight;
  const spot = camera.children.find(c => c instanceof THREE.SpotLight);
  if (spot) {
    spot.intensity = player.flashlight ? 6 : 0;
  }
  const icon = document.getElementById('batteryIcon');
  if (icon) {
    icon.className = `fas ${player.flashlight ? 'fa-lightbulb' : 'fa-lightbulb far'}`;
  }
  showNotification(player.flashlight ? 'Фенерче: ВКЛ' : 'Фенерче: ИЗКЛ', 'success');
}

function updateBattery(delta) {
  if (!player.flashlight) return;
  player.flashlightBattery = Math.max(0, player.flashlightBattery - delta * 2);
  const bar = document.getElementById('batteryBar');
  if (bar) bar.style.width = player.flashlightBattery + '%';

  if (player.flashlightBattery <= 0) {
    player.flashlight = false;
    const spot = camera.children.find(c => c instanceof THREE.SpotLight);
    if (spot) spot.intensity = 0;
    showNotification('Батерията на фенера свърши!', 'error');
  }
}

// ============================================================
// Noise
// ============================================================
function updateNoise() {
  const bars = document.querySelectorAll('#noiseWave span');
  const num = Math.floor(player.noise / 15);
  bars.forEach((b, i) => {
    if (i < num) {
      b.style.height = (8 + i * 4) + 'px';
      b.style.background = player.noise > 60 ? '#f44336' : (player.noise > 30 ? '#ffa726' : '#4caf50');
    } else {
      b.style.height = '3px';
      b.style.background = 'rgba(255,255,255,0.1)';
    }
  });
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
  // Hotbar
  for (let i = 1; i <= 4; i++) {
    const slot = document.getElementById(`slot-${i}`);
    if (!slot) continue;
    slot.className = `hotbar-slot ${player.activeSlot === i ? 'active' : ''}`;
    const item = player.inventory[i - 1];
    const icon = slot.querySelector('i:not(.hotbar-slot-key)');
    if (icon) icon.remove();
    if (item) {
      const el = document.createElement('i');
      el.className = `fas ${item.icon}`;
      slot.appendChild(el);
    }
  }

  // Battery bar visibility
  const active = player.inventory[player.activeSlot - 1];
  const bg = document.getElementById('batteryBarGroup');
  if (bg) {
    bg.style.display = active && active.id === 'flashlight' ? 'flex' : 'none';
  }

  // Hearts
  const hc = document.getElementById('heartsContainer');
  if (hc) {
    hc.innerHTML = '';
    for (let i = 0; i < player.maxHearts; i++) {
      const h = document.createElement('i');
      h.className = i < player.hearts ? 'fas fa-heart' : 'far fa-heart';
      h.style.color = i < player.hearts ? '#e63946' : 'rgba(255,255,255,0.2)';
      hc.appendChild(h);
    }
  }

  // Time
  const td = document.getElementById('timeDisplay');
  if (td) {
    const m = Math.floor(gameTime / 60);
    const s = gameTime % 60;
    td.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Stamina
  document.getElementById('staminaBar').style.width = player.stamina + '%';

  // Held item
  const held = document.getElementById('heldItemDisplay');
  if (held) {
    const a = player.inventory[player.activeSlot - 1];
    if (a && a.id !== 'hand') {
      held.innerHTML = `<i class="fas ${a.icon}"></i>`;
      held.classList.add('active');
    } else {
      held.classList.remove('active');
    }
  }
}

// ============================================================
// Victory / Game Over
// ============================================================
function triggerVictory() {
  gameActive = false;
  clearInterval(timerInterval);
  document.exitPointerLock();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('victoryOverlay').style.display = 'flex';
  document.getElementById('victoryTime').textContent = formatTime(gameTime);
  const reward = 25;
  document.getElementById('victoryReward').innerHTML = `<i class="fas fa-coins"></i> +${reward}`;
  document.getElementById('victoryXP').textContent = `+50 XP`;
  addCredits(reward, 'level_complete');
}

function triggerGameOver() {
  gameActive = false;
  clearInterval(timerInterval);
  document.exitPointerLock();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('gameOverOverlay').style.display = 'flex';
}

function closeVictory() {
  document.getElementById('victoryOverlay').style.display = 'none';
  backToMenu();
}

function restartGame() {
  document.getElementById('gameOverOverlay').style.display = 'none';
  startGame();
}

function backToMenu() {
  gameActive = false;
  gamePaused = false;
  clearInterval(timerInterval);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  document.exitPointerLock();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('victoryOverlay').style.display = 'none';
  document.getElementById('gameOverOverlay').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ============================================================
// Shop
// ============================================================
function openShop() {
  document.getElementById('shopOverlay').style.display = 'flex';
  loadShopItems();
}

function closeShop() {
  document.getElementById('shopOverlay').style.display = 'none';
}

function loadShopItems() {
  const container = document.getElementById('shopItems');
  const tab = document.querySelector('.tab-btn.active');
  const category = tab ? tab.dataset.tab : 'skins';
  container.innerHTML = '<div style="color:#71717a;">Зареждане...</div>';

  db.collection('games').doc('byagai-ot-koce-kisyov').collection('shop')
    .where('category', '==', category).get().then(snap => {
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<div style="color:#71717a;">Няма артикули в тази категория</div>';
      return;
    }
    snap.forEach(doc => {
      const item = doc.data();
      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML = `
        <div class="shop-item-icon"><i class="fas ${item.icon || 'fa-box'}"></i></div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-cost"><i class="fas fa-coins"></i> ${item.cost}</div>
        <button class="btn btn-primary" onclick="buyItem('${doc.id}', ${item.cost})">Купи</button>
      `;
      container.appendChild(div);
    });
  });
}

function buyItem(itemId, cost) {
  if (!currentUser) {
    showNotification('Трябва да си влязъл в профила си!', 'error');
    return;
  }
  if (userCredits < cost) {
    showNotification('Нямаш достатъчно кредити!', 'error');
    return;
  }
  userCredits -= cost;
  db.collection('users').doc(currentUser.uid).set({ credits: userCredits }, { merge: true });
  updateMenuCredits();
  showNotification('Купено успешно!', 'success');
  loadShopItems();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadShopItems();
  });
});

// ============================================================
// Leaderboard
// ============================================================
function openLeaderboard() {
  document.getElementById('leaderboardOverlay').style.display = 'flex';
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '<div style="color:#71717a;">Зареждане...</div>';
  db.collection('games').doc('byagai-ot-koce-kisyov').collection('leaderboard')
    .orderBy('time', 'asc').limit(20).get().then(snap => {
    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<div style="color:#71717a;">Все още няма рекорди</div>';
      return;
    }
    let i = 1;
    snap.forEach(doc => {
      const data = doc.data();
      const div = document.createElement('div');
      div.className = 'lb-entry';
      div.innerHTML = `
        <span class="rank">#${i}</span>
        <span class="name">${data.name || 'Анонимен'}</span>
        <span class="score">${formatTime(Math.floor(data.time / 1000))}</span>
      `;
      list.appendChild(div);
      i++;
    });
  });
}

function closeLeaderboard() {
  document.getElementById('leaderboardOverlay').style.display = 'none';
}

// ============================================================
// Resize
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
