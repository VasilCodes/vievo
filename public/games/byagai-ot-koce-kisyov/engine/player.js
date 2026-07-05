ENGINE.createPlayer = function (spawnPos) {
  const p = {
    position: spawnPos.clone(),
    yaw: 0,
    pitch: 0,
    velocity: new THREE.Vector3(),
    onGround: false,
    speed: 3.0,
    sprintMultiplier: 1.6,
    jumpForce: 5,
    height: 1.6,
    sprinting: false,
    hasFlashlight: false,
    hasKey: false,
    flashlightIntensity: 0,
    locked: false
  };

  ENGINE.camera.position.copy(p.position);
  ENGINE.camera.position.y += p.height;

  // Flashlight spot
  const spot = new THREE.SpotLight(0xffeedd, 0, 20, Math.PI / 6, 0.5, 1.5);
  spot.target.position.set(0, 0, -1);
  ENGINE.camera.add(spot);
  ENGINE.camera.add(spot.target);
  ENGINE.scene.add(spot);
  p.flashlightSpot = spot;

  // Flashlight glow (point)
  const glow = new THREE.PointLight(0xffeedd, 0, 8);
  glow.position.set(0.3, -0.2, -0.5);
  ENGINE.camera.add(glow);
  p.flashlightGlow = glow;

  // Keys
  const keys = {};
  document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' && p.onGround && !p.locked) {
      p.velocity.y = p.jumpForce;
      p.onGround = false;
    }
  });
  document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  p.keys = keys;

  // Mouse
  const canvas = ENGINE.renderer.domElement;
  canvas.addEventListener('click', () => canvas.requestPointerLock());
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas || p.locked) return;
    p.yaw -= e.movementX * 0.002;
    p.pitch -= e.movementY * 0.002;
    p.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, p.pitch));
  });

  p.update = function (dt) {
    if (p.locked) return;
    const sprint = keys['shift'] && p.stamina > 0;
    const spd = sprint ? p.speed * p.sprintMultiplier : p.speed;
    const forward = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    const move = new THREE.Vector3();
    if (keys['w']) move.add(forward);
    if (keys['s']) move.sub(forward);
    if (keys['a']) move.sub(right);
    if (keys['d']) move.add(right);
    if (move.length() > 0) move.normalize().multiplyScalar(spd);

    // Sprint stamina
    if (sprint && move.length() > 0) {
      p.stamina = Math.max(0, p.stamina - 20 * dt);
      p.sprinting = true;
    } else {
      p.stamina = Math.min(100, p.stamina + 8 * dt);
      p.sprinting = false;
    }
    window.stamina = p.stamina;
    if (window.updateStaminaBar) window.updateStaminaBar();

    // Gravity
    p.velocity.x = move.x;
    p.velocity.z = move.z;
    p.velocity.y -= 12 * dt;

    // Collision with floor
    const floorY = ENGINE.currentLevel?.floorY || 0;
    const newPos = p.position.clone().add(p.velocity.clone().multiplyScalar(dt));
    newPos.y = Math.max(floorY, newPos.y);
    p.onGround = newPos.y <= floorY;
    if (p.onGround && p.velocity.y < 0) p.velocity.y = 0;

    // AABB collision with walls
    const half = 0.25;
    const boxes = ENGINE.currentLevel?.collisionBoxes || [];
    let finalPos = newPos.clone();
    for (const box of boxes) {
      if (finalPos.x + half > box.min.x && finalPos.x - half < box.max.x &&
          finalPos.z + half > box.min.z && finalPos.z - half < box.max.z &&
          finalPos.y + p.height > box.min.y && finalPos.y < box.max.y) {
        // Push out along shortest axis
        const overlapX = Math.min(finalPos.x + half - box.min.x, box.max.x - finalPos.x + half);
        const overlapZ = Math.min(finalPos.z + half - box.min.z, box.max.z - finalPos.z + half);
        if (overlapX < overlapZ) {
          finalPos.x = finalPos.x > (box.min.x + box.max.x) / 2 ? box.max.x + half : box.min.x - half;
        } else {
          finalPos.z = finalPos.z > (box.min.z + box.max.z) / 2 ? box.max.z + half : box.min.z - half;
        }
      }
    }

    p.position.copy(finalPos);

    // Camera
    ENGINE.camera.position.set(p.position.x, p.position.y + p.height, p.position.z);
    const euler = new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ');
    ENGINE.camera.quaternion.setFromEuler(euler);

    // Flashlight fade
    const target = p.hasFlashlight ? 1 : 0;
    p.flashlightIntensity += (target - p.flashlightIntensity) * Math.min(1, 5 * dt);
    p.flashlightSpot.intensity = p.flashlightIntensity * 30;
    p.flashlightGlow.intensity = p.flashlightIntensity * 2;

    // Check item pickups
    for (let i = ENGINE.items.length - 1; i >= 0; i--) {
      const item = ENGINE.items[i];
      if (!item.collected && p.position.distanceTo(item.position) < 1.0) {
        if (item.type === 'flashlight') {
          p.hasFlashlight = true;
          item.collected = true;
          ENGINE.levelGroup.remove(item.mesh);
          ENGINE.items.splice(i, 1);
          if (window.showNotification) window.showNotification('Намери фенерче! Натисни F за светлина', 'success');
          if (window.showBattery) window.showBattery(true);
        } else if (item.type === 'key') {
          p.hasKey = true;
          item.collected = true;
          ENGINE.levelGroup.remove(item.mesh);
          ENGINE.items.splice(i, 1);
          if (window.showNotification) window.showNotification('Взе ключа! Сега намери вратата!', 'success');
        }
      }
    }

    // Check exit
    if (ENGINE.exitDoor && p.hasKey) {
      const door = ENGINE.exitDoor;
      if (p.position.distanceTo(door.position) < 1.5) {
        ENGINE.player.locked = true;
        if (window.winGame) window.winGame();
      }
    }
  };

  // Flashlight toggle
  document.addEventListener('keydown', e => {
    if (e.key === 'f' && p.hasFlashlight) {
      const s = p.flashlightSpot;
      s.intensity = s.intensity > 1 ? 0 : s.intensity > 0 ? p.flashlightIntensity * 30 : 0;
    }
  });

  p.stamina = 100;
  p.position.copy(spawnPos);
  ENGINE.player = p;
  return p;
};
