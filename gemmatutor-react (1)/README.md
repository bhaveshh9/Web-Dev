# GemmaTutor AI — React + Flask + MongoDB

```
frontend/  React (Vite) website — same UI, same style.css, same URLs
backend/   Flask API (Python + PyMongo) -> MongoDB
```

## Requirements
Python 3.10+, Node.js 18+, **MongoDB** (local Community Server or a free Atlas cluster),
and Ollama with `ollama pull gemma4:e4b`.

## 1. MongoDB configuration
Copy `backend/.env.example` to `backend/.env` and set:
```
SECRET_KEY=your-long-random-string
MONGO_URI=mongodb://localhost:27017        # or your mongodb+srv://... Atlas URI
MONGO_DB_NAME=gemmatutor
```
Collections are created automatically: `users`, `teacher_uploads`, `exams`, `questions`,
`student_attempts`, `notifications` (fields documented at the top of `backend/mongo.py`).

### Moving your old SQLite data (optional, run once)
```bash
cd backend
python tools/migrate_sqlite_to_mongo.py tools/gemmatutor_old.db
```
Passwords, PDFs, exams, questions, attempts and notifications are copied; existing logins keep working.

## 2. Run
```bash
# Terminal 1 — API
cd backend
python -m venv venv
venv\Scripts\activate          # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python app.py                  # http://localhost:5000

# Terminal 2 — website
cd frontend
npm install
npm run dev                    # open http://localhost:5173
```
Production: `npm run build` in `frontend`, then `python app.py` serves everything on port 5000.
