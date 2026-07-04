// 3D Game "Бягай от Коце Кисьов" using Three.js & Firebase
let scene, camera, renderer;
let gameActive = false;
let gameTime = 0, timerInterval;

// Player states
const player = {
  height: 1.6,
  speed: 0.08,
  runSpeed: 0.15,
  crawlSpeed: 0.04,
  stamina: 100,
  flashlight: false,
  flashlightBattery: 100,
  noise: 0,
  inventory: [],
  activeSlot: 1,
  hiding: false,
  currentLocker: null,
  activeSkin: 'default',
  speedMultiplier: 1.0,
  noiseMultiplier: 1.0,
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Vector2(0, 0), // yaw, pitch
  isCrawling: false,
  velocity: new THREE.Vector3(0, 0, 0),
  isGrounded: true,
  jumpStrength: 5.2,
  maxHearts: 3,
  hearts: 3
};

// Key controls
const keys = { w: false, a: false, s: false, d: false, shift: false, ctrl: false };

// Antagonist "Koce"
const koce = {
  mesh: null,
  position: new THREE.Vector3(15, 0, 15),
  speed: 0.032,
  chaseSpeed: 0.07,
  state: 'patrol', // patrol, search, chase
  lastKnownPlayerPos: null,
  searchTimer: 0,
  patrolTarget: new THREE.Vector3(),
  soundTimer: 0,
  visionRange: 18,
  hidingSpotCheckChance: 0.3
};

// Game data & Levels
let currentLevel = 1;
let currentPart = 1;
let levelMap = []; // Collision meshes
let interactiveObjects = []; // Chests, keys, doors, fallables
let particles = [];
let voiceLines = {
  patrol: ["Къде си?", "Кой вдига шум?", "Тук ли има някой?", "Излез, няма да ти направя нищо..."],
  search: ["Чух нещо...", "Знам, че си тук!", "Ей сега ще те намеря!"],
  chase: ["Видях те!", "Бягай, няма къде да се скриеш!", "Спри се!"]
};

// UI and Firebase
let userCredits = 0;
let userXP = 0;
let userLevel = 1;
let currentUser = null;
let currentUserData = null;
let ownedSkins = ['default'];
let shopItems = [];
let dailyQuests = [];
let previewScene, previewCamera, previewRenderer, previewMesh;
let playerCustomStyle = { shirtColor: '#4caf50', pantsColor: '#1d3557', hairStyle: 'brown_short' };
let gamePaused = false;
let hoveredObject = null;

// Sound Synth (Web Audio API)
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'click') {
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } else if (type === 'step') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, audioCtx.currentTime);
    gain.gain.setValueAtTime(player.isCrawling ? 0.02 : (keys.shift ? 0.15 : 0.08), audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } else if (type === 'alert') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  } else if (type === 'win') {
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.setValueAtTime(400, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } else if (type === 'gameover') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 1.2);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
  } else if (type === 'heartbeat') {
    osc.frequency.setValueAtTime(60, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  }
}

async function rewardXPAndCredits(xpAmount, creditsAmount, reason) {
  if (!currentUser || !currentUserData) return;

  const currentXP = currentUserData.xp || 0;
  const newXP = currentXP + xpAmount;
  const newCredits = (currentUserData.credits || 0) + creditsAmount;

  const currentLevel = currentUserData.level || 1;
  const newLevel = Math.floor(newXP / 100) + 1;

  const updates = {
    xp: newXP,
    credits: newCredits,
    level: newLevel
  };

  let leveledUp = false;
  if (newLevel > currentLevel) {
    leveledUp = true;
    const levelBonus = newLevel * 50;
    updates.credits += levelBonus;
  }

  try {
    await db.collection('users').doc(currentUser.uid).update(updates);
    currentUserData.xp = updates.xp;
    currentUserData.credits = updates.credits;
    currentUserData.level = updates.level;

    if (creditsAmount > 0) {
      showNotification(`Получи +${creditsAmount} <i class="fas fa-coins"></i> и +${xpAmount} XP (${reason})`, 'success');
    }
    if (leveledUp) {
      showNotification(`<i class="fas fa-crown"></i> Честито! Достигна ниво ${newLevel} и получи бонус от ${newLevel * 50} <i class="fas fa-coins"></i>!`, 'success');
    }
  } catch (err) {
    console.error('Грешка при актуализиране на XP/Кредити:', err);
  }
}

// -------------------------------------------------------------
// Firebase Auth and Realtime Database Listener
// -------------------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    // Load User Data
    db.collection('users').doc(user.uid).onSnapshot(async (doc) => {
      if (doc.exists) {
        const d = doc.data();
        currentUserData = d;
        userCredits = d.credits || 0;
        userXP = d.xp || 0;
        userLevel = d.level || 1;
        
        // Зареждане на къстъмизирания скин на играча
        if (!d.characterStyle) {
          const creatorOverlay = document.getElementById('characterCreatorOverlay');
          if (creatorOverlay) creatorOverlay.style.display = 'flex';
          initCreatorPreviewScene();
        } else {
          playerCustomStyle = d.characterStyle;
          closetShirtColor = playerCustomStyle.shirtColor || '#4caf50';
          closetPantsColor = playerCustomStyle.pantsColor || '#1d3557';
          const closetHairEl = document.getElementById('closetHair');
          if (closetHairEl) closetHairEl.value = playerCustomStyle.hairStyle || 'brown_short';
        }

        player.activeSkin = d.equippedSkin || 'default';
        player.maxHearts = d.upgrades?.hearts || 3;
        player.hearts = player.maxHearts;
        updateHeartsHUD();
        
        // Check if admin / owner to display dev panel and admin add offer buttons
        const isAdmin = d.role === 'admin' || d.role === 'owner';
        document.getElementById('devConsoleLink').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('adminAddOfferBtn').style.display = isAdmin ? 'block' : 'none';

        // Load Inventory
        const invSnap = await db.collection('users').doc(user.uid).collection('inventory').get();
        ownedSkins = ['default'];
        invSnap.forEach(item => {
          ownedSkins.push(item.data().item_id);
        });
        
        updateMenuProfileUI();
        loadShopItems();
        updateMenuPreview();
      }
    });

    loadQuests();
    loadLeaderboard();
    initPreviewScene();
  } else {
    window.location.href = '/login/';
  }
});

// Update standard metrics in Menu GUI
function updateMenuProfileUI() {
  document.getElementById('previewSkinCost').textContent = ownedSkins.includes(player.activeSkin) ? "Закупен / Екипиран" : "Не е закупен";
}

// -------------------------------------------------------------
// 3D Shop Initialization and Management
// -------------------------------------------------------------
const DEFAULT_SHOP_ITEMS = [
  { item_id: 'default', name: 'Обикновен скин', type: 'cosmetic', cost_credits: 0, model_color: '#4caf50', accessory: 'none' },
  { item_id: 'red_jacket', name: 'Червено Яке (+10% скорост)', type: 'cosmetic', cost_credits: 150, model_color: '#ef5350', accessory: 'none', stats: { speed: 1.1 } },
  { item_id: 'stealth_hood', name: 'Стелт Качулка (-30% шум)', type: 'cosmetic', cost_credits: 250, model_color: '#2a2a3a', accessory: 'glasses', stats: { noise: 0.7 } },
  { item_id: 'king_gold', name: 'Златен Крал', type: 'cosmetic', cost_credits: 500, model_color: '#ffd700', accessory: 'hat', stats: { speed: 1.05 } }
];

async function loadShopItems() {
  const shopRef = db.collection('games').doc('byagai-ot-koce-kisyov').collection('shop');
  
  try {
    const snap = await shopRef.get();
    
    if (snap.empty) {
      const isAdmin = currentUserData && (currentUserData.role === 'admin' || currentUserData.role === 'owner');
      if (isAdmin) {
        // Populate default shop items
        for (let item of DEFAULT_SHOP_ITEMS) {
          await shopRef.doc(item.item_id).set(item);
        }
        loadShopItems();
      } else {
        shopItems = DEFAULT_SHOP_ITEMS;
        renderShopGrid();
      }
      return;
    }

    shopItems = [];
    snap.forEach(doc => {
      shopItems.push(doc.data());
    });

    renderShopGrid();
  } catch (err) {
    console.error("Грешка при зареждане на магазина: ", err);
    // Fallback to local default items
    shopItems = DEFAULT_SHOP_ITEMS;
    renderShopGrid();
  }
}

function renderShopGrid() {
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = '';

  const isAdmin = currentUserData && (currentUserData.role === 'admin' || currentUserData.role === 'owner');

  shopItems.forEach(item => {
    const card = document.createElement('div');
    card.className = `shop-item-card ${player.activeSkin === item.item_id ? 'selected' : ''}`;
    card.dataset.id = item.item_id;
    card.onclick = () => selectShopItem(item.item_id);

    const isOwned = ownedSkins.includes(item.item_id);
    const priceText = isOwned ? 'Закупен' : `${item.cost_credits} 💰`;

    card.innerHTML = `
      <div class="shop-item-icon" style="color: ${item.model_color}"><i class="fas fa-user-ninja"></i></div>
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-cost">${priceText}</div>
      ${isAdmin ? `
        <div class="admin-card-actions">
          <button class="admin-mini-btn btn-edit-item" onclick="event.stopPropagation(); editShopItem('${item.item_id}')"><i class="fas fa-edit"></i></button>
          <button class="admin-mini-btn btn-delete-item" onclick="event.stopPropagation(); deleteShopItem('${item.item_id}')"><i class="fas fa-trash"></i></button>
        </div>
      ` : ''}
    `;
    grid.appendChild(card);
  });
}

