import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { col } from '../db.js';
import { config } from '../config.js';
import { requireLogin, requireRole } from '../middleware/auth.js';
import { nowIST, secureFilename, toOid, wrap } from '../utils/helpers.js';
import { extractText } from '../utils/pdfReader.js';
import { cleanText } from '../utils/textProcessor.js';
import { generateQuestions, generateFeedback } from '../utils/gemmaService.js';
import { resolvePath } from './teacher.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const MAX_QUESTIONS = 15;

// ---------------------------------------------------------------- list official PDFs
router.get('/upload', requireLogin, requireRole('student', '/teacher/dashboard'), wrap(async (req, res) => {
  const pdfs = await col('teacher_uploads').find({}).sort({ upload_time: -1 }).toArray();
  res.json({
    official_pdfs: pdfs.map((p) => ({ id: String(p._id), title: p.title, filename: p.filename })),
  });
}));

// ---------------------------------------------------------------- generate exam
router.post('/upload', requireLogin, requireRole('student', '/teacher/dashboard'), upload.single('pdf'), wrap(async (req, res) => {
  const officialPdfId = req.body && req.body.official_pdf_id;
  let fileBuffer = null;
  let teacherUploadId = null;

  if (officialPdfId) {
    // An official PDF was selected
    const oid = toOid(officialPdfId);
    const material = oid && (await col('teacher_uploads').findOne({ _id: oid }));
    if (!material) return res.status(404).json({ error: 'Not found' });

    const p = resolvePath(material);
    if (!fs.existsSync(p)) {
      return res.status(400).json({ error: "Couldn't read that PDF. Please try a different file." });
    }
    fileBuffer = fs.readFileSync(p);
    teacherUploadId = material._id;
  } else {
    // Otherwise use the uploaded PDF
    const pdf = req.file;
    if (!pdf || !pdf.originalname) {
      return res.status(400).json({ error: 'No file was uploaded. Please choose a PDF.' });
    }
    if (!pdf.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are supported.' });
    }

    const filename = secureFilename(pdf.originalname);
    fs.mkdirSync(config.uploadFolder, { recursive: true });
    const filepath = path.join(config.uploadFolder, filename);
    console.log('Saving to:', filepath);
    fs.writeFileSync(filepath, pdf.buffer);
    fileBuffer = pdf.buffer;
  }

  // Extract + clean text
  let text;
  try {
    text = await extractText(fileBuffer);
  } catch (e) {
    console.log('PDF extraction failed:', e.message);
    return res.status(400).json({ error: "Couldn't read that PDF. Please try a different file." });
  }

  const cleaned = cleanText(text);
  if (!cleaned || cleaned.length < 50) {
    return res.status(400).json({ error: "Couldn't find enough readable text in that PDF." });
  }

  console.log('='.repeat(50));
  console.log('Length:', cleaned.length);
  console.log(cleaned.slice(0, 1000));
  console.log('='.repeat(50));

  // Generate questions (AI call)
  let questions;
  try {
    questions = await generateQuestions(cleaned);
  } catch (e) {
    console.log('Question generation failed:', e.message);
    return res.status(503).json({ error: "The AI couldn't generate questions from this document. Please try again." });
  }

  if (!Array.isArray(questions) || !questions.length) {
    return res.status(503).json({ error: "The AI didn't return any valid questions. Please try again." });
  }
  if (questions.length > MAX_QUESTIONS) questions = questions.slice(0, MAX_QUESTIONS);

  const { insertedId: examId } = await col('exams').insertOne({
    teacher_upload_id: teacherUploadId,
    total_questions: questions.length,
    created_at: nowIST(),
  });

  await col('questions').insertMany(
    questions.map((q) => ({
      exam_id: examId,
      question_text: q.text,
      options: q.options,
      correct_answer: q.answer,
      topic: q.topic ?? null,
      difficulty: q.difficulty ?? null,
      question_type: q.type ?? null,
      explanation: q.explanation ?? null,
      created_at: nowIST(),
    })),
  );

  res.json({ questions, exam_id: String(examId) });
}));

