import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api, handleAuthError } from '../lib/api.js';

// Port of questions.js + questions.html
const EXAM_SECONDS = 300; // 5 minutes

function loadExam(location) {
  if (location.state && location.state.questions) return location.state;
  try {
    return JSON.parse(sessionStorage.getItem('gtExam')) || null;
  } catch (e) {
    return null;
  }
}

export default function Exam() {
  const navigate = useNavigate();
  const location = useLocation();

  const [exam] = useState(() => loadExam(location));
  const questions = (exam && exam.questions) || [];
  const examId = exam && exam.examId;
  const totalQ = questions.length;

  const [answers, setAnswers] = useState(() => new Array(totalQ).fill(null));
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXAM_SECONDS);
  const [submitted, setSubmitted] = useState(false);

  const startTime = useRef(Date.now());
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);
  answersRef.current = answers;

  // ============================
  // Timer
  // ============================
  useEffect(() => {
    if (!totalQ || submitted) return undefined;
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [totalQ, submitted]);

  // ============================
  // Final Submit
  // ============================
  const submitExam = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);

    const currentAnswers = answersRef.current;
    let correct = 0;

    questions.forEach((question, index) => {
      let correctAnswer = question.answer;

      // Supports "A", "B", "C", "D"
      if (typeof correctAnswer === 'string') {
        correctAnswer = correctAnswer.trim().toUpperCase().charCodeAt(0) - 65;
      }

      // Supports "2" as string
      correctAnswer = Number(correctAnswer);

      if (currentAnswers[index] === correctAnswer) {
        correct++;
      }
    });

    const wrong = totalQ - correct;
    const percentage = Math.round((correct / totalQ) * 100);

    let grade;
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else grade = 'F';

    const totalSeconds = Math.floor((Date.now() - startTime.current) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const resultData = {
      examId,
      totalQuestions: totalQ,
      correct,
      wrong,
      percentage,
      grade,
      timeTaken: formattedTime,
      answers: currentAnswers,
      questions,
    };

    console.log('Result:', resultData);

    api('/submit_exam', { method: 'POST', json: resultData })
      .then((data) => {
        localStorage.setItem('examResult', JSON.stringify(data));

        const modalEl = document.getElementById('submitModal');
        const modal = window.bootstrap && modalEl ? window.bootstrap.Modal.getInstance(modalEl) : null;
        if (modal) modal.hide();
        cleanupModal();

        navigate('/result');
      })
      .catch((err) => {
        console.error(err);
        if (handleAuthError(err, navigate)) return;
        // allow retrying
        submittedRef.current = false;
        setSubmitted(false);
        alert('Something went wrong.');
      });
  }, [questions, totalQ, examId, navigate]);

  // Time up
  useEffect(() => {
    if (totalQ && timeLeft <= 0 && !submittedRef.current) {
      alert('Time is up! Your exam has been submitted automatically.');
      submitExam();
    }
  }, [timeLeft, totalQ, submitExam]);

  // Make sure no Bootstrap modal backdrop is left behind when leaving the page
  useEffect(() => cleanupModal, []);

  // ============================
  // Open Submit Modal
  // ============================
  const answered = answers.filter((x) => x !== null).length;

  const openSubmitModal = () => {
    const modal = new window.bootstrap.Modal(document.getElementById('submitModal'));
    modal.show();
  };

  // ============================
  // Timer display
  // ============================
  const shown = Math.max(timeLeft, 0);
  const tMin = Math.floor(shown / 60);
  const tSec = shown % 60;
  const timerClass = timeLeft <= 60 ? 'badge bg-danger fs-6 px-3 py-2' : 'badge bg-black fs-6 px-3 py-2';

  const q = questions[current];

  return (
    <>
      {/* ============ NAVBAR ============ */}
      <Navbar collapsible={false} right={
        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="gt-step-pill"><i className="bi bi-2-circle-fill"></i> Step 2 of 3 — Exam</span>
        </div>
      } />

      <main className="gt-section" style={{ paddingTop: '8rem' }}>
        <div className="container">
          <div className="gt-quiz-shell">
            <svg className="gemma-svg gemma-svg-1" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="50" cy="50" r="46" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 6" />
              <circle cx="50" cy="50" r="30" stroke="#000000" strokeWidth="1.5" />
            </svg>

            {/* Progress */}
            <div className="d-flex justify-content-between align-items-center mb-2">

              <span className="fw-semibold" style={{ color: 'var(--color-navy)' }}>
                Question <span id="currentQNum">{current + 1}</span> of{' '}
                <span id="totalQNum">{totalQ || 15}</span>
              </span>

              <div className="d-flex align-items-center gap-3">

                <span className="mono small text-muted-soft" id="answeredCount">
                  {answered} answered
                </span>

                <span
                  id="timer"
                  className={timerClass}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {String(tMin).padStart(2, '0')}:{String(tSec).padStart(2, '0')}
                </span>

              </div>

            </div>
            <div className="gt-progress-track mb-3">
              <div
                className="gt-progress-fill"
                id="progressFill"
                style={{ width: totalQ ? ((current + 1) / totalQ) * 100 + '%' : '12.5%' }}
              ></div>
            </div>
            <div className="gt-qdots mb-4" id="qdots">
              {questions.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={
                    'gt-qdot' +
                    (index === current ? ' current' : '') +
                    (answers[index] !== null ? ' answered' : '')
                  }
                  onClick={() => setCurrent(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {/* Question card */}
            <div className="gt-question-card gt-reveal is-visible">
              <span className="gt-q-topic-badge mb-3 d-inline-block" id="qTopic">
                {q ? q.topic || 'General' : 'Thermodynamics'}
              </span>
              <h4 className="mb-4" id="qText">{q ? q.text : totalQ === 0 ? 'No questions found.' : 'Loading question…'}</h4>
              <div id="optionsList">
                {q && q.options.map((option, index) => {
                  const id = `q${current}_${index}`;
                  return (
                    <label key={id} className={'gt-option' + (answers[current] === index ? ' selected' : '')}>
                      <input
                        type="radio"
                        id={id}
                        name={`question${current}`}
                        checked={answers[current] === index}
                        onChange={() =>
                          setAnswers((prev) => {
                            const next = [...prev];
                            next[current] = index;
                            return next;
                          })
                        }
                      />
                      <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Nav buttons */}
            <div className="d-flex justify-content-between align-items-center mt-4">
              <button className="btn btn-gt-ghost" id="prevBtn" disabled={current === 0}
                onClick={() => current > 0 && setCurrent(current - 1)}>
                <i className="bi bi-arrow-left me-1"></i> Previous
              </button>
              <button className={'btn btn-gt-primary' + (current === totalQ - 1 ? ' d-none' : '')} id="nextBtn"
                onClick={() => current < totalQ - 1 && setCurrent(current + 1)}>
                Next <i className="bi bi-arrow-right ms-1"></i>
              </button>
              <button className={'btn btn-gt-primary' + (current === totalQ - 1 ? '' : ' d-none')} id="submitBtn"
                onClick={openSubmitModal}>
                <i className="bi bi-check2-circle me-1"></i> Submit Exam
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* Submit confirmation modal */}
      <div className="modal fade" id="submitModal" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content" style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}>
            <div className="modal-body text-center p-4">
              <div className="gt-icon-badge mx-auto mb-3" style={{ width: 64, height: 64, fontSize: '1.6rem' }}>
                <i className="bi bi-check2-circle"></i>
              </div>
              <h5 className="mb-2">Submit your exam?</h5>
              <p className="text-muted-soft mb-4" id="submitSummary">
                You've answered {answered} of {totalQ} questions.
              </p>
              <div className="d-flex gap-2 justify-content-center">
                <button className="btn btn-gt-ghost" data-bs-dismiss="modal">Keep reviewing</button>
                <button id="confirmSubmitBtn" className="btn btn-gt-primary" onClick={submitExam}>
                  Yes, Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function cleanupModal() {
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
}
