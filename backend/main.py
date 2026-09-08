"""
Stitch ATS — FastAPI Application
Main entry point for the backend API server.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import screening, dashboard, interviews, onboarding, settings, assessment, auth, candidate_portal, agent, investigator
from .auth_middleware import TenantMiddleware

app = FastAPI(
    title="Stitch ATS API",
    description="Backend API for Stitch ATS Demo",
    version="1.0.0"
)

# Add Multi-Tenancy Middleware
app.add_middleware(TenantMiddleware)

import os
import re
from typing import Optional

# CORS — allow React dev servers and any deployed frontend named in env vars.
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

def _origin_from(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    s = raw.strip().rstrip("/")
    return s if re.match(r"^https?://", s, re.I) else f"https://{s}"

# Accept the primary FRONTEND_URL (also used for email links) and, optionally,
# a comma-separated list of additional allowed origins.
for env_var in ("FRONTEND_URL", "ALLOWED_ORIGINS"):
    val = os.getenv(env_var)
    if not val:
        continue
    for part in val.split(","):
        o = _origin_from(part)
        if o and o not in allowed_origins:
            allowed_origins.append(o)

# Fallback for local convenience — DO NOT enable in prod (blocks credentials).
if not any(o.startswith("https://") for o in allowed_origins):
    allowed_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=("*" not in allowed_origins),
    # Regex catches any *.onrender.com origin — safe because we still send no
    # cookies (JWT lives in localStorage) and no credentialed CORS.
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

# Include routers
app.include_router(screening.router)
app.include_router(dashboard.router)
app.include_router(interviews.router)
app.include_router(onboarding.router)
app.include_router(settings.router)
app.include_router(assessment.router)
app.include_router(auth.router)
app.include_router(candidate_portal.router)
app.include_router(agent.router)
app.include_router(investigator.router)

# Mount static files for recordings/resumes
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup():
    """Initialize database tables and (optionally) seed demo data."""
    init_db()
    from .auto_seed import run_auto_seed
    run_auto_seed()


@app.get("/")
def root():
    return {"message": "Stitch ATS API is running", "version": "1.0.0"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.post("/api/admin/seed-demo")
def admin_seed_demo():
    """
    Force-run the demo seeder. Idempotent — safe to hit repeatedly.
    Used to recover when AUTO_SEED_DEMO wasn't applied on a fresh deploy.
    """
    import os
    os.environ["AUTO_SEED_DEMO"] = "true"
    from .auto_seed import run_auto_seed
    run_auto_seed()

    # Report what actually exists so we can verify
    from .database import SessionLocal
    from .models import Company, User, Candidate
    db = SessionLocal()
    try:
        demo = db.query(Company).filter(Company.name == "Demo Co").first()
        users = db.query(User).filter(User.company_id == demo.id).all() if demo else []
        cands = db.query(Candidate).filter(Candidate.company_id == demo.id).all() if demo else []
        return {
            "seeded": True,
            "company_id": demo.id if demo else None,
            "users": [u.email for u in users],
            "candidates": [c.name for c in cands],
        }
    finally:
        db.close()