function selectShopItem(itemId) {
  const item = shopItems.find(i => i.item_id === itemId);
  if (!item) return;

  player.activeSkin = itemId;
  document.querySelectorAll('.shop-item-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.shop-item-card[data-id="${itemId}"]`);
  if (card) card.classList.add('selected');

  // Update skin model colors and accessories in preview
  updateSkinPreview(item.model_color, item.accessory);

  document.getElementById('previewSkinName').textContent = item.name;
  const isOwned = ownedSkins.includes(itemId);
  
  const costEl = document.getElementById('previewSkinCost');
  if (isOwned) {
    costEl.textContent = "Екипирай скин";
    costEl.style.color = '#4caf50';
    costEl.onclick = async () => {
      try {
        await db.collection('users').doc(currentUser.uid).update({ equippedSkin: itemId });
        player.speedMultiplier = item.stats?.speed || 1.0;
        player.noiseMultiplier = item.stats?.noise || 1.0;
        showNotification(`Скинът "${item.name}" е екипиран!`);
        playSound('click');
        updateMenuPreview();
      } catch (err) {
        console.error(err);
      }
    };
  } else {
    costEl.textContent = `Купи за ${item.cost_credits} 💰`;
    costEl.style.color = '#ffd700';
    costEl.onclick = () => buyShopItem(item);
  }
}

async function buyShopItem(item) {
  if (userCredits < item.cost_credits) {
    alert("Нямате достатъчно кредити!");
    return;
  }

  try {
    const updatedCredits = userCredits - item.cost_credits;
    await db.collection('users').doc(currentUser.uid).update({ credits: updatedCredits });
    await db.collection('users').doc(currentUser.uid).collection('inventory').doc(item.item_id).set({
      item_id: item.item_id,
      game_id: 'byagai-ot-koce-kisyov',
      name: item.name,
      purchasedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    alert(`Скинът ${item.name} беше закупен успешно!`);
    playSound('win');
    loadShopItems();
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------
// Admin modal actions
// -------------------------------------------------------------
let editingItemId = null;
window.openAddOfferModal = () => {
  editingItemId = null;
  document.getElementById('adminModalTitle').textContent = "Нов артикул";
  document.getElementById('adminItemName').value = "";
  document.getElementById('adminItemCost').value = 100;
  document.getElementById('adminItemColor').value = "#ff3333";
  document.getElementById('adminItemAccessory').value = "none";
  document.getElementById('adminShopModal').style.display = 'flex';
};

window.editShopItem = (itemId) => {
  const item = shopItems.find(i => i.item_id === itemId);
  if (!item) return;
  editingItemId = itemId;
  document.getElementById('adminModalTitle').textContent = "Редактирай артикул";
  document.getElementById('adminItemName').value = item.name;
  document.getElementById('adminItemCost').value = item.cost_credits;
  document.getElementById('adminItemColor').value = item.model_color || "#ff3333";
  document.getElementById('adminItemAccessory').value = item.accessory || "none";
  document.getElementById('adminShopModal').style.display = 'flex';
};

window.deleteShopItem = async (itemId) => {
  if (confirm("Сигурни ли сте, че искате да изтриете този артикул?")) {
    try {
      await db.collection('games').doc('byagai-ot-koce-kisyov').collection('shop').doc(itemId).delete();
      loadShopItems();
    } catch(err) {
      console.error(err);
    }
  }
};

window.closeAdminShopModal = () => {
  document.getElementById('adminShopModal').style.display = 'none';
};

window.saveAdminShopItem = async () => {
  const name = document.getElementById('adminItemName').value.trim();
  const cost = parseInt(document.getElementById('adminItemCost').value);
  const color = document.getElementById('adminItemColor').value.trim();
  const accessory = document.getElementById('adminItemAccessory').value;

  if (!name || isNaN(cost)) return;

  const id = editingItemId || name.toLowerCase().replace(/ /g, '_');
  const itemData = {
    item_id: id,
    name: name,
    type: 'cosmetic',
    cost_credits: cost,
    model_color: color,
    accessory: accessory,
    stats: {}
  };

  try {
    await db.collection('games').doc('byagai-ot-koce-kisyov').collection('shop').doc(id).set(itemData, { merge: true });
    closeAdminShopModal();
    loadShopItems();
  } catch (err) {
    console.error(err);
  }
};

// -------------------------------------------------------------
// Daily Quests System
// -------------------------------------------------------------
const QUEST_POOL = [
  { id: 'no_noise', text: "Мини ниво без да вдигаш висок шум", reward_xp: 60, reward_credits: 20 },
  { id: 'escape_3', text: "Избягай от Коцето 3 пъти в рамките на едно бягане", reward_xp: 80, reward_credits: 30 },
  { id: 'find_key', text: "Открий ключа за по-малко от 2 минути", reward_xp: 50, reward_credits: 15 },
  { id: 'hide_locker', text: "Скрий се в шкафче, докато Коцето те търси", reward_xp: 70, reward_credits: 25 }
];

async function loadQuests() {
  const questsRef = db.collection('users').doc(currentUser.uid).collection('daily_quests');
  let snap = await questsRef.get();

  const today = new Date().toDateString();
  let needNewQuests = snap.empty;

  if (!snap.empty) {
    const firstQuest = snap.docs[0].data();
    if (firstQuest.date !== today) {
      needNewQuests = true;
      // Delete old quests
      for (let doc of snap.docs) {
        await doc.ref.delete();
      }
    }
  }

  if (needNewQuests) {
    // Pick 3 random quests
    const shuffled = QUEST_POOL.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    for (let q of selected) {
      const newQuest = { ...q, completed: false, date: today };
      await questsRef.doc(q.id).set(newQuest);
    }
    loadQuests();
    return;
  }

  dailyQuests = [];
  snap = await questsRef.get();
  snap.forEach(doc => dailyQuests.push(doc.data()));

  renderQuestsList();
}

function renderQuestsList() {
  const list = document.getElementById('questsList');
  list.innerHTML = '';

  dailyQuests.forEach(q => {
    const row = document.createElement('div');
    row.style.background = 'rgba(255,255,255,0.02)';
    row.style.border = '1px solid var(--border-glow)';
    row.style.borderRadius = '12px';
    row.style.padding = '1rem';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';

    row.innerHTML = `
      <div>
        <h4 style="color: ${q.completed ? '#4caf50' : 'white'};">${q.text}</h4>
        <span style="font-size:0.75rem; color:#ffd700;">Награда: +${q.reward_credits} 💰 / +${q.reward_xp} XP</span>
      </div>
      <span>${q.completed ? '<i class="fas fa-check-circle" style="color:#4caf50; font-size:1.3rem;"></i>' : '<i class="far fa-circle" style="font-size:1.3rem; color:#a1a1aa;"></i>'}</span>
    `;
    list.appendChild(row);
  });
}

// -------------------------------------------------------------
// Leaderboards Loading
// -------------------------------------------------------------
async function loadLeaderboard() {
  const leaderRef = db.collection('games').doc('byagai-ot-koce-kisyov').collection('leaderboard');
  const snap = await leaderRef.orderBy('time_ms', 'asc').limit(15).get();

  const body = document.getElementById('leaderboardBody');
  body.innerHTML = '';

  if (snap.empty) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #a1a1aa;">Все още няма резултати в класацията.</td></tr>`;
    return;
  }

  let rank = 1;
  snap.forEach(doc => {
    const l = doc.data();
    const row = document.createElement('tr');
    
    // Formatting time
    const sec = (l.time_ms / 1000).toFixed(2);
    
    row.innerHTML = `
      <td style="font-weight:700; color: ${rank === 1 ? '#ffd700' : (rank === 2 ? '#c0c0c0' : (rank === 3 ? '#cd7f32' : 'white'))};">${rank}</td>
      <td>${l.username}</td>
      <td>Ниво ${l.level || 1} - Част ${l.part || 1}/10</td>
      <td>${sec}с</td>
    `;
    body.appendChild(row);
    rank++;
  });
}

// Submit a new record to Leaderboards
async function submitLeaderboardRecord(timeMs) {
  if (!currentUser) return;
  const scoreId = currentUser.uid + '_' + currentLevel + '_' + currentPart;
  try {
    await db.collection('games').doc('byagai-ot-koce-kisyov').collection('leaderboard').doc(scoreId).set({
      user_id: currentUser.uid,
      username: currentUserData.username,
      level: currentLevel,
      part: currentPart,
      time_ms: timeMs,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    loadLeaderboard();
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------
// 3D Mini Viewport for Skin Previews (Three.js)
// -------------------------------------------------------------
function initPreviewScene() {
  const container = document.getElementById('skinPreviewContainer');
  previewScene = new THREE.Scene();
  
  previewCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 10);
  previewCamera.position.set(0, 0.8, 2.2);
  previewCamera.lookAt(0, 0.4, 0);

  previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  previewRenderer.setSize(container.clientWidth, container.clientHeight);
  previewRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(previewRenderer.domElement);

  const light = new THREE.AmbientLight(0xffffff, 0.8);
  previewScene.add(light);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(2, 3, 1);
  previewScene.add(dirLight);

  // Character preview construction
  previewMesh = createCharacterModel('#4caf50', 'none');
  previewScene.add(previewMesh);

  // Animation Loop
  function animatePreview() {
    requestAnimationFrame(animatePreview);
    if (previewMesh) {
      previewMesh.rotation.y += 0.015;
    }
    previewRenderer.render(previewScene, previewCamera);
  }
  animatePreview();

  // Mouse interaction
  let isDragging = false;
  let prevMouseX = 0;
  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevMouseX = e.clientX;
  });
  window.addEventListener('mouseup', () => isDragging = false);
  container.addEventListener('mousemove', (e) => {
    if (isDragging && previewMesh) {
      const deltaX = e.clientX - prevMouseX;
      previewMesh.rotation.y += deltaX * 0.01;
      prevMouseX = e.clientX;
    }
  });
}

function updateMenuPreview() {
  let color = playerCustomStyle.shirtColor;
  let accessory = 'none';
  let pants = playerCustomStyle.pantsColor;
  let hair = playerCustomStyle.hairStyle;

  if (player.activeSkin !== 'default') {
    const equipped = shopItems.find(i => i.item_id === player.activeSkin);
    if (equipped) {
      color = equipped.model_color || '#4caf50';
      accessory = equipped.accessory || 'none';
    }
  }

  if (previewMesh) {
    previewScene.remove(previewMesh);
  }
  previewMesh = createCharacterModel(color, accessory, pants, hair);
  previewScene.add(previewMesh);
}

function updateSkinPreview(colorHex, accessory) {
  if (previewMesh) {
    previewScene.remove(previewMesh);
  }
  previewMesh = createCharacterModel(colorHex, accessory, playerCustomStyle.pantsColor, playerCustomStyle.hairStyle);
  previewScene.add(previewMesh);
}

function createCharacterModel(shirtColorHex, accessory = 'none', pantsColorHex = '#1d3557', hairStyle = 'brown_short') {
  const group = new THREE.Group();
  const c = new THREE.Color(shirtColorHex);
  
  // Materials
  const shirtMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.05 });
  const darkShirtMat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.7), roughness: 0.5 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.5 });
  const darkSkinMat = new THREE.MeshStandardMaterial({ color: 0xe8c090, roughness: 0.5 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pantsColorHex), roughness: 0.6 });
  const darkPantsMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pantsColorHex).multiplyScalar(0.7), roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.1 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xd94f5a, roughness: 0.3 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xffa5a5, roughness: 0.5, transparent: true, opacity: 0.35 });
  
  const bodyCenter = 0.45;
  const headCenter = 0.87;
  
  // === TORSO ===
  // Upper body (chest, slightly tapered)
  const chestGeo = new THREE.BoxGeometry(0.34, 0.28, 0.19);
  const chest = new THREE.Mesh(chestGeo, shirtMat);
  chest.position.set(0, bodyCenter + 0.11, 0);
  chest.castShadow = true; chest.receiveShadow = true;
  group.add(chest);
  
  // Lower body (waist, slightly narrower)
  const waistGeo = new THREE.BoxGeometry(0.30, 0.18, 0.16);
  const waist = new THREE.Mesh(waistGeo, darkShirtMat);
  waist.position.set(0, bodyCenter - 0.14, 0);
  waist.castShadow = true;
  group.add(waist);
  
  // Яка на врата (вратовръзка)
  const collarMat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.5), roughness: 0.5 });
  const collarGeo = new THREE.BoxGeometry(0.12, 0.02, 0.06);
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.set(0, bodyCenter + 0.27, 0.05);
  group.add(collar);
  
  // Лява презрамка на ризата
  const strapMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 });
  for (let side = -1; side <= 1; side += 2) {
    const strapGeo = new THREE.BoxGeometry(0.06, 0.10, 0.10);
    const strap = new THREE.Mesh(strapGeo, strapMat);
    strap.position.set(side * 0.17, bodyCenter + 0.24, 0);
    strap.rotation.z = side * 0.2;
    group.add(strap);
  }
  
  // Рамене (по-изразени)
  const shoulderMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 });
  for (let side = -1; side <= 1; side += 2) {
    const shoulderGeo = new THREE.SphereGeometry(0.08, 8, 6);
    const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulder.position.set(side * 0.20, bodyCenter + 0.10, 0);
    shoulder.scale.set(1, 0.7, 0.8);
    group.add(shoulder);
  }

  // Колан
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.7 });
  const beltGeo = new THREE.BoxGeometry(0.30, 0.025, 0.18);
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.set(0, bodyCenter - 0.05, 0);
  group.add(belt);
  
  // Тока на колана
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
  const buckleGeo = new THREE.BoxGeometry(0.04, 0.03, 0.02);
  const buckle = new THREE.Mesh(buckleGeo, buckleMat);
  buckle.position.set(0, bodyCenter - 0.05, 0.10);
  group.add(buckle);

  // === NECK ===
  const neckGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.06, 8);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.set(0, bodyCenter + 0.28, 0);
  group.add(neck);

  // === HEAD ===
  const headGeo = new THREE.SphereGeometry(0.13, 12, 10);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, headCenter, 0);
  head.scale.set(1, 1.05, 0.92);
  head.castShadow = true;
  group.add(head);
  
  // Долна челюст (леко сплескана сфера под главата)
  const jawGeo = new THREE.SphereGeometry(0.10, 8, 6);
  const jaw = new THREE.Mesh(jawGeo, skinMat);
  jaw.position.set(0, headCenter - 0.08, 0.02);
  jaw.scale.set(1.1, 0.6, 0.9);
  group.add(jaw);

  // === FACE DETAILS ===
  // Вежди
  for (let side = -1; side <= 1; side += 2) {
    const browGeo = new THREE.BoxGeometry(0.035, 0.005, 0.005);
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(side * 0.055, headCenter + 0.04, 0.115);
    brow.rotation.z = side * 0.1;
    group.add(brow);
  }
  
  // Очи (бяло + ирис + зеница)
  for (let side = -1; side <= 1; side += 2) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), whiteMat);
    eyeWhite.position.set(side * 0.055, headCenter + 0.01, 0.115);
    eyeWhite.scale.set(1, 0.85, 0.5);
    group.add(eyeWhite);
    
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x4a7db4, roughness: 0.2 });
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), irisMat);
    iris.position.set(side * 0.055, headCenter + 0.01, 0.125);
    iris.scale.set(1, 0.9, 0.4);
    group.add(iris);
    
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.010, 6, 6), pupilMat);
    pupil.position.set(side * 0.055, headCenter + 0.01, 0.130);
    pupil.scale.set(1, 1, 0.3);
    group.add(pupil);
  }
  
  // Блясък в очите
  const gleamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let side = -1; side <= 1; side += 2) {
    const gleam = new THREE.Mesh(new THREE.SphereGeometry(0.004, 4, 4), gleamMat);
    gleam.position.set(side * 0.045, headCenter + 0.025, 0.132);
    group.add(gleam);
  }
  
  // Нос (малък триъгълник)
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.5 });
  const noseGeo = new THREE.ConeGeometry(0.012, 0.02, 4);
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, headCenter - 0.025, 0.125);
  nose.rotation.x = 0.3;
  group.add(nose);
  
  // Уста (извита линия)
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.01, 0.005), mouthMat);
  mouth.position.set(0, headCenter - 0.065, 0.12);
  group.add(mouth);
  
  // Долна устна
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xe08080, roughness: 0.3 });
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 0.005), lipMat);
  lip.position.set(0, headCenter - 0.075, 0.12);
  group.add(lip);
  
  // Румян (леко зачервяване по бузите)
  for (let side = -1; side <= 1; side += 2) {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), blushMat);
    blush.position.set(side * 0.07, headCenter - 0.03, 0.11);
    blush.scale.set(1, 0.8, 0.5);
    group.add(blush);
  }
  
  // Уши (малки дискове отстрани)
  const earMat = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.5 });
  for (let side = -1; side <= 1; side += 2) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), earMat);
    ear.position.set(side * 0.13, headCenter - 0.01, 0);
    ear.scale.set(0.6, 1, 0.6);
    group.add(ear);
  }

  // === HAIR ===
  let hairColor = 0x5c4033;
  if (hairStyle === 'black_spiky') hairColor = 0x181818;
  else if (hairStyle === 'blonde_long') hairColor = 0xe8d48b;
  
  if (hairStyle !== 'bald') {
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.75 });
    const darkHairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hairColor).multiplyScalar(0.6), roughness: 0.8 });
    
    // Основна коса (купол)
    const baseHair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), hairMat);
    baseHair.position.set(0, headCenter + 0.06, 0);
    baseHair.scale.set(1, 0.55, 1.05);
    baseHair.castShadow = true;
    group.add(baseHair);
    
    // Преден бретон
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.07), hairMat);
    fringe.position.set(0, headCenter + 0.05, 0.12);
    fringe.rotation.x = -0.15;
    group.add(fringe);
    
    // Странична коса
    for (let side = -1; side <= 1; side += 2) {
      const sideHair = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.20), hairMat);
      sideHair.position.set(side * 0.13, headCenter - 0.02, 0);
      sideHair.rotation.z = side * 0.1;
      group.add(sideHair);
    }
    
    // Тилен косъм
    const backHairGeo = new THREE.BoxGeometry(0.22, 0.15, 0.08);
    const backHair = new THREE.Mesh(backHairGeo, darkHairMat);
    backHair.position.set(0, headCenter - 0.01, -0.11);
    group.add(backHair);

    if (hairStyle === 'black_spiky') {
      // Бодливи кичури нагоре
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), hairMat);
        spike.position.set(Math.cos(angle) * 0.07, headCenter + 0.10, Math.sin(angle) * 0.07);
        spike.rotation.z = Math.cos(angle) * 0.6;
        spike.rotation.x = Math.sin(angle) * 0.6;
        group.add(spike);
      }
    } else if (hairStyle === 'blonde_long') {
      // Дълги коси отстрани
      for (let side = -1; side <= 1; side += 2) {
        const longLock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.35, 0.18), hairMat);
        longLock.position.set(side * 0.14, headCenter - 0.15, 0.01);
        longLock.rotation.z = side * 0.12;
        group.add(longLock);
      }
      // Задна дълга коса
      const backLong = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.40, 0.04), darkHairMat);
      backLong.position.set(0, headCenter - 0.12, -0.12);
      group.add(backLong);
    } else {
      // Къса коса - предни кичури
      for (let tx = -0.06; tx <= 0.06; tx += 0.04) {
        const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.04), hairMat);
        tuft.position.set(tx, headCenter + 0.09, 0.10);
        tuft.rotation.x = 0.4;
        group.add(tuft);
      }
    }
  }

  // === ARMS ===
  for (let side = -1; side <= 1; side += 2) {
    // Горна част на ръката
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.25, 6), shirtMat);
    upperArm.position.set(side * 0.22, bodyCenter + 0.08, 0);
    upperArm.rotation.z = side * 0.20;
    upperArm.castShadow = true;
    group.add(upperArm);
    
    // Долна част на ръката (предмишница)
    const forearmMat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.85), roughness: 0.5 });
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.18, 6), forearmMat);
    forearm.position.set(side * 0.25, bodyCenter - 0.12, 0);
    forearm.rotation.z = side * 0.15;
    group.add(forearm);
    
    // Ръка (китка + длан)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), skinMat);
    hand.position.set(side * 0.26, bodyCenter - 0.26, 0);
    hand.scale.set(1, 0.9, 0.8);
    group.add(hand);
  }

  // === LEGS ===
  for (let side = -1; side <= 1; side += 2) {
    // Горна част на крак (бедро)
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.18, 6), pantsMat);
    thigh.position.set(side * 0.09, 0.28, 0);
    thigh.castShadow = true;
    group.add(thigh);
    
    // Долна част (пищял)
    const shinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pantsColorHex).multiplyScalar(0.85), roughness: 0.6 });
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.18, 6), shinMat);
    shin.position.set(side * 0.09, 0.08, 0);
    group.add(shin);
    
    // Обувка
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.17), shoeMat);
    shoe.position.set(side * 0.09, 0.02, 0.015);
    shoe.castShadow = true;
    group.add(shoe);
    
    // Подметка
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.17), soleMat);
    sole.position.set(side * 0.09, -0.01, 0.015);
    group.add(sole);
    
    // Нос на обувката
    const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), shoeMat);
    toeCap.position.set(side * 0.09, 0.015, 0.095);
    toeCap.scale.set(1, 0.6, 0.7);
    group.add(toeCap);
  }

  // === ACCESSORIES ===
  if (accessory === 'hat') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.6 });
    const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.02, 8), hatMat);
    hatBase.position.set(0, headCenter + 0.06, 0);
    group.add(hatBase);
    const hatCrown = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.16, 8), hatMat);
    hatCrown.position.set(0, headCenter + 0.15, 0);
    group.add(hatCrown);
  } else if (accessory === 'glasses') {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.5 });
    for (let side = -1; side <= 1; side += 2) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 10), frameMat);
      ring.position.set(side * 0.055, headCenter + 0.015, 0.13);
      ring.rotation.y = Math.PI / 2;
      group.add(ring);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.01), frameMat);
    bridge.position.set(0, headCenter + 0.02, 0.13);
    group.add(bridge);
  } else if (accessory === 'horns') {
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.5 });
    for (let side = -1; side <= 1; side += 2) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), hornMat);
      horn.position.set(side * 0.07, headCenter + 0.08, 0);
      horn.rotation.set(0.2, 0, side * 0.3);
      group.add(horn);
    }
  }

  return group;
}

