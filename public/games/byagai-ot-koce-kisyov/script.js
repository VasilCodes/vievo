const firebaseConfig = {
  apiKey: "AIzaSyCa6TTfSKudSpG5N07wOnmyRMrF6BzNb-s",
  authDomain: "vievo-community-zzz.firebaseapp.com",
  projectId: "vievo-community-zzz",
  storageBucket: "vievo-community-zzz.firebasestorage.app",
  messagingSenderId: "52906238804",
  appId: "1:52906238804:web:2c466dc92fb9fc7539dec1"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentUserData = null;
let userCredits = 0;
let ownedCosmetics = [];
let ownedUpgrades = [];
let equippedCosmetics = {};

const PLAYER_REF = 'games/byagai-ot-koce-kisyov/users';
const SHOP_REF = 'games/byagai-ot-koce-kisyov/shop';
const LEADERBOARD_REF = 'games/byagai-ot-koce-kisyov/leaderboard';

const WEEK_START = new Date('2025-09-01').getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getCurrentWeek() {
  return Math.floor((Date.now() - WEEK_START) / WEEK_MS) + 1;
}

/* ───── Notifications ───── */
function showNotification(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

/* ───── Navigation ───── */
function isOverlayVisible(el) {
  return el && el.style && window.getComputedStyle(el).display === 'flex';
}

function hideAllOverlays() {
  document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
}

function startGame() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
  document.getElementById('hud').style.display = 'block';

  stopHUDEngine();
  ENGINE.stop();
  ENGINE.init();
  startHUDEngine();
  LEVELS.load(1);
  ENGINE.startLoop();
}

function backToMenu() {
  stopHUDEngine();
  ENGINE.stop();
  document.exitPointerLock();
  document.getElementById('gameCanvas').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
  hideAllOverlays();
}

function restartGame() {
  hideAllOverlays();
  ENGINE.stop();
  document.exitPointerLock();
  startGame();
}

function closeVictory() {
  hideAllOverlays();
  document.getElementById('mainMenu').style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
}

/* ───── HUD Engine ───── */
let hudInterval = null;
let gameTimer = 0;
let gameTimeSeconds = 0;
let hearts = 3;
let stamina = 100;
let battery = 100;
let noiseLevel = 0;
let hasFlashlight = false;
let selectedSlot = 0;
let gameRunning = false;

function startHUDEngine() {
  gameTimer = 0;
  gameTimeSeconds = 0;
  hearts = 3;
  stamina = 100;
  battery = 100;
  noiseLevel = 0;
  hasFlashlight = false;
  selectedSlot = 0;
  gameRunning = true;

  window.stamina = 100;
  window.noiseLevel = 0;
  window.updateStaminaBar = updateStaminaBar;
  window.setNoiseLevel = setNoiseLevel;
  window.showBattery = showBattery;
  window.takeDamage = takeDamage;
  window.winGame = winGame;
  window.showNotification = showNotification;

  renderHearts();
  updateTimer();
  updateStaminaBar();
  updateBatteryBar();
  updateNoiseMeter();
  selectHotbarSlot(0);
  hidePrompt();

  hudInterval = setInterval(() => {
    if (!gameRunning) return;
    gameTimeSeconds = Math.floor(ENGINE.clock ? ENGINE.clock.getElapsedTime() : gameTimeSeconds + 1);
    updateTimer();

    // Sync stamina from player
    if (ENGINE.player) {
      stamina = ENGINE.player.stamina;
      noiseLevel = window.noiseLevel || 0;
    } else {
      stamina = Math.min(100, stamina + 0.3);
      if (noiseLevel > 0) noiseLevel = Math.max(0, noiseLevel - 0.02);
    }
    updateStaminaBar();
    updateNoiseMeter();
  }, 200);
}

function stopHUDEngine() {
  gameRunning = false;
  if (hudInterval) {
    clearInterval(hudInterval);
    hudInterval = null;
  }
}

function renderHearts() {
  const row = document.getElementById('heartsRow');
  row.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const icon = document.createElement('i');
    icon.className = i < hearts ? 'fas fa-heart' : 'far fa-heart';
    icon.style.transition = 'all 0.2s';
    if (i < hearts) icon.style.color = '#e63946';
    else icon.style.color = '#52525b';
    row.appendChild(icon);
  }
}

function takeDamage(amount = 1) {
  hearts = Math.max(0, hearts - amount);
  renderHearts();
  if (hearts <= 0) {
    gameOver();
  }
}

