const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/verify-user.js <UID>');
  process.exit(1);
}

const saPath = path.join(__dirname, '..', 'serviceAccount.json');
if (!fs.existsSync(saPath)) {
  console.error('serviceAccount.json не е намерен. Постави го в корена на проекта.');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function signRsaSha256(key, data) {
  return crypto.sign('RSA-SHA256', Buffer.from(data), key);
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const message = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = signRsaSha256(sa.private_key, message);
  const assertion = `${message}.${base64url(signature)}`;

  return new Promise((resolve, reject) => {
    const data = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(assertion)}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const r = JSON.parse(body);
        if (r.access_token) resolve(r.access_token);
        else reject(new Error(r.error_description || 'Failed to get token'));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function markEmailVerified(token, projectId) {
  const body = JSON.stringify({
    localId: uid,
    emailVerified: true
  });

  const options = {
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${projectId}/accounts:update`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function approveUserInFirestore(token, projectId) {
  const body = JSON.stringify({
    fields: {
      approved: { booleanValue: true },
      role: { stringValue: 'user' }
    }
  });

  // First try to read the user doc to check if it exists
  const checkResult = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });

  if (checkResult.status === 404) {
    // User doc doesn't exist, create it
    const createBody = JSON.stringify({
      fields: {
        approved: { booleanValue: true },
        role: { stringValue: 'user' },
        username: { stringValue: uid },
        email: { stringValue: '' },
        credits: { integerValue: 0 },
        xp: { integerValue: 0 },
        level: { integerValue: 1 },
        hp: { integerValue: 100 },
        maxHp: { integerValue: 100 },
        nameColor: { stringValue: '#4caf50' },
        subscription: { stringValue: 'free' },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${projectId}/databases/(default)/documents/users?documentId=${uid}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(createBody);
      req.end();
    });
  }

  // Update existing doc
  const options = {
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=approved&updateMask.fieldPaths=role`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    console.log('⏳ Получаване на достъп...');
    const token = await getAccessToken();
    const projectId = sa.project_id;
    console.log('✅ Успешно свързване с Firebase.');

    console.log('⏳ Потвърждаване на имейл...');
    const emailResult = await markEmailVerified(token, projectId);
    if (emailResult.status === 200) {
      console.log('✅ Имейлът е потвърден.');
    } else {
      console.error(`❌ Грешка при потвърждение на имейл (${emailResult.status}): ${emailResult.body}`);
      // Continue anyway to try Firestore
    }

    console.log('⏳ Одобряване на потребител...');
    const fsResult = await approveUserInFirestore(token, projectId);
    if (fsResult.status === 200) {
      console.log(`✅ Потребител ${uid} е одобрен успешно.`);
    } else {
      console.error(`❌ Грешка при одобрение (${fsResult.status}): ${fsResult.body}`);
    }
  } catch (err) {
    console.error('Грешка:', err.message);
    process.exit(1);
  }
}

main();
