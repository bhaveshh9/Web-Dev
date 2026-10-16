import json
import os
import re

from flask import Flask, request, session, send_file, send_from_directory, jsonify, abort
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

import mongo
from config import Config
from mongo import col, now_ist, to_oid
from utils.gemma_service import generate_questions, generate_feedback
from utils.pdf_reader import extract_text
from utils.text_processor import clean_text

# If you run `npm run build` in /frontend, Flask will also serve the React app
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")

app = Flask(__name__, static_folder=None)
app.config.from_object(Config)

# Allow the React dev server to call the API with the session cookie
CORS(app, supports_credentials=True, origins=[app.config["FRONTEND_ORIGIN"]])

mongo.init_db(app.config)

UPLOAD_FOLDER = app.config["UPLOAD_FOLDER"]
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf"}
MAX_QUESTIONS = 15
DATE_FMT = "%d %b %Y %I:%M %p"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def fmt(dt):
    return dt.strftime(DATE_FMT) if dt else None


def get_or_404(collection, value):
    oid = to_oid(value)
    doc = col(collection).find_one({"_id": oid}) if oid else None
    if doc is None:
        abort(404)
    return doc


def resolve_path(material):
    """
    Older records may store an absolute path from another machine.
    If that file doesn't exist, fall back to uploads/<filename>.
    """
    path = material.get("file_path")
    if path and os.path.exists(path):
        return path
    return os.path.join(app.config["UPLOAD_FOLDER"], material["filename"])


def upload_titles(ids):
    """{teacher_upload _id: title} for a list of ids (None ignored)."""
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    return {d["_id"]: d["title"] for d in col("teacher_uploads").find({"_id": {"$in": ids}})}


def safe_json_extract(raw_text):
    """
    Strips markdown code fences / stray text that LLMs sometimes add
    around JSON output, then parses it.
    """
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise ValueError("AI returned an empty response.")

    text = raw_text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    if not text.startswith("["):
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            text = match.group(0)

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Could not parse AI response as JSON: {e}")


def unauthorized():
    return jsonify({"error": "Please login again.", "redirect": "/login"}), 401


def forbidden(redirect="/login"):
    return jsonify({"error": "Unauthorized Access!", "redirect": redirect}), 403


def require_login():
    return "user_id" in session


def require_role(role):
    return session.get("role") == role


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404
    return e


# ======================================================================
# AUTH
# ======================================================================
@app.route("/api/me")
def me():
    if "user_id" not in session:
        return jsonify({"authenticated": False})
    return jsonify({
        "authenticated": True,
        "user": {"id": session["user_id"], "name": session.get("name"), "role": session.get("role")},
    })


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    user = col("users").find_one({"email": email})

    if user is None:
        return jsonify({"error": "User not found."}), 401

    if user["role"] != role:
        return jsonify({"error": "Incorrect account type selected."}), 401

    if not check_password_hash(user["password"], password or ""):
        return jsonify({"error": "Incorrect password."}), 401

    session["user_id"] = str(user["_id"])
    session["name"] = user["full_name"]
    session["role"] = user["role"]

    return jsonify({
        "user": {"id": str(user["_id"]), "name": user["full_name"], "role": user["role"]},
        "redirect": "/teacher/dashboard" if user["role"] == "teacher" else "/",
    })


@app.route("/api/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully.", "redirect": "/login"})


@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")
    confirm_password = data.get("confirm_password")
    role = data.get("role")

    if password != confirm_password:
        return jsonify({"error": "Passwords do not match."}), 400

    if col("users").find_one({"email": email}):
        return jsonify({"error": "Email already registered."}), 400

    col("users").insert_one({
        "full_name": full_name,
        "email": email,
        "password": generate_password_hash(password),
        "role": role,
        "institution": data.get("institution") if role == "teacher" else None,
        "grade": data.get("grade") if role == "student" else None,
        "created_at": now_ist(),
    })

    return jsonify({"message": "Account created.", "redirect": "/login"})


