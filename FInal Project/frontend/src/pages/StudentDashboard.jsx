import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import CountUp from '../components/CountUp.jsx';
import useReveal from '../hooks/useReveal.js';

// Static dashboard from student-dashboard.html (it was dummy data in the original too).

// Port of dashboard.js "Continue Learning progress bars"
function ProgressBar({ pct }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return <div className="progress-bar" style={{ width: width + '%' }}></div>;
}

// Quick action click feedback for '#' links (dashboard.js)
const quickActionClick = (e) => {
  const card = e.currentTarget;
  e.preventDefault();
  card.style.transition = 'transform .15s var(--ease)';
  card.style.transform = 'scale(0.97)';
  setTimeout(() => { card.style.transform = ''; }, 150);
};

const continueCards = [
  { icon: 'bi-file-earmark-pdf-fill', name: 'Chapter 6 — Thermodynamics', sub: 'Physics · Official PDF', pct: 72 },
  { icon: 'bi-file-earmark-pdf-fill', name: 'Cell Structure & Function', sub: 'Biology · Official PDF', pct: 45 },
  { icon: 'bi-file-earmark-person-fill', name: 'My Notes — Algebra Formulas', sub: 'Math · Personal Upload', pct: 90 },
];

export default function StudentDashboard() {
  useReveal();

  return (
    <>
      <div className="gt-scroll-progress" id="gtScrollProgress"></div>

      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li className="nav-item"><a className="nav-link gt-nav-link active" href="#">Dashboard</a></li>
          <li className="nav-item"><a className="nav-link gt-nav-link" href="#">Browse PDFs</a></li>
          <li className="nav-item"><a className="nav-link gt-nav-link" href="#">My Reports</a></li>
        </ul>
      </Navbar>

      {/* ============ DASHBOARD ============ */}
      <div className="gt-dash-wrap">
        <div className="container">

          {/* Header */}
          <div className="gt-dash-header">
            <div>
              <div className="gt-eyebrow">Student Dashboard</div>
              <h1>Welcome back, Aarav</h1>
            </div>
            <div className="dropdown">
              <button className="gt-user-chip btn dropdown-toggle" type="button" data-bs-toggle="dropdown">
                <span className="gt-avatar">AM</span>
                <span className="text-start">
                  <span className="name d-block">Aarav Mehta</span>
                  <span className="role d-block">Student</span>
                </span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><a className="dropdown-item" href="#"><i className="bi bi-person me-2"></i>Profile</a></li>
                <li><a className="dropdown-item" href="#"><i className="bi bi-gear me-2"></i>Settings</a></li>
                <li><hr className="dropdown-divider" /></li>
                <li><Link className="dropdown-item" to="/login"><i className="bi bi-box-arrow-right me-2"></i>Log out</Link></li>
              </ul>
            </div>
          </div>

          {/* Top Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <div className="gt-dash-stat gt-reveal">
                <span className="gt-icon-badge"><i className="bi bi-journal-richtext"></i></span>
                <div>
                  <span className="val"><CountUp to={42} /></span>
                  <span className="lbl">Available Official PDFs</span>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="gt-dash-stat gt-reveal">
                <span className="gt-icon-badge"><i className="bi bi-file-earmark-person-fill"></i></span>
                <div>
                  <span className="val"><CountUp to={6} /></span>
                  <span className="lbl">My Uploaded PDFs</span>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="gt-dash-stat gt-reveal">
                <span className="gt-icon-badge"><i className="bi bi-check-circle-fill"></i></span>
                <div>
                  <span className="val"><CountUp to={19} /></span>
                  <span className="lbl">Completed Quizzes</span>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="gt-dash-stat gt-reveal">
                <span className="gt-icon-badge"><i className="bi bi-graph-up-arrow"></i></span>
                <div>
                  <span className="val"><CountUp to={84} suffix="%" /></span>
                  <span className="lbl">Average Score</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="gt-dash-section-title">
            <h5>Quick Actions</h5>
          </div>
          <div className="row g-3 mb-4">
            {[
              ['bi-journal-bookmark-fill', 'Browse Official PDFs'],
              ['bi-cloud-arrow-up-fill', 'Upload Personal PDF'],
              ['bi-pencil-square', 'Start Quiz'],
              ['bi-bar-chart-line-fill', 'View My Reports'],
            ].map(([icon, label]) => (
              <div className="col-6 col-lg-3" key={label}>
                <a href="#" className="gt-quick-action gt-reveal" onClick={quickActionClick}>
                  <span className="gt-qa-icon"><i className={'bi ' + icon}></i></span>
                  <span className="gt-qa-label">{label}</span>
                  <i className="bi bi-arrow-right gt-qa-arrow"></i>
                </a>
              </div>
            ))}
          </div>

          {/* Continue Learning */}
          <div className="gt-dash-section-title">
            <h5>Continue Learning</h5>
          </div>
          <div className="row g-3 mb-4">
            {continueCards.map((c) => (
              <div className="col-md-4" key={c.name}>
                <div className="gt-continue-card gt-reveal">
                  <div className="gt-cc-top">
                    <span className="gt-cc-icon"><i className={'bi ' + c.icon}></i></span>
                    <div>
                      <div className="gt-cc-name">{c.name}</div>
                      <div className="gt-cc-sub">{c.sub}</div>
                    </div>
                  </div>
                  <div>
                    <div className="gt-cc-progress-label">
                      <span>Progress</span>
                      <span className="gt-cc-progress-val">{c.pct}%</span>
                    </div>
                    <div className="gt-progress-wrap progress">
                      <ProgressBar pct={c.pct} />
                    </div>
                  </div>
                  <a href="#" className="btn btn-gt-outline btn-sm mt-1">Continue</a>
                </div>
              </div>
            ))}
          </div>

          {/* AI Learning Summary */}
          <div className="gt-dash-section-title">
            <h5>AI Learning Summary</h5>
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <div className="gt-ai-panel gt-reveal">
                <h6><i className="bi bi-bullseye text-success"></i> Strengths</h6>
                <ul className="gt-list-check list-unstyled mb-0">
                  <li><i className="bi bi-check-circle-fill"></i> Newton's Laws of Motion</li>
                  <li><i className="bi bi-check-circle-fill"></i> Cell Division &amp; Mitosis</li>
                  <li><i className="bi bi-check-circle-fill"></i> Linear Equations</li>
                </ul>
              </div>
            </div>
            <div className="col-md-4">
              <div className="gt-ai-panel gt-reveal">
                <h6><i className="bi bi-pin-angle-fill text-warning"></i> Weak Topics</h6>
                <ul className="gt-list-warn list-unstyled mb-0">
                  <li><i className="bi bi-exclamation-triangle-fill"></i> Thermodynamics — Heat Transfer</li>
                  <li><i className="bi bi-exclamation-triangle-fill"></i> Organic Chemistry Naming</li>
                  <li><i className="bi bi-exclamation-triangle-fill"></i> Trigonometric Identities</li>
                </ul>
              </div>
            </div>
            <div className="col-md-4">
              <div className="gt-ai-panel gt-next-topic gt-reveal">
                <h6><i className="bi bi-lightbulb-fill"></i> Recommended Next Topic</h6>
                <div className="gt-next-title">Heat Transfer &amp; Thermal Equilibrium</div>
                <p className="gt-next-sub mb-0">Based on your recent quiz attempts, brushing up here will boost your Physics average the most.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
