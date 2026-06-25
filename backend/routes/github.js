const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { encrypt, decrypt } = require('../services/cryptoService');
const authenticateToken = require('../middleware/auth');

router.post('/link', authenticateToken, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'GitHub token is required' });

  try {
    await db.collection('user_github_tokens').doc(req.user.userId).set({
      encryptedToken: encrypt(token),
      linkedAt: new Date().toISOString(),
      userId: req.user.userId
    });
    res.json({ success: true, message: 'Linked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to link GitHub account' });
  }
});

router.get('/repos', authenticateToken, async (req, res) => {
  try {
    const tokenDoc = await db.collection('user_github_tokens').doc(req.user.userId).get();
    if (!tokenDoc.exists) return res.status(404).json({ error: 'GitHub account not linked', linked: false });

    const githubToken = decrypt(tokenDoc.data().encryptedToken);
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' }
    });

    if (!response.ok) {
      if (response.status === 401) {
        await db.collection('user_github_tokens').doc(req.user.userId).delete();
        return res.status(401).json({ error: 'Token expired. Reconnect.', linked: false });
      }
      throw new Error(`GitHub error: ${response.status}`);
    }

    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const tokenDoc = await db.collection('user_github_tokens').doc(req.user.userId).get();
    res.json({ linked: tokenDoc.exists });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

router.post('/unlink', authenticateToken, async (req, res) => {
  try {
    await db.collection('user_github_tokens').doc(req.user.userId).delete();
    res.json({ success: true, message: 'Unlinked GitHub account' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink GitHub account' });
  }
});

module.exports = router;