function heal(amount = 1) {
  hearts = Math.min(3, hearts + amount);
  renderHearts();
}

function updateTimer() {
  const m = String(Math.floor(gameTimeSeconds / 60)).padStart(2, '0');
  const s = String(gameTimeSeconds % 60).padStart(2, '0');
  document.getElementById('timeText').textContent = `${m}:${s}`;
}

function updateStaminaBar() {
  const val = (ENGINE.player && ENGINE.player.stamina != null) ? ENGINE.player.stamina : stamina;
  document.getElementById('staminaFill').style.width = `${val}%`;
}

function useStamina(amount) {
  stamina = Math.max(0, stamina - amount);
  updateStaminaBar();
  return stamina > 0;
}

function updateBatteryBar() {
  document.getElementById('batteryFill').style.width = `${battery}%`;
}

function showBattery(show = true) {
  document.getElementById('batteryGroup').style.display = show ? 'flex' : 'none';
}

function updateNoiseMeter() {
  const el = document.getElementById('noiseMeter').querySelector('i');
  const val = (ENGINE.koce && ENGINE.koce.mode !== 'patrol') ? Math.min(1, window.noiseLevel || 0) : noiseLevel;
  const intensity = Math.min(1, val);
  if (intensity < 0.3) {
    el.style.color = '#4caf50';
    el.style.textShadow = 'none';
  } else if (intensity < 0.6) {
    el.style.color = '#ff9800';
    el.style.textShadow = '0 0 10px rgba(255,152,0,0.4)';
  } else {
    el.style.color = '#ef5350';
    el.style.textShadow = '0 0 16px rgba(239,83,80,0.6)';
  }
}

function setNoiseLevel(level) {
  noiseLevel = Math.min(1, Math.max(0, level));
  window.noiseLevel = noiseLevel;
  updateNoiseMeter();
}

