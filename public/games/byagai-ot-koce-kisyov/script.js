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
  isCrawling: false
};

// Key controls
const keys = { w: false, a: false, s: false, d: false, shift: false, ctrl: false };

// Antagonist "Koce"
const koce = {
  mesh: null,
  position: new THREE.Vector3(15, 0, 15),
  speed: 0.04,
  chaseSpeed: 0.09,
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
      showNotification(`Получи +${creditsAmount} 💰 и +${xpAmount} XP (${reason})`, 'success');
    }
    if (leveledUp) {
      showNotification(`🎉 Честито! Достигна ниво ${newLevel} и получи бонус от ${newLevel * 50} 💰!`, 'success');
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
          document.getElementById('characterCreatorOverlay').style.display = 'flex';
          initCreatorPreviewScene();
        } else {
          playerCustomStyle = d.characterStyle;
          closetShirtColor = playerCustomStyle.shirtColor || '#4caf50';
          closetPantsColor = playerCustomStyle.pantsColor || '#1d3557';
          const closetHairEl = document.getElementById('closetHair');
          if (closetHairEl) closetHairEl.value = playerCustomStyle.hairStyle || 'brown_short';
        }

        player.activeSkin = d.equippedSkin || 'default';
        
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
  
  const shirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shirtColorHex), roughness: 0.5 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 }); // skin tone
  const pantsMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pantsColorHex), roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }); // black shoes
  
  // Body (Box)
  const bodyGeo = new THREE.BoxGeometry(0.35, 0.55, 0.2);
  const body = new THREE.Mesh(bodyGeo, shirtMat);
  body.position.y = 0.45;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Neck (small flesh box on top of body)
  const neckGeo = new THREE.BoxGeometry(0.1, 0.06, 0.1);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.set(0, 0.73, 0);
  group.add(neck);

  // Head (Box)
  const headGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 0.85;
  head.castShadow = true;
  group.add(head);

  // Eyes (Two small boxes on the front face of head)
  const eyeGeo = new THREE.BoxGeometry(0.03, 0.03, 0.01);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.06, 0.88, 0.125);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.06, 0.88, 0.125);
  group.add(leftEye);
  group.add(rightEye);

  // Mouth (Small red box)
  const mouthGeo = new THREE.BoxGeometry(0.06, 0.02, 0.01);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0xe63946 });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, 0.79, 0.125);
  group.add(mouth);

  // Hair Styles
  let hairColor = 0x5c4033; // Default brown
  if (hairStyle === 'black_spiky') hairColor = 0x111111;
  else if (hairStyle === 'blonde_long') hairColor = 0xf5e3a0;
  
  if (hairStyle !== 'bald') {
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.8 });
    
    // Main hair cap
    const capGeo = new THREE.BoxGeometry(0.26, 0.08, 0.26);
    const cap = new THREE.Mesh(capGeo, hairMat);
    cap.position.set(0, 0.98, 0);
    group.add(cap);

    // Back hair flap
    const backGeo = new THREE.BoxGeometry(0.26, 0.16, 0.06);
    const backFlap = new THREE.Mesh(backGeo, hairMat);
    backFlap.position.set(0, 0.88, -0.1);
    group.add(backFlap);

    if (hairStyle === 'black_spiky') {
      // Add spiky segments
      const spikeGeo = new THREE.BoxGeometry(0.04, 0.06, 0.04);
      for (let offset = -0.08; offset <= 0.08; offset += 0.08) {
        const spike = new THREE.Mesh(spikeGeo, hairMat);
        spike.position.set(offset, 1.03, 0.04);
        spike.rotation.z = offset * -2;
        group.add(spike);
      }
    } else if (hairStyle === 'blonde_long') {
      // Add side cascades hanging down
      const sideGeo = new THREE.BoxGeometry(0.04, 0.3, 0.24);
      const leftSide = new THREE.Mesh(sideGeo, hairMat);
      leftSide.position.set(-0.13, 0.79, 0.01);
      const rightSide = leftSide.clone();
      rightSide.position.x = 0.13;
      group.add(leftSide);
      group.add(rightSide);
    }
  }

  // Arms (Left & Right)
  const armGeo = new THREE.BoxGeometry(0.08, 0.45, 0.08);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.22, 0.45, 0);
  leftArm.castShadow = true;
  
  // Hand (skin colored end of arm)
  const handGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.position.set(-0.22, 0.2, 0);
  group.add(leftHand);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.22;
  const rightHand = leftHand.clone();
  rightHand.position.x = 0.22;

  group.add(leftArm);
  group.add(rightArm);
  group.add(rightHand);

  // Legs (Left & Right)
  const legGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.09, 0.175, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.09;
  group.add(rightLeg);

  // Shoes (Black blocks under legs)
  const shoeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.16);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.09, 0.03, 0.02);
  leftShoe.castShadow = true;
  group.add(leftShoe);

  const rightShoe = leftShoe.clone();
  rightShoe.position.x = 0.09;
  group.add(rightShoe);

  // Accessories
  if (accessory === 'hat') {
    const hatGeo = new THREE.ConeGeometry(0.15, 0.2, 4);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2 });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 1.06;
    hat.rotation.y = Math.PI / 4;
    group.add(hat);
  } else if (accessory === 'glasses') {
    const glassesGeo = new THREE.BoxGeometry(0.26, 0.04, 0.04);
    const glassesMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });
    const glasses = new THREE.Mesh(glassesGeo, glassesMat);
    glasses.position.set(0, 0.88, 0.13);
    group.add(glasses);
  } else if (accessory === 'horns') {
    const hornGeo = new THREE.ConeGeometry(0.04, 0.1, 4);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-0.08, 1.0, 0.06);
    leftHorn.rotation.set(0.2, 0, -0.4);
    const rightHorn = leftHorn.clone();
    rightHorn.position.x = 0.08;
    rightHorn.rotation.z = 0.4;
    group.add(leftHorn);
    group.add(rightHorn);
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
  scene.fog = new THREE.FogExp2(0x020205, 0.12);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lights
  const ambient = new THREE.AmbientLight(0x020205, 0.15);
  scene.add(ambient);

  // Directional Light
  const dirLight = new THREE.DirectionalLight(0x08080f, 0.3);
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
}

