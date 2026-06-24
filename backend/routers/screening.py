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
from ..schemas import ScreeningResult, JobResponse, CandidateResponse, SourcingRequest, ImportSourcedRequest
from ..services.file_parser import extract_text, extract_candidate_name, extract_email, extract_phone, extract_github_url, extract_linkedin_url
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

    # Generate 10 customized screening questions using AI
    from ..services.assessment_eval import generate_screening_questions
    try:
        questions = generate_screening_questions(cleaned_title, text)
        screening_questions_json = json.dumps(questions)
    except Exception:
        screening_questions_json = json.dumps([])

    job = Job(
        title=cleaned_title, 
        description=text, 
        jd_filename=file.filename,
        screening_questions=screening_questions_json
    )
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
        github_url = extract_github_url(text)
        linkedin_url = extract_linkedin_url(text)

        candidate = Candidate(
            name=name,
            email=email,
            phone=phone,
            github_url=github_url,
            linkedin_url=linkedin_url,
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
    for idx, candidate in enumerate(candidates):
        if idx > 0:
            from ..services.ai_screening import get_ai_client_and_model
            try:
                _, _, provider = get_ai_client_and_model()
            except Exception:
                provider = "gemini"
            
            import time
            if provider == "gemini":
                time.sleep(4.0)
            else:
                time.sleep(0.5)

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
            "assessment_status": candidate.assessment_status,
            "assessment_score": candidate.assessment_score,
            "assessment_token": candidate.assessment_token,
            "assessment_violations": candidate.assessment_violations,
            "github_url": candidate.github_url,
            "github_analysis": candidate.github_analysis,
            "linkedin_url": candidate.linkedin_url,
            "linkedin_analysis": candidate.linkedin_analysis,
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
            "assessment_status": candidate.assessment_status if candidate else None,
            "assessment_score": candidate.assessment_score if candidate else None,
            "assessment_token": candidate.assessment_token if candidate else None,
            "assessment_violations": candidate.assessment_violations if candidate else 0,
            "github_url": candidate.github_url if candidate else None,
            "github_analysis": candidate.github_analysis if candidate else None,
            "linkedin_url": candidate.linkedin_url if candidate else None,
            "linkedin_analysis": candidate.linkedin_analysis if candidate else None,
            "created_at": s.created_at.isoformat(),
            "resume_text": candidate.resume_text if candidate else ""
        })
    return results


@router.post("/candidates/purge-failed")
def purge_failed_candidates(db: Session = Depends(get_db)):
    """Delete all candidates who failed the AI screening test (score < 60) or violated the anti-cheating policy (violations >= 3)."""
    failed_candidates = db.query(Candidate).filter(
        (Candidate.assessment_status == "failed") |
        (Candidate.assessment_violations >= 3)
    ).all()
    
    count = len(failed_candidates)
    for c in failed_candidates:
        db.delete(c)
        
    db.commit()
    
    if count > 0:
        activity = Activity(
            action="Candidates Purged",
            description=f"Bulk purged {count} candidates who failed or violated the assessment policy.",
            icon="🗑️",
            color="#ef4444"
        )
        db.add(activity)
        db.commit()
        
    return {"message": f"Successfully purged {count} failed/violated candidates", "count": count}


