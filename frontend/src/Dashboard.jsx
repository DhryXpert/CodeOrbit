import React, { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { LogOut, Activity, Github, Clock, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [duration, setDuration] = useState(7);
  const [activeTrackers, setActiveTrackers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchRepos();
        fetchActiveTrackers(currentUser.uid);
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchRepos = async () => {
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
  };

  const fetchActiveTrackers = async (uid) => {
    try {
      const q = query(collection(db, "tracking_sessions"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const trackers = [];
      querySnapshot.forEach((doc) => {
        trackers.push({ id: doc.id, ...doc.data() });
      });
      setActiveTrackers(trackers);
    } catch (error) {
      console.error("Error fetching trackers:", error);
    }
  };

  const handleStartTracking = async () => {
    if (!selectedRepo) return;
    
    try {
      const token = localStorage.getItem('github_token');
      // Calculate end date based on duration
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + parseInt(duration));

      const sessionData = {
        userId: user.uid,
        repoFullName: selectedRepo.full_name,
        repoId: selectedRepo.id,
        durationDays: parseInt(duration),
        endDate: endDate.toISOString(),
        createdAt: serverTimestamp(),
        isActive: true,
        githubToken: token
      };

      // 1. Save to Firestore
      await addDoc(collection(db, 'tracking_sessions'), sessionData);
      
      // 2. Call our backend to setup the webhook programmatically
      await fetch('https://your-backend-url.onrender.com/api/webhooks/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: selectedRepo.full_name, token })
      });

      alert(`Successfully started tracking ${selectedRepo.name} for ${duration} days!`);
      setSelectedRepo(null);
      fetchActiveTrackers(user.uid);
    } catch (error) {
      console.error("Error starting tracker:", error);
      alert("Failed to start tracking. See console.");
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem('github_token');
    navigate('/');
  };

  if (!user || loading) return <div className="app-container text-gradient" style={{ textAlign: 'center', marginTop: '100px', fontSize: '1.2rem' }}>Loading your repositories...</div>;

  return (
    <div className="app-container animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={user.photoURL} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--accent-primary)' }} />
          Welcome, {user.displayName || user.email}
        </h2>
        <button onClick={handleLogout} className="btn-primary" style={{ background: 'transparent', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Repository Selection */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Github size={24} color="var(--accent-hover)" />
            <h3>Select a Repository</h3>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px', marginBottom: '24px' }}>
            {repos.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No repositories found.</p>
            ) : (
              repos.map(repo => (
                <div 
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo)}
                  style={{
                    padding: '16px',
                    marginBottom: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: selectedRepo?.id === repo.id ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                    background: selectedRepo?.id === repo.id ? 'rgba(109, 40, 217, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '4px' }}>{repo.name}</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {repo.private ? '🔒 Private' : '🌍 Public'} • Updated {new Date(repo.updated_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>

          {selectedRepo && (
            <div className="animate-fade-in" style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ marginBottom: '16px' }}>Configure Tracker</h4>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  Tracking Duration (Days)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input 
                    type="range" 
                    min="1" 
                    max="30" 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontWeight: 'bold', width: '60px', textAlign: 'right' }}>{duration} days</span>
                </div>
              </div>
              <button onClick={handleStartTracking} className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Clock size={18} /> Start Auto-Review
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Active Trackers */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Activity size={24} color="var(--success)" />
            <h3>Active Trackers</h3>
          </div>
          
          {activeTrackers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <CheckCircle size={48} opacity={0.2} style={{ margin: '0 auto 16px' }} />
              <p>You don't have any active repository trackers.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Select a repository on the left to begin.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeTrackers.map(tracker => {
                const endDate = new Date(tracker.endDate);
                const isActive = endDate > new Date();
                
                return (
                  <div key={tracker.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{tracker.repoFullName}</strong>
                      {isActive ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                          <span className="status-indicator"></span> Active
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px' }}>Expired</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
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
