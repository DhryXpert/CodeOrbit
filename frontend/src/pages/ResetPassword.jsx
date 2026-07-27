import { useState, useEffect } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import robotImg from '../assets/robo_dark.webp';
import robotLightImg from '../assets/robo_ligth.webp';
import logoImg from '../assets/logo.webp';
import { useTheme } from '../context/ThemeContext';
import { Eye, EyeOff } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/Auth.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [oobCode, setOobCode] = useState(null);
  const [verifyingCode, setVerifyingCode] = useState(true);
  const [codeError, setCodeError] = useState('');

  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Extract and verify action code (oobCode) from the URL
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const code = queryParams.get('oobCode');
    
    if (!code) {
      setCodeError('No password reset code found in the link.');
      setVerifyingCode(false);
      return;
    }

    setOobCode(code);

    // Verify the password reset code using Firebase Auth
    verifyPasswordResetCode(auth, code)
      .then(() => {
        setVerifyingCode(false);
      })
      .catch((err) => {
        console.error('Failed to verify reset code:', err);
        setCodeError('The password reset link is invalid, expired, or has already been used.');
        setVerifyingCode(false);
      });
  }, [location]);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 6) {
      setSubmitError('Password should be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Confirm reset in Firebase Auth
      await confirmPasswordReset(auth, oobCode, password);

      // 2. Sync password reset in backend database
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const backendUrl = isLocalhost ? 'http://localhost:3000' : (import.meta.env.VITE_BACKEND_URL || '');

      const response = await fetch(`${backendUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode, newPassword: password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update password in custom database.');
      }

      setSuccess(true);
      
      // Redirect user to login page after confirmation
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Error resetting password:', err);
      setSubmitError(`Reset failed: ${err.message}`);
    } finally {
      setSubmitting(false);
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
            Reset Password
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
            Set a new, secure password for your account.
          </p>

          {verifyingCode ? (
            <p style={{ color: 'var(--text-secondary)' }}>Verifying secure reset link...</p>
          ) : codeError ? (
            <div>
              <div className="auth-error" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', textAlign: 'center' }}>
                {codeError}
              </div>
              <div className="auth-footer" style={{ marginTop: '24px' }}>
                Go back to <Link to="/" className="auth-link">Login</Link>
              </div>
            </div>
          ) : success ? (
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
              Password reset successful! Redirecting to login...
            </div>
          ) : (
            <form className="auth-form" onSubmit={handlePasswordReset}>
              {submitError && <div className="auth-error">{submitError}</div>}

              <div className="auth-input-group">
                <label className="auth-input-label">New Password</label>
                <div className="auth-password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="password-toggle-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label">Confirm New Password</label>
                <div className="auth-password-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                    className="password-toggle-btn"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={submitting}>
                {submitting ? 'Resetting password...' : 'Reset Password'}
              </button>
            </form>
          )}

          {!success && !verifyingCode && !codeError && (
            <div className="auth-footer" style={{ marginTop: '24px' }}>
              Cancel and return to <Link to="/" className="auth-link">Login</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
