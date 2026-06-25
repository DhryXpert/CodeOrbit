import { useState } from 'react';
import { Clock } from 'lucide-react';

const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  PHP: '#4F5D95',
  Shell: '#89e051',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Objective: '#438eff',
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function RepoSelector({
  hasGithubToken,
  loading,
  availableRepos,
  totalReposCount,
  selectedRepo,
  setSelectedRepo,
  duration,
  setDuration,
  onConnectGithub,
  onStartTracking
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRepos = availableRepos.filter(repo =>
    repo.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
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
        <h3>
          Select a Repository
          {hasGithubToken && !loading && ` (${filteredRepos.length} of ${totalReposCount})`}
        </h3>
      </div>

      {hasGithubToken && !loading && availableRepos.length > 0 && (
        <div className="dashboard-search-container">
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field dashboard-search-input"
          />
        </div>
      )}
      
      <div className="dashboard-repo-list">
        {!hasGithubToken ? (
          <div className="dashboard-empty-state">
            <p className="dashboard-empty-text">You need to connect your GitHub account to view repositories.</p>
            <button 
              onClick={onConnectGithub} 
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
        ) : availableRepos.length === 0 ? (
          <p className="dashboard-no-repos">All repositories are currently being tracked.</p>
        ) : filteredRepos.length === 0 ? (
          <p className="dashboard-no-repos">No repositories match your search.</p>
        ) : (
          filteredRepos.map(repo => {
            const isSelected = selectedRepo?.id === repo.id;
            return (
              <div 
                key={repo.id}
                onClick={() => setSelectedRepo(isSelected ? null : repo)}
                className={`dashboard-repo-item ${isSelected ? 'selected' : ''}`}
              >
                <strong className="dashboard-repo-name" title={repo.full_name}>{repo.name}</strong>
                <span className="dashboard-repo-meta">
                  <span className="repo-visibility">{repo.private ? '🔒 Private' : '🌍 Public'}</span>
                  {repo.language && (
                    <>
                      <span className="meta-separator">•</span>
                      <span className="repo-lang">
                        <span 
                          className="repo-lang-dot" 
                          style={{ backgroundColor: LANGUAGE_COLORS[repo.language] || '#8b5cf6' }} 
                        />
                        {repo.language}
                      </span>
                    </>
                  )}
                  <span className="meta-separator">•</span>
                  <span>Updated {formatDate(repo.updated_at)}</span>
                </span>

                {isSelected && (
                  <div 
                    className="animate-fade-in dashboard-config-box"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                    <div className="dashboard-config-actions">
                      <button onClick={onStartTracking} className="btn-primary dashboard-start-tracking-btn">
                        <Clock size={18} /> Start Auto-Review
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRepo(null);
                        }} 
                        className="btn-secondary dashboard-cancel-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
