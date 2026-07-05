const LEVELS = {};

// ─── Material cache ───
const MATS = {
  floor: new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xd4c5a9, roughness: 0.8 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xe8ddd0, roughness: 0.9 }),
  shelf: new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.7 }),
  shelfBooks: new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.6 }),
  table: new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.7 }),
  door: new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.6 }),
  doorFrame: new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 0.7 }),
  glow: new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 }),
  key: new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.3 }),
  flashlight: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.3 }),
  light: new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffeecc, emissiveIntensity: 0.3 }),
  // Corridor zone
  locker: new THREE.MeshStandardMaterial({ color: 0x5b7fa5, roughness: 0.5, metalness: 0.3 }),
  lockerHandle: new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.3 }),
  bench: new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.6 }),
  benchMetal: new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5, roughness: 0.4 }),
  floorTile: new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.6 })
};

// ─── Room builder ───
LEVELS.buildRoom = function (cfg) {
  const g = ENGINE.levelGroup;
  const boxes = [];

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.d), MATS.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, cfg.floorY || 0, 0);
  floor.receiveShadow = true;
  g.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.d), MATS.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, cfg.h, 0);
  g.add(ceil);

  // Walls (4 sides)
  const wallH = cfg.h - (cfg.floorY || 0);
  const addWall = (w, h, pos, rotY) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), MATS.wall);
    m.position.copy(pos);
    m.rotation.y = rotY || 0;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    // Collision
    const hw = w / 2, hh = h / 2;
    boxes.push({
      min: new THREE.Vector3(pos.x - hw - 0.1, pos.y - hh, pos.z - 0.2),
      max: new THREE.Vector3(pos.x + hw + 0.1, pos.y + hh, pos.z + 0.2)
    });
  };

  const hw = cfg.w / 2, hd = cfg.d / 2;
  const wallY = wallH / 2;
  // North (-z)
  addWall(cfg.w + 0.3, wallH, new THREE.Vector3(0, wallY, -hd), 0);
  // South (+z) - with door gap
  const doorW = 0.9;
  const doorL = (cfg.w - doorW) / 2;
  if (doorL > 0) {
    addWall(doorL, wallH, new THREE.Vector3(-(doorW / 2 + doorL / 2), wallY, hd), 0);
    addWall(doorL, wallH, new THREE.Vector3(doorW / 2 + doorL / 2, wallY, hd), 0);
  }
  // West (-x)
  addWall(cfg.d + 0.3, wallH, new THREE.Vector3(-hw, wallY, 0), Math.PI / 2);
  // East (+x)
  addWall(cfg.d + 0.3, wallH, new THREE.Vector3(hw, wallY, 0), Math.PI / 2);

  // Exit door on south wall
  const doorPos = new THREE.Vector3(0, 1, hd - 0.1);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, 2, 0.1), MATS.door);
  doorMesh.position.copy(doorPos);
  doorMesh.castShadow = true;
  g.add(doorMesh);

  const frameMat = MATS.doorFrame;
  // Door frame
  const frameParts = [
    { s: [0.08, 2.2, 0.12], p: [-doorW / 2, 1.1, hd - 0.05] },
    { s: [0.08, 2.2, 0.12], p: [doorW / 2, 1.1, hd - 0.05] },
    { s: [doorW + 0.16, 0.08, 0.12], p: [0, 2.2, hd - 0.05] }
  ];
  frameParts.forEach(fp => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...fp.s), frameMat);
    m.position.copy(fp.p);
    m.castShadow = true;
    g.add(m);
  });

  // Door glow (EXIT sign)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({
    color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.8,
    transparent: true, opacity: 0.9
  }));
  glow.position.set(0, 2.1, hd - 0.05);
  g.add(glow);

  ENGINE.exitDoor = { position: doorPos, mesh: doorMesh };

  // Ceiling lights
  for (let x = -cfg.w / 3; x <= cfg.w / 3 + 0.1; x += cfg.w / 3) {
    for (let z = -cfg.d / 3; z <= cfg.d / 3 + 0.1; z += cfg.d / 3) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.15, 8), MATS.light);
      l.position.set(x, cfg.h - 0.02, z);
      l.rotation.x = -Math.PI / 2;
      g.add(l);
      // Point light
      const pl = new THREE.PointLight(0xffeedd, 0.4, 6);
      pl.position.set(x, cfg.h - 0.1, z);
      ENGINE.scene.add(pl);
      ENGINE.ceilingLights.push(pl);
    }
  }

  return { collisionBoxes: boxes, doorPos };
};

// ─── Furniture helpers ───
LEVELS.addShelf = function (x, z, w, d) {
  const g = ENGINE.levelGroup;
  const boxes = ENGINE.currentLevel.collisionBoxes;
  const h = 2;
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MATS.shelf);
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Books (colorful boxes on shelves)
  const colors = [0xe63946, 0x457b9d, 0x2a9d8f, 0xe9c46a, 0xf4a261, 0x9b5de5];
  for (let i = 0; i < 4; i++) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.8 / 4, 0.12, d * 0.6),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.7 })
    );
    book.position.set(
      x + (i - 1.5) * (w * 0.18),
      0.3 + i * 0.45,
      z + (d * 0.05)
    );
    g.add(book);
  }
  // Collision
  const hw = w / 2, hd = d / 2;
  boxes.push({
    min: new THREE.Vector3(x - hw, 0, z - hd),
    max: new THREE.Vector3(x + hw, h, z + hd)
  });
};

