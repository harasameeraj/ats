"""
Stitch ATS — Screening Router
Handles JD upload, CV batch upload, and AI screening.
"""

import os
import json
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Job, Candidate, Screening, Activity
from ..schemas import ScreeningResult, JobResponse, CandidateResponse
from ..services.file_parser import extract_text, extract_candidate_name, extract_email, extract_phone
from ..services.ai_screening import screen_single_candidate

router = APIRouter(prefix="/api/screening", tags=["Screening"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload-jd", response_model=JobResponse)
async def upload_jd(
    file: UploadFile = File(...),
    title: str = Form("Untitled Position"),
    db: Session = Depends(get_db)
):
    """Upload a Job Description file (PDF/DOCX/TXT). Extracts text and saves."""
    contents = await file.read()
    text = extract_text(file.filename, contents)

    if not text or len(text) < 20:
        raise HTTPException(status_code=400, detail="Could not extract text from the file. Try a different format.")

    # Save file to disk
    filepath = os.path.join(UPLOAD_DIR, f"jd_{file.filename}")
    with open(filepath, "wb") as f:
        f.write(contents)

    # Clean and format job title if default or empty
    cleaned_title = title
    if not cleaned_title or cleaned_title.strip() == "" or cleaned_title == "Untitled Position":
        import re
        name_without_ext = os.path.splitext(file.filename)[0]
        cleaned = re.sub(r'[-_.]', ' ', name_without_ext)
        cleaned_title = cleaned.strip().title()
        if not cleaned_title:
            cleaned_title = "Untitled Position"

    job = Job(title=cleaned_title, description=text, jd_filename=file.filename)
    db.add(job)
    db.commit()
    db.refresh(job)

    # Log activity
    activity = Activity(
        action="Job Posted",
        description=f'New JD uploaded: "{cleaned_title}"',
        icon="📝",
        color="#6366f1"
    )
    db.add(activity)
    db.commit()

    return job


@router.post("/upload-cvs", response_model=List[CandidateResponse])
async def upload_cvs(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """Upload batch CVs (up to 20). Extracts text and saves candidates."""
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 CVs per batch.")

    candidates = []
    for file in files:
        contents = await file.read()
        text = extract_text(file.filename, contents)

        # Save file
        filepath = os.path.join(UPLOAD_DIR, f"cv_{file.filename}")
        with open(filepath, "wb") as f:
            f.write(contents)

        name = extract_candidate_name(text, file.filename)
        email = extract_email(text)
        phone = extract_phone(text)

        candidate = Candidate(
            name=name,
            email=email,
            phone=phone,
            resume_text=text,
            resume_filename=file.filename,
            status="uploaded"
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        candidates.append(candidate)

    # Log activity
    activity = Activity(
        action="CVs Uploaded",
        description=f"{len(candidates)} new resumes uploaded for screening",
        icon="📄",
        color="#a855f7"
    )
    db.add(activity)
    db.commit()

    return candidates


@router.post("/run")
async def run_screening(
    job_id: int = Form(...),
    candidate_ids: str = Form(...),  # comma-separated IDs
    db: Session = Depends(get_db)
):
    """Run AI screening for selected candidates against a job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ids = [int(x.strip()) for x in candidate_ids.split(",") if x.strip()]
    candidates = db.query(Candidate).filter(Candidate.id.in_(ids)).all()

    if not candidates:
        raise HTTPException(status_code=404, detail="No candidates found")

    results = []
    for candidate in candidates:
        # Call GPT-4o for screening
        ai_result = screen_single_candidate(
            jd_text=job.description,
            resume_text=candidate.resume_text or "",
            candidate_name=candidate.name
        )

        # Save screening result
        screening = Screening(
            job_id=job.id,
            candidate_id=candidate.id,
            match_score=ai_result["match_score"],
            strengths=ai_result["strengths"],
            gaps=ai_result["gaps"],
            overall_summary=ai_result["overall_summary"],
            seniority_fit=ai_result["seniority_fit"],
            rejection_reason=ai_result["rejection_reason"]
        )
        db.add(screening)

        # Update candidate status and score
        candidate.match_score = ai_result["match_score"]
        candidate.rejection_reason = ai_result["rejection_reason"]
        if ai_result["match_score"] >= 70:
            candidate.status = "shortlisted"
        elif ai_result["match_score"] >= 40:
            candidate.status = "screened"
        else:
            candidate.status = "rejected"

        db.commit()
        db.refresh(screening)

        results.append({
            "id": screening.id,
            "job_id": job.id,
            "candidate_id": candidate.id,
            "candidate_name": candidate.name,
            "candidate_email": candidate.email,
            "candidate_role": candidate.role,
            "match_score": ai_result["match_score"],
            "strengths": json.loads(ai_result["strengths"]) if ai_result["strengths"] else [],
            "gaps": json.loads(ai_result["gaps"]) if ai_result["gaps"] else [],
            "overall_summary": ai_result["overall_summary"],
            "seniority_fit": ai_result["seniority_fit"],
            "rejection_reason": ai_result["rejection_reason"],
            "status": candidate.status,
            "resume_text": candidate.resume_text
        })

    # Log activity
    shortlisted = sum(1 for r in results if r["match_score"] >= 70)
    activity = Activity(
        action="AI Screening Complete",
        description=f'Screened {len(results)} candidates for "{job.title}" — {shortlisted} shortlisted',
        icon="🤖",
        color="#34d399"
    )
    db.add(activity)
    db.commit()

    # Sort by score descending
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results


@router.get("/jobs", response_model=List[JobResponse])
def list_jobs(db: Session = Depends(get_db)):
    """List all jobs."""
    return db.query(Job).order_by(Job.created_at.desc()).all()


@router.get("/candidates", response_model=List[CandidateResponse])
def list_candidates(db: Session = Depends(get_db)):
    """List all candidates."""
    return db.query(Candidate).order_by(Candidate.created_at.desc()).all()


@router.get("/results/{job_id}")
def get_results(job_id: int, db: Session = Depends(get_db)):
    """Get screening results for a specific job."""
    screenings = (
        db.query(Screening)
        .filter(Screening.job_id == job_id)
        .order_by(Screening.match_score.desc())
        .all()
    )
    results = []
    for s in screenings:
        candidate = db.query(Candidate).filter(Candidate.id == s.candidate_id).first()
        results.append({
            "id": s.id,
            "job_id": s.job_id,
            "candidate_id": s.candidate_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else None,
            "candidate_role": candidate.role if candidate else None,
            "match_score": s.match_score,
            "strengths": json.loads(s.strengths) if s.strengths else [],
            "gaps": json.loads(s.gaps) if s.gaps else [],
            "overall_summary": s.overall_summary,
            "seniority_fit": s.seniority_fit,
            "rejection_reason": s.rejection_reason,
            "status": candidate.status if candidate else "unknown",
            "created_at": s.created_at.isoformat(),
            "resume_text": candidate.resume_text if candidate else ""
        })
    return results
