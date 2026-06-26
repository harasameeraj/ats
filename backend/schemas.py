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
    screening_questions: Optional[str] = None
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
    assessment_token: Optional[str] = None
    assessment_score: Optional[float] = None
    assessment_status: Optional[str] = None
    assessment_responses: Optional[str] = None
    assessment_violations: Optional[int] = 0
    github_url: Optional[str] = None
    github_analysis: Optional[str] = None
    linkedin_url: Optional[str] = None
    linkedin_analysis: Optional[str] = None
    client_feedback: Optional[str] = None
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

class EmailSendRequest(BaseModel):
    to_email: str
    subject: str
    body: str

# ===== SETTINGS =====
class SMTPSettingsUpdate(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    smtp_from_name: str

class SMTPSettingsResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password_masked: str
    smtp_from_name: str


# ===== ASSESSMENT =====
class AssessmentInfoResponse(BaseModel):
    candidate_name: str
    job_title: str
    questions: List[str]

class AssessmentResponseSubmit(BaseModel):
    answers: List[str]
    violations: Optional[int] = 0


# ===== CANDIDATE SOURCING =====
class SourcingRequest(BaseModel):
    job_id: int
    location: str

class ImportSourcedRequest(BaseModel):
    job_id: int
    name: str
    email: str
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    bio: str
    match_score: float
    match_reason: str
    skills: List[str]


# ===== ROLE BASED DASHBOARDS =====
class TAActivityLogCreate(BaseModel):
    date: str
    activity: str
    role_ids: Optional[str] = None
    detail: str
    outcome: Optional[str] = None

class SpendLogCreate(BaseModel):
    role_id: str
    role: str
    amount: float
    approval_level: str
    approver: str

class QualityGateUpdate(BaseModel):
    tech_fit: Optional[str] = None
    client_readiness: Optional[str] = None
    red_flags: Optional[str] = None
    delivery_verdict: Optional[str] = None
    client_feedback: Optional[str] = None

class TechVerdictUpdate(BaseModel):
    verdict: str
    verdict_notes: Optional[str] = None