// -------------------------------------------------------------
// Interactive Game Mechanics and Engine Loop (Three.js)
// -------------------------------------------------------------
let animationFrameId = null;

function initEngine() {
  const canvas = document.getElementById('gameCanvas');
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1a24, 0.04);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  // Directional Light
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // Spotlight (Flashlight attached to camera)
  const spotLight = new THREE.SpotLight(0xffffff, 0, 15, Math.PI / 6, 0.5, 1);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  camera.add(spotLight);
  spotLight.position.set(0, 0, 0);
  spotLight.target = new THREE.Object3D();
  camera.add(spotLight.target);
  spotLight.target.position.set(0, 0, -1);
  scene.add(camera);

  // Build current level geometry
  buildLevel(currentLevel);

  // Setup Koce Mesh
  koce.mesh = createCharacterModel('#ef5350', 'glasses', '#1d3557', 'brown_short');
  scene.add(koce.mesh);

  resetPositions();
  setupInputListeners();
  setupTouchControls();
}

function resetPositions() {
  player.position.set(-13, player.height, 13);
  player.rotation.set(0, 0);
  if (camera) {
    camera.rotation.order = "YXZ";
    camera.rotation.y = 0;
    camera.rotation.x = 0;
  }
  player.stamina = 100;
  player.flashlightBattery = 100;
  player.flashlight = false;
  player.hearts = player.maxHearts;
  player.inventory = [{ id: 'hand', name: 'Ръце', icon: 'fa-hand' }];
  player.activeSlot = 1;
  player.hiding = false;
  player.currentLocker = null;

  koce.position.set(15, 0, 15);
  koce.state = 'patrol';
  koce.patrolTarget.copy(getRandomPatrolNode());
  koce.lastKnownPlayerPos = null;
  koce.searchTimer = 0;
  koce.soundTimer = 0;

  // Flashlight light initial state
  if (camera) {
    const spot = camera.children.find(c => c instanceof THREE.SpotLight);
    if (spot) spot.intensity = 0;
  }

  updateHUD();
}

function createDetailedBookshelf(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.7 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2a160a, roughness: 0.8 });

  // Заден панел на секцията
  const backGeo = new THREE.BoxGeometry(3.8, 2.0, 0.1);
  const back = new THREE.Mesh(backGeo, woodMat);
  back.position.z = -0.35;
  back.castShadow = true;
  group.add(back);

  // Странични колони на секцията
  const sideGeo = new THREE.BoxGeometry(0.1, 2.0, 0.8);
  const leftSide = new THREE.Mesh(sideGeo, darkWoodMat);
  leftSide.position.x = -1.9;
  leftSide.castShadow = true;
  const rightSide = leftSide.clone();
  rightSide.position.x = 1.9;
  group.add(leftSide);
  group.add(rightSide);

  // Долен цокъл
  const baseGeo = new THREE.BoxGeometry(3.9, 0.08, 0.8);
  const base = new THREE.Mesh(baseGeo, darkWoodMat);
  base.position.y = -0.96;
  base.castShadow = true;
  group.add(base);
  
  // Преден долен ръб
  const baseTrimGeo = new THREE.BoxGeometry(3.9, 0.03, 0.06);
  const baseTrim = new THREE.Mesh(baseTrimGeo, darkWoodMat);
  baseTrim.position.set(0, -0.92, 0.35);
  group.add(baseTrim);

  // Горен панел на секцията
  const topGeo = new THREE.BoxGeometry(3.9, 0.08, 0.85);
  const top = new THREE.Mesh(topGeo, darkWoodMat);
  top.position.y = 1.0;
  top.castShadow = true;
  group.add(top);
  
  // Горен корниз (декоративна лайстна)
  const crownGeo = new THREE.BoxGeometry(4.0, 0.04, 0.9);
  const crown = new THREE.Mesh(crownGeo, darkWoodMat);
  crown.position.y = 1.06;
  crown.castShadow = true;
  group.add(crown);

  // Рафтове (3 нива: -0.5, 0.0, 0.5)
  const shelfGeo = new THREE.BoxGeometry(3.7, 0.04, 0.75);
  const bookColors = [0xe63946, 0x457b9d, 0x1d3557, 0xe9c46a, 0x2a9d8f, 0xf4a261, 0x9c27b0, 0xff6f00];
  
  for (let lvl = -0.5; lvl <= 0.5; lvl += 0.5) {
    const shelf = new THREE.Mesh(shelfGeo, woodMat);
    shelf.position.y = lvl;
    shelf.receiveShadow = true;
    group.add(shelf);

    // Добавяне на книги върху всеки рафт
    for (let bx = -1.7; bx <= 1.7; bx += 0.22) {
      if (Math.random() < 0.25) continue; // Направи дупки за реализъм
      
      const bookHeight = 0.18 + Math.random() * 0.2;
      const bookWidth = 0.04 + Math.random() * 0.06;
      const bookDepth = 0.35 + Math.random() * 0.18;
      const tilt = (Math.random() - 0.5) * 0.06;
      
      const color = bookColors[Math.floor(Math.random() * bookColors.length)];
      const bookMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.5 + Math.random() * 0.3
      });
      
      const bookGeo = new THREE.BoxGeometry(bookWidth, bookHeight, bookDepth);
      const book = new THREE.Mesh(bookGeo, bookMat);
      book.position.set(bx, lvl + 0.02 + bookHeight / 2, 0);
      book.rotation.z = tilt;
      book.castShadow = true;
      group.add(book);
      
      // Гръб на книгата (тънка лента отпред)
      if (Math.random() < 0.4) {
        const spineMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 });
        const spineGeo = new THREE.BoxGeometry(bookWidth * 0.8, bookHeight * 0.6, 0.01);
        const spine = new THREE.Mesh(spineGeo, spineMat);
        spine.position.set(bx, lvl + 0.02 + bookHeight / 2, bookDepth / 2 + 0.005);
        spine.rotation.z = tilt;
        group.add(spine);
      }
    }
  }

  scene.add(group);
  
  // Опростен физически сблъсък за движението на играча
  const collider = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.0, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
  collider.position.set(x, y, z);
  scene.add(collider);
  levelMap.push(collider);
}

