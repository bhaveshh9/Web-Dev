import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { col } from '../db.js';
import { config } from '../config.js';
import { requireLogin, requireRole } from '../middleware/auth.js';
import { fmt, nowIST, secureFilename, toOid, wrap } from '../utils/helpers.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const teacherOnly = [requireLogin, requireRole('teacher', '/login')];

/** Older records may store an absolute path from another machine; fall back to uploads/<filename>. */
export function resolvePath(material) {
  if (material.file_path && fs.existsSync(material.file_path)) return material.file_path;
  return path.join(config.uploadFolder, material.filename);
}

/** { upload _id (string): title } for a list of ids */
export async function uploadTitles(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))].map(toOid).filter(Boolean);
  if (!unique.length) return {};
  const docs = await col('teacher_uploads').find({ _id: { $in: unique } }).toArray();
  return Object.fromEntries(docs.map((d) => [String(d._id), d.title]));
}

// ---------------------------------------------------------------- dashboard
router.get('/teacher/dashboard', requireLogin, requireRole('teacher', '/'), wrap(async (req, res) => {
  const [totalStudents, totalPdfs, totalExams, totalAttempts] = await Promise.all([
    col('users').countDocuments({ role: 'student' }),
    col('teacher_uploads').countDocuments({}),
    col('exams').countDocuments({}),
    col('student_attempts').countDocuments({}),
  ]);

  const attempts = await col('student_attempts').find({}, { projection: { percentage: 1 } }).toArray();
  const averageScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
    : 0;

  const notifications = await col('notifications').find({}).sort({ created_at: -1 }).limit(10).toArray();
  const unreadCount = await col('notifications').countDocuments({ is_read: false });

  const payload = {
    teacher_name: req.session.name,
    total_students: totalStudents,
    total_pdfs: totalPdfs,
    total_exams: totalExams,
    total_attempts: totalAttempts,
    average_score: averageScore,
    notifications: notifications.map((n) => ({
      id: String(n._id), title: n.title, message: n.message, created_at: fmt(n.created_at),
    })),
    unread_count: unreadCount,
  };

  // Mark all as read
  await col('notifications').updateMany({}, { $set: { is_read: true } });

  res.json(payload);
}));

// ---------------------------------------------------------------- upload study material
router.post('/teacher/upload', ...teacherOnly, upload.single('pdf'), wrap(async (req, res) => {
  const file = req.file;
  if (!file || !file.originalname) return res.status(400).json({ error: 'Please select a PDF file.' });

  if (!file.originalname.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'Only PDF files are allowed.' });
  }

  const filename = secureFilename(file.originalname);
  fs.mkdirSync(config.uploadFolder, { recursive: true });
  const filepath = path.join(config.uploadFolder, filename);
  fs.writeFileSync(filepath, file.buffer);

  const title = (req.body && req.body.title) || '';

  await col('teacher_uploads').insertOne({
    teacher_id: toOid(req.session.user_id),
    filename,
    file_path: filepath,
    title,
    upload_time: nowIST(),
  });

  await col('notifications').insertOne({
    title: 'New Study Material',
    message: `${title} was uploaded successfully.`,
    is_read: false,
    created_at: nowIST(),
  });

  res.json({ message: 'Study Material Uploaded Successfully!', redirect: '/teacher/dashboard' });
}));

// ---------------------------------------------------------------- study materials
router.get('/teacher/materials', ...teacherOnly, wrap(async (req, res) => {
  const materials = await col('teacher_uploads')
    .find({ teacher_id: toOid(req.session.user_id) })
    .sort({ upload_time: -1 })
    .toArray();

  res.json({
    materials: materials.map((m) => ({
      id: String(m._id), title: m.title, filename: m.filename, upload_time: fmt(m.upload_time),
    })),
  });
}));

router.get('/teacher/material/view/:id', ...teacherOnly, wrap(async (req, res) => {
  const oid = toOid(req.params.id);
  const material = oid && (await col('teacher_uploads').findOne({ _id: oid }));
  if (!material) return res.status(404).json({ error: 'Not found' });

  const p = resolvePath(material);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'PDF file not found on the server.' });

  res.type('application/pdf').sendFile(path.resolve(p));
}));

