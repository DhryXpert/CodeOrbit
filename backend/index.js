const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { admin, db } = require('./firebaseAdmin');

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI PR Reviewer Backend is running!' });
});

// Direct root /health for uptime monitors (like Render / UptimeRobot)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const { getPRDiffs, postPRComment } = require('./githubService');
const { generateReview } = require('./aiService');

// GitHub Webhook Endpoint
app.post('/api/webhooks/github', async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    
    // We only care about pull requests
    if (event !== 'pull_request') {
      return res.status(200).send('Ignored: Not a PR event');
    }

    const { action, pull_request, repository } = req.body;
    
    // We only want to review when PR is opened or new commits are pushed (synchronize)
    if (!['opened', 'synchronize'].includes(action)) {
      return res.status(200).send(`Ignored: Action is ${action}`);
    }

    const repoFullName = repository.full_name;
    const prNumber = pull_request.number;

    console.log(`Received PR event for ${repoFullName} #${prNumber}`);

    // 1. Check if this repository is actively tracked in Firestore
    const sessionsRef = db.collection('tracking_sessions');
    const snapshot = await sessionsRef
      .where('repoFullName', '==', repoFullName)
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) {
      console.log('No active tracking session found for this repo.');
      return res.status(200).send('Ignored: Repo not tracked');
    }

    // Since multiple users could track the same repo, we'll just grab the first valid one
    // In a production app, you might want more sophisticated logic.
    let validSession = null;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (new Date(data.endDate) > new Date()) {
        validSession = data;
      }
    });

    if (!validSession) {
      console.log('Tracking session expired.');
      return res.status(200).send('Ignored: Tracking expired');
    }

    const githubToken = validSession.githubToken;
    if (!githubToken) {
      console.error('Session found but missing githubToken!');
      return res.status(500).send('Missing GitHub Token in DB');
    }

    // Send a response back to GitHub immediately so we don't timeout
    // the webhook while the AI processes it.
    res.status(202).send('Accepted for processing');

    // --- Start Background Processing ---
    console.log('Fetching diffs...');
    const diffs = await getPRDiffs(repoFullName, prNumber, githubToken);
    
    if (diffs.includes('Pas de patch disponible') && diffs.split('---').length <= 2) {
      console.log('No actual code changes found.');
      return;
    }

    console.log('Generating AI Review with Gemini...');
    const aiReviewText = await generateReview(diffs);

    console.log('Posting review to GitHub...');
    await postPRComment(repoFullName, prNumber, aiReviewText, githubToken);

    console.log('AI Review posted successfully!');

  } catch (error) {
    console.error("Webhook Error:", error);
    // If we haven't sent a response yet, send a 500
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});

// Setup Webhook Programmatically on GitHub
app.post('/api/webhooks/setup', async (req, res) => {
  const { repoFullName, token } = req.body;

  if (!repoFullName || !token) {
    return res.status(400).json({ error: 'Missing repository name or token' });
  }

  try {
    const url = `https://api.github.com/repos/${repoFullName}/hooks`;
    const backendWebhookUrl = `https://github-pr-reviewer.onrender.com/api/webhooks/github`;

    console.log(`Setting up webhook for ${repoFullName} pointing to ${backendWebhookUrl}`);

    // Create the webhook on GitHub
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
      // If the webhook already exists, GitHub returns a 422. We can treat this as a success.
      if (response.status === 422 && data.errors && data.errors[0].message.includes('already exists')) {
        console.log('Webhook already exists for this repository.');
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
