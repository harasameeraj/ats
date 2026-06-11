"""
Stitch ATS — AI Screening Service
Uses OpenAI GPT-4o for semantic resume-JD matching.
"""

import os
import json
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

# Load .env from the backend directory (parent of services/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def screen_single_candidate(jd_text: str, resume_text: str, candidate_name: str) -> dict:
    """
    Screen a single candidate's resume against a job description using GPT-4o.
    Returns a dict with match_score, strengths, gaps, rejection_reason, etc.
    """
    prompt = f"""You are an expert HR recruiter and talent acquisition specialist. 
Analyze the following resume against the job description using SEMANTIC matching 
(not just keyword matching). Consider skills, experience level, cultural indicators, 
and transferable skills.

JOB DESCRIPTION:
{jd_text[:3000]}

CANDIDATE RESUME ({candidate_name}):
{resume_text[:3000]}

Return a JSON object with exactly these fields:
{{
    "match_score": <number 0-100>,
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "gaps": ["gap 1", "gap 2"],
    "rejection_reason": "<reason string if score < 40, else null>",
    "seniority_fit": "<junior|mid|senior|lead>",
    "overall_summary": "<2-3 sentence summary of fit>"
}}

Be fair but thorough. A score of 70+ means shortlist-worthy. Below 40 means reject.
Return ONLY valid JSON, no markdown.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert HR recruiter. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)

        # Ensure required fields exist with defaults
        return {
            "match_score": float(result.get("match_score", 0)),
            "strengths": json.dumps(result.get("strengths", [])),
            "gaps": json.dumps(result.get("gaps", [])),
            "rejection_reason": result.get("rejection_reason"),
            "seniority_fit": result.get("seniority_fit", "unknown"),
            "overall_summary": result.get("overall_summary", "No summary available.")
        }
    except Exception as e:
        return {
            "match_score": 0.0,
            "strengths": json.dumps([]),
            "gaps": json.dumps([f"Error during screening: {str(e)}"]),
            "rejection_reason": f"Screening error: {str(e)}",
            "seniority_fit": "unknown",
            "overall_summary": f"Error occurred during AI screening: {str(e)}"
        }


def suggest_interview_slots(candidate_name: str, role: str) -> list[dict]:
    """Use AI to suggest optimal interview time slots."""
    try:
        prompt = f"""Suggest 3 optimal interview time slots for a candidate named {candidate_name} 
applying for {role}. Consider typical business hours (9 AM - 5 PM).
Return a JSON array with exactly 3 objects, each having:
{{"time": "human readable time", "reason": "why this slot is good"}}
Return ONLY valid JSON array, no markdown.
"""
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a scheduling assistant. Return only valid JSON arrays."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        # Handle both direct array and wrapped object
        if isinstance(result, list):
            return result
        elif isinstance(result, dict) and "slots" in result:
            return result["slots"]
        elif isinstance(result, dict) and "suggestions" in result:
            return result["suggestions"]
        else:
            # Try to find any array value in the dict
            for v in result.values():
                if isinstance(v, list):
                    return v
            return [{"time": "Tomorrow 10:00 AM", "reason": "Standard morning slot"}]
    except Exception as e:
        return [
            {"time": "Tomorrow 10:00 AM", "reason": "Standard morning slot"},
            {"time": "Tomorrow 2:00 PM", "reason": "Post-lunch energy slot"},
            {"time": "Day after 11:00 AM", "reason": "Mid-morning focus time"}
        ]


def generate_ai_email(candidate_name: str, role: str, strengths: list, gaps: list, summary: str, email_type: str, details: dict) -> dict:
    """Use GPT-4o to generate a highly personalized, friendly email draft for the candidate."""
    details_str = json.dumps(details) if details else ""
    
    if email_type == "invitation":
        prompt = f"""You are a professional corporate recruiter. Write a friendly, warm, and highly personalized email inviting {candidate_name} to an interview for the {role} position.
        
        CANDIDATE DETAILS:
        - Strengths: {strengths}
        - Gaps: {gaps}
        - Overall Fit Summary: {summary}
        - Interview Details: {details_str}
        
        Write a standard subject line and body. 
        In the body:
        - Thank them for applying.
        - Mention 1-2 specific strengths from their CV (derived from the CANDIDATE DETAILS) that impressed our team.
        - Give the interview date, time, and interviewer name if available in the Interview Details.
        - Sound welcoming and enthusiastic.
        
        Return a JSON object with exactly these fields:
        {{
            "subject": "<Subject line>",
            "body": "<Email body with formatting like newlines. Use placeholders like [Interviewer Name] if missing from details, but do not use brackets if details are provided.>"
        }}
        Return ONLY valid JSON.
        """
    else: # offer_letter
        prompt = f"""You are a head of talent acquisition. Write a warm, formal, and exciting job offer letter to {candidate_name} for the {role} position.
        
        CANDIDATE DETAILS:
        - Strengths: {strengths}
        - Overall Fit Summary: {summary}
        - Offer Details: {details_str}
        
        Write a subject line and the offer letter body.
        In the body:
        - Formally offer them the position.
        - Express how excited the team is to have them join, highlighting how their specific strengths fit the role.
        - Explain that we will begin provisioning their access credentials and hardware (e.g. MacBook) shortly (referencing our onboarding automation).
        
        Return a JSON object with exactly these fields:
        {{
            "subject": "<Subject line>",
            "body": "<Job offer letter body with formatting like newlines.>"
        }}
        Return ONLY valid JSON.
        """

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a professional recruitment assistant. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=600,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "subject": result.get("subject", "Interview Invitation: Stitch ATS"),
            "body": result.get("body", f"Dear {candidate_name},\n\nWe would love to invite you to an interview...")
        }
    except Exception as e:
        return {
            "subject": f"Interview Invitation - {role}",
            "body": f"Dear {candidate_name},\n\nWe are pleased to invite you to discuss the {role} position. Our team will contact you shortly to coordinate time slots."
        }
