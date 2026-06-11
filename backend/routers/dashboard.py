"""
Stitch ATS — Dashboard Router
Provides hiring funnel stats, activity feed, and velocity data.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Candidate, Activity, Interview, Screening
from ..schemas import DashboardStats, ActivityResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    """Get hiring funnel counts."""
    total = db.query(Candidate).count()
    screened = db.query(Candidate).filter(Candidate.status.in_(["screened", "shortlisted", "interviewed", "offered", "onboarded", "completed"])).count()
    shortlisted = db.query(Candidate).filter(Candidate.status.in_(["shortlisted", "interviewed", "offered", "onboarded", "completed"])).count()
    interviewed = db.query(Candidate).filter(Candidate.status.in_(["interviewed", "offered", "onboarded", "completed"])).count()
    onboarded = db.query(Candidate).filter(Candidate.status.in_(["onboarded", "completed"])).count()

    return DashboardStats(
        total_applications=total,
        screened=screened,
        interviewed=interviewed,
        onboarded=onboarded,
        shortlisted=shortlisted
    )


@router.get("/activity")
def get_activity(limit: int = 10, db: Session = Depends(get_db)):
    """Get recent activity feed."""
    activities = (
        db.query(Activity)
        .order_by(Activity.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "action": a.action,
            "description": a.description,
            "icon": a.icon,
            "color": a.color,
            "created_at": a.created_at.isoformat()
        }
        for a in activities
    ]


@router.get("/velocity")
def get_velocity(db: Session = Depends(get_db)):
    """Get hiring velocity data by status (mock departments for now)."""
    # Group by status for a real funnel view
    statuses = ["uploaded", "screened", "shortlisted", "interviewed", "offered", "onboarded", "completed", "rejected"]
    velocity = {}
    for status in statuses:
        count = db.query(Candidate).filter(Candidate.status == status).count()
        velocity[status] = count

    return velocity