# ======================================================================
# TEACHER
# ======================================================================
@app.route("/api/teacher/dashboard")
def teacher_dashboard():

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/")

    total_students = col("users").count_documents({"role": "student"})
    total_pdfs = col("teacher_uploads").count_documents({})
    total_exams = col("exams").count_documents({})
    total_attempts = col("student_attempts").count_documents({})

    attempts = list(col("student_attempts").find({}, {"percentage": 1}))
    if attempts:
        average_score = round(sum(a["percentage"] for a in attempts) / len(attempts))
    else:
        average_score = 0

    notifications = list(col("notifications").find().sort("created_at", -1).limit(10))
    unread_count = col("notifications").count_documents({"is_read": False})

    payload = {
        "teacher_name": session["name"],
        "total_students": total_students,
        "total_pdfs": total_pdfs,
        "total_exams": total_exams,
        "total_attempts": total_attempts,
        "average_score": average_score,
        "notifications": [
            {
                "id": str(n["_id"]),
                "title": n["title"],
                "message": n["message"],
                "created_at": fmt(n.get("created_at")),
            }
            for n in notifications
        ],
        "unread_count": unread_count,
    }

    # Mark all as read
    col("notifications").update_many({}, {"$set": {"is_read": True}})

    return jsonify(payload)


@app.route("/api/teacher/upload", methods=["POST"])
def teacher_upload():

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/login")

    if "pdf" not in request.files:
        return jsonify({"error": "Please select a PDF file."}), 400

    file = request.files["pdf"]

    if file.filename == "":
        return jsonify({"error": "Please select a PDF file."}), 400

    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are allowed."}), 400

    filename = secure_filename(file.filename)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    title = request.form["title"]

    col("teacher_uploads").insert_one({
        "teacher_id": to_oid(session["user_id"]),
        "filename": filename,
        "file_path": filepath,
        "title": title,
        "upload_time": now_ist(),
    })

    col("notifications").insert_one({
        "title": "New Study Material",
        "message": f"{title} was uploaded successfully.",
        "is_read": False,
        "created_at": now_ist(),
    })

    return jsonify({
        "message": "Study Material Uploaded Successfully!",
        "redirect": "/teacher/dashboard",
    })


@app.route("/api/teacher/materials")
def study_materials():

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/login")

    materials = col("teacher_uploads").find(
        {"teacher_id": to_oid(session["user_id"])}
    ).sort("upload_time", -1)

    return jsonify({
        "materials": [
            {
                "id": str(m["_id"]),
                "title": m["title"],
                "filename": m["filename"],
                "upload_time": fmt(m.get("upload_time")),
            }
            for m in materials
        ]
    })


@app.route("/api/teacher/material/view/<material_id>")
def view_material(material_id):

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/login")

    material = get_or_404("teacher_uploads", material_id)

    path = resolve_path(material)
    if not os.path.exists(path):
        return jsonify({"error": "PDF file not found on the server."}), 404

    return send_file(path, mimetype="application/pdf")


@app.route("/api/teacher/material/delete/<material_id>", methods=["POST"])
def delete_material(material_id):

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/login")

    material = get_or_404("teacher_uploads", material_id)

    path = resolve_path(material)
    if os.path.exists(path):
        os.remove(path)

    col("teacher_uploads").delete_one({"_id": material["_id"]})

    return jsonify({"message": "Study Material Deleted Successfully!"})


@app.route("/api/generated_exams")
def generated_exams():

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/login")

    exams = list(col("exams").find().sort("created_at", -1))
    titles = upload_titles([e.get("teacher_upload_id") for e in exams])

    return jsonify({
        "exams": [
            {
                "id": str(e["_id"]),
                "title": titles.get(e.get("teacher_upload_id")),
                "created_at": fmt(e.get("created_at")),
            }
            for e in exams
        ]
    })


@app.route("/api/generated_exams/<exam_id>")
def view_generated_exam(exam_id):

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/login")

    exam = get_or_404("exams", exam_id)
    titles = upload_titles([exam.get("teacher_upload_id")])

    questions = list(col("questions").find({"exam_id": exam["_id"]}).sort("_id", 1))

    return jsonify({
        "exam": {"id": str(exam["_id"]), "title": titles.get(exam.get("teacher_upload_id"))},
        "questions": [
            {
                "id": str(q["_id"]),
                "question_text": q["question_text"],
                "options": q.get("options") or [],
                "correct_answer": q["correct_answer"],
                "explanation": q.get("explanation"),
            }
            for q in questions
        ],
    })


