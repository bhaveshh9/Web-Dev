"""
MongoDB connection + collection helpers.

Collections (created automatically on first insert):
  users            { _id, full_name, email(unique), password(hash), role, institution, grade, created_at }
  teacher_uploads  { _id, teacher_id, filename, file_path, title, upload_time }
  exams            { _id, teacher_upload_id|None, total_questions, created_at }
  questions        { _id, exam_id, question_text, options[], correct_answer, topic,
                     difficulty, question_type, explanation, created_at }
  student_attempts { _id, student_id, exam_id, score, percentage, grade, time_taken, submitted_at }
  notifications    { _id, title, message, is_read, created_at }
"""
from datetime import datetime, timedelta

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient, ASCENDING

db = None


def init_db(config):
    """Connect to MongoDB and make sure indexes exist."""
    global db
    client = MongoClient(config["MONGO_URI"], serverSelectionTimeoutMS=5000)
    db = client[config["MONGO_DB_NAME"]]


def ensure_indexes():
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.questions.create_index("exam_id")
    db.student_attempts.create_index("exam_id")
    db.teacher_uploads.create_index("teacher_id")


def col(name):
    return db[name]


def now_ist():
    # same behaviour as the old models: UTC + 5:30
    return datetime.utcnow() + timedelta(hours=5, minutes=30)


def to_oid(value):
    """Convert a string to ObjectId, or None if it is not valid."""
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError):
        return None
