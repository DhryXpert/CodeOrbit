import { useState } from 'react';
import { LogOut, Link2Off, Sun, Moon, Mail } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import logoImg from '../assets/logo.webp';

export default function Sidebar({ 
  user, 
  hasGithubToken, 
  handleUnlinkGithub, 
  handleLogout, 
  sidebarOpen, 
  githubAvatarUrl,
  runningTrackers = [] 
}) {
  const { theme, toggleTheme } = useTheme();
  const [avatarError, setAvatarError] = useState(false);

  const getInitials = () => {
    if (!user) return 'CO';
    const name = user.displayName || user.email || '';
    if (!name) return 'CO';
    const parts = name.split(/[@\s]/);
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';
    return (first + second).toUpperCase() || 'CO';
  };

  const avatarSrc = !avatarError && (githubAvatarUrl || user.photoURL);
  const totalReviews = runningTrackers.reduce((acc, t) => acc + (t.prsReviewed || 0), 0);

  return (
    <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <img src={logoImg} alt="CodeOrbit Logo" className="brand-logo" />
        <span className="brand-name">CodeOrbit</span>
      </div>
      
      <div className="sidebar-profile">
        {avatarSrc ? (
          <img 
            src={avatarSrc} 
            alt="Profile" 
            onError={() => setAvatarError(true)}
            className="sidebar-avatar-img"
          />
        ) : (
          <div className="sidebar-avatar-initials">
            {getInitials()}
          </div>
        )}
        <span className="sidebar-username">{user.displayName || user.email}</span>
      </div>
      
      <div className="sidebar-menu">
        {hasGithubToken && (
          <button onClick={handleUnlinkGithub} className="sidebar-menu-btn unlink-btn" title="Unlink GitHub">
            <Link2Off size={20} />
            <span>Unlink GitHub</span>
          </button>
        )}

        <button onClick={toggleTheme} className="sidebar-menu-btn theme-btn" title="Toggle Theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <hr className="sidebar-menu-divider" />

        <button onClick={handleLogout} className="sidebar-menu-btn logout-btn" title="Sign Out">
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>

      {hasGithubToken && runningTrackers.length > 0 && (
        <div className="sidebar-stats-card">
          <div className="sidebar-stat-item">
            <span className="sidebar-stat-value">{runningTrackers.length}</span>
            <span className="sidebar-stat-label">Repos Tracked</span>
          </div>
          <div className="sidebar-stat-item">
            <span className="sidebar-stat-value">{totalReviews}</span>
            <span className="sidebar-stat-label">Reviews Posted</span>
          </div>
        </div>
      )}
      
      <div className="sidebar-footer">
        <hr className="sidebar-divider" />
        <p className="footer-quote">Never miss your next win. ✌️</p>
        
        <div className="footer-socials">
          <a href="https://github.com/DhryXpert" target="_blank" rel="noopener noreferrer" title="GitHub">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.022A9.606 9.606 0 0112 6.82c.85.004 1.705.114 2.504.336 1.909-1.29 2.747-1.022 2.747-1.022.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          </a>
          <a href="mailto:dhairyakhatri83@gmail.com" title="Email">
            <Mail size={18} />
          </a>
        </div>
        
        <p className="footer-built">Built with joy by Dhairya</p>
        <p className="footer-copyright">© 2025-2026 CodeOrbit.com</p>
      </div>
    </aside>
  );
}
