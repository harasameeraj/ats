"""
Stitch ATS — SQLAlchemy Models
All database tables for the ATS system.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    jd_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    screenings = relationship("Screening", back_populates="job", cascade="all, delete-orphan")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(String, nullable=True)
    status = Column(String, default="uploaded")  # uploaded, screened, shortlisted, interviewed, offered, onboarded, rejected
    match_score = Column(Float, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    resume_text = Column(Text, nullable=True)
    resume_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    screenings = relationship("Screening", back_populates="candidate", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="candidate", cascade="all, delete-orphan")
    onboarding_tasks = relationship("OnboardingTask", back_populates="candidate", cascade="all, delete-orphan")


class Screening(Base):
    __tablename__ = "screenings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    match_score = Column(Float, nullable=False)
    strengths = Column(Text, nullable=True)  # JSON string
    gaps = Column(Text, nullable=True)  # JSON string
    overall_summary = Column(Text, nullable=True)
    seniority_fit = Column(String, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="screenings")
    candidate = relationship("Candidate", back_populates="screenings")


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    interviewer_name = Column(String, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    duration_mins = Column(Integer, default=45)
    status = Column(String, default="pending")  # pending, confirmed, completed, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="interviews")


class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    category = Column(String, nullable=False)  # equipment, access, documentation
    task_name = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, done
    created_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="onboarding_tasks")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    action = Column(String, nullable=False)  # e.g. "New applicant", "Interview scheduled"
    description = Column(Text, nullable=False)
    icon = Column(String, default="📋")
    color = Column(String, default="#6366f1")
    created_at = Column(DateTime, default=datetime.utcnow)
