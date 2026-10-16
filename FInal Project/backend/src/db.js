/**
 * MongoDB connection + collection helper.
 *
 * Collections (created automatically on first insert):
 *   users            { _id, full_name, email(unique), password(hash), role, institution, grade, created_at }
 *   teacher_uploads  { _id, teacher_id, filename, file_path, title, upload_time }
 *   exams            { _id, teacher_upload_id|null, total_questions, created_at }
 *   questions        { _id, exam_id, question_text, options[], correct_answer, topic,
 *                      difficulty, question_type, explanation, created_at }
 *   student_attempts { _id, student_id, exam_id, score, percentage, grade, time_taken, submitted_at }
 *   notifications    { _id, title, message, is_read, created_at }
 */
import { MongoClient } from 'mongodb';
import { config } from './config.js';

let client = null;
let db = null;

export async function connectDb() {
  client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(config.mongoDbName);
  await ensureIndexes();
  return db;
}

// lets tests plug in a fake database
export function setDb(fakeDb) {
  db = fakeDb;
}

export const col = (name) => db.collection(name);

export async function ensureIndexes() {
  await col('users').createIndex({ email: 1 }, { unique: true });
  await col('questions').createIndex({ exam_id: 1 });
  await col('student_attempts').createIndex({ exam_id: 1 });
  await col('teacher_uploads').createIndex({ teacher_id: 1 });
}
