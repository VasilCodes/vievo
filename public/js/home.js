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
let currentThreadId = null;
let currentThreadData = null;
let currentConversationId = null;
let dmUnsubscribe = null;
let selectedSubTier = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = '/login/';
    return;
  }

  if (!user.emailVerified) {
    await auth.signOut();
    window.location.href = '/login/';
    return;
  }

  currentUser = user;

  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists || !doc.data().approved) {
      await auth.signOut();
      window.location.href = '/login/';
      return;
    }

    currentUserData = doc.data();
    updateUI();
    requestBrowserNotificationPermission();
    registerFcmToken();
    
    // Всекидневна проверка за кредити според абонамента
    await checkDailyCredits();

    loadNews();
    loadForum();
    loadConversations();
    loadEvents();
    loadLeaderboard();
    setupListeners();
    trackPresence();
  } catch (err) {
    console.error(err);
  }
});

// Браузърни нотификации
function sendBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico' });
    setTimeout(() => n.close(), 5000);
  } catch (e) { /* ignore */ }
}

function requestBrowserNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// FCM Push известия
let messaging = null;
try {
  if (firebase.messaging) messaging = firebase.messaging();
} catch (e) { /* not available */ }

const PUSH_WORKER_URL = 'https://push.vievo-community.workers.dev';

async function registerFcmToken() {
  if (!messaging || !currentUser) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    // VAPID key се генерира във Firebase Console > Cloud Messaging > Web Push certificates
    const token = await messaging.getToken();
    await db.collection('users').doc(currentUser.uid).update({ fcmToken: token });
  } catch (err) {
    console.error('FCM token error:', err);
  }
}

async function sendPushNotification(targetUid, title, body) {
  try {
    const doc = await db.collection('users').doc(targetUid).get();
    const token = doc.data()?.fcmToken;
    if (!token) return;
    await fetch(PUSH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, title, body })
    });
  } catch (err) {
    console.error('Push error:', err);
  }
}

function requestBrowserNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Toast Известия
function showNotification(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
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
  }, 3000);
}

// Система за трупане на XP и промяна на Кредити
async function rewardXPAndCredits(xpAmount, creditsAmount, reason) {
  if (!currentUser) return;
  
  const currentXP = currentUserData.xp || 0;
  const newXP = currentXP + xpAmount;
  const newCredits = (currentUserData.credits || 0) + creditsAmount;
  
  // Изчисляване на нива: Level = Math.floor(XP / 100) + 1
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
    // Бонус при вдигане на ниво!
    const levelBonus = newLevel * 50;
    updates.credits += levelBonus;
  }

  try {
    await db.collection('users').doc(currentUser.uid).update(updates);
    currentUserData.xp = updates.xp;
    currentUserData.credits = updates.credits;
    currentUserData.level = updates.level;
    
    updateUI();
    
    if (creditsAmount > 0) {
      showNotification(`Получи +${creditsAmount} <i class="fas fa-coins"></i> и +${xpAmount} XP (${reason})`, 'success');
    } else if (creditsAmount < 0) {
      showNotification(`Използвани ${Math.abs(creditsAmount)} <i class="fas fa-coins"></i>. Получи +${xpAmount} XP (${reason})`, 'info');
    } else if (xpAmount > 0) {
      showNotification(`Получи +${xpAmount} XP (${reason})`, 'success');
    }

    if (leveledUp) {
      showNotification(`<i class="fas fa-crown" style="color:#ffd700"></i> Честито! Достигна ниво ${newLevel} и получи бонус от ${newLevel * 50} <i class="fas fa-coins"></i>!`, 'success');
    }
  } catch (err) {
    console.error('Грешка при актуализиране на XP/Кредити:', err);
  }
}

// Проверка за всекидневни кредити
async function checkDailyCredits() {
  if (!currentUser || !currentUserData) return;
  
  const today = new Date().toDateString();
  const lastCheck = currentUserData.lastDailyCheck;
  
  if (lastCheck === today) return; // Вече е взел бонуса за днес
  
  const sub = currentUserData.subscription || 'free';
  const dailyCreditsMap = { free: 10, plus: 15, pro: 25, ultra: 40 };
  const amount = dailyCreditsMap[sub] || 10;
  
  const newCredits = (currentUserData.credits || 0) + amount;
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      credits: newCredits,
      lastDailyCheck: today
    });
    
    currentUserData.credits = newCredits;
    currentUserData.lastDailyCheck = today;
    updateUI();
    
    showNotification(`<i class="fas fa-coins"></i> Всекидневен бонус: Получи ${amount} кредита`, 'success');
  } catch (err) {
    console.error('Грешка при зареждане на всекидневен бонус:', err);
  }
}

