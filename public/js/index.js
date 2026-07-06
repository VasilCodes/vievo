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

auth.onAuthStateChanged((user) => {
  if (user) {
    db.collection('users').doc(user.uid).onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();

        // Ограничаване на достъпа до игрите в етап на разработка
        if (window.location.pathname.includes('/games/') && !window.location.pathname.includes('/games/byagai-ot-koce-kisyov/')) {
          if (data.role !== 'admin' && data.role !== 'owner') {
            alert('Достъпът до игрите в момента е ограничен само за администратори!');
            window.location.href = '/home/';
            return;
          }
        }

        const creditsEl = document.getElementById('navCredits');
        const xpEl = document.getElementById('navXP');
        if (creditsEl) creditsEl.innerHTML = `<i class="fas fa-coins"></i> ${data.credits || 0}`;
        if (xpEl) xpEl.innerHTML = `<i class="fas fa-bolt"></i> ${data.xp || 0}`;
      }
    });
  } else {
    if (!window.location.pathname.includes('/login/') && !window.location.pathname.includes('/signup/')) {
      window.location.href = '/login/';
    }
  }
});