def _attempt_rows(attempts):
    """Attach student name / exam info to a list of attempt documents."""
    students = {
        u["_id"]: u["full_name"]
        for u in col("users").find({"_id": {"$in": list({a["student_id"] for a in attempts})}})
    }
    exams = {
        e["_id"]: e
        for e in col("exams").find({"_id": {"$in": list({a["exam_id"] for a in attempts})}})
    }
    titles = upload_titles([e.get("teacher_upload_id") for e in exams.values()])

    rows = []
    for a in attempts:
        exam = exams.get(a["exam_id"], {})
        rows.append({
            "id": str(a["_id"]),
            "student_name": students.get(a["student_id"], "Unknown"),
            "title": titles.get(exam.get("teacher_upload_id")),
            "score": a["score"],
            "total_questions": exam.get("total_questions"),
            "percentage": a["percentage"],
            "grade": a["grade"],
            "time_taken": a.get("time_taken"),
            "submitted_at": fmt(a.get("submitted_at")),
        })
    return rows


@app.route("/api/student_reports")
def student_reports():

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/login")

    attempts = list(col("student_attempts").find().sort("submitted_at", -1))

    return jsonify({"attempts": _attempt_rows(attempts)})


@app.route("/api/student_report/<attempt_id>")
def view_student_report(attempt_id):

    if not require_login():
        return unauthorized()

    if not require_role("teacher"):
        return forbidden("/login")

    attempt = get_or_404("student_attempts", attempt_id)

    return jsonify({"attempt": _attempt_rows([attempt])[0]})


# ======================================================================
# STUDENT
# ======================================================================
@app.route("/api/upload", methods=["GET", "POST"])
def upload():
    if not require_login():
        return unauthorized()

    if not require_role("student"):
        return forbidden("/teacher/dashboard")

    if request.method == "GET":
        official_pdfs = col("teacher_uploads").find().sort("upload_time", -1)

        return jsonify({
            "official_pdfs": [
                {"id": str(p["_id"]), "title": p["title"], "filename": p["filename"]}
                for p in official_pdfs
            ]
        })

    official_pdf_id = request.form.get("official_pdf_id")
    filepath = None
    teacher_upload_id = None

    # An official PDF was selected
    if official_pdf_id:

        material = get_or_404("teacher_uploads", official_pdf_id)

        filepath = resolve_path(material)
        teacher_upload_id = material["_id"]

    # Otherwise use uploaded PDF
    else:

        pdf = request.files.get("pdf")

        if pdf is None or pdf.filename == "":
            return jsonify({"error": "No file was uploaded. Please choose a PDF."}), 400

        if not allowed_file(pdf.filename):
            return jsonify({"error": "Only PDF files are supported."}), 400

        filename = secure_filename(pdf.filename)

        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)

        print("Saving to:", filepath)
        pdf.save(filepath)

    # Extract + clean text
    try:
        text = extract_text(filepath)
    except Exception as e:
        print("PDF extraction failed:", e)
        return jsonify({"error": "Couldn't read that PDF. Please try a different file."}), 400

    cleaned_text = clean_text(text)

    if not cleaned_text or len(cleaned_text) < 50:
        return jsonify({"error": "Couldn't find enough readable text in that PDF."}), 400

    print("=" * 50)
    print("Length:", len(cleaned_text))
    print(cleaned_text[:1000])
    print("=" * 50)

    # Generate questions
    try:
        raw_response = generate_questions(cleaned_text)
        questions = safe_json_extract(raw_response)
    except Exception as e:
        app.logger.exception("Question generation failed: %s", e)
        return jsonify({"error": "The AI couldn't generate questions from this document. Please try again."}), 503

    if not isinstance(questions, list) or len(questions) == 0:
        return jsonify({"error": "The AI didn't return any valid questions. Please try again."}), 503

    if len(questions) > MAX_QUESTIONS:
        print(f"Expected at most {MAX_QUESTIONS} questions, got {len(questions)} — truncating.")
        questions = questions[:MAX_QUESTIONS]

    exam_id = col("exams").insert_one({
        "teacher_upload_id": teacher_upload_id,
        "total_questions": len(questions),
        "created_at": now_ist(),
    }).inserted_id

    col("questions").insert_many([
        {
            "exam_id": exam_id,
            "question_text": q["text"],
            "options": q["options"],
            "correct_answer": q["answer"],
            "topic": q.get("topic"),
            "difficulty": q.get("difficulty"),
            "question_type": q.get("type"),
            "explanation": q.get("explanation"),
            "created_at": now_ist(),
        }
        for q in questions
    ])
    print(questions)

    return jsonify({"questions": questions, "exam_id": str(exam_id)})


