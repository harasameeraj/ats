"""
Stitch ATS — FastAPI Application
Main entry point for the backend API server.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import screening, dashboard, interviews, onboarding

app = FastAPI(
    title="Stitch ATS API",
    description="AI-Powered Applicant Tracking System",
    version="1.0.0"
)

import os

# CORS — allow React dev server and production URLs
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000"
]

prod_origin = os.getenv("FRONTEND_URL")
if prod_origin:
    allowed_origins.append(prod_origin)
else:
    allowed_origins.append("*")

# If wildcard is in allowed origins, allow_credentials must be False in FastAPI CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True if "*" not in allowed_origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(screening.router)
app.include_router(dashboard.router)
app.include_router(interviews.router)
app.include_router(onboarding.router)


@app.on_event("startup")
def startup():
    """Initialize database tables on startup."""
    init_db()


@app.get("/")
def root():
    return {"message": "Stitch ATS API is running", "version": "1.0.0"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}
