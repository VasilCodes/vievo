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
let editingUserId = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = '/login/'; return; }
  currentUser = user;
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) { window.location.href = '/home/'; return; }
    currentUserData = doc.data();
    if (currentUserData.role !== 'admin' && currentUserData.role !== 'owner') { window.location.href = '/home/'; return; }
    initAdmin();
  } catch (err) { console.error(err); window.location.href = '/home/'; }
});

function initAdmin() {
  loadStats(); loadUsers(); loadNews(); loadPendingApprovals();
  loadAds(); loadSubscriptions(); loadEvents(); loadGameShop();
  setupAdminListeners(); setupTabNavigation();
}

function setupTabNavigation() {
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      const tabEl = document.getElementById('admin-' + item.dataset.tab);
      if (tabEl) tabEl.classList.add('active');
    });
  });
}

async function loadStats() {
  try {
    const usersSnap = await db.collection('users').get();
    const pendingSnap = await db.collection('users').where('approved', '==', false).get();
    const newsSnap = await db.collection('news').get();
    const subsSnap = await db.collection('users').where('subscription', 'in', ['plus', 'pro', 'ultra']).get();
    document.getElementById('statUsers').textContent = usersSnap.size;
    document.getElementById('statPending').textContent = pendingSnap.size;
    document.getElementById('statNews').textContent = newsSnap.size;
    document.getElementById('statSubs').textContent = subsSnap.size;
  } catch (err) { console.error(err); }
}

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const u = doc.data();
      if (u.role === 'owner' && currentUserData.role !== 'owner') return;
      const tr = document.createElement('tr');
      const roleColors = { owner: '#ffd700', admin: '#ef5350', user: '#4caf50' };
      tr.innerHTML = `
        <td style="color:${u.nameColor || '#4caf50'};font-weight:600">${u.username}</td>
        <td>${u.email}</td>
        <td><span class="badge" style="background:${roleColors[u.role] || '#4caf50'}">${u.role}</span></td>
        <td>${u.subscription || 'free'}</td>
        <td>${u.credits || 0}</td>
        <td>${u.banned ? '<i class="fas fa-ban" style="color:#ef5350"></i>' : (u.approved ? '<i class="fas fa-check-circle" style="color:#4caf50"></i>' : '<i class="fas fa-hourglass-half" style="color:#ff9800"></i>')}</td>
        <td>
          <button class="btn btn-small btn-ghost" onclick="openEditUser('${doc.id}')"><i class="fas fa-edit"></i> Редактирай</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
}

window.openEditUser = async (uid) => {
  editingUserId = uid;
  try {
    const doc = await db.collection('users').doc(uid).get();
    const u = doc.data();
    document.getElementById('editUsername').value = u.username || '';
    document.getElementById('editRole').value = u.role || 'user';
    document.getElementById('editSubscription').value = u.subscription || 'free';
    document.getElementById('editCredits').value = u.credits || 0;
    document.getElementById('editNameColor').value = u.nameColor || '#4caf50';
    document.getElementById('editApproved').checked = !!u.approved;
    document.getElementById('editBanned').checked = !!u.banned;
    document.getElementById('editUserStatus').textContent = '';
    document.querySelectorAll('.color-swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.color === (u.nameColor || '#4caf50'));
    });
    document.getElementById('editUserModal').classList.add('show');
  } catch (err) { console.error(err); }
};

window.closeEditModal = () => {
  document.getElementById('editUserModal').classList.remove('show');
  editingUserId = null;
};

window.saveEditUser = async () => {
  if (!editingUserId) return;
  const status = document.getElementById('editUserStatus');
  try {
    await db.collection('users').doc(editingUserId).update({
      username: document.getElementById('editUsername').value.trim(),
      role: document.getElementById('editRole').value,
      subscription: document.getElementById('editSubscription').value,
      credits: parseInt(document.getElementById('editCredits').value) || 0,
      nameColor: document.getElementById('editNameColor').value,
      approved: document.getElementById('editApproved').checked,
      banned: document.getElementById('editBanned').checked
    });
    status.textContent = 'Потребителят е обновен!';
    status.style.color = 'var(--accent)';
    closeEditModal();
    loadUsers();
  } catch (err) {
    status.textContent = 'Грешка: ' + err.message;
    status.style.color = 'var(--danger)';
  }
};

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('color-swatch')) {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    e.target.classList.add('selected');
    document.getElementById('editNameColor').value = e.target.dataset.color;
  }
});

async function loadNews() {
  const container = document.getElementById('newsList');
  try {
    const snap = await db.collection('news').orderBy('createdAt', 'desc').limit(20).get();
    container.innerHTML = '';
    snap.forEach(doc => {
      const n = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      const time = n.createdAt ? new Date(n.createdAt.toMillis()).toLocaleString('bg-BG') : '';
      div.innerHTML = `
        <div class="item-info">
          <strong>${n.title}</strong>
          <div style="font-size:0.82rem;color:var(--text-muted)">${n.author} • ${time}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.25rem;max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.content}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-ghost" onclick="editNews('${doc.id}')">Редактирай</button>
          <button class="btn btn-small btn-danger" onclick="deleteNews('${doc.id}')">Изтрий</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) { console.error(err); }
}