@app.route("/api/submit_exam", methods=["POST"])
def submit_exam():

    data = request.get_json(silent=True) or {}
    exam_id = data.get("examId")
    print("Exam ID:", exam_id)
    if "user_id" not in session:
        return {"error": "Please login again."}, 401
    student_id = to_oid(session["user_id"])
    print("Student ID:", student_id)
    questions = data.get("questions") or []
    answers = data.get("answers") or []
    time_taken = data.get("timeTaken", "--:--")
    total_questions = len(questions)

    exam_oid = to_oid(exam_id)
    if exam_oid is None:
        return {"error": "Invalid exam."}, 400

    if total_questions == 0:
        return {"error": "No questions were submitted."}, 400

    correct = 0
    correct_topics = []
    weak_topics = []
    review_questions = []

    # Calculate Score
    for i, question in enumerate(questions):

        correct_answer = question.get("answer")

        if correct_answer is None:
            print("Missing answer:", question)
            continue

        # Supports A/B/C/D
        if isinstance(correct_answer, str):
            correct_answer = correct_answer.strip().upper()
            if correct_answer in ["A", "B", "C", "D"]:
                correct_answer = ord(correct_answer) - 65

        try:
            correct_answer = int(correct_answer)
        except (TypeError, ValueError):
            print("Unparseable answer, skipping:", question)
            continue

        user_answer = answers[i] if i < len(answers) else None
        review_questions.append({
            "question": question.get("text"),
            "options": question.get("options"),
            "correct_answer": correct_answer,
            "student_answer": user_answer,
            "topic": question.get("topic"),
            "explanation": question.get("explanation", ""),
        })
        if user_answer == correct_answer:
            correct += 1
            correct_topics.append(question.get("topic", "General"))
        else:
            weak_topics.append(question.get("topic", "General"))

    wrong = total_questions - correct
    percentage = round((correct / total_questions) * 100) if total_questions else 0

    # Grade
    if percentage >= 90:
        grade = "A+"
    elif percentage >= 80:
        grade = "A"
    elif percentage >= 70:
        grade = "B"
    elif percentage >= 60:
        grade = "C"
    else:
        grade = "F"

    # Save Student Attempt
    attempt_id = col("student_attempts").insert_one({
        "student_id": student_id,
        "exam_id": exam_oid,
        "score": correct,
        "percentage": float(percentage),
        "grade": grade,
        "time_taken": time_taken,
        "submitted_at": now_ist(),
    }).inserted_id

    print("Student Attempt Saved:", attempt_id)

    # Create Notification (only for exams made from a teacher's PDF)
    exam = col("exams").find_one({"_id": exam_oid})

    if exam and exam.get("teacher_upload_id"):
        upload_doc = col("teacher_uploads").find_one({"_id": exam["teacher_upload_id"]})

        if upload_doc:
            col("notifications").insert_one({
                "title": "New Exam Submission",
                "message": (
                    f"{session['name']} completed "
                    f"'{upload_doc['title']}' "
                    f"and scored {percentage}% "
                    f"(Grade {grade})."
                ),
                "is_read": False,
                "created_at": now_ist(),
            })

    # Call Gemma for feedback
    try:
        ai_feedback = generate_feedback(
            chapter="Uploaded PDF",
            total_questions=total_questions,
            correct_answers=correct,
            percentage=percentage,
            grade=grade,
            correct_topics=correct_topics,
            weak_topics=weak_topics,
        )
    except Exception as e:
        print("Feedback generation failed:", e)
        ai_feedback = {
            "feedback": "Unable to generate personalized feedback.",
            "strengths": [],
            "weak_topics": [],
            "recommended_topics": [],
            "youtube_videos": [],
        }

    print("=" * 50)
    print("AI Feedback")
    print(ai_feedback)
    print("=" * 50)

    return {
        "totalQuestions": total_questions,
        "correct": correct,
        "wrong": wrong,
        "percentage": percentage,
        "grade": grade,
        "timeTaken": time_taken,
        "chapter": "Uploaded PDF",
        "feedback": ai_feedback,
        "questions": questions,
        "review_questions": review_questions,
    }


@app.after_request
def add_no_cache_headers(response):

    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    return response


# ======================================================================
# Serve the built React app (after `npm run build`) — optional
# ======================================================================
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404

    dist = os.path.abspath(FRONTEND_DIST)
    if not os.path.isdir(dist):
        return (
            "React build not found. Run `npm run dev` in /frontend (http://localhost:5173) "
            "or `npm run build` to let Flask serve it.",
            404,
        )

    full = os.path.join(dist, path)
    if path and os.path.isfile(full):
        return send_from_directory(dist, path)
    return send_from_directory(dist, "index.html")


if __name__ == "__main__":
    mongo.ensure_indexes()

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
