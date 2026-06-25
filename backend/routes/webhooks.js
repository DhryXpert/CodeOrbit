const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebaseAdmin');
const { getPRDiffs, postPRComment } = require('../services/githubService');
const { generateReview } = require('../services/aiService');
const { encrypt, decrypt } = require('../services/cryptoService');
const authenticateToken = require('../middleware/auth');

// --- GITHUB WEBHOOK RECEIVER ---
router.post('/github', async (req, res) => {
  try {
    if (req.headers['x-github-event'] !== 'pull_request') {
      return res.status(200).send('Ignored: Not a PR event');
    }

    const { action, pull_request, repository } = req.body;
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return res.status(200).send(`Ignored: Action is ${action}`);
    }

    const repoFullName = repository.full_name;
    const prNumber = pull_request.number;

    const snapshot = await db.collection('tracking_sessions')
      .where('repoFullName', '==', repoFullName)
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) return res.status(200).send('Ignored: Repo not tracked');

    let validSession = null;
    let validSessionId = null;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (new Date(data.endDate) > new Date()) {
        validSession = data;
        validSessionId = doc.id;
      }
    });

    if (!validSession?.githubToken) return res.status(500).send('Missing GitHub Token');

    const githubToken = decrypt(validSession.githubToken);
    res.status(202).send('Accepted for processing');

    // Process in background
    (async () => {
      const diffs = await getPRDiffs(repoFullName, prNumber, githubToken);
      if (diffs.includes('Pas de patch disponible') && diffs.split('---').length <= 2) return;

      const aiReviewText = await generateReview(diffs);
      await postPRComment(repoFullName, prNumber, aiReviewText, githubToken);

      if (validSessionId) {
        await db.collection('tracking_sessions').doc(validSessionId).update({
          prsReviewed: admin.firestore.FieldValue.increment(1)
        });
      }
    })().catch(err => console.error("Webhook processing error:", err));

  } catch (error) {
    console.error("Webhook route error:", error);
    if (!res.headersSent) res.status(500).send('Internal Server Error');
  }
});

// --- SETUP WEBHOOK ---
router.post('/setup', authenticateToken, async (req, res) => {
  const { repoFullName, repoId, durationDays } = req.body;
  if (!repoFullName) return res.status(400).json({ error: 'Missing repository name!' });

  try {
    const tokenDoc = await db.collection('user_github_tokens').doc(req.user.userId).get();
    if (!tokenDoc.exists) return res.status(400).json({ error: 'GitHub not linked' });

    const token = decrypt(tokenDoc.data().encryptedToken);
    const webhookBase = process.env.WEBHOOK_BASE_URL || `${req.protocol}://${req.get('host')}`;

    const response = await fetch(`https://api.github.com/repos/${repoFullName}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['pull_request'],
        config: { url: `${webhookBase}/api/webhooks/github`, content_type: 'json', insecure_ssl: '0' }
      })
    });

    const data = await response.json();
    if (!response.ok && !(response.status === 422 && data.errors?.[0]?.message?.includes('already exists'))) {
      throw new Error(data.message || 'GitHub webhook error');
    }

    const duration = durationDays ? parseInt(durationDays) : 7;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    await db.collection('tracking_sessions').add({
      userId: req.user.userId,
      repoFullName,
      repoId: repoId ? parseInt(repoId) : null,
      durationDays: duration,
      endDate: endDate.toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      githubToken: encrypt(token),
      prsReviewed: 0
    });

    res.json({ message: 'Webhook registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to setup webhook' });
  }
});

// --- GET ACTIVE TRACKERS ---
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('tracking_sessions')
      .where('userId', '==', req.user.userId)
      .where('isActive', '==', true)
      .get();

    const trackers = [];
    snapshot.forEach(doc => trackers.push({ id: doc.id, ...doc.data() }));
    res.json(trackers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active trackers' });
  }
});

// --- STOP TRACKER ---
router.post('/stop', authenticateToken, async (req, res) => {
  const { trackerId } = req.body;
  if (!trackerId) return res.status(400).json({ error: 'Missing tracker ID!' });

  try {
    await db.collection('tracking_sessions').doc(trackerId).update({ isActive: false });
    res.json({ message: 'Stopped tracking successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop tracking' });
  }
});

module.exports = router;
