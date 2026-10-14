import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-.env")

    # ------------------------------------------------------------------
    # MONGODB CONFIGURATION  (set these in backend/.env)
    #   Local  : mongodb://localhost:27017
    #   Atlas  : mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net
    # ------------------------------------------------------------------
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "gemmatutor")

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

    # React dev server origin (only needed if you do NOT use the Vite proxy)
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
