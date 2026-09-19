import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Feedback } from '../components/common/Ui';
import './PhaseA.css';

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;

export function RegisterPage() {
  const { token, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/onboarding" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName) return void setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return void setError('Enter a valid email address.');
    if (!password) return void setError('Create a password.');
    if (!passwordPattern.test(password)) return void setError('Password must be at least 12 characters and include uppercase, lowercase, and a number.');
    if (password !== confirmPassword) return void setError('Passwords do not match.');

    setBusy(true);
    setError('');
    try {
      await register(normalizedName, normalizedEmail, password);
      navigate('/onboarding');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to create your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="login-page register-page"><div className="login-art"><Link className="login-back" to="/">← Back to PulseOps</Link><div className="brand"><span className="brand-mark">P</span><span>PulseOps</span></div><div className="login-statement"><span className="eyebrow">START OPERATING WITH CLARITY</span><h1>Make the next incident <em>understandable.</em></h1><p>Create your account, set up a workspace, and bring your first service into the operations center.</p></div><div className="signal-line"><span className="status-dot" />Your workspace, your control <span className="signal-time">SECURE</span></div></div><section className="login-panel"><div className="login-card"><span className="eyebrow">NEW OPERATOR</span><h2>Create your account</h2><p className="muted">Start with the basics. You will create your workspace next.</p>{error && <Feedback message={error} />}<form onSubmit={submit}><label>Full name<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" /></label><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label><label>Password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="12+ characters" /></label><label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" /></label><button className="button primary full" disabled={busy}>{busy ? 'Creating account...' : 'Create Account'}<span>→</span></button></form><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p></div></section></main>;
}
