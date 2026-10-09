import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'evidencelock-super-secure-production-cryptographic-secret-2026')
    
    # Primary PostgreSQL URI with automatic fallback if Postgres is not reachable
    # Format: postgresql://username:password@localhost:5432/evidencelock
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f"sqlite:///{BASE_DIR / 'data' / 'evidencelock.sqlite'}"
    )
    # Support Heroku/cloud postgres:// style URIs
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    STORAGE_DIR = BASE_DIR / 'storage'
    EVIDENCE_DIR = STORAGE_DIR / 'evidence'
    STAGING_DIR = STORAGE_DIR / 'staging'
    KEYS_DIR = BASE_DIR / 'keys'
    
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.environ.get('NODE_ENV') == 'production'
    SESSION_COOKIE_SAMESITE = 'Lax'