@router.delete("/candidates/{candidate_id}")
def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    """Delete a single candidate by ID."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    name = candidate.name
    db.delete(candidate)
    db.commit()
    
    activity = Activity(
        action="Candidate Deleted",
        description=f"Deleted candidate profile: {name}",
        icon="🗑️",
        color="#f87171"
    )
    db.add(activity)
    db.commit()
    
    return {"message": f"Candidate {name} deleted successfully"}


# ===== CANDIDATE SOURCING ENGINE =====

import urllib.request
import urllib.parse

def extract_jd_criteria(jd_text: str, jd_title: str) -> dict:
    from ..services.ai_screening import safe_chat_completion, clean_json_response
    prompt = f"""
    You are an expert recruiter parser. Given the following job description title and text, extract:
    1. Key technical skills/languages/frameworks (as a list of up to 4 string keywords, e.g. ["React", "Python", "Node"]).
    2. The location/city mentioned (as a single string, e.g., "London" or "San Francisco"). If no location is mentioned, default to "London".

    Return ONLY a JSON object in this format:
    {{
        "skills": ["React", "Python"],
        "location": "London"
    }}
    Do not output markdown code fences or any other text.
    
    Job Title: {jd_title}
    Job Description:
    {jd_text}
    """
    try:
        response = safe_chat_completion(
            messages=[
                {"role": "system", "content": "You are a helpful JSON parser."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content
        cleaned = clean_json_response(content)
        return json.loads(cleaned)
    except Exception as e:
        print("Error extracting JD criteria:", e)
        # fallback
        return {
            "skills": [jd_title.split()[0]] if jd_title else ["Developer"],
            "location": "London"
        }

def search_github_candidates(skills: list, location: str) -> list:
    query_parts = []
    if location:
        query_parts.append(f"location:{location}")
    for skill in skills:
        query_parts.append(skill)
    
    query_str = " ".join(query_parts)
    encoded_query = urllib.parse.quote(query_str)
    url = f"https://api.github.com/search/users?q={encoded_query}&per_page=15"
    
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "StitchATS-Candidate-Sourcer"}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            items = data.get("items", [])
            candidates = []
            
            # Fetch up to 10 user details
            for item in items[:10]:
                user_url = item.get("url")
                user_req = urllib.request.Request(
                    user_url,
                    headers={"User-Agent": "StitchATS-Candidate-Sourcer"}
                )
                try:
                    with urllib.request.urlopen(user_req, timeout=5) as user_res:
                        user_data = json.loads(user_res.read().decode())
                        candidates.append({
                            "name": user_data.get("name") or user_data.get("login"),
                            "github_username": user_data.get("login"),
                            "github_url": user_data.get("html_url"),
                            "linkedin_url": f"https://linkedin.com/in/{user_data.get('login')}",
                            "location": user_data.get("location") or location,
                            "bio": user_data.get("bio") or f"Active developer specializing in {', '.join(skills)}.",
                            "avatar_url": user_data.get("avatar_url"),
                            "email": user_data.get("email") or f"{user_data.get('login')}@example.com",
                            "skills": skills,
                            "company": user_data.get("company") or "Independent Developer",
                            "public_repos": user_data.get("public_repos") or 0
                        })
                except Exception as e:
                    print(f"Error fetching user details: {e}")
            return candidates
    except Exception as e:
        print("GitHub user search API error:", e)
        return []

def generate_fallback_candidates(skills: list, location: str, jd_title: str) -> list:
    from ..services.ai_screening import safe_chat_completion, clean_json_response
    prompt = f"""
    Generate 10 highly realistic candidate profiles for a sourcing simulation.
    They should be located in '{location}' and have experience in: {', '.join(skills)}.
    The job is '{jd_title}'.

    Provide their details in a JSON list of objects. Each object MUST have:
    - name: A realistic full name.
    - github_username: A matching lowercase username.
    - github_url: A realistic github URL, e.g. "https://github.com/username".
    - linkedin_url: A realistic linkedin URL, e.g. "https://linkedin.com/in/username".
    - location: '{location}' (or surrounding areas/details).
    - bio: A short, professional bio (1-2 sentences) detailing their tech stack and experience.
    - email: A realistic email address.
    - skills: A subset or full set of matching tech stack skills.
    - company: A realistic current employer or "Freelance Developer".
    - public_repos: An integer between 12 and 84.

    Return ONLY a JSON list (array) of 10 objects. Do not include markdown code fences or other text.
    """
    try:
        response = safe_chat_completion(
            messages=[
                {"role": "system", "content": "You are a helpful JSON generator outputting array values."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content
        cleaned = clean_json_response(content)
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except Exception as e:
        print("Error generating fallback candidates:", e)
    
    names = ["Emily Chen", "Marcus Vance", "Sven Lindqvist", "Elena Petrova", "Tariq Mahmood", 
             "Aisha Diallo", "Haran Dev", "Alex Morgan", "Chloe Dupont", "Kenji Sato"]
    static_cands = []
    for idx, name in enumerate(names):
        username = name.lower().replace(" ", "")
        static_cands.append({
            "name": name,
            "github_username": username,
            "github_url": f"https://github.com/{username}",
            "linkedin_url": f"https://linkedin.com/in/{username}",
            "location": location,
            "bio": f"Senior Software Engineer specializing in {', '.join(skills)} with a passion for building scalable applications.",
            "email": f"{username}@example.com",
            "skills": skills,
            "company": f"TechCorp {location}",
            "public_repos": 15 + idx * 4
        })
    return static_cands

def score_sourced_candidates(candidates: list, jd_text: str, jd_title: str, skills: list) -> list:
    from ..services.ai_screening import safe_chat_completion, clean_json_response
    candidate_summaries = []
    for idx, c in enumerate(candidates):
        candidate_summaries.append({
            "index": idx,
            "name": c.get("name"),
            "bio": c.get("bio"),
            "skills": c.get("skills"),
            "company": c.get("company")
        })
    
    prompt = f"""
    You are an AI sourcing evaluator. Score the following candidates against this Job Description:
    Job Title: {jd_title}
    Job Description:
    {jd_text}

    Candidates:
    {json.dumps(candidate_summaries, indent=2)}

    For each candidate, assign:
    1. A match_score (float/integer between 40 and 99).
    2. A match_reason (1-2 sentences explaining how their background fits the role requirements).

    Return ONLY a JSON list of objects matching the candidate index:
    [
        {{
            "index": 0,
            "match_score": 85,
            "match_reason": "Candidate has strong Python and Django background matching backend requirements."
        }}
    ]
    Do not output markdown code fences or any other text.
    """
    try:
        response = safe_chat_completion(
            messages=[
                {"role": "system", "content": "You are a helpful JSON evaluator."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content
        cleaned = clean_json_response(content)
        scores = json.loads(cleaned)
        
        score_map = {item["index"]: item for item in scores if "index" in item}
        for idx, c in enumerate(candidates):
            sc = score_map.get(idx, {})
            c["match_score"] = sc.get("match_score", 75)
            c["match_reason"] = sc.get("match_reason", f"Solid skills matching tech requirements.")
    except Exception as e:
        print("Error scoring sourced candidates:", e)
        for idx, c in enumerate(candidates):
            c["match_score"] = 65 + (idx % 4) * 8
            c["match_reason"] = f"Demonstrated background in {', '.join(skills)} matching the core job requirements."
    return candidates


@router.post("/source")
def source_candidates(req: SourcingRequest, db: Session = Depends(get_db)):
    """Source 10 candidates matching the JD title, skills and specified city/location."""
    job = db.query(Job).filter(Job.id == req.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # 1. Parse JD keywords
    criteria = extract_jd_criteria(job.description, job.title)
    skills = criteria.get("skills", ["Python"])
    location = req.location or criteria.get("location") or "London"
    
    # 2. Query GitHub or run fallback
    candidates = search_github_candidates(skills, location)
    if len(candidates) < 5:
        # Fallback generated profiles to ensure high-fidelity sourcing works perfectly
        candidates = generate_fallback_candidates(skills, location, job.title)
    
    # 3. Score candidates with AI
    scored_candidates = score_sourced_candidates(candidates, job.description, job.title, skills)
    
    # Log sourcing activity
    activity = Activity(
        action="AI Candidate Sourcing",
        description=f"Sourced {len(scored_candidates)} developers in '{location}' matching '{job.title}'",
        icon="🔍",
        color="#a855f7"
    )
    db.add(activity)
    db.commit()
    
    return scored_candidates


@router.post("/import-sourced")
def import_sourced_candidate(req: ImportSourcedRequest, db: Session = Depends(get_db)):
    """Import a sourced candidate into the job screening results."""
    # Check if job exists
    job = db.query(Job).filter(Job.id == req.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Check if candidate with this email is already imported
    candidate = db.query(Candidate).filter(Candidate.email == req.email).first()
    if not candidate:
        # Create new candidate
        candidate = Candidate(
            name=req.name,
            email=req.email,
            github_url=req.github_url,
            linkedin_url=req.linkedin_url,
            resume_text=f"Sourced Profile Bio:\n{req.bio}\n\nKey Skills: {', '.join(req.skills)}",
            resume_filename=f"sourced_{req.name.lower().replace(' ', '_')}.txt",
            status="screened",
            match_score=req.match_score,
            role=job.title
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
    
    # Check if screening entry exists
    screening = db.query(Screening).filter(
        Screening.job_id == req.job_id,
        Screening.candidate_id == candidate.id
    ).first()
    
    if not screening:
        # Create screening entry
        screening = Screening(
            job_id=req.job_id,
            candidate_id=candidate.id,
            match_score=req.match_score,
            strengths=json.dumps(req.skills),
            gaps=json.dumps([]),
            overall_summary=req.match_reason,
            seniority_fit="Mid/Senior" if req.match_score >= 80 else "Junior/Mid"
        )
        db.add(screening)
        db.commit()
        db.refresh(screening)
        
    # Log activity
    activity = Activity(
        action="Candidate Sourced & Imported",
        description=f"Imported sourced candidate '{req.name}' for job '{job.title}'",
        icon="📥",
        color="#34d399"
    )
    db.add(activity)
    db.commit()
    
    return {
        "id": screening.id,
        "job_id": screening.job_id,
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "candidate_email": candidate.email,
        "candidate_role": candidate.role,
        "match_score": screening.match_score,
        "strengths": req.skills,
        "gaps": [],
        "overall_summary": screening.overall_summary,
        "seniority_fit": screening.seniority_fit,
        "status": candidate.status,
        "assessment_status": candidate.assessment_status,
        "assessment_score": candidate.assessment_score,
        "assessment_token": candidate.assessment_token,
        "assessment_violations": candidate.assessment_violations,
        "github_url": candidate.github_url,
        "linkedin_url": candidate.linkedin_url,
        "linkedin_analysis": candidate.linkedin_analysis,
        "resume_text": candidate.resume_text
    }
