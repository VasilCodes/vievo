// ============================================================
// Vievo Roblox ↔ Firebase Middleware
// ============================================================
// Roblox cannot use Firebase SDK directly. This server acts as
// a bridge — Roblox calls these REST endpoints via HttpService.
//
// Endpoints:
//   POST /api/auth/login     — email + password → idToken + uid
//   POST /api/auth/register  — email + password → new account
//   GET  /api/user/:uid      — fetch user data (credits, xp, etc.)
//   POST /api/user/:uid/set  — set user fields
//   POST /api/user/:uid/add-credits — increment credits
//   GET  /api/shop/:gameId   — fetch shop items
//   POST /api/leaderboard/:gameId/submit — submit score
//   GET  /api/leaderboard/:gameId — get top scores
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// ------------------------------------------------------------------
// Firebase Admin Initialization (server-side, secure)
// ------------------------------------------------------------------
// You need a service account JSON file from Firebase Console:
//   Project Settings → Service accounts → Generate new private key
// Save it as serviceAccount.json in this folder (gitignored).
// ------------------------------------------------------------------
let firestore = null;
let auth = null;

try {
  const serviceAccount = require('./serviceAccount.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  firestore = admin.firestore();
  auth = admin.auth();
  console.log('✓ Firebase Admin initialized');
} catch (e) {
  console.warn('⚠ No serviceAccount.json found — running in proxy-only mode');
  console.warn('  Firestore/Auth Admin endpoints will return 503.');
  console.warn('  Client-based auth (signInWithPassword) will still work.');
}

// ------------------------------------------------------------------
// Express Setup
// ------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FIREBASE_CLIENT_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

// ------------------------------------------------------------------
// Helper: fetch from Firebase REST API (used when Admin SDK is absent)
// ------------------------------------------------------------------
const https = require('https');

function firebaseRest(path, body = null, method = 'POST') {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/${path}?key=${API_KEY}`);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method, headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(data)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ------------------------------------------------------------------
// Auth Endpoints
// ------------------------------------------------------------------

// POST /api/auth/register — Create new account
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    // Try Admin SDK first
    if (auth) {
      const user = await auth.createUser({ email, password });
      // Create Firestore user document
      if (firestore) {
        await firestore.collection('users').doc(user.uid).set({
          email, credits: 0, xp: 0, createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      return res.json({ uid: user.uid, email: user.email });
    }

    // Fallback to REST API
    const result = await firebaseRest('accounts:signUp', { email, password, returnSecureToken: true });
    if (result.error) return res.status(400).json(result);
    // Try to init Firestore doc via REST
    const token = result.idToken;
    const uid = result.localId;
    await createFirestoreDoc(token, uid, { email, credits: 0, xp: 0 });
    res.json({ uid, email, idToken: token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login — Sign in with email + password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const result = await firebaseRest('accounts:signInWithPassword', { email, password, returnSecureToken: true });
    if (result.error) return res.status(400).json(result);
    res.json({ uid: result.localId, email: result.email, idToken: result.idToken, refreshToken: result.refreshToken });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------------
// Firestore REST helper (used without Admin SDK)
// ------------------------------------------------------------------
async function firestoreRestGet(token, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(data)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function firestoreRestPatch(token, path, fields) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`);
    const body = { fields: {} };
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'number') body.fields[k] = { integerValue: v.toString() };
      else if (typeof v === 'string') body.fields[k] = { stringValue: v };
      else if (typeof v === 'boolean') body.fields[k] = { booleanValue: v };
    }
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(data)); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function createFirestoreDoc(token, uid, data) {
  try {
    await firestoreRestPatch(token, `users/${uid}`, data);
  } catch (e) {
    console.warn('Could not init Firestore doc:', e.message);
  }
}

// ------------------------------------------------------------------
// User Data Endpoints
// ------------------------------------------------------------------

