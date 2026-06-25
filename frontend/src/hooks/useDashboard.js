import { useEffect, useState } from 'react';
import { auth, githubProvider } from '../config/firebase';
import { linkWithPopup, GithubAuthProvider, unlink } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

// Helper to determine backend server URL based on current environment
const getBackendUrl = () => 
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : (import.meta.env.VITE_BACKEND_URL || '');

// Generic API Request wrapper that automatically injects JWT authorization token
async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${getBackendUrl()}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { status: res.status, message: err.error || 'API Error' };
  }
  return res.json();
}

export function useDashboard() {
  const navigate = useNavigate();

  // Load user profile from localStorage
  const [user] = useState(() => {
    const profileJson = localStorage.getItem('user_profile');
    return profileJson ? JSON.parse(profileJson) : null;
  });

  // State definitions for repositories, trackers, and UI loading
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [duration, setDuration] = useState(7);
  const [activeTrackers, setActiveTrackers] = useState([]);
  const [hasGithubToken, setHasGithubToken] = useState(false);
  const [githubAvatarUrl, setGithubAvatarUrl] = useState(null);

  // 1. Fetch active trackers from backend
  const loadActiveTrackers = () => 
    apiRequest('/api/webhooks/active')
      .then(setActiveTrackers)
      .catch(err => console.error("Error loading trackers:", err));

  // 2. Check if the user has a linked GitHub account in Firestore
  const checkGithubStatus = () => 
    apiRequest('/api/github/status')
      .then(data => setHasGithubToken(data.linked))
      .catch(err => console.error("Error checking GitHub status:", err));

  // 3. Fetch linked user's public repositories via backend proxy
  const fetchRepos = () => 
    apiRequest('/api/github/repos')
      .then(data => {
        // Filter out archived repositories
        const active = data.filter(r => !r.archived);
        setRepos(active);
        // Safely extract the user's GitHub avatar
        if (active.length > 0 && active[0].owner?.avatar_url) {
          setGithubAvatarUrl(active[0].owner.avatar_url);
        }
      })
      .catch(err => {
        console.error("Error fetching repos:", err);
        if (err.status === 401) setHasGithubToken(false);
      })
      .finally(() => setLoading(false));

  // Check auth and initial status on component mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !user) return navigate('/');
    checkGithubStatus();
    loadActiveTrackers();
  }, [navigate]);

  // Load user's repositories once GitHub connection status is verified
  useEffect(() => {
    if (hasGithubToken) fetchRepos();
    else setLoading(false);
  }, [hasGithubToken]);

  // Connect GitHub: Uses Firebase Popup Auth, then registers token on backend
  const handleConnectGithub = async () => {
    if (!auth.currentUser) return alert("Initializing authentication. Try again.");
    
    try {
      const result = await linkWithPopup(auth.currentUser, githubProvider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      const pat = credential?.accessToken;
      if (!pat) throw new Error("GitHub login did not return an access token.");

      // Link token on backend
      await apiRequest('/api/github/link', {
        method: 'POST',
        body: JSON.stringify({ token: pat })
      });
      setHasGithubToken(true);
    } catch (error) {
      console.error("GitHub link error:", error);
      
      // Fallback in case account/credential is already in use by Firebase
      const credential = GithubAuthProvider.credentialFromError(error);
      if (credential?.accessToken) {
        try {
          await apiRequest('/api/github/link', {
            method: 'POST',
            body: JSON.stringify({ token: credential.accessToken })
          });
          setHasGithubToken(true);
          return;
        } catch (linkErr) {
          alert(`Failed to register GitHub token: ${linkErr.message}`);
        }
      }
      alert(`Failed to connect GitHub: ${error.message}`);
    }
  };

  // Start tracking a repo: Sends setup instructions to backend
  const handleStartTracking = async () => {
    if (!selectedRepo) return;

    // Check if the selected repo is already tracked
    const isAlreadyTracking = activeTrackers.some(t => {
      const active = t.isActive !== false && new Date(t.endDate) > new Date();
      return t.repoFullName.toLowerCase() === selectedRepo.full_name.toLowerCase() && active;
    });

    if (isAlreadyTracking) return alert(`"${selectedRepo.name}" is already being tracked!`);
    
    try {
      await apiRequest('/api/webhooks/setup', {
        method: 'POST',
        body: JSON.stringify({ 
          repoFullName: selectedRepo.full_name, 
          repoId: selectedRepo.id,
          durationDays: duration
        })
      });
      alert(`Successfully started auto-reviewing ${selectedRepo.name}!`);
      setSelectedRepo(null);
      loadActiveTrackers();
    } catch (err) {
      alert(`Failed to start tracking: ${err.message}`);
    }
  };

  // Stop tracking a repo: Sends stop instructions to backend to delete webhooks
  const handleStopTracking = async (trackerId, repoFullName) => {
    const displayName = repoFullName.split('/').pop();
    if (!confirm(`Stop auto-reviewing ${displayName}?`)) return;

    try {
      await apiRequest('/api/webhooks/stop', {
        method: 'POST',
        body: JSON.stringify({ trackerId })
      });
      alert(`Stopped tracking ${displayName}.`);
      loadActiveTrackers();
    } catch (err) {
      alert(`Failed to stop tracking: ${err.message}`);
    }
  };

  // Clear local session data and sign out of Firebase
  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (e) {
      console.warn("Logout API failed:", e);
    }
    await auth.signOut();
    ['access_token', 'refresh_token', 'user_profile'].forEach(k => localStorage.removeItem(k));
    setHasGithubToken(false);
    navigate('/');
  };

  // Completely unlink GitHub credentials from both database and Firebase Provider
  const handleUnlinkGithub = async () => {
    if (!confirm("Are you sure you want to unlink GitHub completely? This will delete webhooks and stop auto-reviews.")) return;

    try {
      await apiRequest('/api/github/unlink', { method: 'POST' });

      if (auth.currentUser) {
        const githubProviderId = 'github.com';
        const isLinked = auth.currentUser.providerData.some(p => p.providerId === githubProviderId);
        if (isLinked) {
          await unlink(auth.currentUser, githubProviderId);
        }
      }

      setHasGithubToken(false);
      setRepos([]);
      setSelectedRepo(null);
      alert("GitHub account unlinked successfully.");
    } catch (err) {
      alert(`Failed to unlink GitHub: ${err.message || err}`);
    }
  };

  // Helper arrays for Dashboard rendering
  const runningTrackers = activeTrackers.filter(t => t.isActive !== false && new Date(t.endDate) > new Date());
  const activeTrackerRepoNames = new Set(runningTrackers.map(t => t.repoFullName.toLowerCase()));
  const availableRepos = repos.filter(r => !activeTrackerRepoNames.has(r.full_name.toLowerCase()));

  return {
    user,
    loading,
    repos,
    selectedRepo,
    setSelectedRepo,
    duration,
    setDuration,
    hasGithubToken,
    availableRepos,
    runningTrackers,
    handleConnectGithub,
    handleStartTracking,
    handleStopTracking,
    handleLogout,
    handleUnlinkGithub,
    githubAvatarUrl
  };
}
