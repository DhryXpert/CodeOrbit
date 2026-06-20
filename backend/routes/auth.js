const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { admin, db } = require('../config/firebaseAdmin');

const JWT_SECRET = process.env.JWT_SECRET || 'codeorbit-secret-key-123456';

// Password hashing helper matching original implementation
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt).hash === hash;
}

// --- SIGN UP ROUTE ---
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Please provide email, password, and name!' });
  }

  try {
    const usersRef = db.collection('users');
    const checkUser = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
    if (!checkUser.empty) {
      return res.status(400).json({ error: 'This email is already registered!' });
    }

    const { salt, hash } = hashPassword(password);
    const userId = usersRef.doc().id;

    const userDoc = {
      userId,
      email: email.toLowerCase(),
      name,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    };

    await usersRef.doc(userId).set(userDoc);

    // Sync user with Firebase Auth so Custom Token login works
    let firebaseUser = null;
    try {
      firebaseUser = await admin.auth().createUser({
        uid: userId,
        email: email.toLowerCase(),
        displayName: name,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      });
    } catch (err) {
      console.log("Firebase Auth user synced or exists:", err.message);
    }

    const accessToken = jwt.sign({ userId, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '1h' });
    const firebaseCustomToken = await admin.auth().createCustomToken(userId).catch(() => null);

    res.status(201).json({
      accessToken,
      firebaseCustomToken,
      user: {
        uid: userId,
        email: email.toLowerCase(),
        displayName: name,
        photoURL: firebaseUser ? firebaseUser.photoURL : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: 'Something went wrong during signup!' });
  }
});

// --- LOGIN ROUTE ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter your email and password!' });
  }

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
    if (snapshot.empty) {
      return res.status(400).json({ error: 'Incorrect email or password!' });
    }

    const userDoc = snapshot.docs[0].data();
    if (!verifyPassword(password, userDoc.salt, userDoc.passwordHash)) {
      return res.status(400).json({ error: 'Incorrect email or password!' });
    }

    const { userId, name } = userDoc;

    // Check/create user in Firebase Auth if needed
    let firebaseUser = null;
    try {
      firebaseUser = await admin.auth().getUser(userId);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        firebaseUser = await admin.auth().createUser({
          uid: userId,
          email: email.toLowerCase(),
          displayName: name,
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        }).catch(() => null);
      }
    }

    const accessToken = jwt.sign({ userId, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '1h' });
    const firebaseCustomToken = await admin.auth().createCustomToken(userId).catch(() => null);

    res.json({
      accessToken,
      firebaseCustomToken,
      user: {
        uid: userId,
        email: email.toLowerCase(),
        displayName: name,
        photoURL: firebaseUser ? firebaseUser.photoURL : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: 'Something went wrong during login!' });
  }
});

// --- LOGOUT ROUTE ---
router.post('/logout', async (req, res) => {
  res.json({ message: 'Logged out successfully!' });
});

module.exports = router;