function updateUI() {
  const d = currentUserData;
  document.getElementById('navDisplayName').textContent = d.username;
  document.getElementById('navCredits').innerHTML = `<i class="fas fa-coins"></i> ${d.credits || 0}`;
  document.getElementById('navXP').innerHTML = `<i class="fas fa-bolt"></i> ${d.xp || 0}`;
  document.getElementById('profileName').textContent = d.username;
  document.getElementById('profileCredits').textContent = d.credits || 0;
  document.getElementById('profileLevel').textContent = d.level || 1;

  const nameColor = d.nameColor || '#4caf50';
  document.getElementById('profileName').style.color = nameColor;

  const badgeEl = document.getElementById('navBadge');
  const sub = d.subscription || 'free';
  const badgeMap = { free: '', plus: 'Plus', pro: 'Pro', ultra: 'Ultra' };
  badgeEl.textContent = badgeMap[sub] || '';
  if (sub === 'ultra') badgeEl.style.background = '#ffd700';
  else if (sub === 'pro') badgeEl.style.background = '#4caf50';
  else if (sub === 'plus') badgeEl.style.background = '#42a5f5';
  else badgeEl.style.display = 'none';

  const badgesContainer = document.getElementById('profileBadges');
  badgesContainer.innerHTML = '';
  if (d.badges && d.badges.length > 0) {
    d.badges.forEach(b => {
      const span = document.createElement('span');
      span.className = 'badge';
      span.textContent = b;
      badgesContainer.appendChild(span);
    });
  }

  if (d.role === 'owner' || d.role === 'admin') {
    document.getElementById('adminLink').style.display = 'block';
  }

  const body = document.body;
  if (d.background) body.style.backgroundImage = `url(${d.background})`;
  else body.style.backgroundImage = 'none';

  checkAds();
}

function checkAds() {
  const adBanner = document.getElementById('adBanner');
  if (!adBanner) return;
  if (currentUserData.subscription === 'plus' || currentUserData.subscription === 'pro' || currentUserData.subscription === 'ultra') {
    adBanner.style.display = 'none';
  } else if (currentUserData.adsRemoved) {
    adBanner.style.display = 'none';
  } else {
    loadAds();
  }
}

