/**
 * Verify User Script
 * Usage: node scripts/verify-user.js <UID>
 * 
 * Marks a user as approved in Firestore.
 * Requires service account credentials.
 * 
 * First, download your Firebase service account key:
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate new private key"
 * 3. Save as serviceAccount.json in the project root
 */

const admin = require('firebase-admin');
const path = require('path');

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/verify-user.js <UID>');
  process.exit(1);
}

async function main() {
  try {
    const serviceAccount = require(path.join(__dirname, '..', 'serviceAccount.json'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      console.error(`Потребител с UID "${uid}" не съществува.`);
      process.exit(1);
    }

    await db.collection('users').doc(uid).update({
      approved: true,
      role: 'user'
    });

    console.log(`✅ Потребител "${doc.data().username}" (${uid}) е одобрен успешно.`);
  } catch (err) {
    console.error('Грешка:', err.message);
    process.exit(1);
  }
}

main();
