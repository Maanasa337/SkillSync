import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'employee', company_name: '', job_role: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#1E3A8A"/>
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>SkillSync</span>
          </div>
          <h1>Create Account</h1>
          <p>Get started with SkillSync today</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          
          <div className="input-group">
            <label htmlFor="name">Full Name</label>
            <input id="name" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required />
          </div>

          <div className="input-group">
            <label htmlFor="reg-email">Email Address</label>
            <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@company.com" required />
          </div>

          <div className="input-group">
            <label htmlFor="reg-password">Password</label>
            <input id="reg-password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min 6 characters" required />
          </div>

          <div className="input-group">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" value={form.role} onChange={handleChange}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {form.role === 'admin' && (
            <div className="input-group">
              <label htmlFor="company_name">Company Name</label>
              <input id="company_name" name="company_name" value={form.company_name} onChange={handleChange} placeholder="Your company" required />
            </div>
          )}

          {form.role === 'employee' && (
            <div className="input-group">
              <label htmlFor="job_role">Job Role</label>
              <input id="job_role" name="job_role" value={form.job_role} onChange={handleChange} placeholder="e.g. CNC Operator" />
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