async function loadAds() {
  const adBanner = document.getElementById('adBanner');
  const placeholder = document.getElementById('adPlaceholder');
  if (!adBanner) return;

  try {
    const snap = await db.collection('ads').where('active', '==', true).limit(1).get();
    if (!snap.empty) {
      const ad = snap.docs[0].data();
      if (ad.type === 'adsense') {
        placeholder.innerHTML = ad.code || 'AdSense код';
      } else if (ad.imageUrl) {
        placeholder.innerHTML = `<a href="${ad.linkUrl || '#'}" target="_blank"><img src="${ad.imageUrl}" alt="${ad.title}"></a>`;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadNews() {
  const feed = document.getElementById('newsFeed');
  try {
    const snap = await db.collection('news').orderBy('createdAt', 'desc').limit(20).get();
    if (snap.empty) {
      feed.innerHTML = '<div class="news-placeholder">Все още няма новини.</div>';
      return;
    }
    feed.innerHTML = '';
    const sorted = [];
    snap.forEach(doc => sorted.push({ id: doc.id, data: doc.data() }));
    sorted.sort((a, b) => (b.data.pinned ? 1 : 0) - (a.data.pinned ? 1 : 0) || (b.data.createdAt?.toMillis() || 0) - (a.data.createdAt?.toMillis() || 0));
    sorted.forEach(({ data: n }) => {
      const card = document.createElement('div');
      card.className = 'news-card' + (n.pinned ? ' news-pinned' : '');
      const time = n.createdAt ? new Date(n.createdAt.toMillis()).toLocaleString('bg-BG') : '';
      card.innerHTML = `
        <h3 style="color:${n.authorColor || 'var(--text-primary)'}">${n.pinned ? '<i class="fas fa-thumbtack"></i> ' : ''}${n.title}</h3>
        <div class="news-meta" style="color:${n.authorColor || 'var(--text-muted)'}">${n.author} • ${time}</div>
        <div class="news-content">${n.content}</div>
      `;
      feed.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadForum() {
  const container = document.getElementById('forumThreads');
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const snap = await db.collection('forum')
      .where('lastActivity', '>=', threeDaysAgo)
      .orderBy('lastActivity', 'desc')
      .limit(50)
      .get();

    if (snap.empty) {
      container.innerHTML = '<div class="forum-placeholder">Все още няма теми във форума.</div>';
      return;
    }
    container.innerHTML = '';
    const threads = [];
    snap.forEach(doc => threads.push({ id: doc.id, data: doc.data() }));
    threads.sort((a, b) => (b.data.pinned ? 1 : 0) - (a.data.pinned ? 1 : 0) || (b.data.lastActivity?.toMillis() || 0) - (a.data.lastActivity?.toMillis() || 0));
    const isAdmin = currentUserData.role === 'admin' || currentUserData.role === 'owner';
    threads.forEach(({ id, data: t }) => {
      const thread = document.createElement('div');
      thread.className = 'forum-thread' + (t.pinned ? ' forum-pinned' : '');
      thread.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h4 style="color:${t.authorColor || 'var(--text-primary)'}">${t.pinned ? '<i class="fas fa-thumbtack"></i> ' : ''}${t.title}</h4>
          ${isAdmin ? `<button class="btn btn-small btn-ghost" onclick="event.stopPropagation();togglePin('${id}', ${!!t.pinned})" style="font-size:0.75rem;padding:0.25rem 0.5rem">${t.pinned ? 'Откачи' : 'Закачи'}</button>` : ''}
        </div>
        <div class="thread-meta" style="color:${t.authorColor || 'var(--text-muted)'}">от ${t.author} • ${t.replies || 0} отговора</div>
      `;
      thread.onclick = () => openThread(id, t);
      container.appendChild(thread);
    });
  } catch (err) {
    console.error(err);
  }
}

window.togglePin = async (id, current) => {
  try {
    await db.collection('forum').doc(id).update({ pinned: !current });
    loadForum();
  } catch (err) {
    console.error(err);
  }
};

window.openThread = async (id, data) => {
  currentThreadId = id;
  currentThreadData = data;
  document.getElementById('forumThreadTitle').textContent = data.title;
  document.getElementById('forumThreadTitle').style.color = data.authorColor || 'var(--text-primary)';
  document.getElementById('forumThreadMeta').textContent = 'от ' + data.author + ' • ' + (data.replies || 0) + ' отговора';
  document.getElementById('forumThreadContent').textContent = data.content;
  document.getElementById('forumModal').classList.add('show');

  const repliesContainer = document.getElementById('forumReplies');
  repliesContainer.innerHTML = 'Зареждане...';
  try {
    const snap = await db.collection('forum').doc(id).collection('replies').orderBy('createdAt', 'asc').get();
    repliesContainer.innerHTML = '';
    if (snap.empty) {
      repliesContainer.innerHTML = '<div style="color:var(--text-muted);font-size:0.88rem">Все още няма отговори.</div>';
    } else {
      snap.forEach(doc => {
        const r = doc.data();
        const div = document.createElement('div');
        div.className = 'forum-reply';
        const time = r.createdAt ? new Date(r.createdAt.toMillis()).toLocaleString('bg-BG') : '';
        div.innerHTML = '<div class="reply-author" style="color:' + (r.authorColor || '#4caf50') + ';font-weight:600;font-size:0.85rem">' + r.author + ' <span style="color:var(--text-muted);font-weight:400;font-size:0.78rem">' + time + '</span></div><div style="margin-top:0.3rem;font-size:0.9rem;color:var(--text-secondary)">' + r.text + '</div>';
        repliesContainer.appendChild(div);
      });
    }
  } catch (err) {
    repliesContainer.innerHTML = '<div style="color:var(--danger)">Грешка при зареждане на отговорите.</div>';
    console.error(err);
  }
};

window.closeForumModal = () => {
  document.getElementById('forumModal').classList.remove('show');
  currentThreadId = null;
  currentThreadData = null;
};

let conversationsUnsubscribe = null;

async function loadConversations() {
  const container = document.getElementById('conversationsList');

  if (conversationsUnsubscribe) conversationsUnsubscribe();

  conversationsUnsubscribe = db.collection('conversations')
    .where('participants', 'array-contains', currentUser.uid)
    .onSnapshot((snap) => {
      container.innerHTML = '';
      if (snap.empty) {
        container.innerHTML = '<div class="dm-placeholder">Няма разговори</div>';
        return;
      }

      const convs = [];
      snap.forEach(doc => convs.push({ id: doc.id, data: doc.data() }));
      convs.sort((a, b) => {
        const aTime = a.data.lastActivity ? a.data.lastActivity.toMillis() : 0;
        const bTime = b.data.lastActivity ? b.data.lastActivity.toMillis() : 0;
        return bTime - aTime;
      });

      convs.forEach(({ id, data: conv }) => {
        const otherUid = conv.participants.find(id => id !== currentUser.uid);
        const partnerName = (conv.partnerNameFor && conv.partnerNameFor[currentUser.uid]) || conv.partnerName || 'Потребител';
        const div = document.createElement('div');
        div.className = 'dm-conv-item' + (id === currentConversationId ? ' active' : '');
        div.innerHTML = '<div class="dm-conv-name">' + partnerName + '</div><div class="dm-conv-preview">' + (conv.lastMessage || '') + '</div>';
        div.onclick = () => openConversation(id, otherUid, partnerName);
        container.appendChild(div);
      });
    }, (err) => {
      console.error(err);
    });
}

async function openConversation(convId, otherUid, partnerName) {
  currentConversationId = convId;
  document.getElementById('dmPartnerName').textContent = partnerName;
  document.getElementById('dmInputArea').style.display = 'flex';

  document.querySelectorAll('.dm-conv-item').forEach(el => el.classList.remove('active'));
  const items = document.querySelectorAll('.dm-conv-item');
  for (let el of items) {
    if (el.onclick && el.onclick.toString().includes(convId)) {
      el.classList.add('active');
      break;
    }
  }

  if (dmUnsubscribe) dmUnsubscribe();

  const messagesContainer = document.getElementById('dmMessages');
  messagesContainer.innerHTML = 'Зареждане...';

  try {
    const snap = await db.collection('conversations').doc(convId).collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    messagesContainer.innerHTML = '';
    snap.forEach(doc => {
      appendDmMessage(doc.data(), doc.id);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (err) {
    console.error(err);
  }

  dmUnsubscribe = db.collection('conversations').doc(convId).collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot((snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const m = change.doc.data();
          appendDmMessage(m, change.doc.id);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          if (m.senderId !== currentUser.uid && !document.hasFocus()) {
            sendBrowserNotification('Ново съобщение', m.text);
          }
        } else if (change.type === 'modified') {
          const existing = document.getElementById('msg-' + change.doc.id);
          if (existing) existing.remove();
          appendDmMessage(change.doc.data(), change.doc.id);
        } else if (change.type === 'removed') {
          const existing = document.getElementById('msg-' + change.doc.id);
          if (existing) existing.remove();
        }
      });
    });
}

function appendDmMessage(m, msgId) {
  const container = document.getElementById('dmMessages');
  const div = document.createElement('div');
  div.id = 'msg-' + msgId;
  div.className = 'dm-msg' + (m.senderId === currentUser.uid ? ' dm-msg-own' : '');

  if (m.deleted && m.text === 'Съобщението е изтрито.') {
    div.className += ' dm-msg-deleted';
    div.innerHTML = '<div class="dm-msg-text" style="font-style:italic;color:var(--text-muted)"><i class="fas fa-trash"></i> Съобщението е изтрито.</div>';
    container.appendChild(div);
    return;
  }

  const time = m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleTimeString('bg-BG') : '';
  const isOwn = m.senderId === currentUser.uid;
  const deleteBtn = isOwn
    ? `<button class="dm-msg-delete-btn" onclick="deleteMessage('${msgId}')" title="Изтрий"><i class="fas fa-times"></i></button>`
    : '';
  div.innerHTML = '<div class="dm-msg-text">' + m.text + '</div><div class="dm-msg-time">' + time + '</div>' + deleteBtn;
  container.appendChild(div);
}

async function deleteMessage(msgId) {
  if (!currentConversationId || !currentUser) return;
  const sub = currentUserData.subscription || 'free';
  const canHardDelete = ['plus', 'pro', 'ultra'].includes(sub);

  if (canHardDelete) {
    if (!confirm('Наистина ли искаш да изтриеш това съобщение?')) return;
    try {
      await db.collection('conversations').doc(currentConversationId).collection('messages').doc(msgId).delete();
    } catch (err) {
      console.error(err);
      showNotification('Грешка при изтриване.', 'error');
    }
  } else {
    if (!confirm('Съобщението ще бъде заменено с "Съобщението е изтрито." за всички. Напред? Абонамент Plus+ премахва следите напълно.')) return;
    try {
      await db.collection('conversations').doc(currentConversationId).collection('messages').doc(msgId).update({
        text: 'Съобщението е изтрито.',
        deleted: true
      });
    } catch (err) {
      console.error(err);
      showNotification('Грешка при изтриване.', 'error');
    }
  }
}

async function sendDmMessage() {
  const input = document.getElementById('dmInput');
  const text = input.value.trim();
  if (!text || !currentConversationId || !currentUser) return;

  try {
    await db.collection('conversations').doc(currentConversationId).collection('messages').add({
      senderId: currentUser.uid,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('conversations').doc(currentConversationId).update({
      lastMessage: text,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';

    // Push notification to the other user
    try {
      const convDoc = await db.collection('conversations').doc(currentConversationId).get();
      const conv = convDoc.data();
      const otherUid = conv.participants.find(id => id !== currentUser.uid);
      if (otherUid) {
        const partnerName = (conv.partnerNameFor && conv.partnerNameFor[otherUid]) || currentUserData.username;
        sendPushNotification(otherUid, `Ново съобщение от ${partnerName}`, text);
      }
    } catch (e) { /* ignore */ }
  } catch (err) {
    console.error(err);
  }
}

window.searchDmUsers = async function() {
  const query = document.getElementById('dmUserSearch').value.trim().toLowerCase();
  const container = document.getElementById('dmUserResults');
  if (query.length < 2) { container.innerHTML = ''; return; }

  try {
    const snap = await db.collection('users').where('approved', '==', true).get();
    container.innerHTML = '';
    snap.forEach(doc => {
      const u = doc.data();
      if (doc.id === currentUser.uid) return;
      if (u.username.toLowerCase().includes(query)) {
        const div = document.createElement('div');
        div.className = 'dm-user-result';
        div.innerHTML = '<span style="color:' + (u.nameColor || '#4caf50') + '">' + u.username + '</span>';
        div.onclick = () => startConversation(doc.id, u.username);
        container.appendChild(div);
      }
    });
    if (container.innerHTML === '') {
      container.innerHTML = '<div style="color:var(--text-muted);padding:0.5rem">Няма намерени потребители</div>';
    }
  } catch (err) {
    console.error(err);
  }
};

async function startConversation(otherUid, otherName) {
  document.getElementById('newDmModal').classList.remove('show');
  document.getElementById('dmUserSearch').value = '';
  document.getElementById('dmUserResults').innerHTML = '';

  const myUid = currentUser.uid;
  const participants = [myUid, otherUid].sort();

  try {
    const snap = await db.collection('conversations')
      .where('participants', '==', participants)
      .get();

    if (!snap.empty) {
      openConversation(snap.docs[0].id, otherUid, otherName);
    } else {
      const ref = await db.collection('conversations').add({
        participants: participants,
        partnerName: otherName,
        partnerId: otherUid,
        lastMessage: '',
        lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('conversations').doc(ref.id).update({
        ['partnerNameFor.' + myUid]: otherName,
        ['partnerNameFor.' + otherUid]: currentUserData.username
      });
      openConversation(ref.id, otherUid, otherName);
      sendPushNotification(otherUid, `${currentUserData.username} започна разговор с теб`, '');
    }
    loadConversations();
  } catch (err) {
    console.error(err);
  }
}

async function loadEvents() {
  const container = document.getElementById('eventsList');
  try {
    const now = new Date();
    const snap = await db.collection('events')
      .where('date', '>=', now)
      .orderBy('date', 'asc')
      .limit(10)
      .get();

    if (snap.empty) {
      container.innerHTML = '<div class="events-placeholder">Няма предстоящи събития.</div>';
      return;
    }
    container.innerHTML = '';
    snap.forEach(doc => {
      const e = doc.data();
      const card = document.createElement('div');
      card.className = 'event-card';
      const dateStr = e.date ? new Date(e.date.toMillis()).toLocaleDateString('bg-BG') : '';
      card.innerHTML = `
        <div class="event-date"><i class="fas fa-calendar-alt"></i> ${dateStr}</div>
        <h4>${e.title}</h4>
        <p>${e.description || ''}</p>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadLeaderboard() {
  const container = document.getElementById('leaderboardPreview');
  try {
    const snap = await db.collection('users')
      .orderBy('xp', 'desc')
      .limit(5)
      .get();

    if (snap.empty) return;
    container.innerHTML = '';
    let rank = 1;
    snap.forEach(doc => {
      const u = doc.data();
      const item = document.createElement('div');
      item.className = 'lb-item';
      item.innerHTML = `${rank}. <span style="color:${u.nameColor || '#4caf50'}">${u.username}</span> - ${u.xp || 0} XP`;
      container.appendChild(item);
      rank++;
    });
  } catch (err) {
    console.error(err);
  }
}

window.openFullLeaderboard = async () => {
  const container = document.getElementById('fullLeaderboard');
  container.innerHTML = 'Зареждане...';
  document.getElementById('leaderboardModal').classList.add('show');
  try {
    const snap = await db.collection('users').orderBy('xp', 'desc').limit(100).get();
    container.innerHTML = '';
    let rank = 1;
    snap.forEach(doc => {
      const u = doc.data();
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      div.innerHTML = `
        <div class="item-info">
          <strong style="color:${u.nameColor || '#4caf50'}">${rank}. ${u.username}</strong>
          <div style="font-size:0.82rem;color:var(--text-muted)"><i class="fas fa-bolt"></i> ${u.xp || 0} XP • LVL ${u.level || 1}</div>
        </div>
      `;
      container.appendChild(div);
      rank++;
    });
  } catch (err) {
    container.innerHTML = '<div style="color:var(--danger);padding:1rem">Грешка при зареждане</div>';
    console.error(err);
  }
};

function setupListeners() {
  document.getElementById('userBtn').addEventListener('click', () => {
    document.getElementById('dropdownMenu').classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-dropdown')) {
      document.getElementById('dropdownMenu').classList.remove('show');
    }
  });

  document.getElementById('profileLink').addEventListener('click', (e) => {
    e.preventDefault();
    showProfileModal();
  });

  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    showSettingsModal();
  });

  document.getElementById('subscriptionLink').addEventListener('click', (e) => {
    e.preventDefault();
    showSubModal();
  });

  document.getElementById('adminLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/admin/';
  });

  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (currentUser) {
      try {
        await db.collection('users').doc(currentUser.uid).update({ online: false });
      } catch (err) {
        console.error(err);
      }
    }
    await auth.signOut();
    window.location.href = '/login/';
  });

  document.getElementById('newPostBtn').addEventListener('click', async () => {
    if ((currentUserData.credits || 0) < 5) {
      showNotification('Нямаш достатъчно кредити за създаване на тема! (Необходими: 5 <i class="fas fa-coins"></i>)', 'error');
      showSubModal();
      return;
    }
    const title = prompt('Заглавие на темата:');
    if (!title) return;
    const content = prompt('Съдържание:');
    if (!content) return;
    try {
      await db.collection('forum').add({
        title,
        content,
        author: currentUserData.username,
        authorColor: currentUserData.nameColor || '#4caf50',
        authorId: currentUser.uid,
        replies: 0,
        lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await rewardXPAndCredits(20, -5, 'Създаване на нова тема във форума');
      loadForum();
    } catch(err) {
      console.error(err);
    }
  });

  document.getElementById('newDmBtn').addEventListener('click', () => {
    document.getElementById('newDmModal').classList.add('show');
  });

  document.getElementById('dmSendBtn').addEventListener('click', sendDmMessage);
  document.getElementById('dmInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendDmMessage();
  });

  document.getElementById('forumReplyBtn').addEventListener('click', async () => {
    if ((currentUserData.credits || 0) < 2) {
      showNotification('Нямаш достатъчно кредити за отговор! (Необходими: 2 <i class="fas fa-coins"></i>)', 'error');
      showSubModal();
      return;
    }
    const input = document.getElementById('forumReplyInput');
    const text = input.value.trim();
    if (!text || !currentThreadId) return;
    try {
      await db.collection('forum').doc(currentThreadId).collection('replies').add({
        author: currentUserData.username,
        authorColor: currentUserData.nameColor || '#4caf50',
        authorId: currentUser.uid,
        text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('forum').doc(currentThreadId).update({
        replies: firebase.firestore.FieldValue.increment(1),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
      });
      await rewardXPAndCredits(10, -2, 'Добавяне на отговор във форум тема');
      input.value = '';
      openThread(currentThreadId, currentThreadData);

      // Push notification to thread author
      if (currentThreadData && currentThreadData.authorId !== currentUser.uid) {
        sendPushNotification(currentThreadData.authorId, 'Нов отговор във форума',
          `${currentUserData.username} отговори на "${currentThreadData.title}"`);
      }
    } catch(err) {
      console.error(err);
    }
  });

  document.getElementById('forumReplyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('forumReplyBtn').click();
  });

  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) el.classList.remove('show');
    });
  });

  document.getElementById('forumModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('forumModal')) closeForumModal();
  });

  setupColorPicker('settingsColorGrid', 'settingsNameColor');
}

function showProfileModal() {
  const d = currentUserData;
  document.getElementById('modalDisplayName').textContent = d.username;
  document.getElementById('modalEmail').textContent = d.email;
  document.getElementById('modalCredits').textContent = d.credits || 0;
  document.getElementById('modalLevel').textContent = d.level || 1;
  document.getElementById('modalXP').textContent = d.xp || 0;
  const badges = document.getElementById('modalBadges');
  badges.innerHTML = '';
  if (d.badges && d.badges.length > 0) {
    d.badges.forEach(b => {
      const span = document.createElement('span');
      span.className = 'badge';
      span.textContent = b;
      badges.appendChild(span);
    });
  }
  document.getElementById('profileModal').classList.add('show');
}

function showSettingsModal() {
  const d = currentUserData;
  document.getElementById('settingsNameColor').value = d.nameColor || '#4caf50';
  document.querySelectorAll('#settingsColorGrid .color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === (d.nameColor || '#4caf50'));
  });
  document.getElementById('settingsTheme').value = document.documentElement.getAttribute('data-theme') || 'dark';
  document.getElementById('settingsStatus').textContent = '';
  document.getElementById('settingsModal').classList.add('show');
}

