import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import useReveal from '../hooks/useReveal.js';
import { api, handleAuthError } from '../lib/api.js';

export default function GeneratedExams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState(null);

  useEffect(() => {
    api('/generated_exams')
      .then((d) => setExams(d.exams))
      .catch((err) => handleAuthError(err, navigate));
  }, [navigate]);

  useReveal(exams);

  if (!exams) return null;

  return (
    <>
      <div className="gt-scroll-progress" id="gtScrollProgress"></div>

      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li className="nav-item"><Link className="nav-link gt-nav-link" to="/teacher/dashboard">Dashboard</Link></li>
          <li className="nav-item"><Link className="nav-link gt-nav-link active" to="/generated_exams">Generated Exams</Link></li>
          <li className="nav-item"><a className="nav-link gt-nav-link" href="#">Student Reports</a></li>
        </ul>
      </Navbar>

      <div className="gt-dash-wrap">
        <div className="container">

          {/* Header */}
          <div className="gt-dash-header">
            <div>
              <div className="gt-eyebrow">Teacher Module</div>
              <h1>Generated Exams</h1>
            </div>
            <span className="gt-badge-soft-success">
              {exams.length} Exams
            </span>
          </div>

          {exams.length > 0 ? (
            <div className="gt-card gt-reveal p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="ps-4 text-muted-soft small text-uppercase">Study Material</th>
                      <th className="text-muted-soft small text-uppercase">Generated On</th>
                      <th className="text-muted-soft small text-uppercase text-end pe-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => (
                      <tr key={exam.id}>
                        <td className="ps-4">
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
                            <span className="fw-semibold" style={{ color: 'var(--color-navy)' }}>
                              {exam.title ? exam.title : 'Student Uploaded PDF'}
                            </span>
                          </div>
                        </td>
                        <td className="mono text-muted-soft">
                          {exam.created_at ? exam.created_at : '—'}
                        </td>
                        <td className="text-end pe-4">
                          <div className="d-flex justify-content-end gap-2">
                            <Link to={`/generated_exams/${exam.id}`} className="btn btn-gt-outline btn-sm">
                              <i className="bi bi-eye me-1"></i>View
                            </Link>
                          </div>
                        </td>
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
              <h5 className="mb-2" style={{ color: 'var(--color-navy)' }}>No study materials yet</h5>
              <p className="text-muted-soft mb-4">Upload your first PDF so students can start studying from it.</p>
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
