import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginLanguage, setLoginLanguage] = useState('en'); // Always default to English
  const { login } = useAuth();
  const { t, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी (Hindi)' },
    { code: 'ta', label: 'தமிழ் (Tamil)' },
  ];

  useEffect(() => {
    setLanguage('en');
    setLoginLanguage('en');
  }, [setLanguage]);

  const handleLanguageChange = (lang) => {
    setLoginLanguage(lang);
    setLanguage(lang);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const role = await login(email, password);
      navigate(role === 'admin' ? '/admin' : '/employee');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-language-row">
          <select
            value={loginLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="auth-language-select"
            aria-label="Select language"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="auth-header">
          <div className="auth-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#1B2A4A"/>
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>SkillSync</span>
          </div>
          <h1>{t('auth.welcome_back')}</h1>
          <p>{t('auth.sign_in_subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="input-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
            {loading ? t('auth.signing_in') : t('auth.sign_in')}
          </button>
        </form>

        <div className="auth-footer">
          <p>{t('auth.no_account')} <Link to="/register">{t('auth.create_account')}</Link></p>
        </div>

        <div className="auth-demo-info">
          <p><strong>{t('auth.demo_credentials')}</strong></p>
          <p>Admin: admin@skillsync.com / admin123</p>
          <p>Employee: rahulkumar@skillsync.com / emp123</p>
        </div>
      </div>
    </div>
  );
}
