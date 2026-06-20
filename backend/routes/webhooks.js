const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { admin, db } = require('../config/firebaseAdmin');
const { getPRDiffs, postPRComment } = require('../services/githubService');
const { generateReview } = require('../services/aiService');

const JWT_SECRET = process.env.JWT_SECRET || 'codeorbit-secret-key-123456';

// Middleware to check if user has sent a valid JWT access token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token is required!' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Your login session is invalid or expired!' });
    req.user = user;
    next();
  });
};

// --- GITHUB WEBHOOK RECEIVER ENDPOINT ---
router.post('/github', async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    if (event !== 'pull_request') return res.status(200).send('Ignored: Not a PR event');

    const { action, pull_request, repository } = req.body;
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return res.status(200).send(`Ignored: Action is ${action}`);
    }

    const repoFullName = repository.full_name;
    const prNumber = pull_request.number;
    console.log(`Received PR event for ${repoFullName} #${prNumber}`);

    // Check if this repository is actively tracked in Firestore
    const snapshot = await db.collection('tracking_sessions')
      .where('repoFullName', '==', repoFullName)
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) return res.status(200).send('Ignored: Repo not tracked');

    // Grab the first valid session that is not expired
    let validSession = null;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (new Date(data.endDate) > new Date()) {
        validSession = data;
      }
    });

    if (!validSession) return res.status(200).send('Ignored: Tracking expired');

    const githubToken = validSession.githubToken;
    if (!githubToken) return res.status(500).send('Missing GitHub Token in DB');

    res.status(202).send('Accepted for processing');

    // Run AI PR review processing in the background
    try {
      console.log('Fetching diffs from GitHub...');
      const diffs = await getPRDiffs(repoFullName, prNumber, githubToken);
      if (diffs.includes('Pas de patch disponible') && diffs.split('---').length <= 2) {
        console.log('No code changes found.');
        return;
      }

      console.log('Generating AI review comments using Gemini...');
      const aiReviewText = await generateReview(diffs);

      console.log('Posting review comment to GitHub...');
      await postPRComment(repoFullName, prNumber, aiReviewText, githubToken);
      console.log('AI Review posted successfully!');
    } catch (bgError) {
      console.error("Error processing webhook in background:", bgError);
    }
  } catch (error) {
    console.error("Webhook route error:", error);
    if (!res.headersSent) res.status(500).send('Internal Server Error');
  }
});

// --- PROGRAMMATICALLY SETUP GITHUB WEBHOOK ---
router.post('/setup', authenticateToken, async (req, res) => {
  const { repoFullName, token, repoId, durationDays } = req.body;
  if (!repoFullName || !token) return res.status(400).json({ error: 'Missing repository name or token!' });

  try {
    const url = `https://api.github.com/repos/${repoFullName}/hooks`;
    const webhookBase = process.env.WEBHOOK_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const backendWebhookUrl = `${webhookBase}/api/webhooks/github`;

    console.log(`Setting up webhook for ${repoFullName} pointing to ${backendWebhookUrl}`);

    const response = await fetch(url, {
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
        config: { url: backendWebhookUrl, content_type: 'json', insecure_ssl: '0' }
      })
    });

    const data = await response.json();
    if (!response.ok && !(response.status === 422 && data.errors?.[0]?.message?.includes('already exists'))) {
      throw new Error(data.message || 'GitHub API error');
    }

    // Save the tracking session to Firestore
    const endDate = new Date();
    const duration = durationDays ? parseInt(durationDays) : 7;
    endDate.setDate(endDate.getDate() + duration);

    const sessionData = {
      userId: req.user.userId,
      repoFullName,
      repoId: repoId ? parseInt(repoId) : null,
      durationDays: duration,
      endDate: endDate.toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      githubToken: token
    };

    await db.collection('tracking_sessions').add(sessionData);
    console.log(`Saved active tracking session for ${repoFullName} under user ${req.user.userId}`);
    res.status(200).json({ message: 'Webhook registered and tracking started successfully' });
  } catch (error) {
    console.error('Error setting up webhook:', error);
    res.status(500).json({ error: error.message || 'Failed to setup webhook' });
  }
});

// --- GET ACTIVE TRACKING SESSIONS FOR USER ---
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
    console.error('Error fetching active trackers:', error);
    res.status(500).json({ error: 'Failed to fetch active trackers' });
  }
});

// --- STOP TRACKING SESSION ---
router.post('/stop', authenticateToken, async (req, res) => {
  const { trackerId } = req.body;
  if (!trackerId) return res.status(400).json({ error: 'Missing tracker ID!' });

  try {
    await db.collection('tracking_sessions').doc(trackerId).update({ isActive: false });
    res.json({ message: 'Stopped tracking successfully' });
  } catch (error) {
    console.error('Error stopping tracker:', error);
    res.status(500).json({ error: 'Failed to stop tracking' });
  }
});

module.exports = router;
