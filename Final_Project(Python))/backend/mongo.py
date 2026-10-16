
"""
MongoDB connection and collection helpers.
"""

from datetime import datetime, timedelta

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError

db = None
client = None


def init_db(config):
    """Connect to MongoDB, verify the connection, and select the database."""
    global db, client

    uri = config.get("MONGO_URI", "mongodb://127.0.0.1:27017/")
    db_name = config.get("MONGO_DB_NAME", "gemmatutor")

    new_client = MongoClient(
        uri,
        serverSelectionTimeoutMS=5000
    )

    try:
        new_client.admin.command("ping")
        new_db = new_client[db_name]
    except PyMongoError:
        new_client.close()
        raise

    # Replace the previous connection only after the new one succeeds.
    old_client = client
    client = new_client
    db = new_db

    if old_client is not None:
        old_client.close()

    print(f"MongoDB connected successfully: {db_name}")
    ensure_indexes()

    return db


def ensure_indexes():
    """Create indexes required by the application."""
    if db is None:
        raise RuntimeError("Call init_db(config) before ensure_indexes().")

    db.users.create_index(
        [("email", ASCENDING)],
        unique=True
    )
    db.questions.create_index("exam_id")
    db.student_attempts.create_index("exam_id")
    db.teacher_uploads.create_index("teacher_id")


def col(name):
    """Return a collection by name."""
    if db is None:
        raise RuntimeError("MongoDB is not initialized. Call init_db(config).")

    return db[name]


def now_ist():
    """Return the current IST time as a naive datetime, for legacy compatibility."""
    return datetime.utcnow() + timedelta(hours=5, minutes=30)


def to_oid(value):
    """Convert a string to ObjectId, or return None if invalid."""
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError):
        return None


def close_db():
    """Close the MongoDB connection when the application shuts down."""
    global client, db

    if client is not None:
        client.close()

    client = None
    db = None
