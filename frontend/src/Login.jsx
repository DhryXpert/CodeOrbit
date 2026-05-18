import React from 'react';
import { signInWithPopup, GithubAuthProvider } from 'firebase/auth';
import { auth, githubProvider } from './firebase';
import { Github, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  const handleGitHubLogin = async () => {
    try {
      const result = await signInWithPopup(auth, githubProvider);
      // This gives you a GitHub Access Token. You can use it to access the GitHub API.
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      
      // The signed-in user info.
      const user = result.user;
      
      console.log("Logged in!", user.displayName);
      // Save token securely (e.g. in context or local storage for the session)
      localStorage.setItem('github_token', token);
      
      navigate('/dashboard');
    } catch (error) {
      console.error("Error during login:", error.message);
      alert(`Login failed: ${error.message}`);
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '48px', textAlign: 'center', maxWidth: '440px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '50%', border: '1px solid var(--glass-border)' }}>
            <Sparkles size={32} color="var(--accent-hover)" />
          </div>
        </div>
        
        <h1 style={{ marginBottom: '12px', fontSize: '2rem' }}>AI PR Reviewer</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '1.1rem' }}>
          Automate your code reviews with Google Gemini. Connect your repository to get started.
        </p>
        
        <button className="btn-primary" onClick={handleGitHubLogin} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Github size={20} />
          Continue with GitHub
        </button>
        
        <p style={{ color: 'var(--text-secondary)', marginTop: '24px', fontSize: '0.85rem', opacity: 0.7 }}>
          By continuing, you grant access to read your repositories and post PR comments.
        </p>
      </div>
    </div>
  );
}
