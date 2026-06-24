"""
Stitch ATS — Database Configuration
SQLite + SQLAlchemy async-compatible setup
"""

from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

import os

_db_path = Path(__file__).resolve().parent / "stitch_ats.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_db_path}")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency for FastAPI routes — yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables on startup and apply light column migrations if needed."""
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Self-healing migration for SQLite columns
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            # Check jobs table columns
            res = conn.execute(text("PRAGMA table_info(jobs)"))
            columns = [row[1] for row in res.fetchall()]
            if "screening_questions" not in columns:
                conn.execute(text("ALTER TABLE jobs ADD COLUMN screening_questions TEXT"))
                conn.commit()

            # Check candidates table columns
            res = conn.execute(text("PRAGMA table_info(candidates)"))
            columns = [row[1] for row in res.fetchall()]
            
            # Add missing assessment columns to candidates
            candidate_cols = {
                "assessment_token": "VARCHAR",
                "assessment_score": "FLOAT",
                "assessment_status": "VARCHAR",
                "assessment_responses": "TEXT",
                "assessment_violations": "INTEGER",
                "github_url": "VARCHAR",
                "github_analysis": "TEXT",
                "assessment_questions": "TEXT"
            }
            altered = False
            for col_name, col_type in candidate_cols.items():
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE candidates ADD COLUMN {col_name} {col_type}"))
                    altered = True
            if altered:
                conn.commit()
    except Exception as e:
        print(f"[DATABASE MIGRATION ERROR] Failed to apply column updates: {e}")

