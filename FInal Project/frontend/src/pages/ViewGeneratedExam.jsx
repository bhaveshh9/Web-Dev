import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, handleAuthError } from '../lib/api.js';

export default function ViewGeneratedExam() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api(`/generated_exams/${examId}`)
      .then(setData)
      .catch((err) => handleAuthError(err, navigate));
  }, [examId, navigate]);

  if (!data) return null;

  const { exam, questions } = data;

  return (
    <>
      <nav className="navbar navbar-expand-lg gt-navbar">
        <div className="container">
          <Link className="navbar-brand gt-logo" to="/teacher/dashboard">
            GemmaTutor AI
          </Link>
        </div>
      </nav>

      <div className="container mt-5 pt-5">

        <div className="d-flex justify-content-between align-items-center mb-4">

          <div>
            <h2>Generated Exam</h2>

            <p className="text-muted mb-0">
              {exam.title ? exam.title : 'Student Uploaded PDF'}
            </p>
          </div>

          <Link to="/generated_exams" className="btn btn-gt-outline">
            ← Back
          </Link>

        </div>

        {questions.map((question, qi) => (
          <div className="gt-card p-4 mb-4" key={question.id}>

            <h5 className="mb-3">
              Q{qi + 1}. {question.question_text}
            </h5>

            {question.options.map((option, oi) => (
              <div
                key={oi}
                className={'list-group-item mb-2' + (oi === question.correct_answer ? ' list-group-item-success' : '')}
              >
                {option}
              </div>
            ))}

            {question.explanation && (
              <div className="alert alert-info mt-3">
                <strong>Explanation:</strong>{' '}
                {question.explanation}
              </div>
            )}

          </div>
        ))}

      </div>
    </>
  );
}