window.deleteNews = async (id) => {
  if (!confirm('Сигурен ли си?')) return;
  try { await db.collection('news').doc(id).delete(); loadNews(); }
  catch (err) { console.error(err); }
};

async function loadPendingApprovals() {
  const container = document.getElementById('pendingUsers');
  try {
    const snap = await db.collection('users').where('approved', '==', false).get();
    if (snap.empty) { container.innerHTML = '<p style="color:var(--text-muted)">Няма чакащи одобрение.</p>'; return; }
    container.innerHTML = '';
    snap.forEach(doc => {
      const u = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      div.innerHTML = `
        <div class="item-info">
          <strong>${u.username}</strong>
          <div style="font-size:0.82rem;color:var(--text-muted)">${u.email}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-primary" onclick="approveUser('${doc.id}')">Одобри</button>
          <button class="btn btn-sm btn-danger" onclick="rejectUser('${doc.id}')">Откажи</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) { console.error(err); }
}

window.approveUser = async (uid) => {
  try { await db.collection('users').doc(uid).update({ approved: true }); loadPendingApprovals(); loadUsers(); loadStats(); }
  catch (err) { console.error(err); }
};

window.rejectUser = async (uid) => {
  if (!confirm('Сигурен ли си, че искаш да откажеш този потребител?')) return;
  try {
    await db.collection('users').doc(uid).delete();
    loadPendingApprovals(); loadStats();
  } catch (err) { console.error(err); }
};

async function loadAds() {
  const container = document.getElementById('adsList');
  try {
    const snap = await db.collection('ads').orderBy('createdAt', 'desc').get();
    container.innerHTML = '';
    snap.forEach(doc => {
      const ad = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      div.innerHTML = `
        <div class="item-info">
          <strong>${ad.title || 'Без име'}</strong>
          <div style="font-size:0.82rem;color:var(--text-muted)">${ad.type || 'internal'} • ${ad.active ? 'Активна' : 'Неактивна'}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-ghost" onclick="toggleAd('${doc.id}', ${!!ad.active})">${ad.active ? 'Деактивирай' : 'Активирай'}</button>
          <button class="btn btn-small btn-danger" onclick="deleteAd('${doc.id}')">Изтрий</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) { console.error(err); }
}

window.toggleAd = async (id, active) => {
  try { await db.collection('ads').doc(id).update({ active: !active }); loadAds(); }
  catch (err) { console.error(err); }
};

window.deleteAd = async (id) => {
  if (!confirm('Сигурен ли си?')) return;
  try { await db.collection('ads').doc(id).delete(); loadAds(); }
  catch (err) { console.error(err); }
};

async function loadSubscriptions() {
  const container = document.getElementById('subscriptionsList');
  try {
    const snap = await db.collection('users').where('subscription', 'in', ['plus', 'pro', 'ultra']).get();
    if (snap.empty) { container.innerHTML = '<p style="color:var(--text-muted)">Няма активни абонаменти.</p>'; return; }
    container.innerHTML = '';
    snap.forEach(doc => {
      const u = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      const subColors = { plus: '#42a5f5', pro: '#4caf50', ultra: '#ffd700' };
      div.innerHTML = `
        <div class="item-info">
          <strong style="color:${u.nameColor || '#4caf50'}">${u.username}</strong>
          <span class="badge" style="background:${subColors[u.subscription]}">${u.subscription.toUpperCase()}</span>
          <div style="font-size:0.82rem;color:var(--text-muted)">${u.email}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-ghost" onclick="changeSub('${doc.id}', '${u.subscription}')">Промени</button>
          <button class="btn btn-small btn-danger" onclick="removeSub('${doc.id}')">Премахни</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) { console.error(err); }
}

window.changeSub = async (uid, currentSub) => {
  const tiers = ['free', 'plus', 'pro', 'ultra'];
  const idx = tiers.indexOf(currentSub);
  const nextSub = tiers[Math.min(idx + 1, tiers.length - 1)];
  try { await db.collection('users').doc(uid).update({ subscription: nextSub }); loadSubscriptions(); }
  catch (err) { console.error(err); }
};

window.removeSub = async (uid) => {
  if (!confirm('Премахване на абонамента?')) return;
  try { await db.collection('users').doc(uid).update({ subscription: 'free' }); loadSubscriptions(); }
  catch (err) { console.error(err); }
};

async function loadEvents() {
  const container = document.getElementById('eventsList');
  try {
    const snap = await db.collection('events').orderBy('date', 'asc').get();
    container.innerHTML = '';
    if (snap.empty) { container.innerHTML = '<p style="color:var(--text-muted)">Няма събития.</p>'; return; }
    snap.forEach(doc => {
      const e = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      const dateStr = e.date ? new Date(e.date.toMillis()).toLocaleDateString('bg-BG') : '';
      div.innerHTML = `
        <div class="item-info">
          <strong>${e.title}</strong>
          <div style="font-size:0.82rem;color:var(--text-muted)"><i class="fas fa-calendar-alt"></i> ${dateStr}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.25rem;max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.description || ''}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-ghost" onclick="editEvent('${doc.id}')">Редактирай</button>
          <button class="btn btn-small btn-danger" onclick="deleteEvent('${doc.id}')">Изтрий</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) { console.error(err); }
}

window.deleteEvent = async (id) => {
  if (!confirm('Сигурен ли си?')) return;
  try { await db.collection('events').doc(id).delete(); loadEvents(); }
  catch (err) { console.error(err); }
};

let editingNewsId = null;
let editingEventId = null;

window.closeModal = (id) => {
  document.getElementById(id).classList.remove('show');
};

window.editNews = async (id) => {
  try {
    const doc = await db.collection('news').doc(id).get();
    if (!doc.exists) return;
    const n = doc.data();
    editingNewsId = id;
    document.getElementById('editNewsTitle').value = n.title;
    document.getElementById('editNewsContent').value = n.content;
    document.getElementById('editNewsStatus').textContent = '';
    document.getElementById('editNewsModal').classList.add('show');
  } catch (err) { console.error(err); }
};

window.saveEditNews = async () => {
  const title = document.getElementById('editNewsTitle').value.trim();
  const content = document.getElementById('editNewsContent').value.trim();
  const status = document.getElementById('editNewsStatus');
  if (!title || !content) { status.textContent = 'Попълни всички полета.'; status.style.color = 'var(--danger)'; return; }
  try {
    await db.collection('news').doc(editingNewsId).update({ title, content });
    status.textContent = 'Запазено!';
    status.style.color = 'var(--accent)';
    document.getElementById('editNewsModal').classList.remove('show');
    loadNews();
  } catch (err) { status.textContent = 'Грешка: ' + err.message; status.style.color = 'var(--danger)'; }
};

window.editEvent = async (id) => {
  try {
    const doc = await db.collection('events').doc(id).get();
    if (!doc.exists) return;
    const e = doc.data();
    editingEventId = id;
    document.getElementById('editEventTitle').value = e.title;
    document.getElementById('editEventDate').value = e.date ? new Date(e.date.toMillis()).toISOString().split('T')[0] : '';
    document.getElementById('editEventDescription').value = e.description || '';
    document.getElementById('editEventStatus').textContent = '';
    document.getElementById('editEventModal').classList.add('show');
  } catch (err) { console.error(err); }
};

window.saveEditEvent = async () => {
  const title = document.getElementById('editEventTitle').value.trim();
  const date = document.getElementById('editEventDate').value;
  const description = document.getElementById('editEventDescription').value.trim();
  const status = document.getElementById('editEventStatus');
  if (!title || !date) { status.textContent = 'Попълни заглавие и дата.'; status.style.color = 'var(--danger)'; return; }
  try {
    await db.collection('events').doc(editingEventId).update({ title, date: new Date(date), description });
    status.textContent = 'Запазено!';
    status.style.color = 'var(--accent)';
    document.getElementById('editEventModal').classList.remove('show');
    loadEvents();
  } catch (err) { status.textContent = 'Грешка: ' + err.message; status.style.color = 'var(--danger)'; }
};

function setupAdminListeners() {
  document.getElementById('adminLogout').addEventListener('click', async () => {
    await auth.signOut(); window.location.href = '/login/';
  });

  document.getElementById('publishNewsBtn').addEventListener('click', async () => {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    const status = document.getElementById('newsStatus');
    if (!title || !content) { status.textContent = 'Попълни всички полета.'; status.style.color = 'var(--danger)'; return; }
    try {
      await db.collection('news').add({
        title, content,
        author: currentUserData.username,
        authorColor: currentUserData.nameColor || '#4caf50',
        authorId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      status.textContent = 'Новината е публикувана!';
      status.style.color = 'var(--accent)';
      document.getElementById('newsTitle').value = '';
      document.getElementById('newsContent').value = '';
      loadNews(); loadStats();
    } catch (err) { status.textContent = 'Грешка: ' + err.message; status.style.color = 'var(--danger)'; }
  });

  document.getElementById('addAdBtn').addEventListener('click', async () => {
    const title = document.getElementById('adTitle').value.trim();
    const imageUrl = document.getElementById('adImageUrl').value.trim();
    const linkUrl = document.getElementById('adLinkUrl').value.trim();
    const type = document.getElementById('adType').value;
    const status = document.getElementById('adStatus');
    if (!title || (!imageUrl && type !== 'adsense')) { status.textContent = 'Попълни задължителните полета.'; status.style.color = 'var(--danger)'; return; }
    try {
      await db.collection('ads').add({
        title, imageUrl: type === 'internal' ? imageUrl : '', linkUrl, type,
        code: type === 'adsense' ? imageUrl : '', active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      status.textContent = 'Рекламата е добавена!';
      status.style.color = 'var(--accent)';
      document.getElementById('adTitle').value = '';
      document.getElementById('adImageUrl').value = '';
      document.getElementById('adLinkUrl').value = '';
      loadAds();
    } catch (err) { status.textContent = 'Грешка: ' + err.message; status.style.color = 'var(--danger)'; }
  });

  document.getElementById('addShopItemBtn').addEventListener('click', addShopItem);

  document.getElementById('gameSelector').addEventListener('change', () => {
    loadGameShop();
  });

  document.getElementById('addEventBtn').addEventListener('click', async () => {
    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const description = document.getElementById('eventDescription').value.trim();
    const status = document.getElementById('eventStatus');
    if (!title || !date) { status.textContent = 'Попълни заглавие и дата.'; status.style.color = 'var(--danger)'; return; }
    try {
      await db.collection('events').add({
        title, date: new Date(date), description,
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      status.textContent = 'Събитието е добавено!';
      status.style.color = 'var(--accent)';
      document.getElementById('eventTitle').value = '';
      document.getElementById('eventDate').value = '';
      document.getElementById('eventDescription').value = '';
      loadEvents();
    } catch (err) { status.textContent = 'Грешка: ' + err.message; status.style.color = 'var(--danger)'; }
  });
}

/* ===== Games — Shop Management ===== */

function getGameId() {
  return document.getElementById('gameSelector').value;
}

function getShopRef() {
  return db.collection('games').doc(getGameId()).collection('shop');
}

async function loadGameShop() {
  loadShopItems();
  loadShopPurchases();
}

async function loadShopItems() {
  const container = document.getElementById('shopItemsList');
  try {
    const snap = await getShopRef().orderBy('createdAt', 'desc').get();
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--text-muted)">Все още няма предмети.</p>';
      return;
    }
    snap.forEach(doc => {
      if (doc.id === 'purchases') return;
      const item = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      const rarityColors = { common: '#8b949e', uncommon: '#58a6ff', rare: '#d29922', epic: '#bc8cff', legendary: '#ff6b6b' };
      div.innerHTML = `
        <div class="item-info">
          <strong>${item.name || 'Без име'}</strong>
          <span class="badge" style="background:${rarityColors[item.rarity] || '#8b949e'};margin-left:0.5rem;font-size:0.7rem">${item.rarity || 'common'}</span>
          <span class="badge" style="background:var(--warning);margin-left:0.3rem;font-size:0.7rem">${item.price || '0'}</span>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.25rem">
            ${item.description || ''}
            ${item.robuxAsset ? ' • Roblox Asset: ' + item.robuxAsset : ''}
            ${item.assetId ? ' • AssetID: ' + item.assetId : ''}
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.15rem">
            Слот: ${item.rotationSlot || '-'}
            ${item.inRotation ? '<span style="color:var(--accent)"> • В ротация</span>' : ''}
          </div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-ghost" onclick="openEditShopItem('${doc.id}')">Редактирай</button>
          <button class="btn btn-small btn-danger" onclick="deleteShopItem('${doc.id}')">Изтрий</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = '<p style="color:var(--danger)">Грешка при зареждане: ' + err.message + '</p>';
    console.error(err);
  }
}

async function loadShopPurchases() {
  const container = document.getElementById('shopPurchasesList');
  try {
    const snap = await db.collection('games').doc(getGameId()).collection('purchases').orderBy('purchasedAt', 'desc').limit(50).get();
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--text-muted)">Все още няма покупки.</p>';
      return;
    }
    snap.forEach(doc => {
      const p = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      const time = p.purchasedAt ? new Date(p.purchasedAt.toMillis()).toLocaleString('bg-BG') : '';
      div.innerHTML = `
        <div class="item-info">
          <strong>${p.itemName || 'Неизвестен'}</strong>
          <div style="font-size:0.82rem;color:var(--text-muted)">
            Потребител: ${p.userId}
            ${p.currency ? ' • ' + p.price + ' ' + p.currency : ''}
            ${time ? ' • ' + time : ''}
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted)">
            Статус: ${p.status || 'pending'}
            ${p.itemId ? ' • ItemID: ' + p.itemId : ''}
          </div>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = '<p style="color:var(--text-muted)">Грешка при зареждане на покупките.</p>';
    console.error(err);
  }
}

async function addShopItem() {
  const status = document.getElementById('shopStatus');
  const name = document.getElementById('shopName').value.trim();
  const description = document.getElementById('shopDescription').value.trim();
  const price = document.getElementById('shopPrice').value.trim();
  const robuxAsset = document.getElementById('shopRobuxAsset').value.trim();
  const rarity = document.getElementById('shopRarity').value;
  const image = document.getElementById('shopImage').value.trim();
  const assetId = document.getElementById('shopAssetId').value.trim();
  const rotationSlot = parseInt(document.getElementById('shopRotationSlot').value) || null;
  const inRotation = document.getElementById('shopInRotation').checked;

  if (!name) { status.textContent = 'Името е задължително.'; status.style.color = 'var(--danger)'; return; }
  if (!price) { status.textContent = 'Цената е задължителна.'; status.style.color = 'var(--danger)'; return; }

  try {
    await getShopRef().add({
      name,
      description,
      price,
      robuxAsset,
      rarity,
      image,
      assetId,
      rotationSlot,
      inRotation,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    status.textContent = 'Предметът е добавен!';
    status.style.color = 'var(--accent)';
    document.getElementById('shopName').value = '';
    document.getElementById('shopDescription').value = '';
    document.getElementById('shopPrice').value = '';
    document.getElementById('shopRobuxAsset').value = '';
    document.getElementById('shopImage').value = '';
    document.getElementById('shopAssetId').value = '';
    document.getElementById('shopRotationSlot').value = '';
    document.getElementById('shopInRotation').checked = false;
    loadShopItems();
  } catch (err) {
    status.textContent = 'Грешка: ' + err.message;
    status.style.color = 'var(--danger)';
    console.error(err);
  }
}

window.openEditShopItem = async (id) => {
  try {
    const doc = await getShopRef().doc(id).get();
    if (!doc.exists) return;
    const item = doc.data();
    document.getElementById('editShopItemId').value = id;
    document.getElementById('editShopName').value = item.name || '';
    document.getElementById('editShopDescription').value = item.description || '';
    document.getElementById('editShopPrice').value = item.price || '';
    document.getElementById('editShopRobuxAsset').value = item.robuxAsset || '';
    document.getElementById('editShopRarity').value = item.rarity || 'common';
    document.getElementById('editShopImage').value = item.image || '';
    document.getElementById('editShopAssetId').value = item.assetId || '';
    document.getElementById('editShopRotationSlot').value = item.rotationSlot || '';
    document.getElementById('editShopInRotation').checked = !!item.inRotation;
    document.getElementById('editShopStatus').textContent = '';
    document.getElementById('editShopItemModal').classList.add('show');
  } catch (err) {
    console.error(err);
  }
};

window.saveEditShopItem = async () => {
  const id = document.getElementById('editShopItemId').value;
  const status = document.getElementById('editShopStatus');
  if (!id) return;

  const name = document.getElementById('editShopName').value.trim();
  const description = document.getElementById('editShopDescription').value.trim();
  const price = document.getElementById('editShopPrice').value.trim();
  const robuxAsset = document.getElementById('editShopRobuxAsset').value.trim();
  const rarity = document.getElementById('editShopRarity').value;
  const image = document.getElementById('editShopImage').value.trim();
  const assetId = document.getElementById('editShopAssetId').value.trim();
  const rotationSlot = parseInt(document.getElementById('editShopRotationSlot').value) || null;
  const inRotation = document.getElementById('editShopInRotation').checked;

  if (!name) { status.textContent = 'Името е задължително.'; status.style.color = 'var(--danger)'; return; }
  if (!price) { status.textContent = 'Цената е задължителна.'; status.style.color = 'var(--danger)'; return; }

  try {
    await getShopRef().doc(id).update({
      name,
      description,
      price,
      robuxAsset,
      rarity,
      image,
      assetId,
      rotationSlot,
      inRotation
    });
    status.textContent = 'Запазено!';
    status.style.color = 'var(--accent)';
    document.getElementById('editShopItemModal').classList.remove('show');
    loadShopItems();
  } catch (err) {
    status.textContent = 'Грешка: ' + err.message;
    status.style.color = 'var(--danger)';
    console.error(err);
  }
};

window.deleteShopItem = async (id) => {
  if (!confirm('Сигурен ли си, че искаш да изтриеш този предмет?')) return;
  try {
    await getShopRef().doc(id).delete();
    loadShopItems();
  } catch (err) {
    console.error(err);
  }
};
