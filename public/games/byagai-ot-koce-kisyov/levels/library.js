// ─── Library Zone — Levels 1 to 10 ───

(function () {

const levels = {};

// ======= LEVEL 1 — Двуетажна библиотека =======
levels[1] = {
  twoStory: true,
  room: { w: 18, d: 16, h: 6.2, floorY: 0 },
  secondFloor: { w: 12, d: 9, x: -2, z: -3, y: 3.1 },
  stairs: {
    x: -7, z: 6.5, bottomY: 0, topY: 3.1,
    w: 1.2, d: 5.5, dirX: 0, dirZ: -1, steps: 11
  },
  playerSpawn: { x: 0, z: 7 },
  flashlightPos: { x: 4, z: 4 },
  keyPos: { x: -6, z: -2, y: 3.3 },
  padlock: true,

  // Ground‑floor shelves (two rows each side of corridor)
  shelfPairs: [
    { x: -2.5, z: 5.5, w: 0.5, d: 1.8, spacing: 0.7 },
    { x: -2.5, z: 2,   w: 0.5, d: 1.8, spacing: 0.7 },
    { x: -2.5, z: -1.5, w: 0.5, d: 1.8, spacing: 0.7 },
    { x: 2.5,  z: 5.5, w: 0.5, d: 1.8, spacing: 0.7 },
    { x: 2.5,  z: 2,   w: 0.5, d: 1.8, spacing: 0.7 },
    { x: 2.5,  z: -1.5, w: 0.5, d: 1.8, spacing: 0.7 },
  ],
  // Extra shelves along far walls
  shelves: [
    { x: -6.5, z: 6, w: 0.5, d: 1.5 },
    { x: -6.5, z: 3, w: 0.5, d: 1.5 },
    { x: 6.5,  z: 6, w: 0.5, d: 1.5 },
    { x: 6.5,  z: 3, w: 0.5, d: 1.5 },
  ],

  // Tables with chairs (west side, reading area)
  tables: [
    { x: -5.5, z: 6, w: 0.6, d: 0.4 },
    { x: -5.5, z: 4, w: 0.6, d: 0.4 },
    { x: -5.5, z: 2, w: 0.6, d: 0.4 },
  ],
  chairs: [
    { x: -5, z: 6.2 }, { x: -5, z: 4.2 }, { x: -5, z: 2.2 },
  ],

  // Computer desks (east side)
  computerDesks: [
    { x: 5.5, z: 6, dir: 0 },
    { x: 5.5, z: 4, dir: 0 },
    { x: 5.5, z: 2, dir: 0 },
  ],

  // Sofas centre‑west
  sofas: [
    { x: -1, z: 6.5, w: 1.6 },
    { x: 1.5, z: 6.5, w: 1.6 },
  ],

  // Second‑floor furniture (dim, tables + chairs + key area)
  floor2Tables: [
    { x: -5, z: -3, w: 0.6, d: 0.4 },
    { x: -5, z: -1, w: 0.6, d: 0.4 },
    { x: -3, z: -5, w: 0.6, d: 0.4 },
    { x: -1, z: -5, w: 0.6, d: 0.4 },
  ],
  floor2Chairs: [
    { x: -4.5, z: -2.8 },
    { x: -4.5, z: -0.8 },
    { x: -2.5, z: -4.8 },
    { x: -0.5, z: -4.8 },
  ],
  floor2Shelves: [
    { x: -7, z: -2, w: 0.4, d: 0.8 },
    { x: -7, z: -4, w: 0.4, d: 0.8 },
  ],

  koce: {
    spawn: { x: 0, z: 5 },
    patrolPath: [
      { x: 0, z: 7 },
      { x: 5, z: 7 },
      { x: 5, z: -6 },
      { x: -5, z: -6 },
      { x: -5, z: 7 },
      { x: 0, z: 7 },
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
