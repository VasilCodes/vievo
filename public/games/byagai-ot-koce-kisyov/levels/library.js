// ─── Library Zone — Levels 1 to 10 ───

(function () {

const levels = {};

// ======= LEVEL 1 =======
levels[1] = {
  room: { w: 6, d: 6, h: 3, floorY: 0 },
  playerSpawn: { x: -1.5, z: -1.5 },
  flashlightPos: { x: 0.5, z: 0.5 },
  keyPos: { x: -1, z: 2 },
  shelves: [
    { x: -1.8, z: 0, w: 0.6, d: 2 }
  ],
  tables: [
    { x: 1.5, z: -1, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 2, z: -2 },
    patrolPath: [
      { x: 2, z: 1 },
      { x: -2, z: 1 },
      { x: -2, z: -2 },
      { x: 2, z: -2 }
    ],
    speed: 1.2,
    chaseSpeed: 2.5
  }
};

// ======= LEVEL 2 =======
levels[2] = {
  room: { w: 7, d: 7, h: 3, floorY: 0 },
  playerSpawn: { x: -2, z: -2 },
  flashlightPos: { x: 0, z: 0 },
  keyPos: { x: 2, z: 2 },
  shelves: [
    { x: -2, z: -1.5, w: 0.6, d: 2 },
    { x: -2, z: 1.5, w: 0.6, d: 2 },
    { x: 2, z: 0, w: 0.6, d: 2 }
  ],
  tables: [
    { x: 0, z: -2, w: 0.6, d: 0.4 },
    { x: 0, z: 2, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 3, z: -3 },
    patrolPath: [
      { x: 3, z: 0 },
      { x: 0, z: 3 },
      { x: -3, z: 0 },
      { x: 0, z: -3 }
    ],
    speed: 1.3,
    chaseSpeed: 2.6
  }
};

// ======= LEVEL 3 =======
levels[3] = {
  room: { w: 8, d: 8, h: 3, floorY: 0 },
  playerSpawn: { x: -2.5, z: -2.5 },
  flashlightPos: { x: 1, z: 1 },
  keyPos: { x: -2, z: 2.5 },
  shelves: [
    { x: -2.5, z: -1, w: 0.6, d: 2.5 },
    { x: -2.5, z: 2, w: 0.6, d: 1.5 },
    { x: 2.5, z: -2, w: 0.6, d: 2 },
    { x: 0, z: -2.5, w: 2, d: 0.6 }
  ],
  tables: [
    { x: 1.5, z: 0, w: 0.6, d: 0.4 },
    { x: -1, z: -2, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 3, z: 3 },
    patrolPath: [
      { x: 3, z: -2 },
      { x: -1, z: -3 },
      { x: -3, z: 1 },
      { x: 1, z: 3 }
    ],
    speed: 1.4,
    chaseSpeed: 2.8
  }
};

// ======= LEVEL 4 =======
levels[4] = {
  room: { w: 8, d: 10, h: 3, floorY: 0 },
  playerSpawn: { x: -2, z: -3 },
  flashlightPos: { x: 2, z: -1 },
  keyPos: { x: -2, z: 3 },
  shelves: [
    { x: -3, z: -2, w: 0.6, d: 2.5 },
    { x: -3, z: 1.5, w: 0.6, d: 2.5 },
    { x: 0, z: -3.5, w: 2, d: 0.6 },
    { x: 3, z: 0, w: 0.6, d: 2 },
    { x: 1, z: 3.5, w: 1.5, d: 0.6 }
  ],
  tables: [
    { x: 0, z: 0, w: 0.6, d: 0.4 },
    { x: 2.5, z: -2.5, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 3.5, z: 4 },
    patrolPath: [
      { x: 3.5, z: -1 },
      { x: 0, z: -4 },
      { x: -3.5, z: 0 },
      { x: -1, z: 4 }
    ],
    speed: 1.5,
    chaseSpeed: 3.0
  }
};

// ======= LEVEL 5 =======
levels[5] = {
  room: { w: 9, d: 9, h: 3, floorY: 0 },
  playerSpawn: { x: -3, z: -3 },
  flashlightPos: { x: 0, z: 1 },
  keyPos: { x: 3, z: -2 },
  shelves: [
    { x: -3, z: -2, w: 0.6, d: 2 },
    { x: -3, z: 1, w: 0.6, d: 2 },
    { x: 0, z: -3, w: 2.5, d: 0.6 },
    { x: 3, z: 0, w: 0.6, d: 2.5 },
    { x: -1, z: 3, w: 1.5, d: 0.6 }
  ],
  tables: [
    { x: 0, z: -1.5, w: 0.6, d: 0.4 },
    { x: 2, z: 2, w: 0.6, d: 0.4 },
    { x: -2, z: 2.5, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 4, z: 4 },
    patrolPath: [
      { x: 4, z: -2 },
      { x: -2, z: -4 },
      { x: -4, z: 2 },
      { x: 2, z: 4 }
    ],
    speed: 1.6,
    chaseSpeed: 3.2
  }
};

// ======= LEVEL 6 =======
levels[6] = {
  room: { w: 10, d: 10, h: 3, floorY: 0 },
  playerSpawn: { x: -3.5, z: -3.5 },
  flashlightPos: { x: 1.5, z: 0.5 },
  keyPos: { x: -2, z: 3.5 },
  shelves: [
    { x: -3.5, z: -2.5, w: 0.6, d: 2 },
    { x: -3.5, z: 1, w: 0.6, d: 2 },
    { x: -0.5, z: -3.5, w: 2, d: 0.6 },
    { x: -0.5, z: 3.5, w: 2, d: 0.6 },
    { x: 3.5, z: -2, w: 0.6, d: 2.5 },
    { x: 3.5, z: 1.5, w: 0.6, d: 2 }
  ],
  tables: [
    { x: 0, z: -1, w: 0.6, d: 0.4 },
    { x: 1.5, z: 2, w: 0.6, d: 0.4 },
    { x: -2, z: 0, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 4.5, z: 4.5 },
    patrolPath: [
      { x: 4.5, z: 0 },
      { x: 2, z: -4.5 },
      { x: -2, z: -4.5 },
      { x: -4.5, z: 0 },
      { x: -2, z: 4.5 },
      { x: 2, z: 4.5 }
    ],
    speed: 1.7,
    chaseSpeed: 3.3
  }
};

// ======= LEVEL 7 =======
levels[7] = {
  room: { w: 10, d: 12, h: 3, floorY: 0 },
  playerSpawn: { x: -3, z: -4 },
  flashlightPos: { x: 1, z: -1 },
  keyPos: { x: -3, z: 4 },
  shelves: [
    { x: -4, z: -3, w: 0.6, d: 2 },
    { x: -4, z: 0, w: 0.6, d: 2 },
    { x: -4, z: 3, w: 0.6, d: 2 },
    { x: -1, z: -4.5, w: 2, d: 0.6 },
    { x: 2, z: -4.5, w: 1.5, d: 0.6 },
    { x: 4, z: -1, w: 0.6, d: 2 },
    { x: 4, z: 2, w: 0.6, d: 2 }
  ],
  tables: [
    { x: 0, z: 0, w: 0.6, d: 0.4 },
    { x: 2, z: 1.5, w: 0.6, d: 0.4 },
    { x: -2, z: -2, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 4.5, z: 5.5 },
    patrolPath: [
      { x: 4.5, z: -2 },
      { x: 0, z: -5.5 },
      { x: -4.5, z: -1 },
      { x: -3, z: 5.5 },
      { x: 2, z: 5.5 }
    ],
    speed: 1.8,
    chaseSpeed: 3.4
  }
};

// ======= LEVEL 8 =======
levels[8] = {
  room: { w: 11, d: 11, h: 3, floorY: 0 },
  playerSpawn: { x: -4, z: -4 },
  flashlightPos: { x: 2, z: 2 },
  keyPos: { x: -3, z: 4 },
  shelves: [
    { x: -4.5, z: -3, w: 0.6, d: 2 },
    { x: -4.5, z: 0, w: 0.6, d: 2 },
    { x: -4.5, z: 3, w: 0.6, d: 2 },
    { x: -1.5, z: -4.5, w: 2, d: 0.6 },
    { x: -1.5, z: 4.5, w: 2, d: 0.6 },
    { x: 2, z: -4.5, w: 1.5, d: 0.6 },
    { x: 4.5, z: -2, w: 0.6, d: 2 },
    { x: 4.5, z: 1.5, w: 0.6, d: 2 }
  ],
  tables: [
    { x: 0, z: -2, w: 0.6, d: 0.4 },
    { x: 0, z: 2, w: 0.6, d: 0.4 },
    { x: 2.5, z: 0, w: 0.6, d: 0.4 },
    { x: -2, z: 0, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 5, z: 5 },
    patrolPath: [
      { x: 5, z: -3 },
      { x: 0, z: -5 },
      { x: -5, z: -1 },
      { x: -5, z: 3 },
      { x: -1, z: 5 },
      { x: 4, z: 5 }
    ],
    speed: 1.9,
    chaseSpeed: 3.6
  }
};

// ======= LEVEL 9 =======
levels[9] = {
  room: { w: 12, d: 12, h: 3, floorY: 0 },
  playerSpawn: { x: -4, z: -5 },
  flashlightPos: { x: 0, z: 0 },
  keyPos: { x: 4, z: -3 },
  shelves: [
    { x: -5, z: -4, w: 0.6, d: 2 },
    { x: -5, z: -1, w: 0.6, d: 2 },
    { x: -5, z: 2, w: 0.6, d: 2 },
    { x: -2, z: -5.5, w: 2, d: 0.6 },
    { x: -2, z: 5.5, w: 2, d: 0.6 },
    { x: 1, z: -5.5, w: 1.5, d: 0.6 },
    { x: 1, z: 5.5, w: 1.5, d: 0.6 },
    { x: 5, z: -3, w: 0.6, d: 2 },
    { x: 5, z: 1, w: 0.6, d: 2 },
    { x: 5, z: 4, w: 0.6, d: 1.5 }
  ],
  tables: [
    { x: -1.5, z: 0, w: 0.6, d: 0.4 },
    { x: 2, z: -2, w: 0.6, d: 0.4 },
    { x: 2, z: 2, w: 0.6, d: 0.4 },
    { x: -3.5, z: -2.5, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 5.5, z: 5.5 },
    patrolPath: [
      { x: 5.5, z: 0 },
      { x: 2.5, z: -5.5 },
      { x: -2, z: -5.5 },
      { x: -5.5, z: -2 },
      { x: -5.5, z: 2.5 },
      { x: -2, z: 5.5 },
      { x: 3, z: 5.5 }
    ],
    speed: 2.0,
    chaseSpeed: 3.8
  }
};

// ======= LEVEL 10 =======
levels[10] = {
  room: { w: 14, d: 12, h: 3, floorY: 0 },
  playerSpawn: { x: -5, z: -4 },
  flashlightPos: { x: 0, z: -1 },
  keyPos: { x: 5, z: -3 },
  shelves: [
    { x: -6, z: -4, w: 0.6, d: 2 },
    { x: -6, z: -1, w: 0.6, d: 2 },
    { x: -6, z: 2, w: 0.6, d: 2 },
    { x: -6, z: 4.5, w: 0.6, d: 1 },
    { x: -3, z: -5.5, w: 2, d: 0.6 },
    { x: -3, z: 5.5, w: 2, d: 0.6 },
    { x: 0, z: -5.5, w: 2, d: 0.6 },
    { x: 0, z: 5.5, w: 2, d: 0.6 },
    { x: 3, z: -5.5, w: 1.5, d: 0.6 },
    { x: 3, z: 5.5, w: 1.5, d: 0.6 },
    { x: 6, z: -3, w: 0.6, d: 2 },
    { x: 6, z: 0, w: 0.6, d: 2 },
    { x: 6, z: 3, w: 0.6, d: 1.5 }
  ],
  tables: [
    { x: -3.5, z: 0, w: 0.6, d: 0.4 },
    { x: -1, z: -2, w: 0.6, d: 0.4 },
    { x: -1, z: 2, w: 0.6, d: 0.4 },
    { x: 2, z: 0, w: 0.6, d: 0.4 },
    { x: 4.5, z: -1.5, w: 0.6, d: 0.4 }
  ],
  koce: {
    spawn: { x: 6.5, z: 5.5 },
    patrolPath: [
      { x: 6.5, z: 0 },
      { x: 4, z: -5.5 },
      { x: 0, z: -5.5 },
      { x: -4, z: -5.5 },
      { x: -6.5, z: -2 },
      { x: -6.5, z: 2 },
      { x: -4, z: 5.5 },
      { x: 0, z: 5.5 },
      { x: 4, z: 5.5 },
      { x: 6.5, z: 3 }
    ],
    speed: 2.2,
    chaseSpeed: 4.0
  }
};

// Register all
Object.keys(levels).forEach(k => {
  LEVELS.registry[parseInt(k)] = levels[k];
});

})();
