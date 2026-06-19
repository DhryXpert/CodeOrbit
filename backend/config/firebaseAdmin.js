require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin with Service Account
// We parse the private key to handle newline characters correctly from the .env file
const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (process.env.FIREBASE_PROJECT_ID && privateKey) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey
    })
  });
  console.log("Firebase Admin Initialized Successfully");
} else {
  console.warn("Firebase Admin NOT initialized! Please set FIREBASE_PROJECT_ID and FIREBASE_PRIVATE_KEY in your .env file.");
}

const db = admin.firestore ? admin.firestore() : null;

module.exports = { admin, db };