function buildLevel(level) {
  levelMap.forEach(mesh => scene.remove(mesh));
  levelMap = [];
  interactiveObjects.forEach(obj => scene.remove(obj.mesh));
  interactiveObjects = [];
  visitedZones = new Set();
  zonePopupQueue = [];
  zonePopupActive = false;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3e3e4a, roughness: 0.8 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6 }); // warm wooden floor

  const size = 30;
  const floorGeo = new THREE.PlaneGeometry(size, size);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  levelMap.push(floor);

  const ceilGeo = new THREE.PlaneGeometry(size, size);
  const ceiling = new THREE.Mesh(ceilGeo, wallMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 5.5;
  scene.add(ceiling);
  levelMap.push(ceiling);

  const perimeterGeo = new THREE.BoxGeometry(size, 5.5, 0.2);
  const backWall = new THREE.Mesh(perimeterGeo, wallMat);
  backWall.position.set(0, 2.75, -size / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  scene.add(backWall);
  levelMap.push(backWall);

  const frontWall = backWall.clone();
  frontWall.position.z = size / 2;
  scene.add(frontWall);
  levelMap.push(frontWall);

  const sideWallGeo = new THREE.BoxGeometry(0.2, 5.5, size);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.position.set(-size / 2, 2.75, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  scene.add(leftWall);
  levelMap.push(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = size / 2;
  scene.add(rightWall);
  levelMap.push(rightWall);

  if (level === 1) {
    showNotification("Намери фенерчето на 1-вия етаж и се качи по стълбите на тъмния 2-ри етаж за ключа!", "info");

    // Декоративни класически колони по стените на библиотеката
    const colGeo = new THREE.CylinderGeometry(0.2, 0.2, 5.5, 8);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 });
    for (let cx = -14.8; cx <= 14.8; cx += 29.6) {
      for (let cz = -10; cz <= 10; cz += 10) {
        const col = new THREE.Mesh(colGeo, colMat);
        col.position.set(cx, 2.75, cz);
        col.castShadow = true;
        col.receiveShadow = true;
        scene.add(col);
        levelMap.push(col);
      }
    }

    // Втори етаж (балкон)
    const balconyGeo = new THREE.BoxGeometry(16, 0.15, 16);
    const balconyMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.8 });
    const balcony = new THREE.Mesh(balconyGeo, balconyMat);
    balcony.position.set(0, 2.5, -7);
    balcony.receiveShadow = true;
    scene.add(balcony);
    // НЕ добавяме балкона в levelMap, защото блокира движението на играча върху него

    // Парапет (fence) на втория етаж
    const fenceGroup = new THREE.Group();
    fenceGroup.position.set(0, 2.5, 1.0);
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.08), balconyMat);
    topRail.position.set(0, 0.9, 0);
    fenceGroup.add(topRail);
    
    const barGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.9);
    for (let rx = -8; rx <= 8; rx += 0.8) {
      const bar = new THREE.Mesh(barGeo, balconyMat);
      bar.position.set(rx, 0.45, 0);
      bar.castShadow = true;
      fenceGroup.add(bar);
    }
    scene.add(fenceGroup);

    // Стълби до втория етаж (от земята до ръба на балкона z=1)
    const stairMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.7 });
    const stairSideMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
    
    for (let i = 0; i < 11; i++) {
      const stepGeo = new THREE.BoxGeometry(2.5, 0.23, 0.45);
      const step = new THREE.Mesh(stepGeo, stairMat);
      step.position.set(-5, 0.115 + i * 0.23, -3.5 + i * 0.45);
      step.receiveShadow = true;
      step.castShadow = true;
      scene.add(step);
      levelMap.push(step);
      
      // Нос на стъпалото (издадена предна част)
      if (i < 10) {
        const nosingGeo = new THREE.BoxGeometry(2.5, 0.03, 0.06);
        const nosing = new THREE.Mesh(nosingGeo, stairSideMat);
        nosing.position.set(-5, 0.115 + i * 0.23 + 0.115, -3.5 + i * 0.45 + 0.255);
        nosing.castShadow = true;
        scene.add(nosing);
      }
    }

    // Странични тетиви (наклонени греди)
    for (let side = -1; side <= 1; side += 2) {
      const stringerGeo = new THREE.BoxGeometry(0.08, 2.6, 5.2);
      const stringer = new THREE.Mesh(stringerGeo, stairSideMat);
      stringer.position.set(-5 + side * 1.3, 1.3, -1.25);
      stringer.rotation.x = 0.46;
      stringer.castShadow = true;
      scene.add(stringer);
    }

    // Перила с балюстради
    const railMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.6 });
    // Горна ръкохватка
    const handrailGeo = new THREE.BoxGeometry(0.06, 0.06, 5.2);
    const handrail = new THREE.Mesh(handrailGeo, railMat);
    handrail.position.set(-3.8, 2.4, -1.25);
    handrail.rotation.x = 0.46;
    handrail.castShadow = true;
    scene.add(handrail);
    
    // Балюстради (вертикални пръчки)
    for (let bi = 0; bi < 10; bi++) {
      const balusterGeo = new THREE.BoxGeometry(0.03, 0.6, 0.03);
      const baluster = new THREE.Mesh(balusterGeo, railMat);
      const t = (bi + 0.5) / 10;
      const bz = -3.5 + t * 4.5;
      const by = 0.115 + t * 2.3;
      baluster.position.set(-3.8, by + 0.7, bz);
      baluster.castShadow = true;
      scene.add(baluster);
    }

    // Точково локално осветление за първия етаж
    const bulbGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe0b2 });
    
    const lightPositions = [
      new THREE.Vector3(4, 2.3, 5),
      new THREE.Vector3(-4, 2.3, 5),
      new THREE.Vector3(4, 2.3, -5)
    ];

    lightPositions.forEach(pos => {
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.copy(pos);
      scene.add(bulb);

      const light = new THREE.PointLight(0xffd59a, 4.0, 18);
      light.position.copy(pos);
      light.castShadow = true;
      scene.add(light);
    });

    // === БИБЛИОТЕЧНО ОФОРМЛЕНИЕ ===
    // 12 рафта, разположени като истинска библиотека: по стените + няколко островни
    const shelfPositions = [
      // По стените
      { x: -12, z: 10 }, { x: -12, z: 3 }, { x: -12, z: -4 }, { x: -12, z: -10 },
      { x: 12, z: 10 }, { x: 12, z: 3 }, { x: 12, z: -4 }, { x: 12, z: -10 },
      // Острови (разделят пространството)
      { x: -4, z: 8 }, { x: 4, z: 8 },
      { x: -6, z: -3 }, { x: 6, z: -3 },
      // На балкона
      { x: -4, z: -8, y: 3.5 }, { x: 4, z: -8, y: 3.5 }, { x: 0, z: -4, y: 3.5 }
    ];
    shelfPositions.forEach(pos => {
      createDetailedBookshelf(pos.x, pos.y || 1.0, pos.z);
    });

    // === ЧИТАТЕЛСКИ БЮРА ===
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
    const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.5 });
    
    function createDesk(dx, dz, angleY = 0) {
      const deskGroup = new THREE.Group();
      deskGroup.position.set(dx, 0, dz);
      deskGroup.rotation.y = angleY;
      // Плот
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.7), deskTopMat);
      top.position.y = 0.75;
      top.castShadow = true;
      deskGroup.add(top);
      // Крака
      const legMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
      for (let lx of [-0.5, 0.5]) {
        for (let lz of [-0.3, 0.3]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.7, 6), legMat);
          leg.position.set(lx, 0.35, lz);
          deskGroup.add(leg);
        }
      }
      scene.add(deskGroup);
      // Collider
      const coll = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(dx, 0.4, dz);
      coll.rotation.y = angleY;
      scene.add(coll);
      levelMap.push(coll);
    }
    
    createDesk(-7, 5);
    createDesk(7, 5);

    // === КОМПЮТЪРНИ МАСИ ===
    function createComputerDesk(dx, dz) {
      const group = new THREE.Group();
      group.position.set(dx, 0, dz);
      // Плот
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.8), deskTopMat);
      top.position.y = 0.75;
      top.castShadow = true;
      group.add(top);
      // Странични панели
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x3e3e4a, roughness: 0.6 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.7, 0.8), panelMat);
      panel.position.set(-0.75, 0.4, 0);
      group.add(panel);
      const panel2 = panel.clone();
      panel2.position.x = 0.75;
      group.add(panel2);
      // Монитор (черен правоъгълник)
      const monitorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
      const scrMat = new THREE.MeshBasicMaterial({ color: 0x1a3a5a });
      const scr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.02), scrMat);
      scr.position.set(0, 0.9, -0.15);
      group.add(scr);
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.37, 0.04), monitorMat);
      mon.position.set(0, 0.9, -0.15);
      group.add(mon);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.04), monitorMat);
      stand.position.set(0, 0.65, -0.15);
      group.add(stand);
      scene.add(group);
      const coll = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(dx, 0.4, dz);
      scene.add(coll);
      levelMap.push(coll);
    }
    createComputerDesk(-8, -6);
    createComputerDesk(8, -6);

    // === КОЛОНИ ===
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a7f7a, roughness: 0.7 });
    const pillarBaseMat = new THREE.MeshStandardMaterial({ color: 0x6d5f5a, roughness: 0.8 });
    function createColumn(cx, cz) {
      const colGeo = new THREE.CylinderGeometry(0.3, 0.35, 4.5, 10);
      const col = new THREE.Mesh(colGeo, pillarMat);
      col.position.set(cx, 2.25, cz);
      col.castShadow = true;
      scene.add(col);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 10), pillarBaseMat);
      base.position.set(cx, 0.04, cz);
      scene.add(base);
      const cap = base.clone();
      cap.position.y = 4.5;
      scene.add(cap);
      const coll = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 4.5, 6), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(cx, 2.25, cz);
      scene.add(coll);
      levelMap.push(coll);
    }
    createColumn(-9, -9);
    createColumn(9, -9);
    createColumn(-9, 9);
    createColumn(9, 9);

    // === ДИВАН ===
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
    function createSofa(sx, sz, rot) {
      const g = new THREE.Group();
      g.position.set(sx, 0, sz);
      g.rotation.y = rot;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.7), sofaMat);
      base.position.set(0, 0.15, 0);
      base.castShadow = true;
      g.add(base);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.12), sofaMat);
      back.position.set(0, 0.4, -0.3);
      g.add(back);
      for (let side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.7), sofaMat);
        arm.position.set(side * 0.8, 0.2, 0);
        g.add(arm);
      }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.55), cushionMat);
      seat.position.set(0, 0.33, 0.03);
      g.add(seat);
      scene.add(g);
      const coll = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(sx, 0.25, sz);
      coll.rotation.y = rot;
      scene.add(coll);
      levelMap.push(coll);
    }
    createSofa(-5, -8, 0);
    createSofa(5, -8, 0);

    // === ВИТРИНА (стъклена) ===
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.3, roughness: 0.1 });
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.7 });
    const caseGroup = new THREE.Group();
    caseGroup.position.set(0, 0, -12);
    const caseBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.6), caseMat);
    caseBase.position.y = 0.02;
    caseGroup.add(caseBase);
    const caseGlass = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.35, 0.56), glassMat);
    caseGlass.position.y = 0.2;
    caseGroup.add(caseGlass);
    const caseLid = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.02, 0.62), caseMat);
    caseLid.position.y = 0.38;
    caseGroup.add(caseLid);
    scene.add(caseGroup);
    const caseColl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
    caseColl.position.set(0, 0.2, -12);
    scene.add(caseColl);
    levelMap.push(caseColl);

    // === СТОЛЧЕТА КЪМ БЮРАТА ===
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
    function createChair(cx, cz, rot) {
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      g.rotation.y = rot;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), seatMat);
      seat.position.y = 0.4;
      g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.03), chairMat);
      back.position.set(0, 0.55, -0.15);
      g.add(back);
      for (let side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 4), chairMat);
        leg.position.set(side * 0.12, 0.2, 0.12);
        g.add(leg);
        const backLeg = leg.clone();
        backLeg.position.z = -0.12;
        g.add(backLeg);
      }
      scene.add(g);
      const coll = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.35), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(cx, 0.22, cz);
      coll.rotation.y = rot;
      scene.add(coll);
      levelMap.push(coll);
    }
    createChair(-7, 4.3, 0);
    createChair(7, 4.3, 0);

    // === ФЕНЕРЧЕ (скрито на бюро, под книга) ===
    const flashlightMesh = new THREE.Group();
    const fHandleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const fHeadMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });
    const fLensMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
    const fSwitchMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5 });
    const handle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.023, 0.18, 8), fHandleMat);
    handle1.rotation.x = Math.PI / 2; flashlightMesh.add(handle1);
    const head1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.025, 0.07, 8), fHeadMat);
    head1.position.z = 0.12; head1.rotation.x = Math.PI / 2; flashlightMesh.add(head1);
    const lens1 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), fLensMat);
    lens1.position.z = 0.16; flashlightMesh.add(lens1);
    const sw1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.02), fSwitchMat);
    sw1.position.set(0, 0.028, 0.02); flashlightMesh.add(sw1);
    // Поставяме на бюрото вдясно, полускрит зад книга
    flashlightMesh.position.set(-7.4, 0.78, 4.8);
    flashlightMesh.rotation.x = -0.3;
    flashlightMesh.rotation.z = 0.4;
    scene.add(flashlightMesh);
    // Книга върху фенерчето (прикритие) — малка кутия
    const bookHideMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });
    const bookHide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.18), bookHideMat);
    bookHide.position.set(-7.3, 0.85, 4.9);
    bookHide.rotation.y = 0.3;
    scene.add(bookHide);

    interactiveObjects.push({
      type: 'item',
      name: 'Фенерче',
      itemId: 'flashlight',
      icon: 'fa-flashlight',
      mesh: flashlightMesh,
      radius: 0.6
    });

    // Изходна врата с каса и дръжка
    const doorGroup = new THREE.Group();
    doorGroup.position.set(0, 0, -14.8);
    
    // Врата (дървена)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5e2c04, roughness: 0.7 });
    const doorGeo = new THREE.BoxGeometry(1.2, 2.2, 0.12);
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.y = 1.1;
    doorMesh.castShadow = true;
    doorGroup.add(doorMesh);
    
    // Каса (рамка на вратата)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 });
    const frameGeo = new THREE.BoxGeometry(0.06, 1.2, 0.06);
    // Горе
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 0.12), frameMat);
    topFrame.position.set(0, 2.23, 0);
    doorGroup.add(topFrame);
    // Ляво
    const leftFrame = new THREE.Mesh(frameGeo, frameMat);
    leftFrame.position.set(-0.66, 1.1, 0);
    doorGroup.add(leftFrame);
    // Дясно
    const rightFrame = leftFrame.clone();
    rightFrame.position.x = 0.66;
    doorGroup.add(rightFrame);
    
    // Дръжка на вратата
    const doorHandleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
    const handleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.04, 6), doorHandleMat);
    handleBase.position.set(0.35, 1.0, 0.08);
    handleBase.rotation.x = Math.PI / 2;
    doorGroup.add(handleBase);
    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), doorHandleMat);
    handleBar.position.set(0.39, 1.0, 0.05);
    handleBar.rotation.z = Math.PI / 2;
    doorGroup.add(handleBar);
    
    // Панели на вратата (декоративни вдлъбнатини)
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x4a2210, roughness: 0.8 });
    const panelGeo = new THREE.BoxGeometry(0.8, 0.6, 0.02);
    const panel1 = new THREE.Mesh(panelGeo, panelMat);
    panel1.position.set(0, 1.5, 0.07);
    doorGroup.add(panel1);
    const panel2 = panel1.clone();
    panel2.position.y = 0.7;
    doorGroup.add(panel2);
    
    scene.add(doorGroup);
    interactiveObjects.push({
      type: 'exit_door',
      mesh: doorMesh,
      locked: true,
      radius: 1.5
    });

    // Втори изход (лява страна на нивото)
    const doorGroup2 = new THREE.Group();
    doorGroup2.position.set(-14.5, 0, 0);
    const doorMesh2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12), doorMat);
    doorMesh2.position.y = 1.1;
    doorMesh2.castShadow = true;
    doorGroup2.add(doorMesh2);
    scene.add(doorGroup2);
    interactiveObjects.push({
      type: 'exit_door',
      mesh: doorMesh2,
      locked: true,
      radius: 1.5
    });

    // Трети изход (дясна страна на нивото, през стълбите)
    const doorGroup3 = new THREE.Group();
    doorGroup3.position.set(14.5, 0, -5);
    const doorMesh3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12), doorMat);
    doorMesh3.position.y = 1.1;
    doorMesh3.castShadow = true;
    doorGroup3.add(doorMesh3);
    scene.add(doorGroup3);
    interactiveObjects.push({
      type: 'exit_door',
      mesh: doorMesh3,
      locked: true,
      radius: 1.5
    });

    // Подобрен 3D модел на златен ключ (пръстен, стебло с канал, две зъбчета)
    const keyMesh = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.15 });

    // Кръгла глава (пръстен - торус)
    const ringGeo = new THREE.TorusGeometry(0.035, 0.01, 8, 12);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.rotation.y = Math.PI / 2;
    keyMesh.add(ring);

    // Основно стебло на ключа (правоъгълно сечение, по-реалистично)
    const shaftGeo = new THREE.BoxGeometry(0.018, 0.004, 0.11);
    const shaft = new THREE.Mesh(shaftGeo, goldMat);
    shaft.position.set(0, 0, -0.065);
    keyMesh.add(shaft);

    // Канал (прорез) по стеблото
    const grooveMat = new THREE.MeshStandardMaterial({ color: 0x996600, roughness: 0.5 });
    const grooveGeo = new THREE.BoxGeometry(0.004, 0.005, 0.04);
    const groove = new THREE.Mesh(grooveGeo, grooveMat);
    groove.position.set(0, 0, -0.05);
    keyMesh.add(groove);

    // Зъбче 1 (по-голямо)
    const tooth1Geo = new THREE.BoxGeometry(0.01, 0.025, 0.008);
    const tooth1 = new THREE.Mesh(tooth1Geo, goldMat);
    tooth1.position.set(0.009, -0.0145, -0.105);
    keyMesh.add(tooth1);
    
    // Зъбче 2 (по-малко, с отместване)
    const tooth2Geo = new THREE.BoxGeometry(0.01, 0.015, 0.008);
    const tooth2 = new THREE.Mesh(tooth2Geo, goldMat);
    tooth2.position.set(0.009, -0.0095, -0.085);
    keyMesh.add(tooth2);

    // Върховете на зъбчетата (леко заобляне)
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xcca300, metalness: 0.6, roughness: 0.3 });
    const tipGeo = new THREE.SphereGeometry(0.005, 4, 4);
    const tip1 = new THREE.Mesh(tipGeo, tipMat);
    tip1.position.set(0.014, -0.0145, -0.105);
    tip1.scale.set(1, 0.3, 1);
    keyMesh.add(tip1);
    const tip2 = tip1.clone();
    tip2.position.set(0.014, -0.0095, -0.085);
    keyMesh.add(tip2);

    keyMesh.position.set(4, 2.65, -10);
    scene.add(keyMesh);

    interactiveObjects.push({
      type: 'item',
      name: 'Ключ за врата',
      itemId: 'door_key',
      icon: 'fa-key',
      mesh: keyMesh,
      radius: 0.6
    });

  }

  // Additional bookshelves scattered around the level
  createDetailedBookshelf(-3, 1.0, 2);
  createDetailedBookshelf(3, 1.0, 2);
  createDetailedBookshelf(-6, 1.0, 0);
  createDetailedBookshelf(6, 1.0, 0);
  createDetailedBookshelf(0, 1.0, -2);
}

