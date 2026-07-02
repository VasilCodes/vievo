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

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('signupError');
  const successEl = document.getElementById('signupSuccess');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (password !== confirm) {
    errorEl.textContent = 'Паролите не съвпадат.';
    return;
  }

  if (username.length < 2) {
    errorEl.textContent = 'Потребителското име трябва да е поне 2 символа.';
    return;
  }

  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCred.user;

    await db.collection('users').doc(user.uid).set({
      username: username,
      email: email,
      role: 'user',
      subscription: 'free',
      credits: 0,
      xp: 0,
      level: 1,
      approved: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      nameColor: '#4caf50',
      banner: '',
      background: '',
      badges: [],
      totalDonationsReceived: 0,
      totalDonationsGiven: 0,
      hp: 100,
      maxHp: 100
    });

    await user.sendEmailVerification();
    successEl.textContent = 'Регистрацията е успешна! Провери имейла си за потвърждение.';
    document.getElementById('signupForm').reset();
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      errorEl.textContent = 'Този имейл вече се използва.';
    } else if (err.code === 'auth/weak-password') {
      errorEl.textContent = 'Паролата трябва да е поне 6 символа.';
    } else if (err.code === 'auth/invalid-email') {
      errorEl.textContent = 'Невалиден имейл адрес.';
    } else {
      errorEl.textContent = 'Грешка: ' + err.message;
    }
  }
});
