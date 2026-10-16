# GemmaTutor AI — MERN (MongoDB · Express · React · Node)

```
frontend/   React (Vite) website
backend/    Node.js + Express API  ->  MongoDB
            server.js            entry point
            src/app.js           express app (cors, session, routes)
            src/routes/          auth.js · teacher.js · student.js
            src/utils/           gemmaService.js (Ollama) · pdfReader.js · passwords.js ...
            src/db.js            MongoDB connection (collections documented at the top)
```

## Requirements
Node.js 18+ (22 recommended), MongoDB running, Ollama with `gemma4:e4b` pulled.

## Setup (once)
```bash
npm run install-all
copy backend\.env.example backend\.env      # Mac/Linux: cp backend/.env.example backend/.env
```
Edit `backend/.env`: `SECRET_KEY`, `MONGO_URI`, `MONGO_DB_NAME`, `OLLAMA_MODEL`.

## Run (development) — one command
```bash
npm run dev
```
- API      -> http://localhost:5000
- Website  -> http://localhost:5173   (open this one)

Or run them separately: `cd backend && npm run dev` and `cd frontend && npm run dev`.

## Production (single server)
```bash
npm run build      # builds the React app
npm start          # Express serves the API + the built website on :5000
```

## Notes
- Users created by the old Flask version can still log in (same password hash format).
- Everyone must log in once again after switching (new session cookie).
