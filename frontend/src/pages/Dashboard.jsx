import { useState } from 'react';
import { Menu } from 'lucide-react';
import RepoSelector from '../components/RepoSelector';
import ActiveTrackers from '../components/ActiveTrackers';
import Sidebar from '../components/Sidebar';
import { useDashboard } from '../hooks/useDashboard';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
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
  } = useDashboard();

  if (!user) {
    return (
      <div className="dashboard-loading">
        Welcome to CodeOrbit! Loading dashboard...
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Mobile Sidebar Toggle Hamburger Button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)} 
        className="sidebar-toggle-btn"
        title="Toggle Sidebar"
        aria-label="Toggle Sidebar"
      >
        <Menu size={24} />
      </button>

      {/* Dim overlay to close sidebar on click outside on mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
<h1>Welcome Users</h1>
      <Sidebar
        user={user}
        hasGithubToken={hasGithubToken}
        handleUnlinkGithub={handleUnlinkGithub}
        handleLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        githubAvatarUrl={githubAvatarUrl}
        runningTrackers={runningTrackers}
      />

      <main className="dashboard-content">
        <div className="dashboard-grid">
          <RepoSelector
            hasGithubToken={hasGithubToken}
            loading={loading}
            availableRepos={availableRepos}
            totalReposCount={repos?.length || 0}
            selectedRepo={selectedRepo}
            setSelectedRepo={setSelectedRepo}
            duration={duration}
            setDuration={setDuration}
            onConnectGithub={handleConnectGithub}
            onStartTracking={handleStartTracking}
          />

          <ActiveTrackers
            runningTrackers={runningTrackers}
            onStopTracking={handleStopTracking}
          />
        </div>
      </main>
    </div>
  );
}
