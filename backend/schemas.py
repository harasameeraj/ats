"""
Stitch ATS — Pydantic Schemas
Request/Response models for the API.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ===== JOB =====
class JobCreate(BaseModel):
    title: str
    description: str
    jd_filename: Optional[str] = None

class JobResponse(BaseModel):
    id: int
    title: str
    description: str
    jd_filename: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ===== CANDIDATE =====
class CandidateResponse(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    role: Optional[str]
    status: str
    match_score: Optional[float]
    rejection_reason: Optional[str]
    resume_filename: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ===== SCREENING =====
class ScreeningResult(BaseModel):
    id: int
    job_id: int
    candidate_id: int
    candidate_name: str
    candidate_role: Optional[str]
    match_score: float
    strengths: Optional[str]
    gaps: Optional[str]
    overall_summary: Optional[str]
    seniority_fit: Optional[str]
    rejection_reason: Optional[str]
    created_at: datetime


class RunScreeningRequest(BaseModel):
    job_id: int
    candidate_ids: List[int]


# ===== INTERVIEW =====
class InterviewCreate(BaseModel):
    candidate_id: int
    interviewer_name: str
    scheduled_at: datetime
    duration_mins: int = 45
    notes: Optional[str] = None

class BulkInterviewCreate(BaseModel):
    candidate_ids: List[int]
    interviewer_name: str
    start_date: str  # YYYY-MM-DD
    duration_mins: int = 45
    notes: Optional[str] = None

class InterviewUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class InterviewResponse(BaseModel):
    id: int
    candidate_id: int
    candidate_name: str
    candidate_role: Optional[str]
    interviewer_name: str
    scheduled_at: datetime
    duration_mins: int
    status: str
    notes: Optional[str]
    created_at: datetime



# ===== ONBOARDING =====
class OnboardingTaskCreate(BaseModel):
    candidate_id: int
    category: str
    task_name: str

class OnboardingTaskResponse(BaseModel):
    id: int
    candidate_id: int
    category: str
    task_name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class OnboardingCandidateResponse(BaseModel):
    id: int
    name: str
    role: Optional[str]
    status: str
    tasks: List[OnboardingTaskResponse]
    progress: float  # 0-100


# ===== DASHBOARD =====
class DashboardStats(BaseModel):
    total_applications: int
    screened: int
    interviewed: int
    onboarded: int
    shortlisted: int

class ActivityResponse(BaseModel):
    id: int
    action: str
    description: str
    icon: str
    color: str
    created_at: datetime

    class Config:
        from_attributes = True


# ===== EMAIL =====
class EmailGenerationRequest(BaseModel):
    candidate_id: int
    email_type: str  # invitation | offer_letter
    details: Optional[dict] = None
