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

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = '/login/';
    return;
  }

  currentUser = user;

  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      window.location.href = '/home/';
      return;
    }

    currentUserData = doc.data();
    if (currentUserData.role !== 'admin' && currentUserData.role !== 'owner') {
      window.location.href = '/home/';
      return;
    }

    initAdmin();
  } catch (err) {
    console.error(err);
    window.location.href = '/home/';
  }
});

function initAdmin() {
  loadStats();
  loadUsers();
  loadNews();
  loadPendingApprovals();
  loadAds();
  loadSubscriptions();
  loadEvents();
  setupAdminListeners();
  setupTabNavigation();
}

function setupTabNavigation() {
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(item.dataset.tab).classList.add('active');
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
  } catch (err) {
    console.error(err);
  }
}

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const u = doc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:${u.nameColor || '#4caf50'}">${u.username}</td>
        <td>${u.email}</td>
        <td><span class="badge" style="background:${u.role === 'owner' ? '#ffd700' : u.role === 'admin' ? '#ef5350' : '#4caf50'}">${u.role}</span></td>
        <td>${u.subscription || 'free'}</td>
        <td>${u.credits || 0}</td>
        <td>${u.approved ? '✅' : '⏳'}</td>
        <td>
          <button class="btn btn-small btn-secondary" onclick="toggleUserRole('${doc.id}', '${u.role}')">Смени роля</button>
          <button class="btn btn-small ${u.banned ? 'btn-primary' : 'btn-danger'}" onclick="toggleUserBan('${doc.id}', ${!!u.banned})">${u.banned ? 'Отблокирай' : 'Блокирай'}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

window.toggleUserRole = async (uid, currentRole) => {
  const roles = ['user', 'admin'];
  const nextRole = currentRole === 'user' ? 'admin' : 'user';
  try {
    await db.collection('users').doc(uid).update({ role: nextRole });
    loadUsers();
  } catch (err) {
    console.error(err);
  }
};

window.toggleUserBan = async (uid, isBanned) => {
  try {
    await db.collection('users').doc(uid).update({ banned: !isBanned });
    loadUsers();
  } catch (err) {
    console.error(err);
  }
};

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
          <div style="font-size:0.85rem;color:var(--text-muted)">${n.author} • ${time}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-danger" onclick="deleteNews('${doc.id}')">Изтрий</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

window.deleteNews = async (id) => {
  if (!confirm('Сигурен ли си?')) return;
  try {
    await db.collection('news').doc(id).delete();
    loadNews();
  } catch (err) {
    console.error(err);
  }
};

