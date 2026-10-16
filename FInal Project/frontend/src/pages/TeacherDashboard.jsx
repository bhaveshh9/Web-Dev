import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import CountUp from '../components/CountUp.jsx';
import useReveal from '../hooks/useReveal.js';
import { api, handleAuthError } from '../lib/api.js';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/teacher/dashboard')
      .then(setData)
      .catch((err) => handleAuthError(err, navigate));
  }, [navigate]);

  useReveal(data);

  if (!data) return null;

  const {
    teacher_name, total_students, total_pdfs, total_exams, average_score, notifications, unread_count,
  } = data;

  return (
    <>
      <div className="gt-scroll-progress" id="gtScrollProgress"></div>

      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li className="nav-item"><Link className="nav-link gt-nav-link active" to="/teacher/dashboard">Dashboard</Link></li>
          <li className="nav-item"><Link className="nav-link gt-nav-link" to="/teacher/materials">Manage PDFs</Link></li>
          <li className="nav-item"><Link className="nav-link gt-nav-link" to="/student_reports">Student Reports</Link></li>
          <li className="nav-item ms-lg-2 mt-2 mt-lg-0">
            <Link to="/logout" className="btn btn-gt-primary btn-sm w-100">
              Logout
            </Link>
          </li>
        </ul>
      </Navbar>

      {/* ============ DASHBOARD ============ */}
      <div className="gt-dash-wrap">
        <div className="container">

          {/* Header */}
          <div className="gt-dash-header">
            <div>
              <div className="gt-eyebrow">Teacher Dashboard</div>
              <h1>Welcome back, {teacher_name}</h1>
            </div>
            <div className="d-flex align-items-center gap-3">
              <button
                className="gt-bell-btn"
                type="button"
                aria-label="Notifications"
                onClick={() => document.getElementById('gtNotifSection').scrollIntoView({ behavior: 'smooth' })}
              >
                <i className="bi bi-bell-fill"></i>
                {unread_count > 0 && (
                  <span className="gt-bell-dot">{unread_count}</span>
                )}
              </button>
              <div className="dropdown">
                <button className="gt-user-chip btn dropdown-toggle" type="button" data-bs-toggle="dropdown">
                  <span className="gt-avatar">RS</span>
                  <span className="text-start">
                    <span className="name d-block">{teacher_name}</span>
                    <span className="role d-block">Teacher</span>
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
          </div>

          {/* Top Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <div className="gt-dash-stat gt-reveal">
                <span className="gt-icon-badge"><i className="bi bi-people-fill"></i></span>
                <div>
                  <span className="val"><CountUp to={total_students} /></span>
                  <span className="lbl">Total Students</span>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="gt-dash-stat gt-reveal">
                <span className="gt-icon-badge"><i className="bi bi-file-earmark-pdf-fill"></i></span>
                <div>
                  <span className="val"><CountUp to={total_pdfs} /></span>
                  <span className="lbl">Total Official PDFs</span>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="gt-dash-stat gt-reveal">
                <span className="gt-icon-badge"><i className="bi bi-patch-question-fill"></i></span>
                <div>
                  <span className="val"><CountUp to={total_exams} /></span>
                  <span className="lbl">Total Quizzes Generated</span>
                </div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="gt-dash-stat gt-reveal">
                <span className="gt-icon-badge"><i className="bi bi-bar-chart-fill"></i></span>
                <div>
                  <span className="val"><CountUp to={average_score} suffix="%" /></span>
                  <span className="lbl">Average Student Score</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="gt-dash-section-title">
            <h5>Quick Actions</h5>
          </div>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <Link to="/teacher/upload" className="gt-quick-action gt-reveal">
                <span className="gt-qa-icon"><i className="bi bi-file-earmark-arrow-up-fill"></i></span>
                <span className="gt-qa-label">Upload Study Material</span>
                <i className="bi bi-arrow-right gt-qa-arrow"></i>
              </Link>
            </div>
            <div className="col-6 col-lg-3">
              <Link to="/generated_exams" className="gt-quick-action gt-reveal">
                <span className="gt-qa-icon"><i className="bi bi-robot"></i></span>
                <span className="gt-qa-label">Generated Exams</span>
                <i className="bi bi-arrow-right gt-qa-arrow"></i>
              </Link>
            </div>
            <div className="col-6 col-lg-3">
              <Link to="/teacher/materials" className="gt-quick-action gt-reveal">
                <span className="gt-qa-icon"><i className="bi bi-folder2-open"></i></span>
                <span className="gt-qa-label">Manage Study Material</span>
                <i className="bi bi-arrow-right gt-qa-arrow"></i>
              </Link>
            </div>
            <div className="col-6 col-lg-3">
              <Link to="/student_reports" className="gt-quick-action gt-reveal">
                <span className="gt-qa-icon"><i className="bi bi-graph-up"></i></span>
                <span className="gt-qa-label">View Student Reports</span>
                <i className="bi bi-arrow-right gt-qa-arrow"></i>
              </Link>
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="row g-3" id="gtNotifSection">
            <div className="col-12">
              <div className="gt-dash-section-title">
                <h5>Recent Notifications</h5>
              </div>
              <div className="gt-card gt-reveal">
                <ul className="gt-notif-list">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <li className="gt-notif-item" key={notification.id}>
                        <div>
                          <strong>{notification.title}</strong>
                          <p className="mb-1">{notification.message}</p>
                          <small className="text-muted">{notification.created_at}</small>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="text-center py-4">No notifications available.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
