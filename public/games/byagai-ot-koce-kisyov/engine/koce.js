ENGINE.createKoce = function (config) {
  const state = {
    mode: 'patrol',        // patrol | search | chase
    position: config.spawn.clone(),
    speed: 1.8,
    chaseSpeed: 3.5,
    patrolPath: config.patrolPath || [],
    patrolIndex: 0,
    searchTimer: 0,
    searchPos: null,
    sightRange: 10,
    hearingRange: 8,
    angleThreshold: Math.cos(THREE.MathUtils.degToRad(50)),
    noiseThreshold: 0.3,
    lastKnownPos: null,
    waitTimer: 0,
    model: null,
    bodyGroup: new THREE.Group(),
    height: 1.7,
    eyeHeight: 1.6
  };

  // Body
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a73e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), bodyMat);
  body.position.y = 0.8;
  body.castShadow = true;
  state.bodyGroup.add(body);

  // Head
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), headMat);
  head.position.y = 1.5;
  head.castShadow = true;
  state.bodyGroup.add(head);

  // Hair (brown)
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5d3a1a });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hairMat);
  hair.position.set(0, 1.7, 0.05);
  hair.scale.set(1.3, 0.3, 1);
  state.bodyGroup.add(hair);

  // Eyes (big)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const addEye = (x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
    eye.position.set(x, 1.55, 0.25);
    state.bodyGroup.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), pupilMat);
    pupil.position.set(x + 0.02, 1.54, 0.30);
    state.bodyGroup.add(pupil);
  };
  addEye(-0.08);
  addEye(0.08);

  // Red shirt
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.25), shirtMat);
  shirt.position.y = 0.55;
  state.bodyGroup.add(shirt);

  // Blue jeans
  const jeansMat = new THREE.MeshStandardMaterial({ color: 0x2255aa });
  const jeansL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.5, 0.17), jeansMat);
  jeansL.position.set(-0.15, 0.2, 0);
  state.bodyGroup.add(jeansL);
  const jeansR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.5, 0.17), jeansMat);
  jeansR.position.set(0.15, 0.2, 0);
  state.bodyGroup.add(jeansR);

  state.bodyGroup.position.copy(state.position);
  state.bodyGroup.position.y = 0;
  ENGINE.scene.add(state.bodyGroup);

  state.update = function (dt) {
    const player = ENGINE.player;
    if (!player) return;

    const toPlayer = new THREE.Vector3().copy(player.position).sub(state.position);
    const dist = toPlayer.length();
    const dirToPlayer = toPlayer.clone().normalize();

    // Direction Koce is facing
    const facing = new THREE.Vector3(0, 0, -1);
    facing.applyQuaternion(state.bodyGroup.quaternion);

    // Can see player?
    const angle = facing.dot(dirToPlayer);
    const canSee = dist < state.sightRange && angle > state.angleThreshold;
    const canHear = dist < state.hearingRange && (player.sprinting || (window.noiseLevel && window.noiseLevel > state.noiseThreshold));

    // Noise meter updates from player movement
    if (player.sprinting && dist < state.hearingRange) {
      if (window.setNoiseLevel) window.setNoiseLevel(Math.min(1, 1 - dist / state.hearingRange));
    }

    // FSM transitions
    switch (state.mode) {
      case 'patrol':
        if (canSee || canHear) {
          state.mode = 'chase';
          state.lastKnownPos = player.position.clone();
          state.waitTimer = 0;
          break;
        }
        state.patrol(dt);
        break;

      case 'chase':
        if (canSee) {
          state.lastKnownPos = player.position.clone();
          state.chaseTowards(player.position, dt);
          state.waitTimer = 0;
        } else if (state.lastKnownPos) {
          state.chaseTowards(state.lastKnownPos, dt);
          state.waitTimer += dt;
          if (state.waitTimer > 3) {
            state.mode = 'search';
            state.searchPos = state.lastKnownPos;
            state.searchTimer = 0;
            state.waitTimer = 0;
          }
        } else {
          state.mode = 'search';
          state.searchTimer = 0;
        }
        break;

      case 'search':
        if (canSee || canHear) {
          state.mode = 'chase';
          state.lastKnownPos = player.position.clone();
          state.waitTimer = 0;
          break;
        }
        state.search(dt);
        break;
    }

    // Walk animation (bob)
    const bob = Math.sin(Date.now() * 0.008) * 0.03;
    state.bodyGroup.position.y = bob;

    // Check catch
    if (dist < 0.8) {
      if (window.takeDamage) {
        window.takeDamage(3);
        state.mode = 'patrol';
        state.position.copy(config.spawn.clone());
        state.bodyGroup.position.x = state.position.x;
        state.bodyGroup.position.z = state.position.z;
        if (window.showNotification) window.showNotification('Коце те хвана!', 'error');
      }
    }
  };

  state.patrol = function (dt) {
    if (state.patrolPath.length === 0) return;
    const target = state.patrolPath[state.patrolIndex];
    const dir = new THREE.Vector3(target.x - state.position.x, 0, target.z - state.position.z);
    const dist = dir.length();
    if (dist < 0.3) {
      state.patrolIndex = (state.patrolIndex + 1) % state.patrolPath.length;
    } else {
      dir.normalize();
      state.position.x += dir.x * state.speed * dt;
      state.position.z += dir.z * state.speed * dt;
      state.bodyGroup.lookAt(target.x, state.position.y, target.z);
    }
    state.bodyGroup.position.x = state.position.x;
    state.bodyGroup.position.z = state.position.z;
  };

  state.chaseTowards = function (target, dt) {
    const dir = new THREE.Vector3(target.x - state.position.x, 0, target.z - state.position.z);
    const dist = dir.length();
    if (dist > 0.3) {
      dir.normalize();
      const spd = state.chaseSpeed;
      state.position.x += dir.x * spd * dt;
      state.position.z += dir.z * spd * dt;
      state.bodyGroup.lookAt(target.x, state.position.y, target.z);
    }
    state.bodyGroup.position.x = state.position.x;
    state.bodyGroup.position.z = state.position.z;

    // Alert nearby items
    if (window.setNoiseLevel && dist < 6) {
      window.setNoiseLevel(Math.min(1, 1 - dist / 6));
    }
  };

  state.search = function (dt) {
    state.searchTimer += dt;
    if (!state.searchPos) {
      state.mode = 'patrol';
      return;
    }
    const dir = new THREE.Vector3(state.searchPos.x - state.position.x, 0, state.searchPos.z - state.position.z);
    const dist = dir.length();
    if (dist < 0.5 || state.searchTimer > 5) {
      state.mode = 'patrol';
      state.searchTimer = 0;
    } else {
      dir.normalize();
      state.position.x += dir.x * state.speed * dt;
      state.position.z += dir.z * state.speed * dt;
      state.bodyGroup.lookAt(state.searchPos.x, state.position.y, state.searchPos.z);
    }
    state.bodyGroup.position.x = state.position.x;
    state.bodyGroup.position.z = state.position.z;
  };

  ENGINE.koce = state;
  return state;
};