function showPrompt(text) {
  const el = document.getElementById('interactionPrompt');
  if (text) {
    el.innerHTML = text;
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

function hidePrompt() {
  document.getElementById('interactionPrompt').classList.remove('active');
}

function setCrosshairInteractable(interactable) {
  document.getElementById('crosshair').classList.toggle('interactable', interactable);
}

function selectHotbarSlot(index) {
  selectedSlot = index;
  document.querySelectorAll('.slot').forEach((slot, i) => {
    slot.classList.toggle('active', i === index);
  });
}

function hotbarSetItem(index, icon, label) {
  const slot = document.getElementById(`slot-${index + 1}`);
  if (!slot) return;
  slot.innerHTML = icon ? `<i class="fas ${icon}"></i><span class="slot-key">${index + 1}</span>` : `<span class="slot-key">${index + 1}</span>`;
}

document.addEventListener('keydown', (e) => {
  if (!gameRunning) return;
  const num = parseInt(e.key);
  if (num >= 1 && num <= 4) {
    selectHotbarSlot(num - 1);
  }
  if (e.key === ' ' && stamina > 10) {
    useStamina(10);
  }
});

/* ───── Victory / Game Over ───── */
function gameOver() {
  gameRunning = false;
  if (hudInterval) { clearInterval(hudInterval); hudInterval = null; }
  ENGINE.stop();
  document.exitPointerLock();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('gameOverOverlay').style.display = 'flex';
}

function winGame() {
  gameRunning = false;
  ENGINE.stop();
  document.exitPointerLock();
  const statsEl = document.getElementById('victoryStats');
  const score = Math.max(0, Math.floor(1000 - gameTimeSeconds * 5 + hearts * 100 + stamina * 0.5));
  statsEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:1rem 0;text-align:center;">
      <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:10px;">
        <div style="font-size:1.5rem;font-weight:800;color:var(--gold);">${gameTimeSeconds}s</div>
        <div style="font-size:0.75rem;color:var(--muted);">Време</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:10px;">
        <div style="font-size:1.5rem;font-weight:800;color:#e63946;">${'♥'.repeat(hearts)}</div>
        <div style="font-size:0.75rem;color:var(--muted);">Живот</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:10px;grid-column:1/-1;">
        <div style="font-size:1.8rem;font-weight:800;color:#4caf50;">${score}</div>
        <div style="font-size:0.75rem;color:var(--muted);">Резултат</div>
      </div>
    </div>
    <button class="btn btn-gold btn-sm" onclick="submitScore(${score})"><i class="fas fa-trophy"></i> Запази резултата</button>
  `;

  if (hudInterval) { clearInterval(hudInterval); hudInterval = null; }
  document.getElementById('hud').style.display = 'none';
  document.getElementById('victoryOverlay').style.display = 'flex';
}

async function submitScore(score) {
  if (!currentUser) {
    showNotification('Трябва да влезеш в профила си!', 'warn');
    return;
  }
  try {
    const docRef = db.collection(LEADERBOARD_REF).doc(currentUser.uid);
    const existing = await docRef.get();
    if (existing.exists && existing.data().score >= score) {
      showNotification('Имаш по-добър резултат!', 'warn');
      return;
    }
    await docRef.set({
      user_id: currentUser.uid,
      email: currentUser.email,
      score: score,
      time: gameTimeSeconds,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    showNotification('Резултатът е запазен!', 'success');
  } catch (e) {
    showNotification('Грешка при запазване.', 'error');
    console.error(e);
  }
}

/* ───── Shop ───── */
function openShop() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('shopOverlay').style.display = 'flex';
  document.getElementById('shopCreditsAmount').textContent = userCredits;

  const isAdmin = currentUser && (currentUserData?.role === 'owner' || currentUserData?.role === 'admin');
  const footer = document.querySelector('.shop-footer');
  let adminBtn = document.getElementById('shopAdminBtn');
  if (isAdmin) {
    if (!adminBtn) {
      adminBtn = document.createElement('button');
      adminBtn.id = 'shopAdminBtn';
      adminBtn.className = 'btn btn-secondary btn-sm';
      adminBtn.innerHTML = '<i class="fas fa-crown"></i> Админ';
      adminBtn.onclick = openAdmin;
      footer.insertBefore(adminBtn, footer.children[1]);
    }
    adminBtn.style.display = 'inline-flex';
  } else if (adminBtn) {
    adminBtn.style.display = 'none';
  }

  switchShopTab('cosmetics');
}

function closeShop() {
  document.getElementById('shopOverlay').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
}

function switchShopTab(tab) {
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.shop-tab[data-tab="${tab}"]`).classList.add('active');
  const content = document.getElementById('shopContent');
  content.innerHTML = '<p style="color:var(--muted);">Зареждане...</p>';

  if (tab === 'cosmetics') renderCosmetics();
  else if (tab === 'upgrades') renderUpgrades();
  else if (tab === 'services') renderServices();
}

async function renderCosmetics() {
  const content = document.getElementById('shopContent');
  try {
    const week = getCurrentWeek();
    const snap = await db.collection(`${SHOP_REF}/cosmetics/items`).where('weekActive', '==', week).get();

    if (snap.empty) {
      content.innerHTML = '<p class="muted">Тази седмица няма налични козметики. Провери пак следващата седмица!</p>';
      const isAdmin = currentUser && (currentUserData?.role === 'owner' || currentUserData?.role === 'admin');
      if (isAdmin) await renderCosmeticsFallback(content);
      return;
    }

    let items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));

    items.sort((a, b) => {
      const rank = { rare: 0, normal: 1, common: 2 };
      return (rank[a.rarity] || 2) - (rank[b.rarity] || 2);
    });

    renderShopCards(content, items, 'cosmetics');
  } catch (e) {
    content.innerHTML = '<p class="muted">Грешка при зареждане. Опитай пак.</p>';
    console.error(e);
  }
}

async function renderCosmeticsFallback(content) {
  const role = currentUserData?.role;
  if (role !== 'owner' && role !== 'admin') return;

  const snap = await db.collection(`${SHOP_REF}/cosmetics/items`).get();
  if (snap.empty) {
    content.innerHTML += '<p class="muted" style="margin-top:1rem;">Няма никакви козметики в базата. Добави през админ панела!</p>';
    content.innerHTML += `<button class='btn btn-primary btn-sm' onclick='openAdmin()' style='margin-top:8px;'><i class='fas fa-crown'></i> Админ панел</button>`;
    return;
  }
  let items = [];
  snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  content.innerHTML = '<p class="muted" style="margin-bottom:8px;">Няма за тази седмица. Всички налични (само за admin):</p>';
  renderShopCards(content, items, 'cosmetics');
}

