const express = require('express');
const router = express.Router();

// Lightweight OAuth feature-detection endpoint.
// This does not implement full OAuth flows but reports whether providers are configured.
// If you later add passport/google or passport/github, replace these handlers with real redirects/callbacks.
router.get('/status', (req, res) => {
  const enabled = {
    google: !!(process.env.OAUTH_GOOGLE_CLIENT_ID && process.env.OAUTH_GOOGLE_CLIENT_SECRET),
    github: !!(process.env.OAUTH_GITHUB_CLIENT_ID && process.env.OAUTH_GITHUB_CLIENT_SECRET)
  };
  res.json({ enabled });
});

// Placeholder to start an OAuth flow; returns 501 if not configured.
router.get('/start/:provider', (req, res) => {
  const p = req.params.provider;
  if (p === 'google' && process.env.OAUTH_GOOGLE_CLIENT_ID && process.env.OAUTH_GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({ error: 'Google OAuth flow not yet implemented. Install and configure passport to enable.' });
  }
  if (p === 'github' && process.env.OAUTH_GITHUB_CLIENT_ID && process.env.OAUTH_GITHUB_CLIENT_SECRET) {
    return res.status(501).json({ error: 'GitHub OAuth flow not yet implemented. Install and configure passport to enable.' });
  }
  res.status(404).json({ error: 'Provider not configured' });
});

module.exports = router;