router.post('/teacher/material/delete/:id', ...teacherOnly, wrap(async (req, res) => {
  const oid = toOid(req.params.id);
  const material = oid && (await col('teacher_uploads').findOne({ _id: oid }));
  if (!material) return res.status(404).json({ error: 'Not found' });

  const p = resolvePath(material);
  if (fs.existsSync(p)) fs.unlinkSync(p);

  await col('teacher_uploads').deleteOne({ _id: material._id });
  res.json({ message: 'Study Material Deleted Successfully!' });
}));

// ---------------------------------------------------------------- generated exams
router.get('/generated_exams', ...teacherOnly, wrap(async (req, res) => {
  const exams = await col('exams').find({}).sort({ created_at: -1 }).toArray();
  const titles = await uploadTitles(exams.map((e) => e.teacher_upload_id));

  res.json({
    exams: exams.map((e) => ({
      id: String(e._id),
      title: e.teacher_upload_id ? titles[String(e.teacher_upload_id)] ?? null : null,
      created_at: fmt(e.created_at),
    })),
  });
}));

router.get('/generated_exams/:id', ...teacherOnly, wrap(async (req, res) => {
  const oid = toOid(req.params.id);
  const exam = oid && (await col('exams').findOne({ _id: oid }));
  if (!exam) return res.status(404).json({ error: 'Not found' });

  const titles = await uploadTitles([exam.teacher_upload_id]);
  const questions = await col('questions').find({ exam_id: exam._id }).sort({ _id: 1 }).toArray();

  res.json({
    exam: {
      id: String(exam._id),
      title: exam.teacher_upload_id ? titles[String(exam.teacher_upload_id)] ?? null : null,
    },
    questions: questions.map((q) => ({
      id: String(q._id),
      question_text: q.question_text,
      options: q.options || [],
      correct_answer: q.correct_answer,
      explanation: q.explanation ?? null,
    })),
  });
}));

// ---------------------------------------------------------------- student reports
async function attemptRows(attempts) {
  const studentIds = [...new Set(attempts.map((a) => String(a.student_id)))].map(toOid).filter(Boolean);
  const examIds = [...new Set(attempts.map((a) => String(a.exam_id)))].map(toOid).filter(Boolean);

  const students = Object.fromEntries(
    (studentIds.length ? await col('users').find({ _id: { $in: studentIds } }).toArray() : [])
      .map((u) => [String(u._id), u.full_name]),
  );
  const exams = Object.fromEntries(
    (examIds.length ? await col('exams').find({ _id: { $in: examIds } }).toArray() : [])
      .map((e) => [String(e._id), e]),
  );
  const titles = await uploadTitles(Object.values(exams).map((e) => e.teacher_upload_id));

  return attempts.map((a) => {
    const exam = exams[String(a.exam_id)] || {};
    return {
      id: String(a._id),
      student_name: students[String(a.student_id)] || 'Unknown',
      title: exam.teacher_upload_id ? titles[String(exam.teacher_upload_id)] ?? null : null,
      score: a.score,
      total_questions: exam.total_questions ?? null,
      percentage: a.percentage,
      grade: a.grade,
      time_taken: a.time_taken ?? null,
      submitted_at: fmt(a.submitted_at),
    };
  });
}

router.get('/student_reports', ...teacherOnly, wrap(async (req, res) => {
  const attempts = await col('student_attempts').find({}).sort({ submitted_at: -1 }).toArray();
  res.json({ attempts: await attemptRows(attempts) });
}));

router.get('/student_report/:id', ...teacherOnly, wrap(async (req, res) => {
  const oid = toOid(req.params.id);
  const attempt = oid && (await col('student_attempts').findOne({ _id: oid }));
  if (!attempt) return res.status(404).json({ error: 'Not found' });
  res.json({ attempt: (await attemptRows([attempt]))[0] });
}));

export default router;