window.saveSettings = async () => {
  const status = document.getElementById('settingsStatus');
  const nameColor = document.getElementById('settingsNameColor').value.trim();
  const theme = document.getElementById('settingsTheme').value;
  try {
    await db.collection('users').doc(currentUser.uid).update({ nameColor });
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vievo-theme', theme);
    status.textContent = 'Настройките са запазени!';
    status.style.color = 'var(--accent)';
    setTimeout(() => closeModal('settingsModal'), 1000);
    updateUI();
  } catch (err) {
    status.textContent = 'Грешка: ' + err.message;
    status.style.color = 'var(--danger)';
  }
};

function showSubModal() {
  const d = currentUserData;
  const sub = d.subscription || 'free';
  const labels = { free: 'Free', plus: 'Plus', pro: 'Pro', ultra: 'Ultra' };
  const credits = { free: 10, plus: 15, pro: 25, ultra: 40 };
  document.getElementById('subTierName').textContent = labels[sub] || 'Free';
  document.getElementById('subCreditsPerDay').textContent = `${credits[sub] || 10} кредита/ден`;
  document.getElementById('subUpgradeStatus').textContent = '';
  document.getElementById('paypalButtonContainer').innerHTML = '';
  selectedSubTier = null;
  document.querySelectorAll('.sub-tier-card').forEach(c => {
    c.classList.remove('selected');
    if (c.dataset.tier === sub) {
      c.classList.add('selected');
    }
  });
  document.getElementById('subModal').classList.add('show');
}

