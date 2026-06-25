import { Activity, CheckCircle, X } from 'lucide-react';

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function ActiveTrackers({ runningTrackers, onStopTracking }) {
  return (
    <div className="glass-panel dashboard-panel">
      <div className="dashboard-panel-title">
        <Activity size={24} color="var(--success)" />
        <h3>Active Trackers</h3>
      </div>
      
      {runningTrackers.length === 0 ? (
        <div className="dashboard-empty-container">
          <div className="dashboard-empty-state">
            <CheckCircle size={48} opacity={0.2} className="dashboard-empty-icon" />
            <p>You don't have any active repository trackers.</p>
            <p className="dashboard-empty-subtext">Select a repository on the left to begin.</p>
          </div>

          <div className="dashboard-tracker-preview">
            <span className="dashboard-preview-tag">Example Preview</span>
            <div className="dashboard-tracker-card skeleton">
              <div className="dashboard-tracker-header">
                <strong className="dashboard-tracker-name">example-repo</strong>
                <div className="dashboard-tracker-actions">
                  <span className="status-badge active skeleton-badge">
                    <span className="status-indicator"></span> Active
                  </span>
                </div>
              </div>
              <p className="dashboard-tracker-meta">
                Reviewing all PRs until 31/12/2026
              </p>
              <div className="dashboard-tracker-progress-container skeleton-progress">
                <div className="dashboard-tracker-progress-bar" style={{ width: '45%' }} />
              </div>
              <div className="dashboard-tracker-stats">
                <span>12 PRs reviewed</span>
                <span>45% completed</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard-trackers-list">
          {runningTrackers.map(tracker => {
            const endDate = new Date(tracker.endDate);
            
            // Calculate start date: either from tracker.createdAt or fallback using durationDays
            const start = tracker.createdAt 
              ? (typeof tracker.createdAt === 'string' 
                  ? new Date(tracker.createdAt) 
                  : (tracker.createdAt.seconds 
                      ? new Date(tracker.createdAt.seconds * 1000) 
                      : (tracker.createdAt._seconds 
                          ? new Date(tracker.createdAt._seconds * 1000) 
                          : new Date()
                        )
                    )
                )
              : new Date(new Date(tracker.endDate).getTime() - (tracker.durationDays || 7) * 24 * 60 * 60 * 1000);
            
            const end = new Date(tracker.endDate);
            const now = new Date();
            const total = end.getTime() - start.getTime();
            const elapsed = now.getTime() - start.getTime();
            const percent = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
            
            const displayName = tracker.repoFullName.split('/').pop();

            return (
              <div key={tracker.id} className="dashboard-tracker-card">
                <div className="dashboard-tracker-header">
                  <strong className="dashboard-tracker-name" title={tracker.repoFullName}>
                    {displayName}
                  </strong>
                  <div className="dashboard-tracker-actions">
                    <span className="status-badge active">
                      <span className="status-indicator"></span> Active
                    </span>
                    <button 
                      onClick={() => onStopTracking(tracker.id, tracker.repoFullName)}
                      className="dashboard-stop-tracking-btn"
                      title="Stop Tracking"
                      aria-label="Stop Tracking"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <p className="dashboard-tracker-meta">
                  Reviewing all PRs until {formatDate(endDate)}
                </p>
                
                <div className="dashboard-tracker-progress-container">
                  <div 
                    className="dashboard-tracker-progress-bar" 
                    style={{ width: `${percent}%` }} 
                  />
                </div>
                <div className="dashboard-tracker-stats">
                  <span>{tracker.prsReviewed || 0} PRs reviewed</span>
                  <span>{Math.round(percent)}% completed</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