async function loadPendingApprovals() {
  const container = document.getElementById('pendingUsers');
  try {
    const snap = await db.collection('users').where('approved', '==', false).get();
    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--text-muted)">Няма чакащи одобрение.</p>';
      return;
    }
    container.innerHTML = '';
    snap.forEach(doc => {
      const u = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      div.innerHTML = `
        <div class="item-info">
          <strong>${u.username}</strong>
          <div style="font-size:0.85rem;color:var(--text-muted)">${u.email}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-primary" onclick="approveUser('${doc.id}')">Одобри</button>
          <button class="btn btn-small btn-danger" onclick="rejectUser('${doc.id}')">Откажи</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

window.approveUser = async (uid) => {
  try {
    await db.collection('users').doc(uid).update({ approved: true });
    loadPendingApprovals();
    loadUsers();
    loadStats();
  } catch (err) {
    console.error(err);
  }
};

window.rejectUser = async (uid) => {
  if (!confirm('Сигурен ли си, че искаш да откажеш този потребител?')) return;
  try {
    await db.collection('users').doc(uid).delete();
    const user = await auth.getUser(uid).catch(() => null);
    if (user) await auth.deleteUser(uid).catch(() => {});
    loadPendingApprovals();
    loadStats();
  } catch (err) {
    console.error(err);
  }
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
          <div style="font-size:0.85rem;color:var(--text-muted)">${ad.type || 'internal'} • ${ad.active ? 'Активна' : 'Неактивна'}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-secondary" onclick="toggleAd('${doc.id}', ${!!ad.active})">${ad.active ? 'Деактивирай' : 'Активирай'}</button>
          <button class="btn btn-small btn-danger" onclick="deleteAd('${doc.id}')">Изтрий</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

window.toggleAd = async (id, active) => {
  try {
    await db.collection('ads').doc(id).update({ active: !active });
    loadAds();
  } catch (err) {
    console.error(err);
  }
};

window.deleteAd = async (id) => {
  if (!confirm('Сигурен ли си?')) return;
  try {
    await db.collection('ads').doc(id).delete();
    loadAds();
  } catch (err) {
    console.error(err);
  }
};

async function loadSubscriptions() {
  const container = document.getElementById('subscriptionsList');
  try {
    const snap = await db.collection('users')
      .where('subscription', 'in', ['plus', 'pro', 'ultra'])
      .get();

    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--text-muted)">Няма активни абонаменти.</p>';
      return;
    }
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
          <div style="font-size:0.85rem;color:var(--text-muted)">${u.email}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-secondary" onclick="changeSub('${doc.id}', '${u.subscription}')">Промени</button>
          <button class="btn btn-small btn-danger" onclick="removeSub('${doc.id}')">Премахни</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

window.changeSub = async (uid, currentSub) => {
  const tiers = ['free', 'plus', 'pro', 'ultra'];
  const idx = tiers.indexOf(currentSub);
  const nextSub = tiers[Math.min(idx + 1, tiers.length - 1)];
  try {
    await db.collection('users').doc(uid).update({ subscription: nextSub });
    loadSubscriptions();
  } catch (err) {
    console.error(err);
  }
};

window.removeSub = async (uid) => {
  if (!confirm('Премахване на абонамента?')) return;
  try {
    await db.collection('users').doc(uid).update({ subscription: 'free' });
    loadSubscriptions();
  } catch (err) {
    console.error(err);
  }
};

async function loadEvents() {
  const container = document.getElementById('eventsList');
  try {
    const snap = await db.collection('events').orderBy('date', 'asc').get();
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--text-muted)">Няма събития.</p>';
      return;
    }
    snap.forEach(doc => {
      const e = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      const dateStr = e.date ? new Date(e.date.toMillis()).toLocaleDateString('bg-BG') : '';
      div.innerHTML = `
        <div class="item-info">
          <strong>${e.title}</strong>
          <div style="font-size:0.85rem;color:var(--text-muted)">📅 ${dateStr}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-small btn-danger" onclick="deleteEvent('${doc.id}')">Изтрий</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

window.deleteEvent = async (id) => {
  if (!confirm('Сигурен ли си?')) return;
  try {
    await db.collection('events').doc(id).delete();
    loadEvents();
  } catch (err) {
    console.error(err);
  }
};

function setupAdminListeners() {
  document.getElementById('adminLogout').addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = '/login/';
  });

  document.getElementById('publishNewsBtn').addEventListener('click', async () => {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    const status = document.getElementById('newsStatus');

    if (!title || !content) {
      status.textContent = 'Попълни всички полета.';
      status.style.color = 'var(--danger)';
      return;
    }

    try {
      await db.collection('news').add({
        title,
        content,
        author: currentUserData.username,
        authorColor: currentUserData.nameColor || '#4caf50',
        authorId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      status.textContent = 'Новината е публикувана!';
      status.style.color = 'var(--accent)';
      document.getElementById('newsTitle').value = '';
      document.getElementById('newsContent').value = '';
      loadNews();
      loadStats();
    } catch (err) {
      status.textContent = 'Грешка: ' + err.message;
      status.style.color = 'var(--danger)';
    }
  });

  document.getElementById('addAdBtn').addEventListener('click', async () => {
    const title = document.getElementById('adTitle').value.trim();
    const imageUrl = document.getElementById('adImageUrl').value.trim();
    const linkUrl = document.getElementById('adLinkUrl').value.trim();
    const type = document.getElementById('adType').value;
    const status = document.getElementById('adStatus');

    if (!title || (!imageUrl && type !== 'adsense')) {
      status.textContent = 'Попълни задължителните полета.';
      status.style.color = 'var(--danger)';
      return;
    }

    try {
      await db.collection('ads').add({
        title,
        imageUrl: type === 'internal' ? imageUrl : '',
        linkUrl,
        type,
        code: type === 'adsense' ? imageUrl : '',
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      status.textContent = 'Рекламата е добавена!';
      status.style.color = 'var(--accent)';
      document.getElementById('adTitle').value = '';
      document.getElementById('adImageUrl').value = '';
      document.getElementById('adLinkUrl').value = '';
      loadAds();
    } catch (err) {
      status.textContent = 'Грешка: ' + err.message;
      status.style.color = 'var(--danger)';
    }
  });

  document.getElementById('addEventBtn').addEventListener('click', async () => {
    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const description = document.getElementById('eventDescription').value.trim();
    const status = document.getElementById('eventStatus');

    if (!title || !date) {
      status.textContent = 'Попълни заглавие и дата.';
      status.style.color = 'var(--danger)';
      return;
    }

    try {
      await db.collection('events').add({
        title,
        date: new Date(date),
        description,
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      status.textContent = 'Събитието е добавено!';
      status.style.color = 'var(--accent)';
      document.getElementById('eventTitle').value = '';
      document.getElementById('eventDate').value = '';
      document.getElementById('eventDescription').value = '';
      loadEvents();
    } catch (err) {
      status.textContent = 'Грешка: ' + err.message;
      status.style.color = 'var(--danger)';
    }
  });

  document.getElementById('manageCreditsBtn').addEventListener('click', async () => {
    const select = document.getElementById('creditUserSelect');
    const uid = select.value;
    const amount = parseInt(document.getElementById('creditAmount').value);
    const action = document.getElementById('creditAction').value;
    const status = document.getElementById('creditStatus');

    if (!uid || !amount) {
      status.textContent = 'Избери потребител и въведи количество.';
      status.style.color = 'var(--danger)';
      return;
    }

    try {
      const userRef = db.collection('users').doc(uid);
      const delta = action === 'add' ? amount : -amount;
      await userRef.update({
        credits: firebase.firestore.FieldValue.increment(delta)
      });
      status.textContent = `Кредитите са ${action === 'add' ? 'добавени' : 'премахнати'}!`;
      status.style.color = 'var(--accent)';
      document.getElementById('creditAmount').value = '';
      loadUsers();
    } catch (err) {
      status.textContent = 'Грешка: ' + err.message;
      status.style.color = 'var(--danger)';
    }
  });

  loadCreditUserSelect();
}

async function loadCreditUserSelect() {
  const select = document.getElementById('creditUserSelect');
  try {
    const snap = await db.collection('users').orderBy('username', 'asc').get();
    select.innerHTML = '<option value="">Избери потребител...</option>';
    snap.forEach(doc => {
      const u = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = `${u.username} (${u.email}) - ${u.credits || 0} кредита`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
  }
}