// GET /api/user/:uid — Fetch user data
app.get('/api/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { idToken } = req.query;

    if (firestore) {
      const doc = await firestore.collection('users').doc(uid).get();
      if (!doc.exists) return res.status(404).json({ error: 'User not found' });
      return res.json({ uid, ...doc.data() });
    }

    if (!idToken) return res.status(400).json({ error: 'idToken required' });
    const data = await firestoreRestGet(idToken, `users/${uid}`);
    // Flatten Firestore document format
    const result = { uid };
    if (data.fields) {
      for (const [k, v] of Object.entries(data.fields)) {
        result[k] = v.integerValue !== undefined ? parseInt(v.integerValue) : v.stringValue || v.booleanValue;
      }
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/user/:uid/set — Set user fields
app.post('/api/user/:uid/set', async (req, res) => {
  try {
    const { uid } = req.params;
    const { fields, idToken } = req.body;
    if (!fields) return res.status(400).json({ error: 'fields required' });

    if (firestore) {
      await firestore.collection('users').doc(uid).set(fields, { merge: true });
      return res.json({ success: true });
    }

    if (!idToken) return res.status(400).json({ error: 'idToken required' });
    await firestoreRestPatch(idToken, `users/${uid}`, fields);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/user/:uid/add-credits — Increment credits by amount
app.post('/api/user/:uid/add-credits', async (req, res) => {
  try {
    const { uid } = req.params;
    const { amount, reason, idToken } = req.body;
    const amt = parseInt(amount) || 0;

    if (firestore) {
      await firestore.collection('users').doc(uid).update({
        credits: admin.firestore.FieldValue.increment(amt)
      });
      // Log transaction
      if (reason) {
        await firestore.collection('users').doc(uid).collection('transactions').add({
          amount: amt, reason, timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      const doc = await firestore.collection('users').doc(uid).get();
      return res.json({ success: true, credits: doc.data().credits });
    }

    if (!idToken) return res.status(400).json({ error: 'idToken required' });
    const current = await firestoreRestGet(idToken, `users/${uid}`);
    let curCredits = 0;
    if (current.fields && current.fields.credits) {
      curCredits = parseInt(current.fields.credits.integerValue || 0);
    }
    const newCredits = curCredits + amt;
    await firestoreRestPatch(idToken, `users/${uid}`, { credits: newCredits });
    res.json({ success: true, credits: newCredits });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------------
// Shop Endpoints
// ------------------------------------------------------------------

// GET /api/shop/:gameId — Get all shop items for a game
app.get('/api/shop/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { category } = req.query;

    if (firestore) {
      let query = firestore.collection('games').doc(gameId).collection('shop');
      if (category) query = query.where('category', '==', category);
      const snap = await query.get();
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      return res.json(items);
    }

    return res.status(503).json({ error: 'Admin SDK not initialized' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop/:gameId/buy — Purchase an item
app.post('/api/shop/:gameId/buy', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { uid, itemId, itemCost, idToken } = req.body;

    if (firestore) {
      const userDoc = await firestore.collection('users').doc(uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
      const credits = userDoc.data().credits || 0;
      if (credits < itemCost) return res.status(400).json({ error: 'Not enough credits' });

      await firestore.collection('users').doc(uid).update({ credits: credits - itemCost });
      await firestore.collection('users').doc(uid).collection('inventory').add({
        gameId, itemId, purchasedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.json({ success: true, credits: credits - itemCost });
    }

    return res.status(503).json({ error: 'Admin SDK not initialized' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------------
// Leaderboard Endpoints
// ------------------------------------------------------------------

// POST /api/leaderboard/:gameId/submit — Submit a time
app.post('/api/leaderboard/:gameId/submit', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { uid, name, time } = req.body;

    if (firestore) {
      await firestore.collection('games').doc(gameId).collection('leaderboard').add({
        uid, name: name || 'Anonymous', time: parseInt(time) || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.json({ success: true });
    }

    return res.status(503).json({ error: 'Admin SDK not initialized' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/leaderboard/:gameId — Get top scores
app.get('/api/leaderboard/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    if (firestore) {
      const snap = await firestore.collection('games').doc(gameId)
        .collection('leaderboard')
        .orderBy('time', 'asc')
        .limit(limit)
        .get();
      const entries = [];
      snap.forEach(d => entries.push({ id: d.id, ...d.data() }));
      return res.json(entries);
    }

    return res.status(503).json({ error: 'Admin SDK not initialized' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------------
// Health Check
// ------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok', timestamp: new Date().toISOString(),
    adminMode: !!firestore, projectId: PROJECT_ID
  });
});

// ------------------------------------------------------------------
// Start Server
// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  Vievo Roblox ↔ Firebase Middleware  ║`);
  console.log(`║  Running on http://localhost:${PORT}    ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  console.log(`Endpoints:`);
  console.log(`  POST /api/auth/register`);
  console.log(`  POST /api/auth/login`);
  console.log(`  GET  /api/user/:uid`);
  console.log(`  POST /api/user/:uid/set`);
  console.log(`  POST /api/user/:uid/add-credits`);
  console.log(`  GET  /api/shop/:gameId`);
  console.log(`  POST /api/shop/:gameId/buy`);
  console.log(`  POST /api/leaderboard/:gameId/submit`);
  console.log(`  GET  /api/leaderboard/:gameId`);
  console.log(`  GET  /api/health\n`);
});
