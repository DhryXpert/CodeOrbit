const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { admin, db } = require('../config/firebaseAdmin');

const JWT_SECRET = process.env.JWT_SECRET || 'codeorbit-secret-key-123456';

// Password hashing helpers
const hashPassword = (pwd, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.pbkdf2Sync(pwd, salt, 1000, 64, 'sha512').toString('hex')
});

const verifyPassword = (pwd, salt, hash) => hashPassword(pwd, salt).hash === hash;

// Helper to retrieve or provision user in Firebase Auth
async function getOrCreateFirebaseUser(userId, email, name) {
  try {
    return await admin.auth().getUser(userId);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return await admin.auth().createUser({
        uid: userId,
        email: email.toLowerCase(),
        displayName: name,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      });
    }
    throw err;
  }
}

// --- SIGN UP ---
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields required!' });

  try {
    const usersRef = db.collection('users');
    const checkUser = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
    if (!checkUser.empty) return res.status(400).json({ error: 'Email already registered!' });

    const { salt, hash } = hashPassword(password);
    const userId = usersRef.doc().id;

    await usersRef.doc(userId).set({
      userId,
      email: email.toLowerCase(),
      name,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    });

    const firebaseUser = await getOrCreateFirebaseUser(userId, email, name).catch(() => null);
    const accessToken = jwt.sign({ userId, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '1h' });
    const firebaseCustomToken = await admin.auth().createCustomToken(userId).catch(() => null);

    res.status(201).json({
      accessToken,
      firebaseCustomToken,
      user: {
        uid: userId,
        email: email.toLowerCase(),
        displayName: name,
        photoURL: firebaseUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed!' });
  }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required!' });

  try {
    const snapshot = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (snapshot.empty) return res.status(400).json({ error: 'Incorrect credentials!' });

    const userDoc = snapshot.docs[0].data();
    if (!verifyPassword(password, userDoc.salt, userDoc.passwordHash)) {
      return res.status(400).json({ error: 'Incorrect credentials!' });
    }

    const { userId, name } = userDoc;
    const accessToken = jwt.sign({ userId, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '1h' });
    const firebaseCustomToken = await admin.auth().createCustomToken(userId).catch(() => null);
    const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    res.json({
      accessToken,
      firebaseCustomToken,
      user: {
        uid: userId,
        email: email.toLowerCase(),
        displayName: name,
        photoURL
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed!' });
  }
});

router.post('/logout', (req, res) => res.json({ message: 'Logged out' }));

// --- RESET PASSWORD ---
router.post('/reset-password', async (req, res) => {
  const { oobCode, newPassword } = req.body;
  if (!oobCode || !newPassword) {
    return res.status(400).json({ error: 'Reset code and new password are required!' });
  }

  try {
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Backend misconfigured: Missing FIREBASE_API_KEY!' });
    }

    // Verify the oobCode using Firebase Auth REST API
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:verifyPasswordResetCode?key=${apiKey}`;
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oobCode })
    });

    if (!verifyRes.ok) {
      const errorData = await verifyRes.json().catch(() => ({}));
      return res.status(400).json({ error: errorData.error?.message || 'Invalid or expired reset code!' });
    }

    const { email } = await verifyRes.json();
    if (!email) {
      return res.status(400).json({ error: 'Could not resolve email from reset code!' });
    }

    // Hash the new password using existing helper
    const { salt, hash } = hashPassword(newPassword);

    // Update the custom password hash and salt in Firestore 'users' collection
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'User not found in custom database!' });
    }

    const userDocId = snapshot.docs[0].id;
    await usersRef.doc(userDocId).update({
      passwordHash: hash,
      salt
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error during backend password reset:', error);
    res.status(500).json({ error: 'Internal server error during password reset!' });
  }
});

module.exports = router;