function getRandomPatrolNode() {
  const nodes = [
    new THREE.Vector3(10, 0, 10), new THREE.Vector3(-10, 0, 10),
    new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 0, -10),
    new THREE.Vector3(0, 0, 12), new THREE.Vector3(0, 0, -12),
    new THREE.Vector3(12, 0, 0), new THREE.Vector3(-12, 0, 0),
    new THREE.Vector3(-5, 0, 8), new THREE.Vector3(5, 0, 8),
    new THREE.Vector3(-5, 0, -8), new THREE.Vector3(5, 0, -8),
    new THREE.Vector3(8, 0, 4), new THREE.Vector3(-8, 0, 4),
    new THREE.Vector3(8, 0, -4), new THREE.Vector3(-8, 0, -4)
  ];
  return nodes[Math.floor(Math.random() * nodes.length)];
}

// -------------------------------------------------------------
// Mouse & Keyboard Event Listeners for controls
// -------------------------------------------------------------
let inputsBound = false;
function setupInputListeners() {
  if (inputsBound) return;
  inputsBound = true;

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const code = e.code;
    if (key === 'w' || code === 'KeyW' || key === 'у') keys.w = true;
    if (key === 'a' || code === 'KeyA' || key === 'ф') keys.a = true;
    if (key === 's' || code === 'KeyS' || key === 'я') keys.s = true;
    if (key === 'd' || code === 'KeyD' || key === 'в') keys.d = true;
    if (e.key === 'Shift' || code === 'ShiftLeft' || code === 'ShiftRight') keys.shift = true;
    if (e.key === 'Control' || code === 'ControlLeft' || code === 'ControlRight') {
      keys.ctrl = true;
      player.isCrawling = true;
    }
    if (code === 'Space') {
      if (gameActive && !gamePaused && !player.hiding && player.isGrounded) {
        player.velocity.y = player.jumpStrength;
        player.isGrounded = false;
        playSound('step');
      }
    }
    if (key === 'f' || code === 'KeyF' || key === 'а') toggleFlashlight();
    if (key === 'e' || code === 'KeyE' || key === 'у') performInteraction();
    
    // Slots 1-4
    if (['1','2','3','4'].includes(key)) {
      e.preventDefault();
      const slot = parseInt(key);
      player.activeSlot = slot;
      updateHUD();
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    const code = e.code;
    if (key === 'w' || code === 'KeyW' || key === 'у') keys.w = false;
    if (key === 'a' || code === 'KeyA' || key === 'ф') keys.a = false;
    if (key === 's' || code === 'KeyS' || key === 'я') keys.s = false;
    if (key === 'd' || code === 'KeyD' || key === 'в') keys.d = false;
    if (e.key === 'Shift' || code === 'ShiftLeft' || code === 'ShiftRight') keys.shift = false;
    if (e.key === 'Control' || code === 'ControlLeft' || code === 'ControlRight') {
      keys.ctrl = false;
      player.isCrawling = false;
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click (MOUSE1)
      if (gameActive && !gamePaused && !player.hiding) {
        toggleFlashlight();
      }
    }
  });

  // Mouse move look listener
  window.addEventListener('mousemove', (e) => {
    if (!renderer || document.pointerLockElement !== renderer.domElement) return;

    const sensitivity = 0.0022;
    let mx = e.movementX || 0;
    let my = e.movementY || 0;

    // If mobile touch look is active, override with touch deltas
    if (isMobile && touchLookId !== null && touchLookX !== 0) {
      mx = (touchLookX - lastTouchLookX) * 2;
      my = (touchLookY - lastTouchLookY) * 2;
      lastTouchLookX = touchLookX;
      lastTouchLookY = touchLookY;
    }

    player.rotation.x -= mx * sensitivity;
    player.rotation.y -= my * sensitivity;

    // Constrain pitch
    player.rotation.y = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, player.rotation.y));

    camera.rotation.order = "YXZ";
    camera.rotation.y = player.rotation.x;
    camera.rotation.x = player.rotation.y;
  });

  const canvas = document.getElementById('gameCanvas');
  if (canvas) {
    canvas.addEventListener('click', () => {
      if (gameActive && !player.hiding && renderer) {
        renderer.domElement.requestPointerLock();
      }
    });
  }

  // Избор на слот чрез кликане върху HUD
  document.querySelectorAll('.hotbar-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = parseInt(slot.dataset.slot);
      if (s >= 1 && s <= 4) {
        player.activeSlot = s;
        updateHUD();
      }
    });
  });

  // Автоматично паузиране при загуба на Pointer Lock
  document.addEventListener('pointerlockchange', () => {
    if (gameActive && document.pointerLockElement === null && !player.hiding) {
      pauseGame();
    }
  });
}

