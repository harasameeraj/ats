"""
Stitch ATS — Assessment Router
Handles candidate screening test invitation, quiz retrieval, and submission evaluation.
"""

import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Candidate, Job, Activity
from ..schemas import AssessmentInfoResponse, AssessmentResponseSubmit
from ..services.assessment_eval import grade_assessment
from ..services.email_sender import send_email

router = APIRouter(prefix="/api/assessment", tags=["Assessment"])


@router.post("/invite/{candidate_id}")
def invite_candidate(candidate_id: int, job_id: int, db: Session = Depends(get_db)):
    """Generate secure token and email invitation link to candidate."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Generate custom 10 questions for this candidate based on their CV and JD
    from ..services.assessment_eval import generate_candidate_assessment_questions
    try:
        custom_questions = generate_candidate_assessment_questions(
            job_title=job.title,
            jd_text=job.description,
            candidate_name=candidate.name,
            resume_text=candidate.resume_text or ""
        )
        candidate.assessment_questions = json.dumps(custom_questions)
    except Exception as e:
        print(f"[CANDIDATE QUESTIONS ERROR] Fallback to job questions: {e}")
        # Generate questions if they don't exist yet for the job
        if not job.screening_questions:
            from ..services.assessment_eval import generate_screening_questions
            questions = generate_screening_questions(job.title, job.description)
            job.screening_questions = json.dumps(questions)
            db.commit()
        candidate.assessment_questions = job.screening_questions

    # Generate secure token
    token = str(uuid.uuid4())
    candidate.assessment_token = token
    candidate.assessment_status = "pending"
    candidate.assessment_score = None
    candidate.assessment_responses = None
    candidate.assessment_violations = 0
    
    # Store job role in candidate table
    candidate.role = job.title

    db.commit()

    # Create link
    # In development it's localhost:5173, in production we can use FRONTEND_URL
    import os
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    link = f"{frontend_url}/assessment/{token}"

    # Send email
    subject = f"Action Required: Complete your assessment for {job.title}"
    body = f"""Dear {candidate.name},

Thank you for your application for the {job.title} role at our company.

As the next step in our hiring process, we would like to invite you to take a brief 10-question AI Screening Assessment. This helps us understand your fit for the role.

You can take the test at any time using your unique assessment link below:
{link}

⚠️ Important Assessment Rules & Anti-Cheating Policy:
1. The test must be taken in FULLSCREEN mode.
2. Do not switch tabs, minimize the browser window, or leave the assessment screen during the test.
3. Every tab switch or window focus loss will trigger a warning.
4. Exceeding 2 warnings (3 total violations) will immediately lock your assessment and automatically submit your responses.
5. Your violation details will be recorded and shared with the recruitment team.

Please complete the assessment at your earliest convenience. You will receive real-time automated scoring upon submission.

