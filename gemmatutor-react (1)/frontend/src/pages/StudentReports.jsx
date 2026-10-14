import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import useReveal from '../hooks/useReveal.js';
import { api, handleAuthError } from '../lib/api.js';

function GradeBadge({ grade }) {
  if (grade === 'A+' || grade === 'A') return <span className="badge bg-success">{grade}</span>;
  if (grade === 'B') return <span className="badge bg-primary">{grade}</span>;
  if (grade === 'C') return <span className="badge bg-warning text-dark">{grade}</span>;
  return <span className="badge bg-danger">{grade}</span>;
}

export default function StudentReports() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState(null);

  useEffect(() => {
    api('/student_reports')
      .then((d) => setAttempts(d.attempts))
      .catch((err) => handleAuthError(err, navigate));
  }, [navigate]);

  useReveal(attempts);

  if (!attempts) return null;

  return (
    <>
      <div className="gt-scroll-progress" id="gtScrollProgress"></div>

      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li className="nav-item"><Link className="nav-link gt-nav-link" to="/teacher/dashboard">Dashboard</Link></li>
          <li className="nav-item">
            <Link className="nav-link gt-nav-link" to="/generated_exams">
              Generated Exams
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link gt-nav-link active" to="/student_reports">
              Student Reports
            </Link>
          </li>
          <li className="nav-item"><a className="nav-link gt-nav-link" href="#">Student Reports</a></li>
        </ul>
      </Navbar>

      <div className="gt-dash-wrap">
        <div className="container">

          {/* Header */}
          <div className="gt-dash-header">
            <div>
              <div className="gt-eyebrow">Teacher Module</div>
              <h1>Student Reports</h1>
            </div>
            <span className="gt-badge-soft-success">
              {attempts.length} Attempts
            </span>
          </div>

          {attempts.length > 0 ? (
            <div className="gt-card gt-reveal p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="ps-4">Student</th>
                      <th>Study Material</th>
                      <th>Score</th>
                      <th>Grade</th>
                      <th>Submitted On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td className="ps-4">{attempt.student_name}</td>
                        <td>{attempt.title ? attempt.title : 'Student Uploaded PDF'}</td>
                        <td>
                          {attempt.score}/{attempt.total_questions}{' '}
                          ({attempt.percentage}%)
                        </td>
                        <td><GradeBadge grade={attempt.grade} /></td>
                        <td>{attempt.submitted_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="gt-card gt-reveal text-center py-5">
              <span className="gt-icon-badge mx-auto mb-3" style={{ width: 64, height: 64, fontSize: '1.6rem' }}>
                <i className="bi bi-file-earmark-pdf"></i>
              </span>
              <h5 className="mb-2" style={{ color: 'var(--color-navy)' }}>No student reports available</h5>
              <p className="text-muted-soft mb-4">No student has attempted an exam yet..</p>
              <Link to="/teacher/upload" className="btn btn-gt-primary">
                <i className="bi bi-cloud-arrow-up-fill me-2"></i>Upload Study Material
              </Link>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
