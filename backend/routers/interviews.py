"""
Stitch ATS — Interviews Router
CRUD for interview scheduling + AI time suggestions.
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import Interview, Candidate, Activity, Screening
from ..schemas import InterviewCreate, InterviewUpdate, BulkInterviewCreate, EmailGenerationRequest
from ..services.ai_screening import suggest_interview_slots, generate_ai_email


router = APIRouter(prefix="/api/interviews", tags=["Interviews"])


@router.get("/")
def list_interviews(status: Optional[str] = None, db: Session = Depends(get_db)):
    """List all interviews, optionally filtered by status."""
    query = db.query(Interview).order_by(Interview.scheduled_at.asc())
    if status:
        query = query.filter(Interview.status == status)

    interviews = query.all()
    result = []
    for iv in interviews:
        candidate = db.query(Candidate).filter(Candidate.id == iv.candidate_id).first()
        result.append({
            "id": iv.id,
            "candidate_id": iv.candidate_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "candidate_role": candidate.role if candidate else None,
            "candidate_status": candidate.status if candidate else None,
            "interviewer_name": iv.interviewer_name,
            "scheduled_at": iv.scheduled_at.isoformat(),
            "duration_mins": iv.duration_mins,
            "status": iv.status,
            "notes": iv.notes,
            "created_at": iv.created_at.isoformat()
        })
    return result


@router.post("/")
def create_interview(data: InterviewCreate, db: Session = Depends(get_db)):
    """Schedule a new interview."""
    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    interview = Interview(
        candidate_id=data.candidate_id,
        interviewer_name=data.interviewer_name,
        scheduled_at=data.scheduled_at,
        duration_mins=data.duration_mins,
        notes=data.notes,
        status="pending"
    )
    db.add(interview)

    # Update candidate status
    if candidate.status in ("shortlisted", "screened"):
        candidate.status = "interviewed"

    # Log activity
    activity = Activity(
        action="Interview Scheduled",
        description=f'Interview with {candidate.name} by {data.interviewer_name}',
        icon="📅",
        color="#22d3ee"
    )
    db.add(activity)
    db.commit()
    db.refresh(interview)

    return {
        "id": interview.id,
        "candidate_id": interview.candidate_id,
        "candidate_name": candidate.name,
        "interviewer_name": interview.interviewer_name,
        "scheduled_at": interview.scheduled_at.isoformat(),
        "duration_mins": interview.duration_mins,
        "status": interview.status,
        "notes": interview.notes
    }


@router.put("/{interview_id}")
def update_interview(interview_id: int, data: InterviewUpdate, db: Session = Depends(get_db)):
    """Update interview status or details."""
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = db.query(Candidate).filter(Candidate.id == interview.candidate_id).first()

    if data.status:
        interview.status = data.status
        # If cancelled, revert candidate status if there are no other active interviews
        if data.status == "cancelled" and candidate:
            other_active = db.query(Interview).filter(
                Interview.candidate_id == candidate.id,
                Interview.id != interview_id,
                Interview.status.in_(["pending", "confirmed", "completed"])
            ).first()
            if not other_active:
                if candidate.match_score is not None:
                    if candidate.match_score >= 70:
                        candidate.status = "shortlisted"
                    elif candidate.match_score >= 40:
                        candidate.status = "screened"
                    else:
                        candidate.status = "rejected"
                else:
                    candidate.status = "uploaded"

    if data.notes is not None:
        interview.notes = data.notes
    if data.scheduled_at:
        interview.scheduled_at = data.scheduled_at

    db.commit()
    db.refresh(interview)

    return {
        "id": interview.id,
        "candidate_id": interview.candidate_id,
        "candidate_name": candidate.name if candidate else "Unknown",
        "status": interview.status,
        "scheduled_at": interview.scheduled_at.isoformat()
    }


@router.post("/suggest")
def suggest_slots(candidate_id: int, db: Session = Depends(get_db)):
    """Use AI to suggest optimal interview time slots."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    slots = suggest_interview_slots(candidate.name, candidate.role or "General Position")
    return {"candidate_name": candidate.name, "suggestions": slots}