function resetPositions() {
  player.position.set(2, player.height, 2);
  player.rotation.set(0, 0);
  player.stamina = 100;
  player.flashlightBattery = 100;
  player.flashlight = false;
  player.inventory = [{ id: 'hand', name: 'Ръце', icon: 'fa-hand-paper' }];
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
  const spot = camera.children.find(c => c instanceof THREE.SpotLight);
  if (spot) spot.intensity = 0;

  updateHUD();
}

function buildLevel(level) {
  // Clear old maps
  levelMap.forEach(mesh => scene.remove(mesh));
  levelMap = [];
  interactiveObjects.forEach(obj => scene.remove(obj.mesh));
  interactiveObjects = [];

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1e24, roughness: 0.8 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.9 });

  // Outer bounds
  const size = 30;
  const floorGeo = new THREE.PlaneGeometry(size, size);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  levelMap.push(floor);

  // Ceiling
  const ceilGeo = new THREE.PlaneGeometry(size, size);
  const ceiling = new THREE.Mesh(ceilGeo, wallMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 4;
  scene.add(ceiling);
  levelMap.push(ceiling);

  // Perimeter Walls
  const perimeterGeo = new THREE.BoxGeometry(size, 4, 0.2);
  const backWall = new THREE.Mesh(perimeterGeo, wallMat);
  backWall.position.set(0, 2, -size / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  scene.add(backWall);
  levelMap.push(backWall);

  const frontWall = backWall.clone();
  frontWall.position.z = size / 2;
  scene.add(frontWall);
  levelMap.push(frontWall);

  const sideWallGeo = new THREE.BoxGeometry(0.2, 4, size);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.position.set(-size / 2, 2, 0);
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

    // Balcony / Mezzanine Floor (2nd Floor) at y = 2.5
    const balconyGeo = new THREE.BoxGeometry(16, 0.15, 16);
    const balconyMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.8 });
    const balcony = new THREE.Mesh(balconyGeo, balconyMat);
    balcony.position.set(0, 2.5, -7);
    balcony.receiveShadow = true;
    scene.add(balcony);
    levelMap.push(balcony);

    // Stairs connecting 1st and 2nd floor
    for (let i = 0; i < 11; i++) {
      const stepGeo = new THREE.BoxGeometry(2.5, 0.23, 0.45);
      const step = new THREE.Mesh(stepGeo, balconyMat);
      step.position.set(-5, 0.115 + i * 0.23, -1 + i * 0.45);
      step.receiveShadow = true;
      step.castShadow = true;
      scene.add(step);
      levelMap.push(step);
    }

    // Warm Lightbulbs / PointLights for 1st Floor
    const bulbGeo = new THREE.SphereGeometry(0.12, 8, 8);
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

      const light = new THREE.PointLight(0xffd59a, 2.0, 10);
      light.position.copy(pos);
      light.castShadow = true;
      scene.add(light);
    });

    // Bookshelves (Grid layout)
    const shelfGeo = new THREE.BoxGeometry(5, 2.2, 0.8);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.6 });

    // 1st Floor Bookshelves
    for (let x = -8; x <= 8; x += 8) {
      if (x === 0) continue;
      const shelf = new THREE.Mesh(shelfGeo, shelfMat);
      shelf.position.set(x, 1.1, 5);
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      scene.add(shelf);
      levelMap.push(shelf);

      // Falling books
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0x415a77 }));
      book.position.set(x + (Math.random() - 0.5) * 3, 2.35, 5);
      book.castShadow = true;
      scene.add(book);
      interactiveObjects.push({ type: 'fallable', mesh: book, radius: 0.35, active: true });
    }

    // 2nd Floor (Balcony) Bookshelves - in dark
    for (let x = -6; x <= 6; x += 4) {
      const shelf = new THREE.Mesh(shelfGeo, shelfMat);
      shelf.position.set(x, 3.6, -10);
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      scene.add(shelf);
      levelMap.push(shelf);
    }

    // Table on 1st Floor (brightly lit) where the flashlight is placed
    const tableGeo = new THREE.BoxGeometry(1.5, 0.8, 1.0);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.7 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, 0.4, 4);
    table.castShadow = true;
    table.receiveShadow = true;
    scene.add(table);
    levelMap.push(table);

    // Flashlight Item (on table)
    const flashlightGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8);
    const flashlightMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
    const flashlightMesh = new THREE.Mesh(flashlightGeo, flashlightMat);
    flashlightMesh.position.set(0, 0.85, 4);
    flashlightMesh.rotation.x = Math.PI / 2;
    scene.add(flashlightMesh);
    interactiveObjects.push({
      type: 'item',
      name: 'Фенерче',
      itemId: 'flashlight',
      icon: 'fa-flashlight',
      mesh: flashlightMesh,
      radius: 0.45
    });

    // Exit Door (1st Floor)
    const doorGeo = new THREE.BoxGeometry(1.2, 2.2, 0.15);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5e2c04 });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(0, 1.1, -14.8);
    scene.add(doorMesh);
    interactiveObjects.push({
      type: 'exit_door',
      mesh: doorMesh,
      locked: true,
      radius: 1.5
    });

    // Key Item (on the 2nd Floor mezzanine in dark)
    const keyGeo = new THREE.BoxGeometry(0.05, 0.02, 0.12);
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    const keyMesh = new THREE.Mesh(keyGeo, keyMat);
    keyMesh.position.set(4, 2.65, -10);
    scene.add(keyMesh);
    interactiveObjects.push({
      type: 'item',
      name: 'Ключ за врата',
      itemId: 'door_key',
      icon: 'fa-key',
      mesh: keyMesh,
      radius: 0.5
    });

  } else if (level === 2) {
    // Corridor barricades and lockers
    const lockerGeo = new THREE.BoxGeometry(0.8, 2.2, 0.6);
    const lockerMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7 });
    
    // Generate hideable lockers along left wall
    for (let z = -12; z <= 12; z += 4) {
      const locker = new THREE.Mesh(lockerGeo, lockerMat);
      locker.position.set(-14.4, 1.1, z);
      locker.castShadow = true;
      scene.add(locker);
      interactiveObjects.push({
        type: 'locker',
        mesh: locker,
        radius: 1.0
      });
    }

    // Barricade blocking path
    const deskGeo = new THREE.BoxGeometry(3, 1.2, 1.5);
    const desk = new THREE.Mesh(deskGeo, wallMat);
    desk.position.set(4, 0.6, 2);
    scene.add(desk);
    levelMap.push(desk);

    // Key Item inside drawer
    const keyGeo = new THREE.BoxGeometry(0.05, 0.02, 0.12);
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    const keyMesh = new THREE.Mesh(keyGeo, keyMat);
    keyMesh.position.set(4, 1.25, 2.1);
    scene.add(keyMesh);
    interactiveObjects.push({
      type: 'item',
      name: 'Изходен ключ',
      itemId: 'door_key',
      icon: 'fa-key',
      mesh: keyMesh,
      radius: 0.4
    });

    // Exit Door
    const doorGeo = new THREE.BoxGeometry(1.2, 2.2, 0.15);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5e2c04 });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(14.8, 1.1, 0);
    doorMesh.rotation.y = Math.PI / 2;
    scene.add(doorMesh);
    interactiveObjects.push({
      type: 'exit_door',
      mesh: doorMesh,
      locked: true,
      radius: 1.5
    });
  } else {
    // Cafeteria Tables
    const tableGeo = new THREE.BoxGeometry(3, 0.9, 1.5);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db });
    for (let x = -8; x <= 8; x += 6) {
      for (let z = -6; z <= 6; z += 6) {
        const table = new THREE.Mesh(tableGeo, tableMat);
        table.position.set(x, 0.45, z);
        table.castShadow = true;
        table.receiveShadow = true;
        scene.add(table);
        levelMap.push(table);
      }
    }

    // Fridge Door
    const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.2), new THREE.MeshStandardMaterial({ color: 0xc4b5fd }));
    fridgeDoor.position.set(-14.8, 1.25, 0);
    fridgeDoor.rotation.y = Math.PI / 2;
    scene.add(fridgeDoor);
    interactiveObjects.push({
      type: 'exit_door',
      mesh: fridgeDoor,
      locked: true,
      radius: 1.5
    });

    // Color key
    const keyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: 0x8b5cf6 }));
    keyMesh.position.set(8, 0.1, 8);
    scene.add(keyMesh);
    interactiveObjects.push({
      type: 'item',
      name: 'Хладилен Ключ',
      itemId: 'door_key',
      icon: 'fa-key',
      mesh: keyMesh,
      radius: 0.4
    });
  }
}

