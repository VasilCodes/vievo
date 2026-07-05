const ENGINE = {};

ENGINE.init = function () {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  ENGINE.scene = new THREE.Scene();
  ENGINE.scene.background = new THREE.Color(0x0a0a12);
  ENGINE.scene.fog = new THREE.Fog(0x0a0a12, 15, 30);

  ENGINE.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
  ENGINE.camera.position.set(0, 1.6, 0);

  ENGINE.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  ENGINE.renderer.setSize(window.innerWidth, window.innerHeight);
  ENGINE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ENGINE.renderer.shadowMap.enabled = true;
  ENGINE.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ENGINE.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  ENGINE.renderer.toneMappingExposure = 1.2;

  // Ambient light
  const ambient = new THREE.AmbientLight(0x404060, 0.3);
  ENGINE.scene.add(ambient);

  // Moonlight (directional)
  const moon = new THREE.DirectionalLight(0x8888ff, 0.6);
  moon.position.set(10, 15, 5);
  moon.castShadow = true;
  moon.shadow.mapSize.width = 1024;
  moon.shadow.mapSize.height = 1024;
  const d = 15;
  moon.shadow.camera.left = -d;
  moon.shadow.camera.right = d;
  moon.shadow.camera.top = d;
  moon.shadow.camera.bottom = -d;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 30;
  ENGINE.scene.add(moon);
  ENGINE.moonLight = moon;

  // Dim warm fill
  const fill = new THREE.DirectionalLight(0xff8844, 0.15);
  fill.position.set(-5, 3, -5);
  ENGINE.scene.add(fill);

  // Ceiling lights (placed per level)
  ENGINE.ceilingLights = [];

  ENGINE.levelGroup = new THREE.Group();
  ENGINE.scene.add(ENGINE.levelGroup);

  ENGINE.items = [];
  ENGINE.koce = null;
  ENGINE.exitDoor = null;
  ENGINE.playerCollider = null;
  ENGINE.clock = new THREE.Clock();
  ENGINE.running = false;

  window.addEventListener('resize', () => {
    ENGINE.camera.aspect = window.innerWidth / window.innerHeight;
    ENGINE.camera.updateProjectionMatrix();
    ENGINE.renderer.setSize(window.innerWidth, window.innerHeight);
  });
};

ENGINE.startLoop = function () {
  ENGINE.running = true;
  ENGINE.clock.start();

  function loop() {
    if (!ENGINE.running) return;
    requestAnimationFrame(loop);

    const dt = ENGINE.clock.getDelta();

    if (ENGINE.player) ENGINE.player.update(dt);
    if (ENGINE.koce) ENGINE.koce.update(dt);
    ENGINE.items.forEach(item => { if (item.update) item.update(dt); });

    ENGINE.renderer.render(ENGINE.scene, ENGINE.camera);
  }
  loop();
};

ENGINE.stop = function () {
  ENGINE.running = false;
  if (ENGINE.renderer) ENGINE.renderer.setAnimationLoop(null);
};

ENGINE.clearLevel = function () {
  while (ENGINE.levelGroup.children.length > 0) {
    const child = ENGINE.levelGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
    ENGINE.levelGroup.remove(child);
  }
  ENGINE.ceilingLights = [];
  ENGINE.items = [];
  ENGINE.koce = null;
  ENGINE.exitDoor = null;
  ENGINE.playerCollider = null;
};

// ── Blocky character model (for preview) ──
ENGINE.createCharacterModel = function (config) {
  const group = new THREE.Group();
  const { shirtColor, pantsColor, hairColor, skinColor } = config;
  const shirt = new THREE.MeshStandardMaterial({ color: parseInt(shirtColor || 0x3388ff) });
  const pants = new THREE.MeshStandardMaterial({ color: parseInt(pantsColor || 0x3355aa) });
  const hair = new THREE.MeshStandardMaterial({ color: parseInt(hairColor || 0x5d3a1a) });
  const skin = new THREE.MeshStandardMaterial({ color: parseInt(skinColor || 0xffccaa) });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.25), shirt);
  torso.position.y = 0.9;
  group.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.3), skin);
  head.position.y = 1.5;
  group.add(head);

  // Hair
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.35), hair);
  hairTop.position.set(0, 1.68, 0);
  group.add(hairTop);
  const hairF = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.06), hair);
  hairF.position.set(0, 1.62, 0.16);
  group.add(hairF);

  // Eyes
  const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyeP = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const x of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.04), eyeW);
    e.position.set(x, 1.5, 0.17);
    group.add(e);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.05), eyeP);
    p.position.set(x + 0.01, 1.49, 0.19);
    group.add(p);
  }

  // Arms
  for (const ax of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), skin);
    arm.position.set(ax, 0.9, 0);
    group.add(arm);
  }

  // Legs
  for (const lx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), pants);
    leg.position.set(lx, 0.2, 0);
    group.add(leg);
  }

  // Shoes
  const shoe = new THREE.MeshStandardMaterial({ color: 0x333333 });
  for (const sx of [-0.12, 0.12]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.22), shoe);
    s.position.set(sx, 0.03, 0.02);
    group.add(s);
  }

  return group;
};