LEVELS.addTable = function (x, z, w, d) {
  const g = ENGINE.levelGroup;
  const boxes = ENGINE.currentLevel.collisionBoxes;
  const h = 0.7;
  // Top
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), MATS.table);
  top.position.set(x, h, z);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);
  // Legs
  const legPos = [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05],
                  [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]];
  legPos.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.04), MATS.table);
    leg.position.set(x + lx, h / 2, z + lz);
    g.add(leg);
  });
  boxes.push({
    min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, h + 0.05, z + d / 2)
  });
};

LEVELS.addFlashlight = function (x, z) {
  const g = ENGINE.levelGroup;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.15, 8), MATS.flashlight);
  body.position.set(x, 0.1, z);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), new THREE.MeshStandardMaterial({
    color: 0xffeecc, emissive: 0xffeecc, emissiveIntensity: 0.3
  }));
  head.position.set(x, 0.1, z + 0.08);
  head.rotation.x = -Math.PI / 2;
  g.add(head);
  ENGINE.items.push({
    type: 'flashlight',
    position: new THREE.Vector3(x, 0.1, z),
    mesh: body,
    collected: false
  });
};

LEVELS.addKey = function (x, z) {
  const g = ENGINE.levelGroup;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 12), MATS.key);
  ring.position.set(x, 0.1, z);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.005), MATS.key);
  shaft.position.set(x, 0.06, z);
  g.add(shaft);
  ENGINE.items.push({
    type: 'key',
    position: new THREE.Vector3(x, 0.1, z),
    mesh: ring,
    collected: false
  });
};

// ─── Corridor furniture ───
LEVELS.addLocker = function (x, z, w, d) {
  const g = ENGINE.levelGroup;
  const boxes = ENGINE.currentLevel.collisionBoxes;
  const h = 1.8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MATS.locker);
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Handle
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.03), MATS.lockerHandle);
  handle.position.set(x, 0.85, z + (d / 2 + 0.02) * Math.sign(z || 1));
  g.add(handle);
  boxes.push({
    min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, h, z + d / 2)
  });
};

LEVELS.addBench = function (x, z, w) {
  const g = ENGINE.levelGroup;
  const boxes = ENGINE.currentLevel.collisionBoxes;
  const h = 0.45;
  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.35), MATS.bench);
  seat.position.set(x, h, z);
  seat.castShadow = true;
  g.add(seat);
  // Legs
  const legOff = w / 2 - 0.05;
  for (const lx of [-legOff, legOff]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.04), MATS.benchMetal);
    leg.position.set(x + lx, h / 2, z);
    g.add(leg);
  }
  boxes.push({
    min: new THREE.Vector3(x - w / 2, 0, z - 0.2),
    max: new THREE.Vector3(x + w / 2, h + 0.04, z + 0.2)
  });
};

// ─── Zone name map ───
LEVELS.zoneNames = {
  1: 'Библиотека', 2: 'Библиотека', 3: 'Библиотека', 4: 'Библиотека', 5: 'Библиотека',
  6: 'Библиотека', 7: 'Библиотека', 8: 'Библиотека', 9: 'Библиотека', 10: 'Библиотека',
  11: 'Коридор', 12: 'Коридор', 13: 'Коридор', 14: 'Коридор', 15: 'Коридор',
  16: 'Коридор', 17: 'Коридор', 18: 'Коридор', 19: 'Коридор', 20: 'Коридор',
  21: 'Столова', 22: 'Столова', 23: 'Столова', 24: 'Столова', 25: 'Столова',
  26: 'Столова', 27: 'Столова', 28: 'Столова', 29: 'Столова', 30: 'Столова'
};

// ─── Level loading ───
LEVELS.currentLevelNum = 0;

LEVELS.load = function (num) {
  ENGINE.clearLevel();
  ENGINE.currentLevel = { collisionBoxes: [] };

  const levelData = LEVELS.registry[num];
  if (!levelData) {
    console.error('Level not found:', num);
    return;
  }

  // Build room
  const result = LEVELS.buildRoom(levelData.room);
  ENGINE.currentLevel.collisionBoxes = result.collisionBoxes;
  ENGINE.currentLevel.floorY = levelData.room.floorY || 0;
  ENGINE.currentLevelNum = num;

  // Furniture
  (levelData.shelves || []).forEach(s => LEVELS.addShelf(s.x, s.z, s.w || 0.8, s.d || 0.4));
  (levelData.tables || []).forEach(t => LEVELS.addTable(t.x, t.z, t.w || 0.6, t.d || 0.4));
  (levelData.lockers || []).forEach(l => LEVELS.addLocker(l.x, l.z, l.w || 0.5, l.d || 0.4));
  (levelData.benches || []).forEach(b => LEVELS.addBench(b.x, b.z, b.w || 1.2));

  // Items
  if (levelData.flashlightPos) LEVELS.addFlashlight(levelData.flashlightPos.x, levelData.flashlightPos.z);
  if (levelData.keyPos) LEVELS.addKey(levelData.keyPos.x, levelData.keyPos.z);

  // Player
  if (ENGINE.createPlayer) {
    ENGINE.createPlayer(new THREE.Vector3(levelData.playerSpawn.x, levelData.room.floorY || 0, levelData.playerSpawn.z));
  }

  // Koce
  if (ENGINE.createKoce && levelData.koce) {
    const kc = levelData.koce;
    ENGINE.createKoce({
      spawn: new THREE.Vector3(kc.spawn.x, kc.spawn.y || 0, kc.spawn.z),
      patrolPath: (kc.patrolPath || []).map(p => new THREE.Vector3(p.x, p.y || 0, p.z)),
      speed: kc.speed,
      chaseSpeed: kc.chaseSpeed
    });
  }

  const zone = LEVELS.zoneNames[num] || 'Зона';
  if (window.showNotification) {
    window.showNotification(`Ниво ${num} — ${zone}`, 'success');
  }
};

LEVELS.registry = {};
