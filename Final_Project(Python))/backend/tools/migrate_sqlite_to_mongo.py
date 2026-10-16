"""
One-time migration: old SQLite file  ->  MongoDB.

Usage (from the backend folder, venv active, MongoDB running):
    python tools/migrate_sqlite_to_mongo.py tools/gemmatutor_old.db

Password hashes are copied as-is, so existing logins keep working.
Integer foreign keys are converted to the new ObjectIds.
Run it once on an EMPTY database (it refuses to run if users already exist).
"""
import json
import os
import sqlite3
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import mongo
from config import Config


def dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def rows(conn, table):
    cur = conn.execute(f"SELECT * FROM {table}")
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def main(path, mongo_db=None):
    conn = sqlite3.connect(path)

    if mongo_db is None:
        mongo.init_db({"MONGO_URI": Config.MONGO_URI, "MONGO_DB_NAME": Config.MONGO_DB_NAME})
    else:
        mongo.db = mongo_db
    db = mongo.db

    if db.users.count_documents({}) > 0:
        sys.exit("MongoDB already has users — refusing to migrate into a non-empty database.")

    user_map, upload_map, exam_map = {}, {}, {}

    for r in rows(conn, "users"):
        res = db.users.insert_one({
            "full_name": r["full_name"], "email": r["email"], "password": r["password"],
            "role": r["role"], "institution": r["institution"], "grade": r["grade"],
            "created_at": dt(r["created_at"]),
        })
        user_map[r["id"]] = res.inserted_id

    for r in rows(conn, "teacher_uploads"):
        res = db.teacher_uploads.insert_one({
            "teacher_id": user_map.get(r["teacher_id"]), "filename": r["filename"],
            "file_path": r["file_path"], "title": r["title"], "upload_time": dt(r["upload_time"]),
        })
        upload_map[r["id"]] = res.inserted_id

    for r in rows(conn, "exams"):
        res = db.exams.insert_one({
            "teacher_upload_id": upload_map.get(r["teacher_upload_id"]),
            "total_questions": r["total_questions"], "created_at": dt(r["created_at"]),
        })
        exam_map[r["id"]] = res.inserted_id

    qs = []
    for r in sorted(rows(conn, "questions"), key=lambda x: x["id"]):
        opts = r["options"]
        if isinstance(opts, str):
            try:
                opts = json.loads(opts)
            except ValueError:
                opts = []
        qs.append({
            "exam_id": exam_map.get(r["exam_id"]), "question_text": r["question_text"],
            "options": opts, "correct_answer": r["correct_answer"], "topic": r["topic"],
            "difficulty": r["difficulty"], "question_type": r["question_type"],
            "explanation": r["explanation"], "created_at": dt(r["created_at"]),
        })
    if qs:
        db.questions.insert_many(qs)

    atts = [{
        "student_id": user_map.get(r["student_id"]), "exam_id": exam_map.get(r["exam_id"]),
        "score": r["score"], "percentage": float(r["percentage"]), "grade": r["grade"],
        "time_taken": r["time_taken"], "submitted_at": dt(r["submitted_at"]),
    } for r in rows(conn, "student_attempts")]
    if atts:
        db.student_attempts.insert_many(atts)

    notes = [{
        "title": r["title"], "message": r["message"], "is_read": bool(r["is_read"]),
        "created_at": dt(r["created_at"]),
    } for r in rows(conn, "notifications")]
    if notes:
        db.notifications.insert_many(notes)

    mongo.ensure_indexes()
    print(f"Migrated: {len(user_map)} users, {len(upload_map)} PDFs, {len(exam_map)} exams, "
          f"{len(qs)} questions, {len(atts)} attempts, {len(notes)} notifications.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python tools/migrate_sqlite_to_mongo.py path/to/old.db")
    main(sys.argv[1])
