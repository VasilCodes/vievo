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
  ENGINE.renderer.setAnimationLoop(null);
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
