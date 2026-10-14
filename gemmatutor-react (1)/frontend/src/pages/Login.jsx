import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();

  const [role, setRole] = useState('teacher');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null); // {type, message}
  const [busy, setBusy] = useState(false);

  // Already logged in -> go to the right dashboard (same as the Flask route)
  if (!loading && user) {
    return <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address.';
    }
    if (!password || password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    setErrors(errs);

    if (Object.keys(errs).length) {
      setBanner({ type: 'error', message: 'Please fix the highlighted fields.' });
      return;
    }

    setBusy(true);
    try {
      const data = await api('/login', { method: 'POST', json: { email, password, role } });
      setUser(data.user);
      navigate(data.redirect || '/', { replace: true });
    } catch (err) {
      setBanner({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="gt-scroll-progress" id="gtScrollProgress"></div>

      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li className="nav-item ms-lg-2 mt-2 mt-lg-0">
            <Link to="/signup" className="btn btn-gt-primary btn-sm w-100">Create Account</Link>
          </li>
        </ul>
      </Navbar>

      {/* ============ LOGIN ============ */}
      <div className="gt-auth-wrap">
        <div className="container">
          <div className="gt-auth-shell">
            <div className="row g-0">

              {/* Left brand panel */}
              <div className="col-lg-5">
                <div className="gt-auth-side">
                  <div className="gt-auth-side-logo">
                    <span className="gt-logo-mark"><i className="bi bi-mortarboard-fill"></i></span>
                    GemmaTutor AI
                  </div>
                  <div>
                    <p className="gt-auth-side-quote">Welcome back. Pick up right where you left off.</p>
                    <ul className="gt-auth-side-list">
                      <li><i className="bi bi-file-earmark-pdf-fill"></i> Turn notes into exams instantly</li>
                      <li><i className="bi bi-stars"></i> AI-generated, topic-accurate questions</li>
                      <li><i className="bi bi-graph-up-arrow"></i> Instant grading &amp; feedback</li>
                    </ul>
                  </div>
                  <div className="mono small" style={{ opacity: 0.6, position: 'relative', zIndex: 1 }}>Powered by Google Gemma 4</div>
                </div>
              </div>

              {/* Right form panel */}
              <div className="col-lg-7">
                <div className="gt-auth-form-panel">
                  <div className="gt-eyebrow">Sign in</div>
                  <h2 className="mb-1">Log in to your account</h2>
                  <p className="text-muted-soft mb-4">Choose your role to continue.</p>

                  <div className={'gt-alert-banner gt-alert-' + (banner ? banner.type : 'error') + (banner ? ' show' : '')}>
                    {banner && (
                      <>
                        <i className={'bi ' + (banner.type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill')}></i>
                        <span>{banner.message}</span>
                      </>
                    )}
                  </div>

                  {/* Role toggle */}
                  <div className="gt-role-toggle" role="tablist" aria-label="Select account type">
                    <input type="radio" name="role_toggle" id="roleTeacher" value="teacher"
                      checked={role === 'teacher'} onChange={() => setRole('teacher')} />
                    <label htmlFor="roleTeacher"><i className="bi bi-person-workspace"></i> Teacher</label>

                    <input type="radio" name="role_toggle" id="roleStudent" value="student"
                      checked={role === 'student'} onChange={() => setRole('student')} />
                    <label htmlFor="roleStudent"><i className="bi bi-mortarboard"></i> Student</label>
                  </div>

                  <form id="gtLoginForm" onSubmit={handleSubmit} noValidate>
                    <input type="hidden" name="role" id="gtSelectedRole" value={role} readOnly />

                    <div className="mb-3">
                      <label className="gt-form-label" htmlFor="loginEmail">Email address</label>
                      <div className="gt-input-group">
                        <i className="bi bi-envelope"></i>
                        <input type="email" className={'gt-form-control' + (errors.email ? ' is-invalid' : '')}
                          id="loginEmail" name="email" placeholder="you@school.edu" required
                          value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="gt-field-error" style={errors.email ? { display: 'block' } : undefined}>{errors.email}</div>
                    </div>

                    <div className="mb-2">
                      <label className="gt-form-label" htmlFor="loginPassword">Password</label>
                      <div className="gt-input-group">
                        <i className="bi bi-lock"></i>
                        <input type={showPass ? 'text' : 'password'}
                          className={'gt-form-control' + (errors.password ? ' is-invalid' : '')}
                          id="loginPassword" name="password" placeholder="••••••••" required
                          value={password} onChange={(e) => setPassword(e.target.value)} />
                        <button type="button" className="gt-toggle-pass" aria-label="Show password"
                          onClick={() => setShowPass((s) => !s)}>
                          <i className={showPass ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
                        </button>
                      </div>
                      <div className="gt-field-error" style={errors.password ? { display: 'block' } : undefined}>{errors.password}</div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox" id="rememberMe" name="remember"
                          checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                        <label className="form-check-label small text-muted-soft" htmlFor="rememberMe">Remember me</label>
                      </div>
                      <a href="#" className="small" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Forgot password?</a>
                    </div>

                    <button type="submit" className="btn btn-gt-primary w-100 gt-magnetic" disabled={busy}>
                      <i className="bi bi-box-arrow-in-right me-2"></i>Log In
                    </button>
                  </form>

                  <div className="gt-auth-switch">
                    Don't have an account? <Link to="/signup">Create one</Link>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
