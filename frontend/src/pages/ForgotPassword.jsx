import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { Link } from 'react-router-dom';
import robotImg from '../assets/robo_dark.webp';
import robotLightImg from '../assets/robo_ligth.webp';
import logoImg from '../assets/logo.webp';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/Auth.css';

export default function ForgotPassword() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // Configuration telling Firebase where to redirect the user after they click the link
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSuccessMessage('The email reset link is send to your mail');
    } catch (err) {
      console.error('Password reset request failed:', err);
      setError(`Reset failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-container animate-fade-in">
      <ThemeToggle />
      <div className="auth-hero">
        <img
          src={theme === 'light' ? robotLightImg : robotImg}
          alt="AI Robot"
          className="auth-hero-image"
        />
      </div>

      <div className="auth-form-container">
        <div className="auth-form-wrapper">
          <div className="auth-brand">
            <img src={logoImg} alt="CodeOrbit Logo" className="auth-logo" />
            <h1 className="auth-title">CodeOrbit</h1>
          </div>
          <p className="auth-subtitle">Everything around your code ecosystem</p>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Forgot Password
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
            Enter your email address to receive a secure link to reset your password.
          </p>

          {error && <div className="auth-error">{error}</div>}
          
          {successMessage && (
            <div 
              style={{
                color: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '14px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '0.95rem',
                textAlign: 'center',
                fontWeight: 500
              }}
            >
              {successMessage}
            </div>
          )}

          {!successMessage && (
            <form className="auth-form" onSubmit={handleResetRequest}>
              <div className="auth-input-group">
                <label className="auth-input-label">Email</label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="Input your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? 'Sending link...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="auth-footer" style={{ marginTop: '24px' }}>
            Back to <Link to="/" className="auth-link">Login</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
