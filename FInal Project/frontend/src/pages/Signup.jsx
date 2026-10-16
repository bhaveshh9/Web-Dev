import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api } from '../lib/api.js';

export default function Signup() {
  const navigate = useNavigate();

  const [role, setRole] = useState('teacher');
  const [form, setForm] = useState({
    full_name: '', email: '', institution: '', grade: '', password: '', confirm_password: '',
  });
  const [terms, setTerms] = useState(false);
  const [show, setShow] = useState({ password: false, confirm: false });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    let bannerMsg = null;

    if (!form.full_name.trim()) errs.name = 'Enter your full name.';

    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errs.email = 'Enter a valid email address.';
    }

    if (!form.password || form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }

    if (form.confirm_password !== form.password || !form.confirm_password) {
      errs.confirm = 'Passwords do not match.';
    }

    if (!terms) {
      bannerMsg = 'Please accept the Terms to continue.';
    }

    setErrors(errs);

    if (Object.keys(errs).length || bannerMsg) {
      setBanner({ type: 'error', message: bannerMsg || 'Please fix the highlighted fields.' });
      return;
    }

    setBusy(true);
    try {
      await api('/signup', { method: 'POST', json: { ...form, role } });
      navigate('/login');
    } catch (err) {
      setBanner({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const fieldErr = (k) => (errors[k] ? { display: 'block' } : undefined);

  return (
    <>
      <div className="gt-scroll-progress" id="gtScrollProgress"></div>

      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li className="nav-item"><Link className="nav-link gt-nav-link" to="/">Home</Link></li>
          <li className="nav-item"><Link className="nav-link gt-nav-link" to="/upload">Upload PDF</Link></li>
          <li className="nav-item ms-lg-2 mt-2 mt-lg-0">
            <Link to="/login" className="btn btn-gt-outline btn-sm w-100">Log In</Link>
          </li>
        </ul>
      </Navbar>

      {/* ============ SIGNUP ============ */}
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
                    <p className="gt-auth-side-quote">Create your account and let Gemma 4 handle the busywork.</p>
                    <ul className="gt-auth-side-list">
                      <li><i className="bi bi-cloud-arrow-up-fill"></i> Upload notes, get a full exam in seconds</li>
                      <li><i className="bi bi-check-circle-fill"></i> Auto-graded, no manual marking</li>
                      <li><i className="bi bi-person-lines-fill"></i> Personalized feedback for every student</li>
                    </ul>
                  </div>
                  <div className="mono small" style={{ opacity: 0.6, position: 'relative', zIndex: 1 }}>Powered by Google Gemma 4</div>
                </div>
              </div>

              {/* Right form panel */}
              <div className="col-lg-7">
                <div className="gt-auth-form-panel">
                  <div className="gt-eyebrow">Get started</div>
                  <h2 className="mb-1">Create your account</h2>
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
                    <input type="radio" name="role_toggle" id="roleTeacherSU" value="teacher"
                      checked={role === 'teacher'} onChange={() => setRole('teacher')} />
                    <label htmlFor="roleTeacherSU"><i className="bi bi-person-workspace"></i> Teacher</label>

                    <input type="radio" name="role_toggle" id="roleStudentSU" value="student"
                      checked={role === 'student'} onChange={() => setRole('student')} />
                    <label htmlFor="roleStudentSU"><i className="bi bi-mortarboard"></i> Student</label>
                  </div>

                  <form id="gtSignupForm" onSubmit={handleSubmit} noValidate>
                    <input type="hidden" name="role" id="gtSelectedRole" value={role} readOnly />

                    <div className="mb-3">
                      <label className="gt-form-label" htmlFor="signupName">Full name</label>
                      <div className="gt-input-group">
                        <i className="bi bi-person"></i>
                        <input type="text" className={'gt-form-control' + (errors.name ? ' is-invalid' : '')}
                          id="signupName" name="full_name" placeholder="Jane Doe" required
                          value={form.full_name} onChange={set('full_name')} />
                      </div>
                      <div className="gt-field-error" style={fieldErr('name')}>{errors.name}</div>
                    </div>

                    <div className="mb-3">
                      <label className="gt-form-label" htmlFor="signupEmail">Email address</label>
                      <div className="gt-input-group">
                        <i className="bi bi-envelope"></i>
                        <input type="email" className={'gt-form-control' + (errors.email ? ' is-invalid' : '')}
                          id="signupEmail" name="email" placeholder="you@school.edu" required
                          value={form.email} onChange={set('email')} />
                      </div>
                      <div className="gt-field-error" style={fieldErr('email')}>{errors.email}</div>
                    </div>

                    {/* Teacher-only field */}
                    <div className={'gt-role-fields mb-3' + (role === 'teacher' ? ' active' : '')} data-role="teacher">
                      <label className="gt-form-label" htmlFor="teacherSchool">School / Institution</label>
                      <div className="gt-input-group">
                        <i className="bi bi-building"></i>
                        <input type="text" className="gt-form-control" id="teacherSchool" name="institution"
                          placeholder="Lincoln High School" value={form.institution} onChange={set('institution')} />
                      </div>
                    </div>

                    {/* Student-only field */}
                    <div className={'gt-role-fields mb-3' + (role === 'student' ? ' active' : '')} data-role="student">
                      <label className="gt-form-label" htmlFor="studentGrade">Grade / Class</label>
                      <div className="gt-input-group">
                        <i className="bi bi-journal-bookmark"></i>
                        <input type="text" className="gt-form-control" id="studentGrade" name="grade"
                          placeholder="Grade 10 — Section B" value={form.grade} onChange={set('grade')} />
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="gt-form-label" htmlFor="signupPassword">Password</label>
                        <div className="gt-input-group">
                          <i className="bi bi-lock"></i>
                          <input type={show.password ? 'text' : 'password'}
                            className={'gt-form-control' + (errors.password ? ' is-invalid' : '')}
                            id="signupPassword" name="password" placeholder="At least 8 characters" required
                            value={form.password} onChange={set('password')} />
                          <button type="button" className="gt-toggle-pass" aria-label="Show password"
                            onClick={() => setShow((s) => ({ ...s, password: !s.password }))}>
                            <i className={show.password ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
                          </button>
                        </div>
                        <div className="gt-field-error" style={fieldErr('password')}>{errors.password}</div>
                      </div>
                      <div className="col-md-6">
                        <label className="gt-form-label" htmlFor="signupConfirm">Confirm password</label>
                        <div className="gt-input-group">
                          <i className="bi bi-lock-fill"></i>
                          <input type={show.confirm ? 'text' : 'password'}
                            className={'gt-form-control' + (errors.confirm ? ' is-invalid' : '')}
                            id="signupConfirm" name="confirm_password" placeholder="Re-enter password" required
                            value={form.confirm_password} onChange={set('confirm_password')} />
                          <button type="button" className="gt-toggle-pass" aria-label="Show password"
                            onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}>
                            <i className={show.confirm ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
                          </button>
                        </div>
                        <div className="gt-field-error" style={fieldErr('confirm')}>{errors.confirm}</div>
                      </div>
                    </div>

                    <div className="form-check mb-4">
                      <input className="form-check-input" type="checkbox" id="signupTerms" name="terms"
                        checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                      <label className="form-check-label small text-muted-soft" htmlFor="signupTerms">
                        I agree to the <a href="#" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Terms of Service</a> and <a href="#" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Privacy Policy</a>.
                      </label>
                    </div>

                    <button type="submit" className="btn btn-gt-primary w-100 gt-magnetic" disabled={busy}>
                      <i className="bi bi-person-plus-fill me-2"></i>Create Account
                    </button>
                  </form>

                  <div className="gt-auth-switch">
                    Already have an account? <Link to="/login">Log in</Link>
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