@router.post("/bulk-schedule")
def bulk_schedule(data: BulkInterviewCreate, db: Session = Depends(get_db)):
    """Bulk schedule interviews for multiple candidates automatically with no overlaps."""
    candidates = db.query(Candidate).filter(Candidate.id.in_(data.candidate_ids)).all()
    if not candidates:
        raise HTTPException(status_code=404, detail="No candidates found")

    # Sort candidates by match score descending to schedule high-match first
    candidates.sort(key=lambda c: c.match_score or 0, reverse=True)

    from datetime import datetime, time as datetime_time
    try:
        start_date = datetime.strptime(data.start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")

    # Get existing interviews to check for overlaps
    existing_interviews = db.query(Interview).all()
    scheduled_interviews = []

    current_time = datetime.combine(start_date.date(), datetime_time(10, 0))  # Start at 10 AM

    def is_overlap(slot_start, slot_end, existing_ivs):
        for iv in existing_ivs:
            iv_start = iv.scheduled_at
            iv_end = iv_start + timedelta(minutes=iv.duration_mins)
            if max(slot_start, iv_start) < min(slot_end, iv_end):
                return True
        return False

    for candidate in candidates:
        while True:
            # Skip weekends
            if current_time.weekday() >= 5:
                days_to_add = 7 - current_time.weekday()
                current_time = datetime.combine((current_time + timedelta(days=days_to_add)).date(), datetime_time(10, 0))
                continue

            slot_start = current_time
            slot_end = slot_start + timedelta(minutes=data.duration_mins)
            day_end = datetime.combine(current_time.date(), datetime_time(17, 0))

            # Outside business hours? Move to next day 10 AM
            if slot_end > day_end:
                current_time = datetime.combine((current_time + timedelta(days=1)).date(), datetime_time(10, 0))
                continue

            # Check overlap
            if is_overlap(slot_start, slot_end, existing_interviews) or is_overlap(slot_start, slot_end, scheduled_interviews):
                current_time += timedelta(minutes=15)
                continue

            break

        iv = Interview(
            candidate_id=candidate.id,
            interviewer_name=data.interviewer_name,
            scheduled_at=current_time,
            duration_mins=data.duration_mins,
            notes=data.notes or f"Auto-scheduled screening follow-up for {candidate.name}.",
            status="pending"
        )
        db.add(iv)

        if candidate.status in ("shortlisted", "screened", "uploaded"):
            candidate.status = "interviewed"

        activity = Activity(
            action="Interview Scheduled",
            description=f'Interview with {candidate.name} by {data.interviewer_name} (Auto)',
            icon="📅",
            color="#22d3ee"
        )
        db.add(activity)

        scheduled_interviews.append(iv)
        # Advance current time with 15 mins buffer
        current_time += timedelta(minutes=data.duration_mins + 15)

    db.commit()

    return [
        {
            "id": iv.id,
            "candidate_id": iv.candidate_id,
            "candidate_name": next((c.name for c in candidates if c.id == iv.candidate_id), "Unknown"),
            "interviewer_name": iv.interviewer_name,
            "scheduled_at": iv.scheduled_at.isoformat(),
            "duration_mins": iv.duration_mins,
            "status": iv.status
        }
        for iv in scheduled_interviews
    ]


@router.post("/{interview_id}/action")
def interview_action(interview_id: int, action: str, db: Session = Depends(get_db)):
    """Hire or reject a candidate after completing an interview."""
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = db.query(Candidate).filter(Candidate.id == interview.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    action_lower = action.lower()
    if action_lower not in ("hire", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'hire' or 'reject'")

    if action_lower == "hire":
        candidate.status = "hired"
        interview.status = "completed"
        activity = Activity(
            action="Candidate Hired",
            description=f'{candidate.name} has been marked as HIRED after interview!',
            icon="🎉",
            color="#34d399"
        )
        db.add(activity)
    else:
        candidate.status = "rejected"
        interview.status = "completed"
        activity = Activity(
            action="Candidate Rejected",
            description=f'{candidate.name} was rejected after interview.',
            icon="❌",
            color="#f87171"
        )
        db.add(activity)

    db.commit()
    return {
        "message": f"Candidate status updated to '{candidate.status}'",
        "candidate_id": candidate.id,
        "candidate_status": candidate.status,
        "interview_id": interview.id,
        "interview_status": interview.status
    }


@router.post("/generate-email")
def generate_email(data: EmailGenerationRequest, db: Session = Depends(get_db)):
    """Generate a recruiter invitation or offer letter draft with AI."""
    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Fetch screening results for candidate to get strengths, gaps, summary
    screening = db.query(Screening).filter(Screening.candidate_id == data.candidate_id).first()
    
    import json
    strengths = json.loads(screening.strengths) if (screening and screening.strengths) else []
    gaps = json.loads(screening.gaps) if (screening and screening.gaps) else []
    summary = screening.overall_summary if screening else "A qualified candidate."
    role = candidate.role or "General Position"

    email_draft = generate_ai_email(
        candidate_name=candidate.name,
        role=role,
        strengths=strengths,
        gaps=gaps,
        summary=summary,
        email_type=data.email_type,
        details=data.details
    )
    
    return email_draft

