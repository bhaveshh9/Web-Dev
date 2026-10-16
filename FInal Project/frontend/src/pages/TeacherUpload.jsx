import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api, handleAuthError } from '../lib/api.js';

// Port of teacher_upload.js + teacher_upload.html
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function TeacherUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const showFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      alert('Please select a PDF file.');
      return;
    }
    setFile(f);
  };

  const removeFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const fd = new FormData();
    fd.append('title', title);
    fd.append('pdf', file);

    setBusy(true);
    setError(null);
    try {
      await api('/teacher/upload', { method: 'POST', form: fd });
      navigate('/teacher/dashboard');
    } catch (err) {
      if (!handleAuthError(err, navigate)) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li className="nav-item"><Link className="nav-link gt-nav-link" to="/">Home</Link></li>
        </ul>
      </Navbar>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      <main className="gt-section" style={{ paddingTop: '8.5rem' }}>
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">

              <div className="text-center mb-4">
                <h2 className="mt-3 mb-2">Upload Study Material</h2>
                <p className="text-muted-soft">
                  Upload official PDF notes for students.
                  Students can later generate quizzes
                  from these materials.
                </p>
              </div>

              <svg className="gemma-svg gemma-svg-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="50" cy="50" r="46" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 6" />
                <circle cx="50" cy="50" r="30" stroke="#000000" strokeWidth="1.5" />
              </svg>

              <form onSubmit={handleSubmit} encType="multipart/form-data">
                {/* Study Material Title */}
                <div className="gt-card mb-4">
                  <label htmlFor="title" className="fw-semibold mb-2 d-block" style={{ color: 'var(--color-navy)' }}>
                    <i className="bi bi-book me-2"></i>
                    Study Material Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    className="form-control gt-input"
                    placeholder="e.g. Operating Systems Unit 1"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Dropzone */}
                <div
                  className={'gt-dropzone' + (file ? ' d-none' : '')}
                  id="dropzone"
                  role="button"
                  tabIndex={0}
                  aria-label="Upload a PDF file"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  <input
                    type="file"
                    id="fileInput"
                    name="pdf"
                    accept="application/pdf"
                    className="d-none"
                    ref={fileInputRef}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => showFile(e.target.files[0])}
                  />
                  <div className="gt-dropzone-icon"><i className="bi bi-cloud-arrow-up"></i></div>
                  <h5 className="mb-1">Drag &amp; drop your PDF here</h5>
                  <p className="text-muted-soft mb-3">or click to browse from your device</p>
                  <span className="btn btn-gt-outline btn-sm"><i className="bi bi-folder2-open me-1"></i> Browse files</span>
                </div>

                {/* File preview (hidden until a file is chosen) */}
                <div id="filePreview" className={'gt-file-card mt-4' + (file ? '' : ' d-none')}>
                  <div className="gt-file-icon"><i className="bi bi-file-earmark-pdf-fill"></i></div>
                  <div className="flex-grow-1 overflow-hidden">
                    <div className="fw-semibold text-truncate" id="fileName">{file ? file.name : 'notes.pdf'}</div>
                    <div className="small text-muted-soft" id="fileSize">{file ? formatSize(file.size) : '0 KB'}</div>
                  </div>
                  <button className="btn btn-sm btn-gt-ghost" id="removeFileBtn" type="button" onClick={removeFile}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-4">
                  <Link to="/teacher/dashboard" className="btn btn-gt-ghost">
                    Back
                  </Link>

                  <button type="submit" className="btn btn-gt-primary btn-lg" id="generateBtn" disabled={!file || busy}>
                    <i className="bi bi-upload me-2"></i>
                    Upload Study Material
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      </main>
    </>
  );
}
