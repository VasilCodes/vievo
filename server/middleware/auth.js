const admin = require('firebase-admin');

async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { verifyToken, requireAdmin };
