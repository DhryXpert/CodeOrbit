const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebaseAdmin');
const { getPRDiffs, postPRComment } = require('../services/githubService');
const { generateReview } = require('../services/aiService');

const JWT_SECRET = process.env.JWT_SECRET || 'codeorbit-secret-key-123456';

// Simple middleware to check if user has sent a valid JWT access token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required!' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Your login session is invalid or expired!' });
    }
    req.user = user;
    next();
  });
};

// --- GITHUB WEBHOOK RECEIVER ENDPOINT ---
router.post('/github', async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    
    // We only care about pull request activities
    if (event !== 'pull_request') {
      return res.status(200).send('Ignored: Not a PR event');
    }

    const { action, pull_request, repository } = req.body;
    
    // We only want to trigger reviews on opened, reopened, or synchronised (new commits) PRs
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return res.status(200).send(`Ignored: Action is ${action}`);
    }

    const repoFullName = repository.full_name;
    const prNumber = pull_request.number;

    console.log(`Received PR event for ${repoFullName} #${prNumber}`);

    // Check if this repository is actively tracked in Firestore
    const sessionsRef = db.collection('tracking_sessions');
    const snapshot = await sessionsRef
      .where('repoFullName', '==', repoFullName)
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) {
      console.log('No active tracking session found for this repo.');
      return res.status(200).send('Ignored: Repo not tracked');
    }

    // Grab the first valid session that is not expired
    let validSession = null;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (new Date(data.endDate) > new Date()) {
        validSession = data;
      }
    });

    if (!validSession) {
      console.log('Tracking session has expired.');
      return res.status(200).send('Ignored: Tracking expired');
    }

    const githubToken = validSession.githubToken;
    if (!githubToken) {
      console.error('Session found but missing githubToken!');
      return res.status(500).send('Missing GitHub Token in DB');
    }

    // Send status 202 back immediately so GitHub webhook doesn't timeout
    res.status(202).send('Accepted for processing');

    // Run the AI PR review processing in the background
    try {
      console.log('Fetching diffs from GitHub...');
      const diffs = await getPRDiffs(repoFullName, prNumber, githubToken);
      
      if (diffs.includes('Pas de patch disponible') && diffs.split('---').length <= 2) {
        console.log('No code changes found.');
        await db.collection('webhook_logs').add({ 
          repoFullName, 
          prNumber, 
          status: 'ignored_no_patch', 
          timestamp: new Date() 
        });
        return;
      }

      console.log('Generating AI review comments using Gemini...');
      const aiReviewText = await generateReview(diffs);

      console.log('Posting review comment to GitHub...');
      await postPRComment(repoFullName, prNumber, aiReviewText, githubToken);

      console.log('AI Review posted successfully!');
      await db.collection('webhook_logs').add({ 
        repoFullName, 
        prNumber, 
        status: 'success', 
        timestamp: new Date() 
      });

    } catch (bgError) {
      console.error("Error processing webhook in background:", bgError);
      await db.collection('webhook_logs').add({ 
        repoFullName, 
        prNumber, 
        status: 'error', 
        errorMessage: bgError.message || bgError.toString(),
        timestamp: new Date() 
      });
    }

  } catch (error) {
    console.error("Webhook route error:", error);
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});

// --- PROGRAMMATICALLY SETUP GITHUB WEBHOOK ---
router.post('/setup', authenticateToken, async (req, res) => {
  const { repoFullName, token } = req.body;

  if (!repoFullName || !token) {
    return res.status(400).json({ error: 'Missing repository name or token!' });
  }

  try {
    const url = `https://api.github.com/repos/${repoFullName}/hooks`;
    const webhookBase = process.env.WEBHOOK_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const backendWebhookUrl = `${webhookBase}/api/webhooks/github`;

    console.log(`Setting up webhook for ${repoFullName} pointing to ${backendWebhookUrl}`);

    // Call GitHub API to register the webhook
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
        config: {
          url: backendWebhookUrl,
          content_type: 'json',
          insecure_ssl: '0'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Treat 'already exists' as a success to avoid breaking UX
      if (response.status === 422 && data.errors && data.errors[0].message.includes('already exists')) {
        console.log('Webhook already exists on this repository.');
        return res.status(200).json({ message: 'Webhook already active' });
      }
      throw new Error(data.message || 'GitHub API error');
    }

    console.log('Webhook created successfully on GitHub!');
    res.status(200).json({ message: 'Webhook registered successfully' });

  } catch (error) {
    console.error('Error setting up webhook:', error);
    res.status(500).json({ error: error.message || 'Failed to setup webhook' });
  }
});

module.exports = router;