// -------------------------------------------------------------
// Mobile / Touch Controls Setup
// -------------------------------------------------------------
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768;
let touchMoveX = 0, touchMoveY = 0;
let touchLookX = 0, touchLookY = 0;
let lastTouchLookX = 0, lastTouchLookY = 0;
let touchJoystickActive = false;
let touchLookId = null;

function setupTouchControls() {
  if (!isMobile) return;
  const tc = document.getElementById('touchControls');
  if (tc) tc.classList.add('active');

  // Joystick handling
  const joystick = document.getElementById('touchJoystick');
  const knob = document.getElementById('touchJoystickKnob');
  if (!joystick || !knob) return;

  const joyRect = joystick.getBoundingClientRect();
  const joyCenterX = joyRect.left + joyRect.width / 2;
  const joyCenterY = joyRect.top + joyRect.height / 2;
  const joyRadius = joyRect.width / 2 - 28;

  function updateJoystick(touch) {
    const dx = touch.clientX - joyCenterX;
    const dy = touch.clientY - joyCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, joyRadius);
    const angle = Math.atan2(dy, dx);
    knob.style.transform = `translate(${-25 + Math.cos(angle) * clampedDist}px, ${-25 + Math.sin(angle) * clampedDist}px)`;
    touchMoveX = Math.cos(angle) * (clampedDist / joyRadius);
    touchMoveY = Math.sin(angle) * (clampedDist / joyRadius);
  }

  joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchJoystickActive = true;
    updateJoystick(e.changedTouches[0]);
  }, { passive: false });

  joystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    updateJoystick(e.changedTouches[0]);
  }, { passive: false });

  joystick.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchJoystickActive = false;
    touchMoveX = 0; touchMoveY = 0;
    knob.style.transform = 'translate(-25px, -25px)';
  }, { passive: false });

  // Look area
  const lookArea = document.getElementById('touchLookArea');
  if (lookArea) {
    lookArea.addEventListener('touchstart', (e) => {
      if (e.changedTouches.length > 0) {
        touchLookId = e.changedTouches[0].identifier;
        touchLookX = 0; touchLookY = 0;
      }
    }, { passive: true });

    lookArea.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchLookId) {
          touchLookX = t.clientX;
          touchLookY = t.clientY;
        }
      }
    }, { passive: true });

    lookArea.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchLookId) {
          touchLookId = null;
        }
      }
    }, { passive: true });
  }

  // Buttons
  document.getElementById('touchInteract')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    performInteraction();
  }, { passive: false });

  document.getElementById('touchJump')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !gamePaused && !player.hiding && player.isGrounded) {
      player.velocity.y = player.jumpStrength;
      player.isGrounded = false;
      playSound('step');
    }
  }, { passive: false });

  document.getElementById('touchCrouch')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    player.isCrawling = !player.isCrawling;
  }, { passive: false });

  document.getElementById('touchFlashlight')?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    toggleFlashlight();
  }, { passive: false });
}

// Apply touch input to movement in the game loop
function applyTouchInput() {
  if (!isMobile) return;
  if (touchJoystickActive) {
    keys.w = touchMoveY < -0.3;
    keys.s = touchMoveY > 0.3;
    keys.a = touchMoveX < -0.3;
    keys.d = touchMoveX > 0.3;
  }
  // Look input applied in mousemove handler simulation
}

function toggleFlashlight() {
  if (!player.inventory.some(i => i.id === 'flashlight')) return;
  player.flashlight = !player.flashlight;
  const spot = camera.children.find(c => c instanceof THREE.SpotLight);
  if (spot) {
    spot.intensity = player.flashlight ? 2.5 : 0;
  }
  playSound('click');
}

function performInteraction() {
  if (player.hiding) {
    // Unhide
    player.hiding = false;
    renderer.domElement.requestPointerLock();
    player.position.add(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.x));
    updateHUD();
    return;
  }

  // Find nearest interactive
  let nearest = hoveredObject;
  if (!nearest) {
    let minDist = Infinity;
    interactiveObjects.forEach(obj => {
      const pPos = new THREE.Vector3(player.position.x, 0, player.position.z);
      const oPos = new THREE.Vector3(obj.mesh.position.x, 0, obj.mesh.position.z);
      const dist = pPos.distanceTo(oPos);
      if (dist < (obj.radius + 1.2) && dist < minDist) {
        minDist = dist;
        nearest = obj;
      }
    });
  }

  if (nearest) {
    if (nearest.type === 'item') {
      // Pick up
      player.inventory.push({ id: nearest.itemId, name: nearest.name, icon: nearest.icon });
      scene.remove(nearest.mesh);
      interactiveObjects = interactiveObjects.filter(o => o !== nearest);
      showNotification(`Събрано: ${nearest.name}`);
      playSound('win');
      updateHUD();
    } else if (nearest.type === 'locker') {
      // Hide
      player.hiding = true;
      player.currentLocker = nearest.mesh;
      document.exitPointerLock();
      playSound('click');
      showNotification("Криеш се в шкафчето. Натисни E за излизане.");
      updateHUD();
    } else if (nearest.type === 'exit_door') {
      // Check for key
      const activeItem = player.inventory[player.activeSlot - 1];
      if (activeItem && activeItem.id === 'door_key') {
        // Unlock Exit Door
        nearest.locked = false;
        showNotification("Вратата е отключена!");
        playSound('win');
        triggerVictory();
      } else {
        showNotification("Вратата е заключена! Трябва ти съответния ключ.");
      }
    }
  }
}

function updateInteractionPrompt() {
  const promptEl = document.getElementById('interactionPrompt');
  const crosshair = document.querySelector('.crosshair');
  if (!promptEl) return;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const meshes = [];
  interactiveObjects.forEach(o => {
    if (o.mesh.isGroup) {
      o.mesh.traverse(child => {
        if (child.isMesh) meshes.push(child);
      });
    } else {
      meshes.push(o.mesh);
    }
  });

  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0 && intersects[0].distance < 3.0) {
    const hitMesh = intersects[0].object;
    const targetObj = interactiveObjects.find(o => {
      if (o.mesh === hitMesh) return true;
      let found = false;
      o.mesh.traverse(child => {
        if (child === hitMesh) found = true;
      });
      return found;
    });

    if (targetObj) {
      hoveredObject = targetObj;
      if (crosshair) crosshair.classList.add('interactable');
      promptEl.classList.add('active');
      
      if (targetObj.itemId === 'flashlight') {
        promptEl.innerHTML = `Фенер <span style="color: #ffd700;">[E]</span>`;
      } else if (targetObj.itemId === 'door_key') {
        promptEl.innerHTML = `Ключ за врата <span style="color: #ffd700;">[E]</span>`;
      } else if (targetObj.type === 'locker') {
        promptEl.innerHTML = `Скрий се в шкафче <span style="color: #ffd700;">[E]</span>`;
      } else if (targetObj.type === 'exit_door') {
        promptEl.innerHTML = `Отключи врата <span style="color: #ffd700;">[E]</span>`;
      } else {
        promptEl.innerHTML = `Взаимодействие <span style="color: #ffd700;">[E]</span>`;
      }
      return;
    }
  }

  hoveredObject = null;
  if (crosshair) crosshair.classList.remove('interactable');
  promptEl.classList.remove('active');
}

let clock = new THREE.Clock();

function gameLoop() {
  if (!gameActive || gamePaused) return;
  animationFrameId = requestAnimationFrame(gameLoop);

  const delta = clock.getDelta();
  
  if (!player.hiding) {
    handlePlayerMovement(delta);
  } else {
    // Hide noise decays
    player.noise = Math.max(0, player.noise - delta * 20);
    // Heartbeat sound
    if (Math.random() < 0.02) playSound('heartbeat');
  }

  updateKoceAI(delta);
  updateNoiseHUD();
  updateFlashlightBattery(delta);
  updateInteractionPrompt();
  updateZoneTriggers(delta);

  renderer.render(scene, camera);
}

function handlePlayerMovement(delta) {
  applyTouchInput();
  // Movement Speed configuration
  let speed = player.speed;
  if (keys.shift && player.stamina > 0 && (keys.w || keys.a || keys.s || keys.d)) {
    speed = player.runSpeed;
    player.stamina = Math.max(0, player.stamina - delta * 25);
    player.noise = Math.min(100, player.noise + delta * 60);
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

  // Speed mods
  // Speed mods
  speed *= player.speedMultiplier;
  player.noise *= player.noiseMultiplier;

  // Local direction vectors
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.x);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.x);

  const moveDir = new THREE.Vector3();
  if (keys.w) moveDir.add(forward);
  if (keys.s) moveDir.add(forward.clone().negate());
  if (keys.d) moveDir.add(right);
  if (keys.a) moveDir.add(right.clone().negate());

  if (moveDir.lengthSq() > 0.001) {
    moveDir.normalize();

    const prevPos = player.position.clone();

    const checkPlayerCollision = () => {
      let collision = false;
      levelMap.forEach(mesh => {
        if (mesh === levelMap[0] || mesh === levelMap[1]) return; // ignore floor and ceil
        const box = new THREE.Box3().setFromObject(mesh);
        const playerBox = new THREE.Box3(
          new THREE.Vector3(player.position.x - 0.25, player.position.y - player.height, player.position.z - 0.25),
          new THREE.Vector3(player.position.x + 0.25, player.position.y + 0.4, player.position.z + 0.25)
        );
        if (box.intersectsBox(playerBox)) {
          collision = true;
        }
      });
      return collision;
    };

    // Опит за преместване по ос X
    player.position.x += moveDir.x * speed;
    if (checkPlayerCollision()) {
      player.position.x = prevPos.x;
    }

    // Опит за преместване по ос Z
    player.position.z += moveDir.z * speed;
    if (checkPlayerCollision()) {
      player.position.z = prevPos.z;
    }
  }

  // Gravity physics logic
  if (!player.isGrounded) {
    player.velocity.y -= 9.8 * 2.0 * delta; // standard gravity
    player.position.y += player.velocity.y * delta;

    // Check landing Y height
    let standY = player.height;
    
    // Balcony landing check
    if (player.position.x >= -8 && player.position.x <= 8 && player.position.z >= -15 && player.position.z <= 1) {
      if (player.position.y >= 2.5 + player.height - 0.2 && player.velocity.y <= 0) {
        standY = 2.5 + player.height;
      }
    }

    // Stair landing check (catch player falling onto stairs)
    if (player.position.x >= -6.5 && player.position.x <= -3.5 && player.position.z >= -4.0 && player.position.z <= 1.5 && player.position.y < 2.5 + player.height) {
      const t = Math.max(0, Math.min(1, (player.position.z + 3.5) / 4.5));
      const stairHeight = 0.115 + t * 2.3;
      if (player.position.y >= stairHeight + player.height - 0.2 && player.velocity.y <= 0) {
        standY = Math.max(standY, stairHeight + player.height);
      }
    }

    if (player.position.y <= standY) {
      player.position.y = standY;
      player.velocity.y = 0;
      player.isGrounded = true;
    }
  } else {
    // Grounded height checks
    let expectedY = player.height;
    const isOnBalcony = player.position.y > 2.0 && player.position.x >= -8 && player.position.x <= 8 && player.position.z >= -15 && player.position.z <= 1;
    if (isOnBalcony) {
      expectedY = 2.5 + player.height;
    } else if (player.position.x >= -6.5 && player.position.x <= -3.5 && player.position.z >= -4.0 && player.position.z <= 1.5) {
      // Smooth step climbing on stairs: x = -5, z = -3.5 to 1
      const t = Math.max(0, Math.min(1, (player.position.z + 3.5) / 4.5));
      const stairHeight = 0.115 + t * 2.3;
      expectedY = stairHeight + player.height;
    }

    // Apply height adjustment
    if (Math.abs(player.position.y - expectedY) > 0.05) {
      if (player.position.y > expectedY) {
        player.isGrounded = false;
        player.velocity.y = 0;
      } else {
        player.position.y = expectedY;
      }
    }
  }

  // Update Camera position
  camera.position.copy(player.position);
  if (player.isCrawling) {
    camera.position.y -= 0.6;
  }

  // Footstep audio simulation
  if ((keys.w || keys.a || keys.s || keys.d) && Math.floor(clock.getElapsedTime() * (keys.shift ? 4.5 : 2.5)) % 2 === 0) {
    if (Math.random() < 0.05) playSound('step');
  }

  // Update HUD values
  document.getElementById('staminaBar').style.width = player.stamina + '%';
}

