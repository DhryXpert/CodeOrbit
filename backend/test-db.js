require('dotenv').config();
const { db } = require('./firebaseAdmin');

async function checkSessions() {
  try {
    console.log("Checking Firestore for tracking sessions...");
    const snapshot = await db.collection('tracking_sessions').get();
    
    if (snapshot.empty) {
      console.log("No tracking sessions found in the database at all!");
      process.exit(0);
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nSession ID: ${doc.id}`);
      console.log(`- Repo: ${data.repoFullName}`);
      console.log(`- Active: ${data.isActive}`);
      console.log(`- End Date: ${data.endDate}`);
      console.log(`- Token exists: ${!!data.githubToken}`);
      
      const isExpired = new Date(data.endDate) <= new Date();
      console.log(`- Is Expired?: ${isExpired}`);
    });
    
  } catch (err) {
    console.error("Error reading database:", err);
  } finally {
    process.exit(0);
  }
}

checkSessions();
