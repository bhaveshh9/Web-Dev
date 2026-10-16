import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import CountUp from '../components/CountUp.jsx';
import useReveal from '../hooks/useReveal.js';
import { useAuth } from '../context/AuthContext.jsx';

// "/" route: not logged in -> login, teacher -> dashboard, student -> landing page (index.html)
export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
  return <Landing />;
}

function Landing() {
  useReveal();

  // Port of the inline script in index.html: scroll progress, magnetic CTAs, scan-card tilt
  useEffect(() => {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanups = [];

    const progressBar = document.getElementById('gtScrollProgress');
    const updateProgress = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop || document.body.scrollTop;
      const height = (h.scrollHeight || document.body.scrollHeight) - h.clientHeight;
      const pct = height > 0 ? (scrolled / height) * 100 : 0;
      if (progressBar) progressBar.style.width = pct + '%';
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
    cleanups.push(() => window.removeEventListener('scroll', updateProgress));

    if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
      document.querySelectorAll('.gt-magnetic').forEach((btn) => {
        const move = (e) => {
          const rect = btn.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          btn.style.transform = 'translate(' + x * 0.12 + 'px,' + y * 0.28 + 'px)';
        };
        const leave = () => { btn.style.transform = ''; };
        btn.addEventListener('mousemove', move);
        btn.addEventListener('mouseleave', leave);
        cleanups.push(() => {
          btn.removeEventListener('mousemove', move);
          btn.removeEventListener('mouseleave', leave);
        });
      });

      const scanCard = document.getElementById('gtScanCard');
      if (scanCard) {
        const move = (e) => {
          const rect = scanCard.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          scanCard.style.transform = 'perspective(900px) rotateY(' + px * 5 + 'deg) rotateX(' + py * -5 + 'deg)';
        };
        const leave = () => { scanCard.style.transform = ''; };
        scanCard.addEventListener('mousemove', move);
        scanCard.addEventListener('mouseleave', leave);
        cleanups.push(() => {
          scanCard.removeEventListener('mousemove', move);
          scanCard.removeEventListener('mouseleave', leave);
        });
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <>
      {/* Scroll progress indicator */}
      <div className="gt-scroll-progress" id="gtScrollProgress"></div>

      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-center gap-3">
          <li className="nav-item">
            <Link className="nav-link gt-nav-link active" to="/">Home</Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link gt-nav-link" to="/upload">Upload PDF</Link>
          </li>
          <li className="nav-item">
            <Link to="/upload" className="btn btn-gt-primary btn-sm px-4">
              <i className="bi bi-stars me-2"></i>
              Get Started
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/logout" className="btn btn-gt-outline btn-sm px-4">
              <i className="bi bi-box-arrow-right me-2"></i>
              Logout
            </Link>
          </li>
        </ul>
      </Navbar>

      {/* ============ HERO ============ */}
      <header className="gt-hero" style={{ paddingTop: '9rem' }}>
        <div className="container">

          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <div className="gt-eyebrow">Powered by Google Gemma 4</div>
              <h1 className="mb-3">Turn any PDF of notes into a <span className="gt-accent-word">graded exam</span> — automatically.</h1>
              <p className="gt-hero-sub mb-4">
                GemmaTutor AI reads a teacher's notes, writes the questions, and grades every
                student answer — so teachers spend their time teaching, not typing exams.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <Link to="/upload" className="btn btn-gt-primary btn-lg gt-magnetic">
                  <i className="bi bi-arrow-right-circle me-2"></i>Get Started
                </Link>
                <a href="#features" className="btn btn-gt-outline btn-lg">Explore features</a>
              </div>
              <div className="d-flex align-items-center gap-4 mt-5 flex-wrap">
                <div>
                  <div className="mono fw-bold fs-5" style={{ color: 'var(--color-navy)' }}><CountUp to={10} suffix="s" duration={1200} threshold={0.6} /></div>
                  <div className="text-muted-soft small">avg. question generation</div>
                </div>
                <div className="vr d-none d-sm-block"></div>
                <div>
                  <div className="mono fw-bold fs-5" style={{ color: 'var(--color-navy)' }}>1 click</div>
                  <div className="text-muted-soft small">from notes to exam</div>
                </div>
                <div className="vr d-none d-sm-block"></div>
                <div>
                  <div className="mono fw-bold fs-5" style={{ color: 'var(--color-navy)' }}><CountUp to={100} suffix="%" duration={1200} threshold={0.6} /></div>
                  <div className="text-muted-soft small">auto-graded feedback</div>
                </div>
              </div>
            </div>

            {/* Signature visual: scanning document -> question chips */}
            <div className="col-lg-6">

              {/* decorative marks, reusing the existing gemma-svg tokens */}
              <svg className="gemma-svg gemma-svg-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="50" cy="50" r="46" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 6" />
                <circle cx="50" cy="50" r="30" stroke="#000000" strokeWidth="1.5" />
              </svg>
              <svg className="gemma-svg gemma-svg-2" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="10" y="10" width="80" height="80" rx="18" stroke="#000000" strokeWidth="1.5" />
                <path d="M30 50h40M30 65h24" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
              </svg>

              <div className="gt-scan-card" id="gtScanCard">

                <div className="d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-file-earmark-pdf-fill" style={{ color: '#E5484D', fontSize: '1.3rem' }}></i>
                  <span className="mono small text-muted-soft">GemmaTutorAI.pdf</span>
                </div>

                <div className="doc-line w-90"></div>
                <div className="doc-line w-75"></div>
                <div className="doc-line w-85"></div>
                <div className="doc-line w-60"></div>
                <div className="doc-line w-90"></div>
                <div className="doc-line w-75"></div>
                <div className="doc-line w-85" style={{ marginBottom: 0 }}></div>

                <div className="gt-scanner"></div>

                <div className="gt-chip c1"><i className="bi bi-check-circle-fill"></i> Q1 generated</div>
                <div className="gt-chip c2"><i className="bi bi-check-circle-fill"></i> Q2 generated</div>
                <div className="gt-chip c3"><i className="bi bi-check-circle-fill"></i> Q3 generated</div>

              </div>

            </div>
          </div>

        </div>
      </header>

      {/* ============ HOW IT WORKS ============ */}
      <section className="gt-section gt-section-soft">
        <div className="container">
          <div className="row justify-content-center text-center mb-5 gt-reveal">
            <div className="col-lg-7">
              <div className="gt-eyebrow justify-content-center">The workflow</div>
              <h2 className="mb-2">From notes to a graded exam in three steps</h2>
              <p className="text-muted-soft">No manual question writing. No manual grading.</p>
            </div>
          </div>
          <svg className="gemma-svg gemma-svg-3" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="10" y="10" width="80" height="80" rx="18" stroke="#000000" strokeWidth="1.5" />
            <path d="M30 50h40M30 65h24" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="row g-4 gt-step-track">
            <div className="col-md-4 gt-reveal">
              <div className="gt-card">
                <div className="gt-step-num">STEP 01</div>
                <div className="gt-icon-badge"><i className="bi bi-cloud-arrow-up-fill"></i></div>
                <h5>Upload your notes</h5>
                <p className="text-muted-soft mb-0">Drop in a PDF of lecture notes, textbook chapters, or a study guide.</p>
              </div>
            </div>
            <div className="col-md-4 gt-reveal" style={{ transitionDelay: '.08s' }}>
              <div className="gt-card">
                <div className="gt-step-num">STEP 02</div>
                <div className="gt-icon-badge"><i className="bi bi-stars"></i></div>
                <h5>Gemma 4 writes the exam</h5>
                <p className="text-muted-soft mb-0">The model reads the content and generates topic-accurate multiple-choice questions.</p>
              </div>
            </div>
            <div className="col-md-4 gt-reveal" style={{ transitionDelay: '.16s' }}>
              <div className="gt-card">
                <div className="gt-step-num">STEP 03</div>
                <div className="gt-icon-badge"><i className="bi bi-graph-up-arrow"></i></div>
                <h5>Students get instant feedback</h5>
                <p className="text-muted-soft mb-0">Answers are graded automatically, with strengths and weak topics called out.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="gt-section" id="features">
        <div className="container">
          <div className="row justify-content-center text-center mb-5 gt-reveal">
            <div className="col-lg-7">
              <div className="gt-eyebrow justify-content-center">Features</div>
              <h2 className="mb-2">Built for the real classroom workflow</h2>
              <p className="text-muted-soft">Everything a teacher needs to test and support a class, without extra admin work.</p>
            </div>
          </div>
          <svg className="gemma-svg gemma-svg-4" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="50" cy="50" r="46" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 6" />
            <circle cx="50" cy="50" r="30" stroke="#000000" strokeWidth="1.5" />
          </svg>
          <div className="row g-4">
            <div className="col-md-6 col-lg-3 gt-reveal">
              <div className="gt-card">
                <div className="gt-icon-badge"><i className="bi bi-filetype-pdf"></i></div>
                <h6 className="fw-bold">PDF-native input</h6>
                <p className="text-muted-soft small mb-0">Works directly from scanned or exported notes — no reformatting needed.</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3 gt-reveal" style={{ transitionDelay: '.06s' }}>
              <div className="gt-card">
                <div className="gt-icon-badge"><i className="bi bi-patch-question"></i></div>
                <h6 className="fw-bold">Auto-generated MCQs</h6>
                <p className="text-muted-soft small mb-0">Balanced, topic-tagged multiple-choice questions in seconds.</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3 gt-reveal" style={{ transitionDelay: '.12s' }}>
              <div className="gt-card">
                <div className="gt-icon-badge"><i className="bi bi-check2-circle"></i></div>
                <h6 className="fw-bold">Instant evaluation</h6>
                <p className="text-muted-soft small mb-0">Every submission is scored the moment it's submitted — no waiting.</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3 gt-reveal" style={{ transitionDelay: '.18s' }}>
              <div className="gt-card">
                <div className="gt-icon-badge"><i className="bi bi-person-lines-fill"></i></div>
                <h6 className="fw-bold">Personalized feedback</h6>
                <p className="text-muted-soft small mb-0">Strengths, weak topics, and next steps tailored to each student.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="gt-section pt-0">
        <div className="container">
          <div className="gt-card gt-cta-band gt-reveal p-5 text-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', border: 'none' }}>
            <h3 className="text-white mb-2">Ready to turn your notes into an exam?</h3>
            <p className="text-white-50 mb-4">Upload a PDF and see your first AI-generated exam in under a minute.</p>
            <Link to="/upload" className="btn btn-light btn-lg fw-semibold gt-magnetic" style={{ borderRadius: '999px', color: 'var(--color-primary-dark)' }}>
              Get Started <i className="bi bi-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="gt-footer">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-4">
              <Link to="/" className="gt-logo text-white mb-3 d-inline-flex">
                <span className="gt-logo-mark"><i className="bi bi-mortarboard-fill"></i></span>
                GemmaTutor AI
              </Link>
              <p className="small mb-0" style={{ maxWidth: '32ch' }}>AI-powered exam generation and grading, built for teachers, powered by Google Gemma 4.</p>
            </div>
            <div className="col-6 col-lg-2">
              <h6 className="text-white mb-3 small text-uppercase" style={{ letterSpacing: '.08em' }}>Product</h6>
              <ul className="list-unstyled small d-flex flex-column gap-2">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/upload">Upload PDF</Link></li>
                <li><Link to="/upload">Take Exam</Link></li>
                <li><Link to="/upload">Results</Link></li>
              </ul>
            </div>
            <div className="col-6 col-lg-2">
              <h6 className="text-white mb-3 small text-uppercase" style={{ letterSpacing: '.08em' }}>Company</h6>
              <ul className="list-unstyled small d-flex flex-column gap-2">
                <li><a href="#">About</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="#">Privacy</a></li>
              </ul>
            </div>
          </div>
          <hr className="my-4" />
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center small gap-2">
            <span>&copy; 2026 GemmaTutor AI. All rights reserved.</span>
            <span className="d-flex gap-3">
              <a href="https://github.com/bhaveshh9"><i className="bi bi-github fs-5"></i></a>
              <a href="https://www.linkedin.com/in/bhavesh-pathak-0682532ab"><i className="bi bi-linkedin fs-5"></i></a>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
