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
    locked: false,
    stamina: 100,
    staminaLocked: false,
    // Touch controls state
    touchMove: { x: 0, y: 0 },
    touchSprinting: false,
    touchJump: false
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

  // Keys (desktop)
  const keys = {};
  document.addEventListener('keydown', e => {
    if (p.locked) return;
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'f' && p.hasFlashlight && !p._fHeld) {
      p.flashlightOn = !p.flashlightOn;
      p._fHeld = true;
    }
  });
  document.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === 'f') p._fHeld = false;
  });
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

  // Collision helper
  const aabbOverlap = function (pos, box) {
    const hw = 0.25, hh = p.height;
    return pos.x + hw > box.min.x && pos.x - hw < box.max.x &&
           pos.z + hw > box.min.z && pos.z - hw < box.max.z &&
           pos.y + hh > box.min.y && pos.y < box.max.y;
  };

  p.update = function (dt) {
    if (p.locked) return;

    // Determine input from desktop keys or touch
    const forward = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    let moveX = 0, moveZ = 0;
    if (keys['w'] || p.touchMove.y > 0.3) moveZ -= 1;
    if (keys['s'] || p.touchMove.y < -0.3) moveZ += 1;
    if (keys['a'] || p.touchMove.x < -0.3) moveX -= 1;
    if (keys['d'] || p.touchMove.x > 0.3) moveX += 1;

    const wantsSprint = (keys['shift'] || p.touchSprinting) && (moveX !== 0 || moveZ !== 0);
    const wantsJump = (keys[' '] || p.touchJump) && p.onGround;
    if (wantsJump) {
      p.velocity.y = p.jumpForce;
      p.onGround = false;
      p.touchJump = false;
    }

    // Sprint with stamina lock
    const canSprint = wantsSprint && p.stamina > 0 && !p.staminaLocked;
    const spd = canSprint ? p.speed * p.sprintMultiplier : p.speed;

    const move = new THREE.Vector3();
    if (moveX !== 0 || moveZ !== 0) {
      move.addScaledVector(forward, -moveZ);
      move.addScaledVector(right, moveX);
      if (move.length() > 0) move.normalize().multiplyScalar(spd);
    }

    // Sprint stamina
    if (canSprint && move.length() > 0) {
      p.stamina = Math.max(0, p.stamina - 24 * dt);
      p.sprinting = true;
      if (p.stamina <= 0) {
        p.stamina = 0;
        p.staminaLocked = true;
      }
    } else {
      p.stamina = Math.min(100, p.stamina + 8 * dt);
      p.sprinting = false;
      if (p.stamina >= 50) p.staminaLocked = false;
    }
    window.stamina = p.stamina;
    if (window.updateStaminaBar) window.updateStaminaBar();

    // ── 3D AABB collision ──
    p.velocity.x = move.x;
    p.velocity.z = move.z;
    p.velocity.y -= 14 * dt;

    const floorY = ENGINE.currentLevel?.floorY || 0;
    const boxes = ENGINE.currentLevel?.collisionBoxes || [];
    const rawPos = p.position.clone().add(p.velocity.clone().multiplyScalar(dt));

    // Resolve X
    const tryX = p.position.clone();
    tryX.x = rawPos.x;
    for (const box of boxes) {
      if (aabbOverlap(tryX, box)) {
        tryX.x = tryX.x > (box.min.x + box.max.x) / 2 ? box.max.x + 0.25 : box.min.x - 0.25;
      }
    }

    // Step‑up on X
    if (tryX.x !== rawPos.x) {
      const stepUp = tryX.clone();
      stepUp.y += 0.3;
      let canStep = true;
      for (const box of boxes) {
        if (aabbOverlap(stepUp, box)) { canStep = false; break; }
      }
      if (canStep) { tryX.y = stepUp.y; p.velocity.y = 0; }
    }

    // Resolve Z
    const tryZ = tryX.clone();
    tryZ.z = rawPos.z;
    for (const box of boxes) {
      if (aabbOverlap(tryZ, box)) {
        tryZ.z = tryZ.z > (box.min.z + box.max.z) / 2 ? box.max.z + 0.25 : box.min.z - 0.25;
      }
    }

    // Step‑up on Z
    if (tryZ.z !== rawPos.z) {
      const stepUp = tryZ.clone();
      stepUp.y += 0.3;
      let canStep = true;
      for (const box of boxes) {
        if (aabbOverlap(stepUp, box)) { canStep = false; break; }
      }
      if (canStep) { tryZ.y = stepUp.y; p.velocity.y = 0; }
    }

    // Resolve Y (gravity + platforms)
    let finalPos = tryZ.clone();
    finalPos.y = Math.max(floorY, finalPos.y);
    p.onGround = finalPos.y <= floorY;
    if (p.onGround && p.velocity.y < 0) p.velocity.y = 0;

    // Check platforms (stairs, second floor) — only Y collision
    const platforms = ENGINE.currentLevel?.platforms || [];
    for (const plat of platforms) {
      if (finalPos.x + 0.25 > plat.min.x && finalPos.x - 0.25 < plat.max.x &&
          finalPos.z + 0.25 > plat.min.z && finalPos.z - 0.25 < plat.max.z) {
        if (finalPos.y <= plat.max.y && finalPos.y + p.height > plat.max.y) {
          finalPos.y = plat.max.y;
          p.onGround = true;
          if (p.velocity.y < 0) p.velocity.y = 0;
        }
      }
    }

    // Step‑up loop: when walking into a stair step, lift the player up
    for (let attempt = 0; attempt < 12; attempt++) {
      let stuck = false;
      for (const box of boxes) {
        if (aabbOverlap(finalPos, box)) {
          stuck = true;
          break;
        }
      }
      if (!stuck) break;
      finalPos.y += 0.3;
      // Cap — don't lift above total room height or platform height
      if (finalPos.y > 4) break;
    }

    if (p.onGround && p.velocity.y < 0) p.velocity.y = 0;

    p.position.copy(finalPos);

    // Camera
    ENGINE.camera.position.set(p.position.x, p.position.y + p.height, p.position.z);
    const euler = new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ');
    ENGINE.camera.quaternion.setFromEuler(euler);

    // Flashlight fade
    const target = p.hasFlashlight ? 1 : 0;
    p.flashlightIntensity += (target - p.flashlightIntensity) * Math.min(1, 5 * dt);
    if (p.flashlightOn === undefined) p.flashlightOn = false;
    const flIntensity = p.flashlightOn ? p.flashlightIntensity * 30 : 0;
    p.flashlightSpot.intensity += (flIntensity - p.flashlightSpot.intensity) * Math.min(1, 8 * dt);
    p.flashlightGlow.intensity = p.flashlightOn ? p.flashlightIntensity * 2 : 0;

    // Check item pickups
    const pickupRange = 1.2;
    for (let i = ENGINE.items.length - 1; i >= 0; i--) {
      const item = ENGINE.items[i];
      const dist = p.position.distanceTo(item.position);
      if (!item.collected && dist < pickupRange) {
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
      if (p.position.distanceTo(door.position) < 1.8) {
        ENGINE.player.locked = true;
        if (window.winGame) window.winGame();
      }
    }
  };

  p.position.copy(spawnPos);
  ENGINE.player = p;
  return p;
};