// ---------------------------------------------------------------- submit exam
router.post('/submit_exam', wrap(async (req, res) => {
  const data = req.body || {};
  if (!req.session || !req.session.user_id) return res.status(401).json({ error: 'Please login again.' });

  const examOid = toOid(data.examId);
  if (!examOid) return res.status(400).json({ error: 'Invalid exam.' });

  const studentId = toOid(req.session.user_id);
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const answers = Array.isArray(data.answers) ? data.answers : [];
  const timeTaken = data.timeTaken || '--:--';
  const totalQuestions = questions.length;

  if (totalQuestions === 0) return res.status(400).json({ error: 'No questions were submitted.' });

  let correct = 0;
  const correctTopics = [];
  const weakTopics = [];
  const reviewQuestions = [];

  // Calculate Score
  questions.forEach((question, i) => {
    let correctAnswer = question.answer;
    if (correctAnswer === undefined || correctAnswer === null) {
      console.log('Missing answer:', question);
      return;
    }

    // Supports A/B/C/D
    if (typeof correctAnswer === 'string') {
      correctAnswer = correctAnswer.trim().toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(correctAnswer)) correctAnswer = correctAnswer.charCodeAt(0) - 65;
    }

    correctAnswer = Number.parseInt(correctAnswer, 10);
    if (Number.isNaN(correctAnswer)) {
      console.log('Unparseable answer, skipping:', question);
      return;
    }

    const userAnswer = i < answers.length ? answers[i] : null;
    reviewQuestions.push({
      question: question.text,
      options: question.options,
      correct_answer: correctAnswer,
      student_answer: userAnswer,
      topic: question.topic,
      explanation: question.explanation || '',
    });

    if (userAnswer === correctAnswer) {
      correct += 1;
      correctTopics.push(question.topic || 'General');
    } else {
      weakTopics.push(question.topic || 'General');
    }
  });

  const wrong = totalQuestions - correct;
  const percentage = Math.round((correct / totalQuestions) * 100);

  let grade;
  if (percentage >= 90) grade = 'A+';
  else if (percentage >= 80) grade = 'A';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  else grade = 'F';

  // Save Student Attempt
  const { insertedId } = await col('student_attempts').insertOne({
    student_id: studentId,
    exam_id: examOid,
    score: correct,
    percentage,
    grade,
    time_taken: timeTaken,
    submitted_at: nowIST(),
  });
  console.log('Student Attempt Saved:', String(insertedId));

  // Create Notification (only for exams made from a teacher's PDF)
  const exam = await col('exams').findOne({ _id: examOid });
  if (exam && exam.teacher_upload_id) {
    const uploadDoc = await col('teacher_uploads').findOne({ _id: exam.teacher_upload_id });
    if (uploadDoc) {
      await col('notifications').insertOne({
        title: 'New Exam Submission',
        message:
          `${req.session.name} completed '${uploadDoc.title}' ` +
          `and scored ${percentage}% (Grade ${grade}).`,
        is_read: false,
        created_at: nowIST(),
      });
    }
  }

  // Call Gemma for feedback (has its own fallback)
  const aiFeedback = await generateFeedback({
    chapter: 'Uploaded PDF',
    totalQuestions,
    correctAnswers: correct,
    percentage,
    grade,
    correctTopics,
    weakTopics,
  });

  console.log('='.repeat(50));
  console.log('AI Feedback', aiFeedback);
  console.log('='.repeat(50));

  res.json({
    totalQuestions,
    correct,
    wrong,
    percentage,
    grade,
    timeTaken,
    chapter: 'Uploaded PDF',
    feedback: aiFeedback,
    questions,
    review_questions: reviewQuestions,
  });
}));

export default router;
