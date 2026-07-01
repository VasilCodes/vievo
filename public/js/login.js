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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');

  errorEl.textContent = '';

  try {
    const userCred = await auth.signInWithEmailAndPassword(email, password);
    const user = userCred.user;

    if (!user.emailVerified) {
      errorEl.textContent = 'Моля, потвърди имейла си преди да влезеш.';
      await auth.signOut();
      return;
    }

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      errorEl.textContent = 'Грешка: профилът не е намерен.';
      await auth.signOut();
      return;
    }

    const userData = userDoc.data();
    if (!userData.approved) {
      errorEl.textContent = 'Профилът ти все още не е одобрен от администратор.';
      await auth.signOut();
      return;
    }

    window.location.href = '/home/';
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      errorEl.textContent = 'Грешен имейл или парола.';
    } else if (err.code === 'auth/invalid-email') {
      errorEl.textContent = 'Невалиден имейл адрес.';
    } else if (err.code === 'auth/too-many-requests') {
      errorEl.textContent = 'Твърде много опити. Опитай по-късно.';
    } else {
      errorEl.textContent = 'Грешка: ' + err.message;
    }
  }
});