async function renderUpgrades() {
  const content = document.getElementById('shopContent');
  const isAdmin = currentUser && (currentUserData?.role === 'owner' || currentUserData?.role === 'admin');
  try {
    const snap = await db.collection(`${SHOP_REF}/upgrades/items`).get();

    if (snap.empty) {
      content.innerHTML = `<p class="muted">Все още няма качества в магазина.</p>`;
      if (isAdmin) {
        content.innerHTML += `<button class='btn btn-primary btn-sm' onclick='openAdmin()' style='margin-top:8px;'><i class='fas fa-crown'></i> Добави през админ</button>`;
      }
      return;
    }

    let items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    renderShopCards(content, items, 'upgrades');
  } catch (e) {
    content.innerHTML = '<p class="muted">Грешка при зареждане.</p>';
    console.error(e);
  }
}

function renderShopCards(container, items, collection) {
  if (!items.length) {
    container.innerHTML = '<p class="muted">Няма налични артикули.</p>';
    return;
  }

  const isAdmin = currentUser && (currentUserData?.role === 'owner' || currentUserData?.role === 'admin');
  const showRarity = collection === 'cosmetics';

  container.innerHTML = `<div class="shop-grid">${items.map(item => {
    const owned = collection === 'cosmetics' ? ownedCosmetics.includes(item.id) : ownedUpgrades.includes(item.id);
    const rarityClass = item.rarity || 'common';
    const rarityLabel = { rare: 'Рядко', normal: 'Нормално', common: 'Обикновено' }[rarityClass] || '';
    return `<div class="shop-card${showRarity ? ` rarity-${rarityClass}` : ''}${owned ? ' owned' : ''}">
      ${showRarity ? `<div class="rarity-badge">${rarityLabel}</div>` : ''}
      <div class="shop-card-icon"><i class="fas ${item.icon || 'fa-box'}"></i></div>
      <div class="shop-card-name">${item.name}</div>
      ${item.description ? `<div class="shop-card-desc">${item.description}</div>` : ''}
      <div class="shop-card-cost"><i class="fas fa-coins"></i> ${item.cost}</div>
      ${!owned ? `<button class="btn btn-primary btn-sm" onclick="buyItem('${collection}','${item.id}',${item.cost})"><i class="fas fa-cart-plus"></i> Купи</button>` : ''}
      ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="deleteShopItem('${collection}','${item.id}')" style="margin-top:4px;font-size:0.7rem;"><i class="fas fa-trash"></i></button>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function renderServices() {
  const content = document.getElementById('shopContent');
  content.innerHTML = `
    <p style="margin-bottom:1rem;color:var(--muted);">Купи кредити, за да подкрепиш играта.</p>
    <div class="service-card">
      <div class="shop-card-icon"><i class="fas fa-coins"></i></div>
      <div class="credits-get">90 кредита</div>
      <div class="price-eur">1,99 <small>евро</small></div>
      <button class="btn btn-gold btn-sm" onclick="buyService(90, 1.99)"><i class="fas fa-shopping-cart"></i> Купи</button>
    </div>
    <div class="service-card">
      <div class="shop-card-icon"><i class="fas fa-coins"></i></div>
      <div class="credits-get">150 кредита</div>
      <div class="price-eur">2,99 <small>евро</small></div>
      <button class="btn btn-gold btn-sm" onclick="buyService(150, 2.99)"><i class="fas fa-shopping-cart"></i> Купи</button>
    </div>
    <div class="service-card">
      <div class="shop-card-icon"><i class="fas fa-coins"></i></div>
      <div class="credits-get">270 кредита</div>
      <div class="price-eur">4,99 <small>евро</small></div>
      <button class="btn btn-gold btn-sm" onclick="buyService(270, 4.99)"><i class="fas fa-shopping-cart"></i> Купи</button>
    </div>
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
      <p style="margin-bottom:8px;color:var(--muted);font-size:0.9rem;">Искаш повече? Виж абонаментите:</p>
      <button class="btn btn-secondary btn-sm" onclick="openSubscriptions()"><i class="fas fa-star"></i> Абонаменти</button>
    </div>
  `;
}

function buyService(credits, price) {
  if (!currentUser) {
    showNotification('Трябва да влезеш в профила си първо!', 'warn');
    openAuth();
    return;
  }
  showNotification(`Пренасочване към плащане — ${credits} кр. за ${price.toFixed(2).replace('.', ',')} евро`, 'warn');
}

function openSubscriptions() {
  showNotification('Ще бъдеш пренасочен към страницата с абонаменти', 'warn');
}

async function buyItem(collection, itemId, cost) {
  if (!currentUser) {
    showNotification('Трябва да влезеш в профила си!', 'warn');
    openAuth();
    return;
  }

  if (userCredits < cost) {
    showNotification('Нямаш достатъчно кредити!', 'error');
    return;
  }

  try {
    const batch = db.batch();
    const userRef = db.collection(PLAYER_REF).doc(currentUser.uid);
    batch.update(userRef, {
      credits: firebase.firestore.FieldValue.increment(-cost),
      [`owned${collection.charAt(0).toUpperCase() + collection.slice(1)}`]: firebase.firestore.FieldValue.arrayUnion(itemId)
    });
    await batch.commit();

    userCredits -= cost;
    if (collection === 'cosmetics') ownedCosmetics.push(itemId);
    else ownedUpgrades.push(itemId);

    document.getElementById('shopCreditsAmount').textContent = userCredits;
    updateMenuCredits();
    showNotification('Успешно закупи!', 'success');
    switchShopTab(collection);
  } catch (e) {
    showNotification('Грешка при покупка. Опитай пак.', 'error');
    console.error(e);
  }
}

async function deleteShopItem(collection, itemId) {
  if (!currentUser || (currentUserData?.role !== 'owner' && currentUserData?.role !== 'admin')) return;
  try {
    await db.collection(`${SHOP_REF}/${collection}/items`).doc(itemId).delete();
    showNotification('Изтрито!', 'success');

    const adminOverlay = document.getElementById('adminOverlay');
    if (isOverlayVisible(adminOverlay)) {
      refreshAdminItems();
    }
    switchShopTab(collection);
  } catch (e) {
    showNotification('Грешка при изтриване.', 'error');
    console.error(e);
  }
}

/* ───── Admin Panel ───── */
function openAdmin() {
  if (!currentUser) {
    showNotification('Трябва да влезеш в профила си!', 'warn');
    openAuth();
    return;
  }
  if (currentUserData?.role !== 'owner' && currentUserData?.role !== 'admin') {
    showNotification('Нямаш разрешение!', 'error');
    return;
  }
  hideAllOverlays();
  document.getElementById('adminOverlay').style.display = 'flex';
  document.getElementById('adminCategory').value = 'cosmetics';
  toggleAdminFields();
  refreshAdminItems();
}

function closeAdmin() {
  document.getElementById('adminOverlay').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
}

function toggleAdminFields() {
  const cat = document.getElementById('adminCategory').value;
  document.getElementById('adminCosmeticFields').style.display = cat === 'cosmetics' ? 'block' : 'none';
  document.getElementById('adminUpgradeFields').style.display = cat === 'upgrades' ? 'block' : 'none';
}

async function addShopItem() {
  if (!currentUser || (currentUserData?.role !== 'owner' && currentUserData?.role !== 'admin')) return;

  const category = document.getElementById('adminCategory').value;
  const name = document.getElementById('adminName').value.trim();
  const icon = document.getElementById('adminIcon').value.trim() || 'fa-box';
  const cost = parseInt(document.getElementById('adminCost').value);
  const description = document.getElementById('adminDescription').value.trim();

  if (!name || !cost) {
    showNotification('Име и цена са задължителни!', 'warn');
    return;
  }

  const data = { name, icon, cost, description, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

  if (category === 'cosmetics') {
    data.rarity = document.getElementById('adminRarity').value;
    data.type = document.getElementById('adminType').value;
    data.color = document.getElementById('adminColor').value.trim() || null;
    data.weekActive = getCurrentWeek();
  } else if (category === 'upgrades') {
    data.effectType = document.getElementById('adminEffectType')?.value || 'speed';
    data.effectValue = parseFloat(document.getElementById('adminEffectValue')?.value) || 1;
    data.duration = parseInt(document.getElementById('adminDuration')?.value) || 0;
  }

  try {
    await db.collection(`${SHOP_REF}/${category}/items`).add(data);
    showNotification('Добавено успешно!', 'success');

    document.getElementById('adminName').value = '';
    document.getElementById('adminIcon').value = '';
    document.getElementById('adminCost').value = '';
    document.getElementById('adminDescription').value = '';
    if (category === 'cosmetics') document.getElementById('adminColor').value = '';

    refreshAdminItems();
    switchShopTab(category);
  } catch (e) {
    showNotification('Грешка при добавяне.', 'error');
    console.error(e);
  }
}

async function refreshAdminItems() {
  if (!document.getElementById('adminItems')) return;
  const container = document.getElementById('adminItems');
  const category = document.getElementById('adminCategory').value;

  try {
    const snap = await db.collection(`${SHOP_REF}/${category}/items`).get();
    if (snap.empty) {
      container.innerHTML = '<p class="muted">Няма артикули в тази категория.</p>';
      return;
    }
    let html = '<p style="font-size:0.85rem;color:var(--muted);margin-bottom:6px;">Налични артикули:</p>';
    snap.forEach(d => {
      const item = d.data();
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(255,255,255,0.04);border-radius:6px;margin-bottom:4px;font-size:0.85rem;">
        <span><i class="fas ${item.icon || 'fa-box'}"></i> ${item.name} — <span style="color:var(--gold);">${item.cost} кр.</span></span>
        <button class="btn btn-secondary btn-sm" onclick="deleteShopItem('${category}','${d.id}')" style="padding:4px 10px;font-size:0.7rem;"><i class="fas fa-trash"></i></button>
      </div>`;
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="muted">Грешка.</p>';
  }
}

/* ───── Auth ───── */
function openAuth() {
  hideAllOverlays();
  document.getElementById('authOverlay').style.display = 'flex';
  document.getElementById('authError').style.display = 'none';
  updateAuthUI();
}

function closeAuth() {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
}

function updateAuthUI() {
  if (currentUser) {
    document.getElementById('authLoggedOut').style.display = 'none';
    document.getElementById('authLoggedIn').style.display = 'block';
    document.getElementById('authUserEmail').textContent = `Влезнал си като: ${currentUser.email}`;
    document.getElementById('menuUser').textContent = `(${currentUser.email})`;
    document.getElementById('menuUser').style.display = 'inline';
    document.getElementById('authBtn').innerHTML = '<i class="fas fa-user"></i> Профил';
  } else {
    document.getElementById('authLoggedOut').style.display = 'block';
    document.getElementById('authLoggedIn').style.display = 'none';
    document.getElementById('menuUser').style.display = 'none';
    document.getElementById('authBtn').innerHTML = '<i class="fas fa-sign-in-alt"></i> Вход';
  }
}

async function login() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');

  if (!email || !password) {
    errorEl.textContent = 'Попълни имейл и парола.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await handleUserLogin(cred.user);
    showNotification('Успешен вход!', 'success');
    closeAuth();
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.style.display = 'block';
  }
}

async function register() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');

  if (!email || !password) {
    errorEl.textContent = 'Попълни имейл и парола.';
    errorEl.style.display = 'block';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Паролата трябва да е поне 6 символа.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection(PLAYER_REF).doc(cred.user.uid).set({
      email: cred.user.email,
      role: 'player',
      credits: 100,
      ownedCosmetics: [],
      ownedUpgrades: [],
      equippedCosmetics: {},
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await handleUserLogin(cred.user);
    showNotification('Регистрацията успешна! Получи 100 кредита за добре дошли!', 'success');
    closeAuth();
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.style.display = 'block';
  }
}

async function logout() {
  try {
    await auth.signOut();
    currentUser = null;
    currentUserData = null;
    userCredits = 0;
    ownedCosmetics = [];
    ownedUpgrades = [];
    updateAuthUI();
    updateMenuCredits();
    showNotification('Излезна от профила.', 'warn');
    closeAuth();
  } catch (e) {
    console.error(e);
  }
}

async function handleUserLogin(user) {
  currentUser = user;
  try {
    const userRef = db.collection(PLAYER_REF).doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      await userRef.set({
        email: user.email,
        role: 'player',
        credits: 100,
        ownedCosmetics: [],
        ownedUpgrades: [],
        equippedCosmetics: {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      currentUserData = { role: 'player', credits: 100, ownedCosmetics: [], ownedUpgrades: [], equippedCosmetics: {} };
    } else {
      currentUserData = doc.data();
    }

    userCredits = currentUserData.credits || 0;
    ownedCosmetics = currentUserData.ownedCosmetics || [];
    ownedUpgrades = currentUserData.ownedUpgrades || [];

    updateAuthUI();
    updateMenuCredits();
  } catch (e) {
    console.error('handleUserLogin error:', e);
  }
}

function updateMenuCredits() {
  const el = document.getElementById('menuCredits');
  if (el) el.innerHTML = `<i class="fas fa-coins"></i> ${userCredits}`;
}

auth.onAuthStateChanged(async (user) => {
  if (user) {
    await handleUserLogin(user);
  } else {
    currentUser = null;
    currentUserData = null;
    userCredits = 0;
    ownedCosmetics = [];
    ownedUpgrades = [];
    updateAuthUI();
    updateMenuCredits();
  }
});

/* ───── Leaderboard ───── */
function openLeaderboard() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('leaderboardOverlay').style.display = 'flex';
  renderLeaderboard();
}

function closeLeaderboard() {
  document.getElementById('leaderboardOverlay').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
}

async function renderLeaderboard() {
  const container = document.getElementById('leaderboardContent');
  container.innerHTML = '<p style="color:var(--muted);">Зареждане...</p>';

  try {
    const snap = await db.collection(LEADERBOARD_REF)
      .orderBy('score', 'desc')
      .limit(10)
      .get();

    if (snap.empty) {
      container.innerHTML = '<p class="muted">Все още няма резултати. Избягай пръв!</p>';
      return;
    }

    let rank = 1;
    let html = '<div style="display:flex;flex-direction:column;gap:6px;">';
    snap.forEach(d => {
      const data = d.data();
      const isMe = currentUser && d.id === currentUser.uid;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      html += `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${isMe ? 'rgba(239,83,80,0.1)' : 'rgba(255,255,255,0.03)'};border-radius:10px;border:1px solid ${isMe ? 'rgba(239,83,80,0.2)' : 'var(--border)'};">
          <span style="font-size:1.2rem;font-weight:700;width:32px;text-align:center;color:var(--muted);">${medal}</span>
          <div style="flex:1;text-align:left;">
            <div style="font-weight:600;font-size:0.9rem;">${data.email || 'Анонимен'}</div>
            <div style="font-size:0.75rem;color:var(--muted);">${data.time || 0} сек.</div>
          </div>
          <span style="font-size:1.1rem;font-weight:800;color:var(--gold);">${data.score || 0}</span>
        </div>`;
      rank++;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="muted">Грешка при зареждане.</p>';
    console.error(e);
  }
}

/* ───── About ───── */
function openAbout() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('aboutOverlay').style.display = 'flex';
  const container = document.getElementById('aboutContent');
  container.innerHTML = `
    <div style="text-align:left;line-height:1.7;max-height:40vh;overflow-y:auto;padding-right:4px;">
      <p style="color:#a1a1aa;margin-bottom:1.2rem;">
        <strong style="color:var(--text);">„Избягай от Коце Кисьов"</strong> е 3D хорър-комедия от първо лице.
      </p>
      <p style="color:#a1a1aa;margin-bottom:1.2rem;">
        Ти си ученик, който остава след часовете в училище. Но злият помощник Коце Кисьов те е забелязал.
        Той е навсякъде. Той <em>никога не спи</em>.
      </p>
      <p style="color:#a1a1aa;margin-bottom:1.2rem;">
        Трябва да избягаш от сградата, докато той те преследва.
        Внимавай — колкото повече шум вдигаш, толкова по-бързо ще те намери.
      </p>
      <p style="color:#52525b;font-size:0.8rem;">
        Версия 1.0 • ©Vievo Gang
      </p>
    </div>
  `;
}

function closeAbout() {
  document.getElementById('aboutOverlay').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
}

/* ───── Escape key ───── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlays = document.querySelectorAll('.overlay');
    for (const o of overlays) {
      if (isOverlayVisible(o)) {
        if (o.id === 'shopOverlay') closeShop();
        else if (o.id === 'leaderboardOverlay') closeLeaderboard();
        else if (o.id === 'aboutOverlay') closeAbout();
        else if (o.id === 'victoryOverlay') closeVictory();
        else if (o.id === 'gameOverOverlay') restartGame();
        else if (o.id === 'authOverlay') closeAuth();
        else if (o.id === 'adminOverlay') closeAdmin();
        else o.style.display = 'none';
        break;
      }
    }
  }
});

/* ───── Init ───── */
document.addEventListener('DOMContentLoaded', () => {
  const adminCat = document.getElementById('adminCategory');
  if (adminCat) {
    adminCat.addEventListener('change', () => {
      toggleAdminFields();
      refreshAdminItems();
    });
  }
});
