from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os

from ..database import get_db, SessionLocal
from ..models import Job, Candidate, User, Company
from ..schemas import JobResponse
from ..auth_utils import get_current_user
from ..services.file_parser import extract_text, extract_candidate_name, extract_phone

router = APIRouter(prefix="/api/candidate_portal", tags=["Candidate Portal"])

# 1. Global Job Board
@router.get("/jobs", response_model=list[JobResponse])
def get_published_jobs(db: Session = Depends(get_db)):
    """Fetch all published jobs across all companies."""
    jobs = db.query(Job).filter(Job.is_published == True).all()
    
    # Attach company names
    for job in jobs:
        company = db.query(Company).filter(Company.id == job.company_id).first()
        job.company_name = company.name if company else "Unknown Company"
        
    return jobs

# 2. Apply for a Job
@router.post("/jobs/{job_id}/apply")
async def apply_for_job(
    job_id: int, 
    resume: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can apply to jobs.")
        
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_filename = f"{current_user.id}_{job_id}_{timestamp}_{resume.filename}"
    file_path = os.path.join(UPLOAD_DIR, f"cv_{safe_filename}")
    
    file_bytes = await resume.read()
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    # Extract text and details
    resume_text = extract_text(resume.filename, file_bytes)
    extracted_name = extract_candidate_name(resume_text, resume.filename)
    extracted_phone = extract_phone(resume_text)
        
    candidate = Candidate(
        name=extracted_name or current_user.email.split('@')[0], 
        email=current_user.email,
        phone=extracted_phone or "",
        role=job.title,
        status="Under Review",
        resume_filename=f"cv_{safe_filename}",
        resume_text=resume_text,
        company_id=job.company_id
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    from ..models import Screening, Activity
    screening = Screening(
        job_id=job.id,
        candidate_id=candidate.id,
        company_id=job.company_id,
        match_score=0.0
    )
    db.add(screening)
    
    activity = Activity(
        action="New Candidate Application",
        description=f"{candidate.name} applied for {job.title} via Candidate Portal",
        icon="👤",
        color="#3b82f6",
        company_id=job.company_id
    )
    db.add(activity)
    
    db.commit()
    
    return {"message": "Application submitted successfully!", "candidate_id": candidate.id}

# 3. Get My Applications
@router.get("/applications")
def get_my_applications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can view their applications.")
        
    candidates = db.query(Candidate).filter(Candidate.email == current_user.email).all()
    
    results = []
    for cand in candidates:
        from ..models import Screening
        screening = db.query(Screening).filter(Screening.candidate_id == cand.id).first()
        job_title = "Unknown Job"
        company_name = "Unknown Company"
        
        if screening:
            job = db.query(Job).filter(Job.id == screening.job_id).first()
            if job:
                job_title = job.title
                
        company = db.query(Company).filter(Company.id == cand.company_id).first()
        if company:
            company_name = company.name
            
        results.append({
            "id": cand.id,
            "job_title": job_title,
            "company_name": company_name,
            "status": cand.status,
            "assessment_status": cand.assessment_status,
            "applied_at": cand.created_at
        })
        
    return results