Best regards,
Hiring Team
"""
    # Send email using dynamic SMTP settings
    email_result = send_email(to_email=candidate.email, subject=subject, body=body, db=db)
    
    # If email failed (e.g. SMTP credentials not set), we raise error so HR knows
    if not email_result["success"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Failed to send email invite: {email_result['message']}. Please check your SMTP settings."
        )

    # Log activity
    activity = Activity(
        action="Assessment Invited",
        description=f"AI screening test invitation sent to {candidate.name} for {job.title}",
        icon="✉️",
        color="#a855f7"
    )
    db.add(activity)
    db.commit()

    return {"message": "Invitation sent successfully", "link": link}


@router.get("/info/{token}", response_model=AssessmentInfoResponse)
def get_assessment_info(token: str, db: Session = Depends(get_db)):
    """Public endpoint: Load details for a screening test via token."""
    candidate = db.query(Candidate).filter(Candidate.assessment_token == token).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Invalid assessment link or link has expired.")

    # Find custom questions or fallback to job level questions
    if candidate.assessment_questions:
        questions = json.loads(candidate.assessment_questions)
        job_title = candidate.role or "General Position"
    else:
        # Find the job using the job's candidate screenings
        # Let's search screenings or default to first job matched with candidate.role
        job = None
        if candidate.screenings:
            job = candidate.screenings[0].job
        else:
            # Fallback to matching role title
            job = db.query(Job).filter(Job.title == candidate.role).first()

        if not job:
            # Fallback to any job if none exists
            job = db.query(Job).first()

        if not job or not job.screening_questions:
            raise HTTPException(status_code=404, detail="Screening questions not found for this role.")

        questions = json.loads(job.screening_questions)
        job_title = job.title

    return AssessmentInfoResponse(
        candidate_name=candidate.name,
        job_title=job_title,
        questions=questions
    )


@router.post("/submit/{token}")
def submit_assessment(token: str, data: AssessmentResponseSubmit, db: Session = Depends(get_db)):
    """Public endpoint: Candidate submits answers, graded in real-time by GPT-4o."""
    candidate = db.query(Candidate).filter(Candidate.assessment_token == token).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Invalid assessment link or link has expired.")

    # Find the job
    job = None
    if candidate.screenings:
        job = candidate.screenings[0].job
    else:
        job = db.query(Job).filter(Job.title == candidate.role).first()
        
    if not job:
        job = db.query(Job).first()

    if candidate.assessment_questions:
        questions = json.loads(candidate.assessment_questions)
    else:
        if not job or not job.screening_questions:
            raise HTTPException(status_code=404, detail="Role description or questions not found.")
        questions = json.loads(job.screening_questions)
    
    # Grade responses
    result = grade_assessment(
        job_title=job.title,
        jd_text=job.description,
        questions=questions,
        answers=data.answers
    )

    # Save results
    candidate.assessment_score = result["score"]
    candidate.assessment_violations = data.violations if data.violations is not None else 0
    candidate.assessment_responses = json.dumps({
        "overall_feedback": result["overall_feedback"],
        "question_feedback": result["question_feedback"]
    })
    
    # Invalidate token so they can't submit twice
    candidate.assessment_token = None

    # Update candidate stage status based on test result score
    score = result["score"]
    
    # If cheated/violations >= 3, they are auto-rejected or flagged
    is_violated = data.violations is not None and data.violations >= 3
    if is_violated:
        candidate.status = "rejected"
        candidate.assessment_status = "failed"
        candidate.rejection_reason = f"Terminated due to multiple Anti-Cheating violations ({data.violations} tab switches/focus losses). Score graded up to exit point: {result['score']}/100."
    else:
        if score >= 60.0:
            candidate.status = "shortlisted"
            candidate.assessment_status = "passed"
        else:
            candidate.status = "rejected"
            candidate.assessment_status = "failed"
            candidate.rejection_reason = f"Failed AI Assessment test. Score: {result['score']}/100. Feedback: {result['overall_feedback']}"

    # Log activity
    if is_violated:
        activity = Activity(
            action="Assessment Violation Lock",
            description=f"{candidate.name}'s assessment for {job.title} was locked and auto-submitted due to 3 anti-cheating policy violations.",
            icon="🚨",
            color="#ef4444"
        )
    else:
        activity = Activity(
            action="Assessment Completed",
            description=f"{candidate.name} completed assessment for {job.title} — Score: {result['score']}% ({result['status'].upper()})",
            icon="📝",
            color="#10b981" if result["status"] == "passed" else "#f87171"
        )
    db.add(activity)
    db.commit()

    return {
        "score": result["score"],
        "status": result["status"],
        "overall_feedback": result["overall_feedback"],
        "question_feedback": result.get("question_feedback", [])
    }


# ===== WEBCAM RECORDING UPLOAD =====
import os
from fastapi import UploadFile, File

@router.post("/upload-recording/{token}")
async def upload_recording(token: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Public endpoint: Upload webcam video recording for candidate assessment session."""
    candidate = db.query(Candidate).filter(Candidate.assessment_token == token).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Invalid assessment token or session has expired.")
    
    # Save directory
    recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "recordings")
    os.makedirs(recordings_dir, exist_ok=True)
    
    # Save file: {candidate_id}_recording.webm
    filename = f"{candidate.id}_recording.webm"
    filepath = os.path.join(recordings_dir, filename)
    
    try:
        contents = await file.read()
        with open(filepath, "wb") as f:
            f.write(contents)
    except Exception as e:
        print(f"[RECORDING UPLOAD ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to save video recording.")
        
    return {"message": "Recording uploaded successfully", "filename": filename}
