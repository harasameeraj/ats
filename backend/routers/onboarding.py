"""
Stitch ATS — Onboarding Router
Manages new hire onboarding tasks and progress tracking.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Candidate, OnboardingTask, Activity
from ..schemas import OnboardingTaskCreate, OnboardingTaskResponse, OnboardingCandidateResponse

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


# Default onboarding template tasks
DEFAULT_TASKS = [
    {"category": "equipment", "task_name": 'MacBook Pro 16" (M3 Max)'},
    {"category": "equipment", "task_name": "Security Access Badge"},
    {"category": "access", "task_name": "Slack Workspace"},
    {"category": "access", "task_name": "Jira & Confluence"},
    {"category": "access", "task_name": "GitHub Organization"},
    {"category": "documentation", "task_name": "Signed Offer Letter"},
    {"category": "documentation", "task_name": "I-9 Verification Documents"},
    {"category": "documentation", "task_name": "NDA & IP Agreement"},
]


@router.get("/")
def list_onboarding(db: Session = Depends(get_db)):
    """List all candidates in onboarding with their tasks."""
    candidates = (
        db.query(Candidate)
        .filter(Candidate.status.in_(["offered", "onboarded"]))
        .order_by(Candidate.created_at.desc())
        .all()
    )

    result = []
    for c in candidates:
        tasks = db.query(OnboardingTask).filter(OnboardingTask.candidate_id == c.id).all()
        done = sum(1 for t in tasks if t.status == "done")
        total = len(tasks) if tasks else 1
        progress = round((done / total) * 100, 1) if total > 0 else 0

        result.append({
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "role": c.role,
            "status": c.status,
            "progress": progress,
            "tasks": [
                {
                    "id": t.id,
                    "candidate_id": t.candidate_id,
                    "category": t.category,
                    "task_name": t.task_name,
                    "status": t.status,
                    "created_at": t.created_at.isoformat()
                }
                for t in tasks
            ]
        })
    return result


@router.post("/")
def add_to_onboarding(candidate_id: int, db: Session = Depends(get_db)):
    """Move a candidate to onboarding with default tasks."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate.status = "offered"

    # Create default onboarding tasks
    for task_template in DEFAULT_TASKS:
        task = OnboardingTask(
            candidate_id=candidate.id,
            category=task_template["category"],
            task_name=task_template["task_name"],
            status="pending"
        )
        db.add(task)

    # Log activity
    activity = Activity(
        action="Onboarding Started",
        description=f"{candidate.name} moved to onboarding",
        icon="✅",
        color="#34d399"
    )
    db.add(activity)
    db.commit()

    return {"message": f"{candidate.name} added to onboarding with {len(DEFAULT_TASKS)} tasks"}


@router.put("/task/{task_id}")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    """Toggle a task between pending, done, and blocked."""
    task = db.query(OnboardingTask).filter(OnboardingTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status == "pending":
        task.status = "done"
    elif task.status == "done":
        task.status = "blocked"
    else:
        task.status = "pending"

    db.commit()
    db.refresh(task)

    # Check if all tasks are done → update candidate to onboarded
    candidate = db.query(Candidate).filter(Candidate.id == task.candidate_id).first()
    if candidate:
        all_tasks = db.query(OnboardingTask).filter(OnboardingTask.candidate_id == candidate.id).all()
        if all(t.status == "done" for t in all_tasks):
            candidate.status = "onboarded"
            activity = Activity(
                action="Onboarding Complete",
                description=f"{candidate.name} has completed all onboarding tasks!",
                icon="🎉",
                color="#34d399"
            )
            db.add(activity)
            db.commit()
        else:
            # Revert to offered if previously marked onboarded
            if candidate.status == "onboarded":
                candidate.status = "offered"
                db.commit()

    return {
        "id": task.id,
        "task_name": task.task_name,
        "status": task.status,
        "candidate_id": task.candidate_id
    }


@router.get("/stats")
def onboarding_stats(db: Session = Depends(get_db)):
    """Get pipeline status for onboarding."""
    pending = db.query(OnboardingTask).filter(OnboardingTask.status == "pending").count()
    done = db.query(OnboardingTask).filter(OnboardingTask.status == "done").count()
    blocked = db.query(OnboardingTask).filter(OnboardingTask.status == "blocked").count()

    candidates_in_boarding = (
        db.query(Candidate)
        .filter(Candidate.status.in_(["offered", "onboarded"]))
        .count()
    )

    onboarded_candidates = db.query(Candidate).filter(Candidate.status.in_(["onboarded", "completed"])).all()
    if onboarded_candidates:
        from datetime import datetime
        total_days = 0
        for c in onboarded_candidates:
            delta = datetime.utcnow() - c.created_at
            total_days += max(0.2, delta.total_seconds() / 86400.0)
        avg_days = total_days / len(onboarded_candidates)
        avg_time = f"{avg_days:.1f}d"
    else:
        avg_time = "4.8d"

    return {
        "to_do_today": pending,
        "completed": done,
        "blocked": blocked,
        "avg_time": avg_time,
        "total_candidates": candidates_in_boarding
    }


@router.post("/bot/run")
def run_onboarding_bot(db: Session = Depends(get_db)):
    """Automate access and equipment task provisioning for active candidates."""
    candidates = db.query(Candidate).filter(Candidate.status == "offered").all()
    
    logs = []
    logs.append("[INFO] Initializing Onboarding Access & Equipment Bot v2.0...")
    logs.append(f"[INFO] Found {len(candidates)} active new hire(s) in onboarding pipeline.")
    
    modified_count = 0
    
    for c in candidates:
        logs.append(f"[PROCESS] Processing onboarding provisions for candidate: {c.name}")
        tasks = (
            db.query(OnboardingTask)
            .filter(
                OnboardingTask.candidate_id == c.id,
                OnboardingTask.category.in_(["access", "equipment"]),
                OnboardingTask.status.in_(["pending", "blocked"])
            )
            .all()
        )
        
        if not tasks:
            logs.append(f"  [SKIPPED] All access and equipment items are already completed for {c.name}.")
            continue
            
        for t in tasks:
            t.status = "done"
            modified_count += 1
            logs.append(f"  [SUCCESS] Auto-provisioned: {t.task_name} -> Marked DONE.")
            
        all_tasks = db.query(OnboardingTask).filter(OnboardingTask.candidate_id == c.id).all()
        if all(x.status == "done" for x in all_tasks):
            c.status = "onboarded"
            logs.append(f"  [CONGRATS] {c.name} has completed all onboarding checklist requirements! Status set to ONBOARDED.")
            
            activity = Activity(
                action="Onboarding Complete",
                description=f"{c.name} has completed onboarding (Auto Bot)!",
                icon="🎉",
                color="#34d399"
            )
            db.add(activity)

    if modified_count > 0:
        db.commit()
        logs.append(f"[SUCCESS] Automation script completed. Successfully updated {modified_count} tasks in database.")
    else:
        logs.append("[INFO] No pending access or equipment tasks to automate.")
        
    return {"logs": [{"time": "Just now", "text": l} for l in logs]}


@router.post("/{candidate_id}/complete")
def complete_onboarding(candidate_id: int, db: Session = Depends(get_db)):
    """Mark a candidate's onboarding as completely finished, archiving them from the tracker."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    candidate.status = "completed"
    
    activity = Activity(
        action="Onboarding Completed",
        description=f"{candidate.name} has finished all onboarding tasks and is now active!",
        icon="🚀",
        color="#34d399"
    )
    db.add(activity)
    db.commit()
    return {"message": "Onboarding completed successfully", "candidate_id": candidate_id}