function updateKoceAI(delta) {
  if (!koce.mesh) return;

  const distToPlayer = koce.position.distanceTo(player.position);
  
  // Vision check (Raycasting line of sight)
  let playerVisible = false;
  if (distToPlayer < koce.visionRange && !player.hiding) {
    const rayDir = player.position.clone().sub(koce.position).normalize();
    const raycaster = new THREE.Raycaster(koce.position.clone().add(new THREE.Vector3(0, 1.2, 0)), rayDir, 0.1, koce.visionRange);
    const intersects = raycaster.intersectObjects(levelMap);
    if (intersects.length === 0 || intersects[0].distance > distToPlayer) {
      playerVisible = true;
    }
  }

  // Hearing check
  let playerHeard = false;
  if (player.noise > 15 && distToPlayer < (player.noise * 0.25)) {
    playerHeard = true;
    koce.lastKnownPlayerPos = player.position.clone();
  }

  // Behavior state switcher
  if (playerVisible) {
    if (koce.state !== 'chase') {
      koce.state = 'chase';
      playSound('alert');
      showNotification("Коце те видя! Бягай!");
    }
    koce.lastKnownPlayerPos = player.position.clone();
  } else if (playerHeard) {
    if (koce.state !== 'chase') {
      koce.state = 'search';
    }
  }

  // AI movement controller
  let currentSpeed = (koce.state === 'chase') ? koce.chaseSpeed : koce.speed;
  let targetPos = new THREE.Vector3();

  if (koce.state === 'chase' && koce.lastKnownPlayerPos) {
    targetPos.copy(koce.lastKnownPlayerPos);
    // Exit chase if target reached and player not visible
    if (koce.position.distanceTo(targetPos) < 1.0 && !playerVisible) {
      koce.state = 'search';
      koce.searchTimer = 5; // Search for 5 seconds
    }
  } else if (koce.state === 'search' && koce.lastKnownPlayerPos) {
    targetPos.copy(koce.lastKnownPlayerPos);
    koce.searchTimer -= delta;
    if (koce.searchTimer <= 0) {
      koce.state = 'patrol';
      koce.patrolTarget.copy(getRandomPatrolNode());
    }
  } else {
    // Patrol Mode
    targetPos.copy(koce.patrolTarget);
    if (koce.position.distanceTo(targetPos) < 1.0) {
      koce.patrolTarget.copy(getRandomPatrolNode());
    }
  }

  // Rotate and steer Koce towards target positions
  const dir = targetPos.clone().sub(koce.position);
  dir.y = 0;
  if (dir.lengthSq() > 0.01) {
    dir.normalize();
    const proposedX = koce.position.x + dir.x * currentSpeed;
    const proposedZ = koce.position.z + dir.z * currentSpeed;
    
    // Koce collision with levelMap (try X and Z independently for sliding)
    const koceRadius = 0.4;
    let blockedX = false, blockedZ = false;
    for (const obj of levelMap) {
      if (!obj.geometry || !obj.geometry.parameters) continue;
      const box = new THREE.Box3().setFromObject(obj);
      const testX = new THREE.Vector3(proposedX, koce.position.y, koce.position.z);
      if (box.containsPoint(testX) || box.distanceToPoint(testX) < koceRadius) {
        blockedX = true;
      }
      const testZ = new THREE.Vector3(koce.position.x, koce.position.y, proposedZ);
      if (box.containsPoint(testZ) || box.distanceToPoint(testZ) < koceRadius) {
        blockedZ = true;
      }
    }
    
    koce.position.x = blockedX ? koce.position.x : proposedX;
    koce.position.z = blockedZ ? koce.position.z : proposedZ;
    koce.mesh.position.copy(koce.position);
    
    // Look rotation
    const angle = Math.atan2(dir.x, dir.z);
    koce.mesh.rotation.y = angle;
  }

  // Trigger scary sound line alerts
  koce.soundTimer -= delta;
  if (koce.soundTimer <= 0) {
    koce.soundTimer = 8 + Math.random() * 8;
    const voicePool = voiceLines[koce.state];
    const phrase = voicePool[Math.floor(Math.random() * voicePool.length)];
    showNotification(`Коце: "${phrase}"`, 'warn');
  }

  // Game over check
  const horizontalDistToPlayer = new THREE.Vector2(koce.position.x, koce.position.z).distanceTo(new THREE.Vector2(player.position.x, player.position.z));
  const verticalDistToPlayer = Math.abs(koce.position.y - (player.position.y - player.height));
  if (horizontalDistToPlayer < 1.2 && verticalDistToPlayer < 1.5 && !player.hiding) {
    player.hearts--;
    updateHeartsHUD();
    
    if (player.hearts <= 0) {
      triggerGameOver();
    } else {
      showNotification(`Коце те хвана! Остават ти ${player.hearts} <i class="fas fa-heart-broken"></i>`, 'warn');
      playSound('alert');
      triggerHeartThump();
      // Нулиране на позицията на играча
      player.position.set(-13, player.height, 13);
      if (camera) {
        camera.position.copy(player.position);
        camera.rotation.order = "YXZ";
        camera.rotation.y = 0;
        camera.rotation.x = 0;
      }
      player.velocity.set(0, 0, 0);
      player.isGrounded = true;
      player.rotation.set(0, 0);
      
      // Нулиране на позицията на Коце
      koce.position.set(15, 0, 15);
      koce.state = 'patrol';
      koce.patrolTarget.copy(getRandomPatrolNode());
    }
  }
}

function updateNoiseHUD() {
  const bars = document.getElementById('noiseWave').children;
  const numActive = Math.floor(player.noise / 15);
  for (let i = 0; i < bars.length; i++) {
    if (i < numActive) {
      bars[i].style.height = (8 + i * 4) + 'px';
      bars[i].style.background = player.noise > 60 ? '#f44336' : (player.noise > 30 ? '#ffa726' : '#4caf50');
    } else {
      bars[i].style.height = '3px';
      bars[i].style.background = 'rgba(255,255,255,0.1)';
    }
  }
}

function updateFlashlightBattery(delta) {
  if (player.flashlight) {
    player.flashlightBattery = Math.max(0, player.flashlightBattery - delta * 4.5);
    if (player.flashlightBattery <= 0) {
      toggleFlashlight();
    }
  }
  document.getElementById('batteryBar').style.width = player.flashlightBattery + '%';
}

function updateHUD() {
  // Inventory sync
  for (let i = 1; i <= 4; i++) {
    const slot = document.getElementById(`slot-${i}`);
    slot.className = `hotbar-slot ${player.activeSlot === i ? 'active' : ''}`;
    const item = player.inventory[i - 1];
    
    // Clear old HTML icons
    const icon = slot.querySelector('i:not(.hotbar-slot-key i)');
    if (icon) icon.remove();

    if (item) {
      const itemIcon = document.createElement('i');
      itemIcon.className = `fas ${item.icon}`;
      slot.appendChild(itemIcon);
    }
  }

  // Покажи батерията само когато държим фенера в ръка
  const activeItem = player.inventory[player.activeSlot - 1];
  const batteryBarGroup = document.getElementById('batteryBarGroup');
  if (batteryBarGroup) {
    if (activeItem && activeItem.id === 'flashlight') {
      batteryBarGroup.style.display = 'flex';
    } else {
      batteryBarGroup.style.display = 'none';
    }
  }

  updateHeartsHUD();
  updateHeldItemDisplay();
}

function updateHeartsHUD() {
  const container = document.getElementById('heartsContainer');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < player.maxHearts; i++) {
    const heart = document.createElement('i');
    if (i < player.hearts) {
      heart.className = 'fas fa-heart';
      heart.style.color = '#e63946';
    } else {
      heart.className = 'far fa-heart';
      heart.style.color = 'rgba(255, 255, 255, 0.2)';
    }
    container.appendChild(heart);
  }
}

function triggerHeartThump() {
  const el = document.getElementById('heartThumpOverlay');
  if (!el) return;
  el.classList.remove('active');
  void el.offsetWidth;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 700);
}

function updateHeldItemDisplay() {
  const el = document.getElementById('heldItemDisplay');
  if (!el) return;
  const activeItem = player.inventory[player.activeSlot - 1];
  if (activeItem && activeItem.id !== 'hand') {
    el.innerHTML = `<i class="fas ${activeItem.icon}"></i>`;
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

// -------------------------------------------------------------
// Interactive UI Alerts, Menus and Core Screen Overlays
// -------------------------------------------------------------
function showNotification(message, type = 'success') {
  // Standard toast popup inside the canvas overlay
  const container = document.getElementById('toastContainer');
  if (!container) {
    // If not in index.html, fall back to simple logging
    console.log(`Notification: ${message}`);
    return;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = '<i class="fas fa-bullhorn"></i>';
  if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
  else if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
  else if (type === 'info') icon = '<i class="fas fa-info-circle"></i>';
  else if (type === 'warn') icon = '<i class="fas fa-exclamation-triangle"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 2500);
}

// -------------------------------------------------------------
// Dynamic Zone Popups System
// -------------------------------------------------------------
let zonePopupQueue = [];
let zonePopupActive = false;
let visitedZones = new Set();

function showDynamicPopup(title, message, icon = 'fa-info-circle', duration = 4000) {
  const el = document.getElementById('dynamicPopup');
  if (!el) return;
  
  el.querySelector('.popup-icon i').className = `fas ${icon}`;
  el.querySelector('.popup-title').textContent = title;
  el.querySelector('.popup-message').textContent = message;
  el.classList.add('active');
  el.classList.remove('hide');
  
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => {
      el.classList.remove('active');
      zonePopupActive = false;
      processZoneQueue();
    }, 400);
  }, duration);
  
  zonePopupActive = true;
}

function processZoneQueue() {
  if (zonePopupActive || zonePopupQueue.length === 0) return;
  const next = zonePopupQueue.shift();
  showDynamicPopup(next.title, next.message, next.icon, next.duration);
}

function checkZoneTrigger(zoneId, title, message, icon) {
  if (visitedZones.has(zoneId)) return;
  visitedZones.add(zoneId);
  
  zonePopupQueue.push({ title, message, icon, duration: 4000 });
  if (!zonePopupActive) processZoneQueue();
}

let zoneCheckTimer = 0;
function updateZoneTriggers(delta) {
  zoneCheckTimer += delta;
  if (zoneCheckTimer < 2.0) return;
  zoneCheckTimer = 0;
  
  if (player.position.y > 4.0 && player.position.x >= -8 && player.position.x <= 8 && player.position.z >= -15 && player.position.z <= 1) {
    checkZoneTrigger('l1_balcony', 'Балкон — 2-ри етаж', 'Внимавай! Коце може да се качи по стълбите и да те открие. Търси ключа сред рафтовете!', 'fa-cloud-moon');
  }
  if (player.position.x >= -6.5 && player.position.x <= -3.5 && player.position.z >= -4.0 && player.position.z <= 1.5) {
    checkZoneTrigger('l1_stairs', 'Стълби', 'Качваш се на втория етаж. Бъди тих — шумът привлича Коце!', 'fa-arrow-up');
  }
  if (player.position.distanceTo(new THREE.Vector3(4, 2.65, -10)) < 5) {
    checkZoneTrigger('l1_key_area', 'Близо до ключа', 'Някъде тук има ключ за изходната врата. Огледай се внимателно!', 'fa-key');
  }
  if (player.position.distanceTo(new THREE.Vector3(0, 0.85, 4)) < 5) {
    checkZoneTrigger('l1_flashlight_area', 'Фенерче', 'Фенерчето е някъде тук на масата. Светлината ще ти помогне в тъмното!', 'fa-flashlight');
  }
}

