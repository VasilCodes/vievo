const admin = require('firebase-admin');
const db = admin.firestore();

async function getUsers(req, res) {
  try {
    const snap = await db.collection('users').get();
    const users = [];
    snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateUser(req, res) {
  try {
    const { uid } = req.params;
    await db.collection('users').doc(uid).update(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getUsers, updateUser };
