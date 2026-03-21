from __future__ import annotations

import atexit
import logging

from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient

from .config import Config

logger = logging.getLogger(__name__)

mongo_client: MongoClient = None  # type: ignore
db = None


def get_db():
    if db is None:
        raise RuntimeError("MongoDB is not connected. Set a valid MONGODB_URI in backend/.env")
    return db


def create_app() -> Flask:
    global mongo_client, db

    app = Flask(__name__)
    app.config.from_object(Config)

    cors_origins = Config.CORS_ORIGINS
    if cors_origins == "*":
        CORS(app)
    else:
        CORS(app, origins=[o.strip() for o in cors_origins.split(",")])

    try:
        mongo_client = MongoClient(Config.MONGODB_URI, serverSelectionTimeoutMS=5000)
        atexit.register(mongo_client.close)
        try:
            db = mongo_client.get_default_database()
        except Exception:
            db = mongo_client["historic_event"]
    except Exception as e:
        logger.warning("Could not connect to MongoDB: %s", e)
        logger.warning("App will start but database operations will fail. Set a valid MONGODB_URI in backend/.env")
        db = None

    if db is not None:
        from .models import ensure_indexes
        try:
            ensure_indexes(db)
        except Exception as e:
            logger.warning("Could not create indexes (MongoDB may not be available): %s", e)

    @app.route("/health")
    def health_check():
        mongo_ok = db is not None
        if mongo_ok:
            try:
                mongo_client.admin.command("ping")
            except Exception:
                mongo_ok = False
        status_code = 200 if mongo_ok else 503
        return jsonify({"status": "ok" if mongo_ok else "degraded", "mongodb": mongo_ok}), status_code

    from .api.routes import api_bp
    app.register_blueprint(api_bp, url_prefix="/api")

    return app
