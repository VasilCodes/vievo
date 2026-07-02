importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCa6TTfSKudSpG5N07wOnmyRMrF6BzNb-s",
  authDomain: "vievo-community-zzz.firebaseapp.com",
  projectId: "vievo-community-zzz",
  storageBucket: "vievo-community-zzz.firebasestorage.app",
  messagingSenderId: "52906238804",
  appId: "1:52906238804:web:2c466dc92fb9fc7539dec1"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/favicon.ico',
    click_action: payload.data?.click_action || '/home/'
  });
});
