import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api, handleAuthError } from '../lib/api.js';

// Port of upload.js + official-pdf-search.js + upload.html

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

const STEPS = [
  'Uploading PDF',
  'Extracting text with OCR',
  'Gemma 4 generating questions',
  'Finalizing your exam',
];

export default function Upload() {
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  const [officialPdfs, setOfficialPdfs] = useState([]);

  // official PDF search / selection
  const [keyword, setKeyword] = useState('');
  const [searchTouched, setSearchTouched] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selectedOfficialId, setSelectedOfficialId] = useState('');
  const [selectedOfficial, setSelectedOfficial] = useState(null);

  // file upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragover, setDragover] = useState(false);

  // processing
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);

  useEffect(() => {
    api('/upload')
      .then((d) => setOfficialPdfs(d.official_pdfs))
      .catch((err) => handleAuthError(err, navigate));
  }, [navigate]);

  // Hide result list when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (
        searchRef.current && resultsRef.current &&
        !searchRef.current.contains(e.target) &&
        !resultsRef.current.contains(e.target)
      ) {
        setShowList(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const kw = keyword.toLowerCase().trim();
  const matches = (pdf) => pdf.title.toLowerCase().includes(kw) || pdf.filename.toLowerCase().includes(kw);
  const found = officialPdfs.some(matches);

  const hasSelection = Boolean(selectedFile || selectedOfficial);
  const previewName = selectedOfficial ? selectedOfficial.title : selectedFile ? selectedFile.name : 'notes.pdf';
  const previewSize = selectedOfficial ? selectedOfficial.filename : selectedFile ? formatSize(selectedFile.size) : '0 KB';

  const handleFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }
    setSelectedFile(file);
  };

  const selectOfficial = (pdf) => {
    setSelectedOfficialId(String(pdf.id));
    setSelectedOfficial(pdf);
    setKeyword(pdf.title);
    setShowList(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setSelectedOfficialId('');
    setSelectedOfficial(null);
    setKeyword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generate = async () => {
    if ((!selectedFile && !selectedOfficialId) || processing) return;

    setProcessing(true);
    setProgressVisible(true);
    setStepIndex(0);

    // Simulated upload + generation progress
    let p = 0;
    const progressInterval = setInterval(() => {
      if (p < 25) {
        p += 5;
        setStepIndex(0);
      } else if (p < 50) {
        p += 3;
        setStepIndex(1);
      } else if (p < 80) {
        p += 2;
        setStepIndex(2);
      } else if (p < 95) {
        p += 1;
        setStepIndex(3);
      }
      setProgress(p);
    }, 250);

    const formData = new FormData();
    if (selectedOfficialId) {
      formData.append('official_pdf_id', selectedOfficialId);
    } else {
      formData.append('pdf', selectedFile);
    }

    try {
      const data = await api('/upload', { method: 'POST', form: formData });

      // Stop animation
      clearInterval(progressInterval);

      // Finish progress
      setProgress(100);
      setStepIndex(4);

      // Small delay so user sees 100%
      await new Promise((resolve) => setTimeout(resolve, 700));

      // Open exam page (was: document.write(html))
      const payload = { questions: data.questions, examId: data.exam_id };
      sessionStorage.setItem('gtExam', JSON.stringify(payload));
      navigate('/exam', { state: payload });
    } catch (err) {
      console.error(err);
      clearInterval(progressInterval);
      if (handleAuthError(err, navigate)) return;

      alert('Upload failed. Please try again.');

      setProcessing(false);
      setProgress(0);
      setProgressVisible(false);
    }
  };

  const statusClass = (i) => {
    if (i < stepIndex) return 'done';
    if (i === stepIndex && stepIndex < STEPS.length) return 'active';
    return '';
  };
  const statusIcon = (i) => {
    if (i < stepIndex) return 'bi bi-check-circle-fill';
    if (i === stepIndex && stepIndex < STEPS.length) return 'bi bi-arrow-repeat';
    return 'bi bi-circle';
  };

  return (
    <>
      {/* ============ NAVBAR ============ */}
      <Navbar>
        <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
          <li className="nav-item"><Link className="nav-link gt-nav-link" to="/">Home</Link></li>
        </ul>
      </Navbar>

      <main className="gt-section" style={{ paddingTop: '8.5rem' }}>
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">

              <div className="text-center mb-4">
                <span className="gt-step-pill mb-3"><i className="bi bi-1-circle-fill"></i> Step 1 of 3 — Upload notes</span>
                <h2 className="mt-3 mb-2">Upload your notes to generate an exam</h2>
                <p className="text-muted-soft">Accepted format: PDF, up to 20 MB. Gemma 4 will read the content and write the questions.</p>
              </div>

              <svg className="gemma-svg gemma-svg-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="50" cy="50" r="46" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 6" />
                <circle cx="50" cy="50" r="30" stroke="#000000" strokeWidth="1.5" />
              </svg>

              {/* Search existing Official PDFs */}
              <div id="gtOfficialPdfList" className="mb-4">
                <div className="gt-input-group">
                  <i className="bi bi-search"></i>
                  <input
                    type="text"
                    id="officialPdfSearch"
                    className="gt-form-control"
                    placeholder="Search Study Material..."
                    ref={searchRef}
                    value={keyword}
                    onFocus={() => setShowList(true)}
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      setSearchTouched(true);
                    }}
                  />
                </div>

                {officialPdfs.length > 0 && (
                  <>
                    <ul
                      id="officialPdfResults"
                      ref={resultsRef}
                      className={'list-unstyled mb-0 list mt-2' + (showList ? '' : ' d-none')}
                    >
                      {officialPdfs.map((pdf) => (
                        <li
                          key={pdf.id}
                          className={'gt-official-item' + (String(pdf.id) === selectedOfficialId ? ' is-selected' : '')}
                          data-pdf-id={pdf.id}
                          style={!matches(pdf) ? { display: 'none' } : searchTouched ? { display: 'flex' } : undefined}
                          onClick={() => selectOfficial(pdf)}
                        >
                          <div className="gt-official-icon"><i className="bi bi-file-earmark-pdf-fill"></i></div>
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="fw-semibold text-truncate name"> {pdf.title}</div>
                            <div className="small text-muted-soft subject"> {pdf.filename}</div>
                          </div>
                          <button type="button" className="btn btn-gt-outline btn-sm gt-select-official-btn">
                            <i className="bi bi-check2 me-1"></i>Select
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p
                      className={'text-center text-muted-soft small mt-2' + (searchTouched && !found ? '' : ' d-none')}
                      id="gtNoResultsMsg"
                    >
                      No matching PDFs found.
                    </p>
                  </>
                )}

                <input type="hidden" id="selectedOfficialPdfId" name="official_pdf_id" value={selectedOfficialId} readOnly />
              </div>

              {/* Dropzone */}
              <div
                className={'gt-dropzone' + (dragover ? ' dragover' : '') + (hasSelection ? ' d-none' : '')}
                id="dropzone"
                role="button"
                tabIndex={0}
                aria-label="Upload a PDF file"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current && fileInputRef.current.click();
                  }
                }}
                onDragEnter={(e) => { e.preventDefault(); setDragover(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragover(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragover(false);
                  handleFile(e.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  id="fileInput"
                  name="pdf"
                  accept="application/pdf"
                  className="d-none"
                  ref={fileInputRef}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                <div className="gt-dropzone-icon"><i className="bi bi-cloud-arrow-up"></i></div>
                <h5 className="mb-1">Drag &amp; drop your PDF here</h5>
                <p className="text-muted-soft mb-3">or click to browse from your device</p>
                <span className="btn btn-gt-outline btn-sm"><i className="bi bi-folder2-open me-1"></i> Browse files</span>
              </div>

              {/* File preview (hidden until a file is chosen) */}
              <div id="filePreview" className={'gt-file-card mt-4' + (hasSelection ? '' : ' d-none')}>
                <div className="gt-file-icon"><i className="bi bi-file-earmark-pdf-fill"></i></div>
                <div className="flex-grow-1 overflow-hidden">
                  <div className="fw-semibold text-truncate" id="fileName">{previewName}</div>
                  <div className="small text-muted-soft" id="fileSize">{previewSize}</div>
                </div>
                <button className="btn btn-sm btn-gt-ghost" id="removeFileBtn" type="button" onClick={removeFile}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              {/* Progress / processing status */}
              <div id="progressSection" className={'mt-4' + (progressVisible ? '' : ' d-none')}>
                <div className="gt-card">
                  <div className="gt-progress-wrap mb-3">
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="fw-semibold" style={{ color: 'var(--color-navy)' }}>Processing your document…</span>
                      <span className="mono" id="progressPct">{progress}%</span>
                    </div>
                    <div className="progress">
                      <div className="progress-bar" id="progressBar" role="progressbar" style={{ width: progress + '%' }}></div>
                    </div>
                  </div>
                  <ul className="list-unstyled gt-status-list mb-0" id="statusList">
                    {STEPS.map((label, i) => (
                      <li key={label} data-step={i} className={statusClass(i)}>
                        <span className="status-icon"><i className={statusIcon(i)}></i></span> {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-4">
                <Link to="/upload" className="btn btn-gt-ghost"><i className="bi bi-arrow-left me-1"></i> Back</Link>
                <button
                  className="btn btn-gt-primary btn-lg"
                  id="generateBtn"
                  disabled={!hasSelection || processing}
                  onClick={generate}
                >
                  {processing ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Processing…</>
                  ) : (
                    <><i className="bi bi-stars me-2"></i>Generate Exam</>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>
    </>
  );
}