window.selectSubTier = (tier) => {
  selectedSubTier = tier;
  document.querySelectorAll('.sub-tier-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('.sub-tier-card[data-tier="' + tier + '"]').classList.add('selected');
  document.getElementById('subUpgradeStatus').textContent = '';
  renderPayPalButton(tier);
};

function renderPayPalButton(tier) {
  const container = document.getElementById('paypalButtonContainer');
  container.innerHTML = '';

  const prices = { plus: 5, pro: 10, ultra: 20 };
  const price = prices[tier];
  if (!price) return;

  if (typeof paypal !== 'undefined') {
    paypal.Buttons({
      createOrder: function(data, actions) {
        return actions.order.create({
          purchase_units: [{
            description: 'Виево банда - ' + tier.charAt(0).toUpperCase() + tier.slice(1),
            amount: { value: price.toString(), currency_code: 'EUR' }
          }]
        });
      },
      onApprove: function(data, actions) {
        return actions.order.capture().then(function(details) {
          db.collection('users').doc(currentUser.uid).update({
            subscription: tier
          }).then(() => {
            document.getElementById('subUpgradeStatus').textContent = 'Абонаментът е активиран! Благодарим ти, ' + details.payer.name.given_name + '!';
            document.getElementById('subUpgradeStatus').style.color = 'var(--accent)';
            currentUserData.subscription = tier;
            updateUI();
            showSubModal();
          }).catch(console.error);
        });
      },
      onError: function(err) {
        document.getElementById('subUpgradeStatus').textContent = 'Грешка при плащане: ' + err.message;
        document.getElementById('subUpgradeStatus').style.color = 'var(--danger)';
      }
    }).render(container);
  } else {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">PayPal зареждане...</p>';
    setTimeout(() => renderPayPalButton(tier), 2000);
  }
}

window.closeModal = (id) => {
  document.getElementById(id).classList.remove('show');
};

function setupColorPicker(gridId, inputId) {
  document.getElementById(gridId).addEventListener('click', (e) => {
    if (e.target.classList.contains('color-swatch')) {
      document.querySelectorAll(`#${gridId} .color-swatch`).forEach(s => s.classList.remove('selected'));
      e.target.classList.add('selected');
      document.getElementById(inputId).value = e.target.dataset.color;
    }
  });
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  localStorage.setItem('vievo-theme', html.getAttribute('data-theme'));
}

(function() {
  const saved = localStorage.getItem('vievo-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

function trackPresence() {
  if (!currentUser) return;

  // Задаване на онлайн статус
  db.collection('users').doc(currentUser.uid).update({
    online: true,
    lastActive: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Периодично обновяване
  setInterval(() => {
    if (currentUser) {
      db.collection('users').doc(currentUser.uid).update({
        online: true,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }, 45000);

  // Маркиране като офлайн при излизане
  window.addEventListener('beforeunload', () => {
    db.collection('users').doc(currentUser.uid).update({
      online: false
    });
  });

  // Слушане за потребители онлайн в реално време
  db.collection('users')
    .where('online', '==', true)
    .onSnapshot((snap) => {
      const container = document.getElementById('onlineUsers');
      if (!container) return;
      container.innerHTML = `<span class="online-count">${snap.size} потребители онлайн</span>`;

      snap.forEach(doc => {
        const u = doc.data();
        const userDiv = document.createElement('div');
        userDiv.className = 'online-user-item';
        userDiv.style.display = 'flex';
        userDiv.style.alignItems = 'center';
        userDiv.style.gap = '0.4rem';
        userDiv.style.marginTop = '0.5rem';
        userDiv.style.fontSize = '0.85rem';

        userDiv.innerHTML = `
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #2ea043; display: inline-block; box-shadow: 0 0 8px #2ea043;"></span>
          <span style="color: ${u.nameColor || '#4caf50'}; font-weight: 600;">${u.username}</span>
        `;
        container.appendChild(userDiv);
      });
    });
}