// Start Game from Main Menu
document.getElementById('btnPlayGame').addEventListener('click', () => {
  initAudio();
  document.getElementById('mainMenuOverlay').style.display = 'none';
  document.getElementById('hud').classList.add('active');
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  gameActive = true;
  gameTime = 0;
  currentPart = 1;
  clock.getDelta(); // reset clock
  initEngine();
  gameLoop();
  updateLevelProgressDisplay();
  
  // Lock screen
  if (renderer && renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
  
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    gameTime += 0.1;
  }, 100);

  // Setup stuck alert timer after 3 minutes (180s)
  setTimeout(() => {
    if (gameActive) {
      document.getElementById('hintPopup').style.display = 'block';
      document.exitPointerLock();
    }
  }, 180000);
});

// Tab navigation listeners in Main Menu
document.querySelectorAll('.menu-nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.menu-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const targetTab = btn.dataset.tab;
    document.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(targetTab).classList.add('active');
    
    playSound('click');
  });
});

// Level selection buttons
document.querySelectorAll('.level-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const level = parseInt(btn.dataset.level);
    if (btn.classList.contains('locked')) {
      showNotification('Това ниво не е достъпно още!', 'warn');
      return;
    }
    document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentLevel = level;
    updateLevelProgressDisplay();
    playSound('click');
  });
});

function updateLevelProgressDisplay() {
  const progress = getProgress();
  const done = [1,2,3,4,5,6,7,8,9,10].filter(p => progress[`l1_p${p}`]).length;
  document.getElementById('level1Prog').textContent = done + '/10';
}

// Victory triggering screen
function getProgress() {
  try { return JSON.parse(localStorage.getItem('game_progress') || '{}'); } catch { return {}; }
}
function saveProgress(p) {
  localStorage.setItem('game_progress', JSON.stringify(p));
}

function triggerVictory() {
  gameActive = false;
  clearInterval(timerInterval);
  document.exitPointerLock();
  
  playSound('win');
  document.getElementById('victoryTime').textContent = gameTime.toFixed(2) + 'с';
  document.getElementById('victoryOverlay').style.display = 'flex';
  document.getElementById('hud').classList.remove('active');

  // Track completed parts
  const progress = getProgress();
  const completedKey = `l1_p${currentPart}`;
  if (!progress[completedKey]) {
    progress[completedKey] = true;
    saveProgress(progress);
  }

  // Check if replaying (all 10 parts done)
  const allPartsDone = [1,2,3,4,5,6,7,8,9,10].every(p => progress[`l1_p${p}`]);
  const isReplay = allPartsDone && currentPart <= 10;

  // Rewards (reduced if replay)
  const xpReward = isReplay ? 10 : 50;
  const creditReward = isReplay ? 5 : 25;
  rewardXPAndCredits(xpReward, creditReward, isReplay ? 'Преиграване (намалени награди)' : 'Преминаване на ниво');
  submitLeaderboardRecord(Math.floor(gameTime * 1000));

  if (isReplay) {
    showNotification('Преиграване — наградите са намалени!', 'warn');
  }

  // Auto-advance to next part after 8 seconds
  setTimeout(() => {
    const victoryOverlay = document.getElementById('victoryOverlay');
    if (victoryOverlay && victoryOverlay.style.display === 'flex') {
      nextLevelPart();
    }
  }, 8000);
}

// Defeat / caught triggering screen
function triggerGameOver() {
  gameActive = false;
  clearInterval(timerInterval);
  document.exitPointerLock();

  playSound('gameover');
  document.getElementById('gameOverOverlay').style.display = 'flex';
  document.getElementById('hud').classList.remove('active');
}

window.restartLevel = () => {
  document.getElementById('gameOverOverlay').style.display = 'none';
  document.getElementById('victoryOverlay').style.display = 'none';
  document.getElementById('hud').classList.add('active');
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  gameActive = true;
  gameTime = 0;
  resetPositions();
  gameLoop();
  
  if (renderer && renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
  
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    gameTime += 0.1;
  }, 100);
};

window.exitToMenu = () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  gameActive = false;
  gamePaused = false;
  clearInterval(timerInterval);
  document.getElementById('gameOverOverlay').style.display = 'none';
  document.getElementById('victoryOverlay').style.display = 'none';
  document.getElementById('pauseOverlay').style.display = 'none';
  document.getElementById('mainMenuOverlay').style.display = 'flex';
  updateLevelProgressDisplay();
  updateMenuPreview();
};

window.nextLevelPart = () => {
  currentPart++;
  if (currentPart > 10) {
    currentPart = 10;
    showNotification('Всички 10 части са завършени! Опитай пак за по-добро време.', 'success');
    return;
  }
  restartLevel();
};

// -------------------------------------------------------------
// Interactive Hints and Dev Controls
// -------------------------------------------------------------
window.unlockHintWithCredits = async () => {
  if (userCredits < 25) {
    alert("Нямате достатъчно кредити!");
    return;
  }
  try {
    const updated = userCredits - 25;
    await db.collection('users').doc(currentUser.uid).update({ credits: updated });
    closeHintPopup();
    showNotification("Подсказка: Търси ключа около рафтовете/бюрата!", "info");
  } catch(err) {
    console.error(err);
  }
};

window.unlockHintWithAd = () => {
  alert("Гледане на видео реклама (30с)...");
  setTimeout(() => {
    closeHintPopup();
    showNotification("Подсказка: Търси ключа около рафтовете/бюрата!", "info");
  }, 2000);
};

window.closeHintPopup = () => {
  document.getElementById('hintPopup').style.display = 'none';
  if (gameActive) {
    renderer.domElement.requestPointerLock();
  }
};

// Dev Panel methods
window.setDevCredits = async () => {
  try {
    await db.collection('users').doc(currentUser.uid).update({ credits: userCredits + 100 });
    showNotification("Добавени 100 Кредита!");
  } catch (err) {
    console.error(err);
  }
};

window.setDevXP = async () => {
  try {
    await db.collection('users').doc(currentUser.uid).update({ xp: userXP + 200 });
    showNotification("Добавени 200 XP!");
  } catch (err) {
    console.error(err);
  }
};

window.unlockAllLevels = () => {
  document.querySelectorAll('.level-btn.locked').forEach(b => b.classList.remove('locked'));
  currentLevel = 3;
  currentPart = 10;
  showNotification("Всички нива са достъпни!");
};

// -------------------------------------------------------------
// Pause Menu Implementation
// -------------------------------------------------------------
window.pauseGame = () => {
  if (!gameActive || gamePaused) return;
  gamePaused = true;
  clearInterval(timerInterval);
  document.getElementById('pauseOverlay').style.display = 'flex';
  playSound('click');
};

window.resumeGame = () => {
  gamePaused = false;
  document.getElementById('pauseOverlay').style.display = 'none';
  const canvas = document.getElementById('gameCanvas');
  if (canvas) canvas.requestPointerLock();
  
  clock.getDelta();
  gameLoop();
  
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    gameTime += 0.1;
  }, 100);
};

// -------------------------------------------------------------
// Character Creator & Closet Settings
// -------------------------------------------------------------
let creatorPreviewScene, creatorPreviewCamera, creatorPreviewRenderer, creatorPreviewMesh;
let creatorShirtColor = '#4caf50';
let creatorPantsColor = '#1d3557';

function initCreatorPreviewScene() {
  const container = document.getElementById('creatorPreviewContainer');
  if (!container || creatorPreviewRenderer) return;

  creatorPreviewScene = new THREE.Scene();
  creatorPreviewCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 10);
  creatorPreviewCamera.position.set(0, 0.8, 2.2);
  creatorPreviewCamera.lookAt(0, 0.4, 0);

  creatorPreviewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  creatorPreviewRenderer.setSize(container.clientWidth, container.clientHeight);
  creatorPreviewRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(creatorPreviewRenderer.domElement);

  const light = new THREE.AmbientLight(0xffffff, 0.8);
  creatorPreviewScene.add(light);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(2, 3, 1);
  creatorPreviewScene.add(dirLight);

  creatorPreviewMesh = createCharacterModel(creatorShirtColor, 'none', creatorPantsColor, 'brown_short');
  creatorPreviewScene.add(creatorPreviewMesh);

  function animateCreatorPreview() {
    requestAnimationFrame(animateCreatorPreview);
    if (creatorPreviewMesh) {
      creatorPreviewMesh.rotation.y += 0.015;
    }
    creatorPreviewRenderer.render(creatorPreviewScene, creatorPreviewCamera);
  }
  animateCreatorPreview();

  // Drag interaction
  let isDragging = false;
  let prevMouseX = 0;
  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevMouseX = e.clientX;
  });
  window.addEventListener('mouseup', () => isDragging = false);
  container.addEventListener('mousemove', (e) => {
    if (isDragging && creatorPreviewMesh) {
      const deltaX = e.clientX - prevMouseX;
      creatorPreviewMesh.rotation.y += deltaX * 0.01;
      prevMouseX = e.clientX;
    }
  });
}

window.updateCreatorModel = () => {
  if (creatorPreviewMesh) {
    creatorPreviewScene.remove(creatorPreviewMesh);
  }
  const hair = document.getElementById('creatorHair').value;
  creatorPreviewMesh = createCharacterModel(creatorShirtColor, 'none', creatorPantsColor, hair);
  creatorPreviewScene.add(creatorPreviewMesh);
};

window.setCreatorShirt = (color, btn) => {
  creatorShirtColor = color;
  document.querySelectorAll('#characterCreatorOverlay .creator-color-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateCreatorModel();
  playSound('click');
};

window.setCreatorPants = (color, btn) => {
  creatorPantsColor = color;
  document.querySelectorAll('#characterCreatorOverlay .creator-pants-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateCreatorModel();
  playSound('click');
};

window.saveInitialCharacter = async () => {
  const shirt = creatorShirtColor;
  const pants = creatorPantsColor;
  const hair = document.getElementById('creatorHair').value;

  const style = { shirtColor: shirt, pantsColor: pants, hairStyle: hair };
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      characterStyle: style,
      equippedSkin: 'default'
    });
    playerCustomStyle = style;
    document.getElementById('characterCreatorOverlay').style.display = 'none';
    showNotification("Героят беше създаден успешно!", "success");
    playSound('win');
    updateMenuPreview();
  } catch (err) {
    console.error(err);
  }
};

// Dressing Room / Съблекалня
let closetShirtColor = '#4caf50';
let closetPantsColor = '#1d3557';

window.setClosetShirt = (color, btn) => {
  closetShirtColor = color;
  document.querySelectorAll('#closet-tab .creator-color-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateClosetModel();
  playSound('click');
};

window.setClosetPants = (color, btn) => {
  closetPantsColor = color;
  document.querySelectorAll('#closet-tab .creator-pants-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateClosetModel();
  playSound('click');
};

window.updateClosetModel = () => {
  const hair = document.getElementById('closetHair').value;
  if (previewMesh) {
    previewScene.remove(previewMesh);
  }
  previewMesh = createCharacterModel(closetShirtColor, 'none', closetPantsColor, hair);
  previewScene.add(previewMesh);
};

window.saveClosetSelection = async () => {
  const shirt = closetShirtColor;
  const pants = closetPantsColor;
  const hair = document.getElementById('closetHair').value;

  const style = { shirtColor: shirt, pantsColor: pants, hairStyle: hair };
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      characterStyle: style,
      equippedSkin: 'default'
    });
    player.activeSkin = 'default';
    playerCustomStyle = style;
    showNotification("Стилът на героя беше обновен!");
    playSound('win');
    updateMenuPreview();
    renderShopGrid();
  } catch (err) {
    console.error(err);
  }
};

