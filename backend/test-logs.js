require('dotenv').config();
const { db } = require('./firebaseAdmin');

async function readLogs() {
  try {
    const snapshot = await db.collection('webhook_logs').orderBy('timestamp', 'desc').limit(5).get();
    if (snapshot.empty) {
      console.log("No logs found yet. Waiting for a webhook...");
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`[${data.timestamp.toDate().toISOString()}] ${data.repoFullName} PR#${data.prNumber} -> ${data.status}`);
        if (data.errorMessage) console.log(`   ERROR: ${data.errorMessage}`);
      });
    }
  } catch (err) {
    console.error("Failed to read logs:", err);
  } finally {
    process.exit(0);
  }
}

readLogs();
