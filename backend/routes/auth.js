const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { admin, db } = require('../config/firebaseAdmin');

// Simple secret keys for JWT signing
const JWT_SECRET = process.env.JWT_SECRET || 'codeorbit-secret-key-123456';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'codeorbit-refresh-key-123456';

// Helper function to hash a password using Node's crypto
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// Helper function to check if the password matches the stored hash
function verifyPassword(password, salt, hash) {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

// --- SIGN UP ROUTE ---
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Please provide email, password, and name!' });
  }

  try {
    const usersRef = db.collection('users');
    
    // Check if email already exists
    const checkUser = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
    if (!checkUser.empty) {
      return res.status(400).json({ error: 'This email is already registered!' });
    }

    // Hash the password for security
    const { salt, hash } = hashPassword(password);
    
    // Create a new document reference with an auto ID
    const newUserRef = usersRef.doc();
    const userId = newUserRef.id;

    const userDoc = {
      userId,
      email: email.toLowerCase(),
      name,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    };

    // Save to Firestore users collection
    await newUserRef.set(userDoc);

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
      console.log("Firebase Auth user already exists or could not create:", err.message);
    }

    // Generate JWT access token and refresh token
    const accessToken = jwt.sign({ userId, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId, email: email.toLowerCase() }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Save refresh token to Firestore
    await db.collection('refresh_tokens').doc(userId).set({
      token: refreshToken,
      createdAt: new Date().toISOString()
    });

    // Create a custom Firebase Token for client-side Firestore authentication
    let firebaseCustomToken = null;
    try {
      firebaseCustomToken = await admin.auth().createCustomToken(userId);
    } catch (tokErr) {
      console.log("Could not make Firebase Custom Token:", tokErr);
    }

    res.status(201).json({
      accessToken,
      refreshToken,
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
    
    // Find user document by email
    const snapshot = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
    if (snapshot.empty) {
      return res.status(400).json({ error: 'Incorrect email or password!' });
    }

    const userDoc = snapshot.docs[0].data();
    
    // Check if password is correct
    const isValid = verifyPassword(password, userDoc.salt, userDoc.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Incorrect email or password!' });
    }

    const userId = userDoc.userId;
    const name = userDoc.name;

    // Check/create user in Firebase Auth if needed
    let firebaseUser = null;
    try {
      firebaseUser = await admin.auth().getUser(userId);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        try {
          firebaseUser = await admin.auth().createUser({
            uid: userId,
            email: email.toLowerCase(),
            displayName: name,
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
          });
        } catch (cErr) {
          console.log("Could not sync Firebase user on login:", cErr.message);
        }
      }
    }

    // Generate fresh tokens
    const accessToken = jwt.sign({ userId, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId, email: email.toLowerCase() }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Store refresh token
    await db.collection('refresh_tokens').doc(userId).set({
      token: refreshToken,
      createdAt: new Date().toISOString()
    });

    // Create Firebase Custom Token
    let firebaseCustomToken = null;
    try {
      firebaseCustomToken = await admin.auth().createCustomToken(userId);
    } catch (tokErr) {
      console.log("Could not make Firebase Custom Token:", tokErr);
    }

    res.json({
      accessToken,
      refreshToken,
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

// --- TOKEN REFRESH ROUTE ---
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required!' });
  }

  try {
    // Check if token is valid
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const userId = decoded.userId;

    // Check if token exists in Database
    const tokenDoc = await db.collection('refresh_tokens').doc(userId).get();
    if (!tokenDoc.exists || tokenDoc.data().token !== refreshToken) {
      return res.status(403).json({ error: 'Invalid or expired refresh token!' });
    }

    // Fetch user profile info
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found!' });
    }

    const userData = userDoc.data();
    
    // Generate new Access Token
    const accessToken = jwt.sign(
      { userId, email: userData.email, name: userData.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Make new Firebase custom token to keep client authenticated
    let firebaseCustomToken = null;
    try {
      firebaseCustomToken = await admin.auth().createCustomToken(userId);
    } catch (tokErr) {
      console.log("Could not make custom token:", tokErr);
    }

    res.json({
      accessToken,
      firebaseCustomToken
    });

  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(403).json({ error: 'Invalid or expired refresh token!' });
  }
});

// --- LOGOUT ROUTE ---
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required!' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const userId = decoded.userId;

    // Delete refresh token from Firestore
    await db.collection('refresh_tokens').doc(userId).delete();
    
    res.json({ message: 'Logged out successfully!' });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(200).json({ message: 'Logged out!' });
  }
});

module.exports = router;