function getRandomPatrolNode() {
  const nodes = [
    new THREE.Vector3(10, 0, 10),
    new THREE.Vector3(-10, 0, 10),
    new THREE.Vector3(-10, 0, -10),
    new THREE.Vector3(10, 0, -10),
    new THREE.Vector3(0, 0, 8),
    new THREE.Vector3(0, 0, -8),
    new THREE.Vector3(12, 0, 0),
    new THREE.Vector3(-12, 0, 0)
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
    if (e.key === 'Escape') {
      if (gameActive) {
        togglePause();
      }
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'w') keys.w = true;
    if (key === 'a') keys.a = true;
    if (key === 's') keys.s = true;
    if (key === 'd') keys.d = true;
    if (e.key === 'Shift') keys.shift = true;
    if (e.key === 'Control') {
      keys.ctrl = true;
      player.isCrawling = true;
    }
    if (key === 'f') toggleFlashlight();
    if (key === 'e') performInteraction();
    
    // Slots 1-4
    if (['1','2','3','4'].includes(key)) {
      const slot = parseInt(key);
      player.activeSlot = slot;
      updateHUD();
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w') keys.w = false;
    if (key === 'a') keys.a = false;
    if (key === 's') keys.s = false;
    if (key === 'd') keys.d = false;
    if (e.key === 'Shift') keys.shift = false;
    if (e.key === 'Control') {
      keys.ctrl = false;
      player.isCrawling = false;
    }
  });

  // Mouse move look listener
  window.addEventListener('mousemove', (e) => {
    if (!renderer || document.pointerLockElement !== renderer.domElement) return;

    const sensitivity = 0.0022;
    player.rotation.x -= e.movementX * sensitivity;
    player.rotation.y -= e.movementY * sensitivity;

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
  let nearest = null;
  let minDist = Infinity;
  interactiveObjects.forEach(obj => {
    const dist = player.position.distanceTo(obj.mesh.position);
    if (dist < obj.radius && dist < minDist) {
      minDist = dist;
      nearest = obj;
    }
  });

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

// -------------------------------------------------------------
// Core Engine Tick (Logic and 3D rendering loop)
// -------------------------------------------------------------
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

  renderer.render(scene, camera);
}

function handlePlayerMovement(delta) {
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
  moveDir.normalize();

  const prevPos = player.position.clone();
  player.position.addScaledVector(moveDir, speed);

  // Simple bounding collision checks against levelMap walls
  let collision = false;
  levelMap.forEach(mesh => {
    if (mesh === levelMap[0] || mesh === levelMap[1]) return; // ignore floor and ceil
    const box = new THREE.Box3().setFromObject(mesh);
    const playerBox = new THREE.Box3(
      new THREE.Vector3(player.position.x - 0.25, 0, player.position.z - 0.25),
      new THREE.Vector3(player.position.x + 0.25, 2, player.position.z + 0.25)
    );
    if (box.intersectsBox(playerBox)) {
      collision = true;
    }
  });

  if (collision) {
    player.position.copy(prevPos);
  }

  // Update Camera positions
  camera.position.copy(player.position);
  camera.position.y = player.isCrawling ? 0.7 : player.height;

  // Footstep audio simulation
  if ((keys.w || keys.a || keys.s || keys.d) && Math.floor(clock.getElapsedTime() * (keys.shift ? 4.5 : 2.5)) % 2 === 0) {
    if (Math.random() < 0.05) playSound('step');
  }

  // Update HUD values
  document.getElementById('staminaBar').style.width = player.stamina + '%';

  // Interaction prompt detection
  let canInteract = false;
  interactiveObjects.forEach(obj => {
    if (player.position.distanceTo(obj.mesh.position) < obj.radius) {
      canInteract = true;
    }
  });
  const cross = document.getElementById('crosshair');
  const prompt = document.getElementById('interactionPrompt');
  if (canInteract) {
    cross.classList.add('interactable');
    prompt.classList.add('active');
  } else {
    cross.classList.remove('interactable');
    prompt.classList.remove('active');
  }
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
    koce.position.addScaledVector(dir, currentSpeed);
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
  if (distToPlayer < 0.95 && !player.hiding) {
    triggerGameOver();
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

  // Flashlight icon sync in HUD
  const flashlightIcon = document.getElementById('slotFlashlightIcon');
  if (player.inventory.some(i => i.id === 'flashlight')) {
    if (flashlightIcon) flashlightIcon.style.display = 'block';
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
  clock.getDelta(); // reset clock
  initEngine();
  gameLoop();
  
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

// Victory triggering screen
function triggerVictory() {
  gameActive = false;
  clearInterval(timerInterval);
  document.exitPointerLock();
  
  playSound('win');
  document.getElementById('victoryTime').textContent = gameTime.toFixed(2) + 'с';
  document.getElementById('victoryOverlay').style.display = 'flex';
  document.getElementById('hud').classList.remove('active');

  // Firebase submission and rewards
  rewardXPAndCredits(50, 25, 'Преминаване на ниво');
  submitLeaderboardRecord(Math.floor(gameTime * 1000));
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
  updateMenuPreview();
};

window.nextLevelPart = () => {
  currentPart++;
  if (currentPart > 10) {
    currentPart = 1;
    currentLevel = Math.min(3, currentLevel + 1);
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
  currentLevel = 3;
  currentPart = 10;
  showNotification("Всички нива са достъпни!");
  document.getElementById('level2Prog').textContent = "Част 1/10";
  document.getElementById('level3Prog').textContent = "Част 1/10";
};

// -------------------------------------------------------------
// Pause Menu Implementation
// -------------------------------------------------------------
window.togglePause = () => {
  if (!gameActive) return;
  gamePaused = !gamePaused;
  
  if (gamePaused) {
    document.exitPointerLock();
    clearInterval(timerInterval);
    document.getElementById('pauseOverlay').style.display = 'flex';
  } else {
    document.getElementById('pauseOverlay').style.display = 'none';
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.requestPointerLock();
    
    clock.getDelta(); // Reset clock delta
    gameLoop();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      gameTime += 0.1;
    }, 100);
  }
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
