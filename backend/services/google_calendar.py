"""
Stitch ATS — Google Calendar Service
Generates Google Calendar event links and supports full API integration when credentials are configured.
"""

import json
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional, Dict, Any


def generate_gcal_link(
    summary: str,
    description: str,
    start_dt: datetime,
    duration_mins: int = 45,
    location: str = "",
    attendee_emails: list = None,
) -> str:
    """
    Generate a Google Calendar 'Add Event' URL that opens in the user's browser
    with pre-filled event details. Works instantly — no API credentials needed.
    """
    end_dt = start_dt + timedelta(minutes=duration_mins)

    # Google Calendar uses this date format: YYYYMMDDTHHmmSSZ
    fmt = "%Y%m%dT%H%M%S"
    dates = f"{start_dt.strftime(fmt)}/{end_dt.strftime(fmt)}"

    params = {
        "action": "TEMPLATE",
        "text": summary,
        "details": description,
        "dates": dates,
        "ctz": "Asia/Kolkata",
    }

    if location:
        params["location"] = location

    if attendee_emails:
        params["add"] = ",".join(attendee_emails)

    base = "https://calendar.google.com/calendar/render"
    return f"{base}?{urllib.parse.urlencode(params)}"


def build_interview_gcal_link(
    candidate_name: str,
    candidate_email: str,
    interviewer_name: str,
    candidate_role: str,
    scheduled_at: datetime,
    duration_mins: int = 45,
    organizer_email: str = "",
    notes: str = "",
) -> str:
    """
    Build a complete Google Calendar event link for an interview.
    """
    summary = f"Interview — {candidate_name}"

    description_lines = [
        f"📋 Candidate: {candidate_name}",
        f"👤 Interviewer: {interviewer_name}",
        f"💼 Role: {candidate_role or 'General'}",
        f"⏱ Duration: {duration_mins} minutes",
        "",
        "📌 Stitch ATS — Automated Interview Scheduling",
    ]
    if notes:
        description_lines.insert(4, f"📝 Notes: {notes}")

    description = "\n".join(description_lines)

    attendees = []
    if candidate_email:
        attendees.append(candidate_email)
    if organizer_email:
        attendees.append(organizer_email)

    return generate_gcal_link(
        summary=summary,
        description=description,
        start_dt=scheduled_at,
        duration_mins=duration_mins,
        location="Google Meet (create link in event)",
        attendee_emails=attendees,
    )


def try_create_api_event(
    credentials_json: str,
    calendar_id: str,
    summary: str,
    description: str,
    start_dt: datetime,
    duration_mins: int = 45,
    attendee_emails: list = None,
) -> Optional[Dict[str, Any]]:
    """
    Try to create an event using Google Calendar API with service account credentials.
    Returns event data dict with 'htmlLink' and 'hangoutLink' if successful, or None if
    credentials are not configured or API call fails.
    
    This is the advanced integration — only works when service account credentials are configured
    in Settings.
    """
    if not credentials_json or not calendar_id:
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds_dict = json.loads(credentials_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_dict,
            scopes=["https://www.googleapis.com/auth/calendar"],
        )

        service = build("calendar", "v3", credentials=creds)

        end_dt = start_dt + timedelta(minutes=duration_mins)

        event_body = {
            "summary": summary,
            "description": description,
            "start": {
                "dateTime": start_dt.isoformat(),
                "timeZone": "Asia/Kolkata",
            },
            "end": {
                "dateTime": end_dt.isoformat(),
                "timeZone": "Asia/Kolkata",
            },
            "conferenceData": {
                "createRequest": {
                    "requestId": f"stitch-ats-{start_dt.strftime('%Y%m%d%H%M%S')}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 30},
                    {"method": "popup", "minutes": 15},
                ],
            },
        }

        if attendee_emails:
            event_body["attendees"] = [{"email": e} for e in attendee_emails]

        event = (
            service.events()
            .insert(
                calendarId=calendar_id,
                body=event_body,
                conferenceDataVersion=1,
            )
            .execute()
        )

        return {
            "event_id": event.get("id"),
            "html_link": event.get("htmlLink"),
            "meet_link": event.get("hangoutLink", ""),
        }
    except ImportError:
        # google-api-python-client not installed
        return None
    except Exception as e:
        print(f"[GCal API Error] {e}")
        return None
