import { useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useNavigate, Link } from 'react-router-dom';
import robotImg from '../assets/robo_dark.webp';
import robotLightImg from '../assets/robo_ligth.webp';
import logoImg from '../assets/logo.webp';
import { useTheme } from '../context/ThemeContext';
import { Eye, EyeOff } from 'lucide-react';
import '../styles/Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const backendUrl = isLocalhost ? 'http://localhost:3000' : (import.meta.env.VITE_BACKEND_URL || '');

      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Login failed with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Store custom JWT access and refresh tokens
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('user_profile', JSON.stringify(data.user));

      // Sign into Firebase Auth using the custom token to preserve client-side Firestore access
      if (data.firebaseCustomToken) {
        await signInWithCustomToken(auth, data.firebaseCustomToken);
      }

      navigate('/dashboard');
    } catch (err) {
      console.error("Error during login:", err.message);
      setError(`Login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-container animate-fade-in">
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

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleEmailLogin}>
            <div className="auth-input-group">
              <label className="auth-input-label">Email</label>
              <input 
                type="email" 
                className="auth-input" 
                placeholder="Input your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            
            <div className="auth-input-group">
              <label className="auth-input-label">Password</label>
              <div className="auth-password-wrapper">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="auth-input" 
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
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

            <div className="auth-form-options">
              <a href="#" className="auth-link" style={{ marginLeft: 'auto' }}>Forgot Password?</a>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>


          <div className="auth-footer">
            Don't have an account? <Link to="/signup" className="auth-link">Sign Up</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
