import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

const DEPARTMENTS = ['Production', 'Quality', 'Maintenance', 'HR'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
];

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'employee', company_name: '', job_role: '',
    department: 'Production', primary_language: 'en', known_languages: ['en'],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t, setLanguage } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    setLanguage('en');
  }, [setLanguage]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleKnownLangToggle = (langCode) => {
    setForm(prev => {
      const current = prev.known_languages || [];
      if (current.includes(langCode)) {
        // Don't allow removing primary_language
        if (langCode === prev.primary_language) return prev;
        return { ...prev, known_languages: current.filter(l => l !== langCode) };
      } else {
        return { ...prev, known_languages: [...current, langCode] };
      }
    });
  };

  const handlePrimaryLangChange = (e) => {
    const newPrimary = e.target.value;
    setForm(prev => {
      const known = prev.known_languages.includes(newPrimary)
        ? prev.known_languages
        : [...prev.known_languages, newPrimary];
      return { ...prev, primary_language: newPrimary, known_languages: known };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate known_languages includes primary_language
    if (!form.known_languages.includes(form.primary_language)) {
      setError(t('auth.validation_known_lang'));
      return;
    }

    setLoading(true);
    try {
      const role = await register(form);
      navigate(role === 'admin' ? '/admin' : '/employee');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ width: '500px' }}>
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#1B2A4A"/>
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>SkillSync</span>
          </div>
          <h1>{t('auth.create_account')}</h1>
          <p>{t('auth.get_started')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="input-group">
            <label htmlFor="name">{t('auth.full_name')}</label>
            <input id="name" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required />
          </div>

          <div className="input-group">
            <label htmlFor="reg-email">{t('auth.email')}</label>
            <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@company.com" required />
          </div>

          <div className="input-group">
            <label htmlFor="reg-password">{t('auth.password')}</label>
            <input id="reg-password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min 6 characters" required />
          </div>

          <div className="input-group">
            <label htmlFor="role">{t('auth.role')}</label>
            <select id="role" name="role" value={form.role} onChange={handleChange}>
              <option value="employee">{t('auth.employee')}</option>
              <option value="admin">{t('auth.admin')}</option>
            </select>
          </div>

          {form.role === 'admin' && (
            <div className="input-group">
              <label htmlFor="company_name">{t('auth.company_name')}</label>
              <input id="company_name" name="company_name" value={form.company_name} onChange={handleChange} placeholder="Your company" required />
            </div>
          )}

          {form.role === 'employee' && (
            <div className="input-group">
              <label htmlFor="job_role">{t('auth.job_role')}</label>
              <input id="job_role" name="job_role" value={form.job_role} onChange={handleChange} placeholder="e.g. CNC Operator" />
            </div>
          )}

          <div className="input-group">
            <label htmlFor="department">{t('auth.department')}</label>
            <select id="department" name="department" value={form.department} onChange={handleChange}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label htmlFor="primary_language">{t('auth.primary_language')}</label>
            <select id="primary_language" name="primary_language" value={form.primary_language} onChange={handlePrimaryLangChange}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>{t('auth.known_languages')}</label>
            <div className="checkbox-group">
              {LANGUAGES.map(l => (
                <label key={l.code} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.known_languages.includes(l.code)}
                    onChange={() => handleKnownLangToggle(l.code)}
                    disabled={l.code === form.primary_language}
                  />
                  <span>{l.label}</span>
                  {l.code === form.primary_language && <span className="badge badge-primary" style={{marginLeft: 6, fontSize: 10}}>Primary</span>}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
            {loading ? t('auth.creating') : t('auth.create_account')}
          </button>
        </form>

        <div className="auth-footer">
          <p>{t('auth.have_account')} <Link to="/login">{t('auth.sign_in')}</Link></p>
        </div>
      </div>
    </div>
  );
}
