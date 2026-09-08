"""
Stitch ATS — Auto-seed for demo deployments.

Runs at backend startup when AUTO_SEED_DEMO=true (set in render.yaml).
Idempotent: only inserts what's missing, never overwrites existing data.

Ensures a live demo always has:
  * Company "Demo Co" (id may vary)
  * Users recruiter@demo.com / tech@demo.com / delivery@demo.com  (password: demo1234)
  * Demo candidates Alex Chen and Priya Sharma so the Investigator flow
    has something to show without any prior upload
"""
from __future__ import annotations

import os
from passlib.context import CryptContext

from .database import SessionLocal
from .models import Company, User, Candidate


_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


ALEX_RESUME = """Alex Chen
Senior Systems Engineer

Contact: alex.chen@example.com · github.com/torvalds

EXPERIENCE
Linux Foundation — 15+ years — Kernel maintainer and contributor.
Deep experience in the kernel tree, filesystems, and distributed VCS design.
Worked on Git and related tooling.

SKILLS
C at scale, systems programming, code review, distributed collaboration.
"""

PRIYA_RESUME = """Priya Sharma
Senior AI/ML Engineer

Contact: priya.sharma@example.com · github.com/nonexistent-user-98765-priya-xyz

EXPERIENCE
Google Brain — 10 years — Led all research on transformer scaling.
Published 40 papers at NeurIPS and ICML on foundation model architecture.
Deployed models serving 3 billion users daily.
Previously invented the attention mechanism (2015).

SKILLS
PyTorch, JAX, distributed training on 10,000+ GPUs, CUDA kernel optimization,
transformer scaling laws, mixture-of-experts, LLM alignment, RLHF.
"""


def _ensure_user(db, email: str, role: str, company_id: int, plaintext_password: str):
    u = db.query(User).filter(User.email == email).first()
    if u:
        return u, False
    u = User(
        email=email,
        password_hash=_pwd.hash(plaintext_password),
        role=role,
        company_id=company_id,
        is_temporary_password=False,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u, True


def _ensure_candidate(db, *, name, email, role, resume, github_url, company_id):
    c = db.query(Candidate).filter(
        Candidate.email == email,
        Candidate.company_id == company_id,
    ).first()
    if c:
        return c, False
    c = Candidate(
        company_id=company_id,
        name=name,
        email=email,
        role=role,
        resume_text=resume,
        github_url=github_url,
        status="uploaded",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c, True


def run_auto_seed():
    if os.getenv("AUTO_SEED_DEMO", "").strip().lower() not in ("1", "true", "yes"):
        return

    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.name == "Demo Co").first()
        if not company:
            company = Company(name="Demo Co")
            db.add(company); db.commit(); db.refresh(company)
            print(f"[auto_seed] created company #{company.id} 'Demo Co'")

        created = []
        for email, role in [
            ("recruiter@demo.com", "recruiter"),
            ("tech@demo.com",      "tech_panel"),
            ("delivery@demo.com",  "delivery_head"),
        ]:
            _, is_new = _ensure_user(db, email, role, company.id, "demo1234")
            if is_new:
                created.append(email)
        if created:
            print(f"[auto_seed] created users: {', '.join(created)}  (password: demo1234)")

        # Demo candidates for the Investigator flow
        for spec in [
            dict(name="Alex Chen (Demo)", email="alex.chen@example.com",
                 role="Senior Systems Engineer", resume=ALEX_RESUME,
                 github_url="https://github.com/torvalds"),
            dict(name="Priya Sharma (Demo)", email="priya.sharma@example.com",
                 role="Senior AI/ML Engineer", resume=PRIYA_RESUME,
                 github_url="https://github.com/nonexistent-user-98765-priya-xyz"),
        ]:
            _, is_new = _ensure_candidate(db, company_id=company.id, **spec)
            if is_new:
                print(f"[auto_seed] created candidate {spec['name']}")

        print("[auto_seed] done")
    except Exception as e:
        print(f"[auto_seed] failed (non-fatal): {e}")
    finally:
        db.close()
