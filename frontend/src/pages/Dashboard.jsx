import { useEffect, useState } from 'react';
import { auth, githubProvider } from '../config/firebase';
import { linkWithPopup, GithubAuthProvider } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { LogOut, Activity, Clock, CheckCircle, X } from 'lucide-react';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [user] = useState(() => {
    const profileJson = localStorage.getItem('user_profile');
    return profileJson ? JSON.parse(profileJson) : null;
  });
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [duration, setDuration] = useState(7);
  const [activeTrackers, setActiveTrackers] = useState([]);
  const [hasGithubToken, setHasGithubToken] = useState(!!localStorage.getItem('github_token'));
  const navigate = useNavigate();

  async function loadActiveTrackers() {
    try {
      const accessToken = localStorage.getItem('access_token');
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const backendUrl = isLocalhost ? 'http://localhost:3000' : (import.meta.env.VITE_BACKEND_URL || '');

      const response = await fetch(`${backendUrl}/api/webhooks/active`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setActiveTrackers(data);
      } else {
        console.error("Failed to fetch active trackers:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching trackers from backend:", error);
    }
  }

  async function fetchRepos() {
    const token = localStorage.getItem('github_token');
    if (!token) return;
    
    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Filter out archived repos
        setRepos(data.filter(r => !r.archived));
      }
    } catch (error) {
      console.error("Error fetching repos:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const profileJson = localStorage.getItem('user_profile');
    if (!token || !profileJson) {
      navigate('/');
      return;
    }

    if (hasGithubToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRepos();
    }

    // Load active trackers immediately on mount via the backend API
    loadActiveTrackers();
  }, [navigate, hasGithubToken]);

  const handleConnectGithub = async () => {
    if (!auth.currentUser) {
      alert("Firebase session is initializing. Please wait a moment and try again.");
      return;
    }

    try {
      const result = await linkWithPopup(auth.currentUser, githubProvider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('github_token', credential.accessToken);
        setHasGithubToken(true);
      }
    } catch (error) {
      console.error("Error linking GitHub account:", error);
      if (error.code === 'auth/credential-already-in-use') {
        const credential = GithubAuthProvider.credentialFromError(error);
        if (credential?.accessToken) {
          localStorage.setItem('github_token', credential.accessToken);
          setHasGithubToken(true);
          console.log("Retrieved GitHub token via credentialFromError successfully (account already linked).");
        } else {
          alert(`Failed to connect GitHub: ${error.message}`);
        }
      } else {
        alert(`Failed to connect GitHub: ${error.message}`);
      }
    }
  };





  const handleStartTracking = async () => {
    if (!selectedRepo) return;

    // Prevent duplicate tracking
    const isAlreadyTracking = activeTrackers.some(tracker => {
      const endDate = new Date(tracker.endDate);
      const isActive = tracker.isActive !== false && endDate > new Date();
      return tracker.repoFullName.toLowerCase() === selectedRepo.full_name.toLowerCase() && isActive;
    });

    if (isAlreadyTracking) {
      alert(`The repository "${selectedRepo.name}" is already being actively tracked!`);
      return;
    }
    
    try {
      const token = localStorage.getItem('github_token');
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const backendUrl = isLocalhost ? 'http://localhost:3000' : (import.meta.env.VITE_BACKEND_URL || '');
      const accessToken = localStorage.getItem('access_token');
      
      const response = await fetch(`${backendUrl}/api/webhooks/setup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          repoFullName: selectedRepo.full_name, 
          token,
          repoId: selectedRepo.id,
          durationDays: duration
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Webhook setup failed with status: ${response.status}`);
      }

      alert(`Successfully started tracking ${selectedRepo.name} for ${duration} days!`);
      setSelectedRepo(null);
      loadActiveTrackers();
    } catch (error) {
      console.error("Error starting tracker:", error);
      alert(`Failed to start tracking: ${error.message}. See console.`);
    }
  };

  const handleStopTracking = async (trackerId, repoFullName) => {
    if (!confirm(`Are you sure you want to stop tracking ${repoFullName}?`)) {
      return;
    }

    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const backendUrl = isLocalhost ? 'http://localhost:3000' : (import.meta.env.VITE_BACKEND_URL || '');
      const accessToken = localStorage.getItem('access_token');

      const response = await fetch(`${backendUrl}/api/webhooks/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ trackerId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to stop tracking: ${response.status}`);
      }

      alert(`Stopped tracking ${repoFullName}.`);
      loadActiveTrackers();
    } catch (error) {
      console.error("Error stopping tracker:", error);
      alert(`Failed to stop tracking: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const backendUrl = isLocalhost ? 'http://localhost:3000' : (import.meta.env.VITE_BACKEND_URL || '');
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        await fetch(`${backendUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        }).catch(err => console.warn("Failed to call backend logout:", err));
      }
    } catch (e) {
      console.error("Logout API call failed:", e);
    }

    await auth.signOut();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('github_token');
    setHasGithubToken(false);
    navigate('/');
  };

  if (!user) return <div className="app-container text-gradient dashboard-loading">Welcome to CodeOrbit! Loading dashboard...</div>;

  const runningTrackers = activeTrackers.filter(tracker => {
    const endDate = new Date(tracker.endDate);
    return tracker.isActive !== false && endDate > new Date();
  });

  const activeTrackerRepoNames = new Set(
    runningTrackers.map(tracker => tracker.repoFullName.toLowerCase())
  );

  const availableRepos = repos.filter(repo => !activeTrackerRepoNames.has(repo.full_name.toLowerCase()));

  return (
    <div className="app-container animate-fade-in">
      <header className="dashboard-header">
        <h2 className="dashboard-header-user">
          <img src={user.photoURL} alt="Profile" />
          Welcome, {user.displayName || user.email}
        </h2>
        <button onClick={handleLogout} className="btn-primary dashboard-logout-btn">
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      <div className="dashboard-grid">
        {/* Left Column: Repository Selection */}
        <div className="glass-panel dashboard-panel">
          <div className="dashboard-panel-title">
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="var(--accent-hover)" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="lucide lucide-github"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            <h3>Select a Repository</h3>
          </div>
          
          <div className="dashboard-repo-list">
            {!hasGithubToken ? (
              <div className="dashboard-empty-state">
                <p className="dashboard-empty-text">You need to connect your GitHub account to view repositories.</p>
                <button 
                  onClick={handleConnectGithub} 
                  className="btn-primary dashboard-connect-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.022A9.606 9.606 0 0112 6.82c.85.004 1.705.114 2.504.336 1.909-1.29 2.747-1.022 2.747-1.022.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  Connect to GitHub
                </button>
              </div>
            ) : loading ? (
              <div className="dashboard-loading-repos">
                <p>Loading your repositories...</p>
              </div>
            ) : repos.length === 0 ? (
              <p className="dashboard-no-repos">No repositories found.</p>
            ) : availableRepos.length === 0 ? (
              <p className="dashboard-no-repos">All repositories are currently being tracked.</p>
            ) : (
              availableRepos.map(repo => (
                <div 
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo)}
                  className={`dashboard-repo-item ${selectedRepo?.id === repo.id ? 'selected' : ''}`}
                >
                  <strong className="dashboard-repo-name">{repo.name}</strong>
                  <span className="dashboard-repo-meta">
                    {repo.private ? '🔒 Private' : '🌍 Public'} • Updated {new Date(repo.updated_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>

          {selectedRepo && (
            <div className="animate-fade-in dashboard-config-box">
              <h4 className="dashboard-config-title">Configure Tracker</h4>
              <div className="dashboard-config-group">
                <label className="dashboard-config-label">
                  Tracking Duration (Days)
                </label>
                <div className="dashboard-duration-container">
                  <input 
                    type="range" 
                    min="1" 
                    max="30" 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)}
                    className="dashboard-duration-slider"
                  />
                  <span className="dashboard-duration-text">{duration} days</span>
                </div>
              </div>
              <button onClick={handleStartTracking} className="btn-primary dashboard-start-tracking-btn">
                <Clock size={18} /> Start Auto-Review
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Active Trackers */}
        <div className="glass-panel dashboard-panel">
          <div className="dashboard-panel-title">
            <Activity size={24} color="var(--success)" />
            <h3>Active Trackers</h3>
          </div>
          
          {runningTrackers.length === 0 ? (
            <div className="dashboard-empty-state">
              <CheckCircle size={48} opacity={0.2} className="dashboard-empty-icon" />
              <p>You don't have any active repository trackers.</p>
              <p className="dashboard-empty-subtext">Select a repository on the left to begin.</p>
            </div>
          ) : (
            <div className="dashboard-trackers-list">
              {runningTrackers.map(tracker => {
                const endDate = new Date(tracker.endDate);
                
                return (
                  <div key={tracker.id} className="dashboard-tracker-card">
                    <div className="dashboard-tracker-header">
                      <strong className="dashboard-tracker-name">{tracker.repoFullName}</strong>
                      <div className="dashboard-tracker-actions">
                        <span className="status-badge active">
                          <span className="status-indicator"></span> Active
                        </span>
                        <button 
                          onClick={() => handleStopTracking(tracker.id, tracker.repoFullName)}
                          className="dashboard-stop-tracking-btn"
                          title="Stop Tracking"
                          aria-label="Stop Tracking"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="dashboard-tracker-meta">
                      Reviewing all PRs until {endDate.toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
