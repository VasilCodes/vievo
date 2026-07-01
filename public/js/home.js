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
    loadNews();
    loadForum();
    loadChat();
    loadEvents();
    loadLeaderboard();
    setupListeners();
  } catch (err) {
    console.error(err);
  }
});

function updateUI() {
  const d = currentUserData;
  document.getElementById('navDisplayName').textContent = d.username;
  document.getElementById('navCredits').textContent = `💰 ${d.credits || 0}`;
  document.getElementById('navXP').textContent = `⚡ ${d.xp || 0}`;
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
    const snap = await db.collection('ads').where('active', '==', true).orderBy('createdAt', 'desc').limit(1).get();
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
    snap.forEach(doc => {
      const n = doc.data();
      const card = document.createElement('div');
      card.className = 'news-card';
      const time = n.createdAt ? new Date(n.createdAt.toMillis()).toLocaleString('bg-BG') : '';
      card.innerHTML = `
        <h3 style="color:${n.authorColor || 'var(--text-primary)'}">${n.title}</h3>
        <div class="news-meta">${n.author} • ${time}</div>
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
    snap.forEach(doc => {
      const t = doc.data();
      const thread = document.createElement('div');
      thread.className = 'forum-thread';
      thread.innerHTML = `
        <h4 style="color:${t.authorColor || 'var(--text-primary)'}">${t.title}</h4>
        <div class="thread-meta">от ${t.author} • ${t.replies || 0} отговора</div>
      `;
      thread.onclick = () => openThread(doc.id, t);
      container.appendChild(thread);
    });
  } catch (err) {
    console.error(err);
  }
}

function openThread(id, data) {
  alert('Форум тема: ' + data.title + '\n\nДетайлите ще бъдат добавени в следваща версия.');
}

async function loadChat() {
  const messagesEl = document.getElementById('chatMessages');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const snap = await db.collection('chat')
      .where('createdAt', '>=', threeDaysAgo)
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    messagesEl.innerHTML = '';
    snap.forEach(doc => {
      const m = doc.data();
      appendChatMessage(m);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (err) {
    console.error(err);
  }

  db.collection('chat')
    .where('createdAt', '>=', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
    .orderBy('createdAt', 'asc')
    .onSnapshot((snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const m = change.doc.data();
          appendChatMessage(m);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      });
    });

  sendBtn.addEventListener('click', sendChatMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  async function sendChatMessage() {
    const text = input.value.trim();
    if (!text || !currentUser) return;

    try {
      await db.collection('chat').add({
        userId: currentUser.uid,
        author: currentUserData.username,
        authorColor: currentUserData.nameColor || '#4caf50',
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      input.value = '';
    } catch (err) {
      console.error(err);
    }
  }

  function appendChatMessage(m) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const time = m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleTimeString('bg-BG') : '';
    div.innerHTML = `
      <div class="chat-author" style="color:${m.authorColor || '#4caf50'}">${m.author}</div>
      ${m.text}
      <span class="chat-time">${time}</span>
    `;
    messagesEl.appendChild(div);
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
        <div class="event-date">📅 ${dateStr}</div>
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

function setupListeners() {
  document.getElementById('userBtn').addEventListener('click', () => {
    document.getElementById('dropdownMenu').classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-dropdown')) {
      document.getElementById('dropdownMenu').classList.remove('show');
    }
  });

  document.getElementById('adminLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/admin/';
  });

  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await auth.signOut();
    window.location.href = '/login/';
  });

  document.getElementById('newPostBtn').addEventListener('click', () => {
    const title = prompt('Заглавие на темата:');
    if (!title) return;
    const content = prompt('Съдържание:');
    if (!content) return;
    db.collection('forum').add({
      title,
      content,
      author: currentUserData.username,
      authorColor: currentUserData.nameColor || '#4caf50',
      authorId: currentUser.uid,
      replies: 0,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => loadForum()).catch(console.error);
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
