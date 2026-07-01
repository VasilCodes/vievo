const admin = require('firebase-admin');
const db = admin.firestore();

const TIER_CREDITS = {
  free: 10,
  plus: 15,
  pro: 25,
  ultra: 40
};

async function distributeDailyCredits() {
  const snap = await db.collection('users').get();
  const batch = db.batch();

  snap.forEach(doc => {
    const user = doc.data();
    if (!user.approved || user.banned) return;

    const tier = user.subscription || 'free';
    const bonus = TIER_CREDITS[tier] || 10;

    batch.update(doc.ref, {
      credits: admin.firestore.FieldValue.increment(bonus),
      xp: admin.firestore.FieldValue.increment(5)
    });
  });

  await batch.commit();
  console.log('Daily credits distributed');
}

async function activateSubscription(uid, tier, duration) {
  const endDate = new Date();
  if (duration === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
  else endDate.setDate(endDate.getDate() + 30);

  await db.collection('users').doc(uid).update({
    subscription: tier,
    subscriptionEnd: endDate,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function expireSubscriptions() {
  const now = new Date();
  const snap = await db.collection('users')
    .where('subscriptionEnd', '<', now)
    .where('subscription', 'in', ['plus', 'pro', 'ultra'])
    .get();

  const batch = db.batch();
  snap.forEach(doc => {
    batch.update(doc.ref, { subscription: 'free', subscriptionEnd: null });
  });
  await batch.commit();
}

module.exports = { distributeDailyCredits, activateSubscription, expireSubscriptions };
