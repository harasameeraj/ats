"""
Stitch ATS — Settings Router
Provides endpoints to manage global system configurations like SMTP email setup.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SystemSetting, Activity
from ..schemas import SMTPSettingsUpdate, SMTPSettingsResponse, EmailProviderUpdate
from ..services.email_sender import send_email

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/smtp", response_model=SMTPSettingsResponse)
def get_smtp_settings(db: Session = Depends(get_db)):
    """Retrieve SMTP settings from database."""
    # Find settings or use defaults
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_name"]
    settings = db.query(SystemSetting).filter(SystemSetting.key.in_(keys)).all()
    settings_dict = {s.key: s.value for s in settings}

    host = settings_dict.get("smtp_host", "smtp.gmail.com")
    port = int(settings_dict.get("smtp_port", "587") or "587")
    user = settings_dict.get("smtp_user", "")
    password = settings_dict.get("smtp_password", "")
    from_name = settings_dict.get("smtp_from_name", "Stitch ATS")

    # Mask password
    masked_password = ""
    if password:
        masked_password = "•" * min(len(password), 12)

    return SMTPSettingsResponse(
        smtp_host=host,
        smtp_port=port,
        smtp_user=user,
        smtp_password_masked=masked_password,
        smtp_from_name=from_name
    )


@router.put("/smtp")
def update_smtp_settings(data: SMTPSettingsUpdate, db: Session = Depends(get_db)):
    """Update SMTP settings."""
    settings_data = {
        "smtp_host": data.smtp_host,
        "smtp_port": str(data.smtp_port),
        "smtp_user": data.smtp_user,
        "smtp_from_name": data.smtp_from_name
    }

    # Only update password if a new one is provided and not a placeholder
    # e.g., if it doesn't contain bullet characters (•) which indicates masked placeholder
    if data.smtp_password and "•" not in data.smtp_password:
        settings_data["smtp_password"] = data.smtp_password

    for key, val in settings_data.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not setting:
            setting = SystemSetting(key=key, value=val)
            db.add(setting)
        else:
            setting.value = val

    # Log activity
    activity = Activity(
        action="SMTP Config Updated",
        description=f"SMTP configuration updated for {data.smtp_user}",
        icon="⚙️",
        color="#8b5cf6"
    )
    db.add(activity)
    db.commit()

    return {"message": "SMTP settings updated successfully"}


@router.post("/smtp/test")
def test_smtp_settings(data: SMTPSettingsUpdate, db: Session = Depends(get_db)):
    """Test SMTP settings by sending a test email to the user's SMTP user address."""
    # Temporarily apply password if not sent (i.e. if user is testing with existing masked password)
    smtp_password = data.smtp_password
    if not smtp_password or "•" in smtp_password:
        existing_pwd = db.query(SystemSetting).filter(SystemSetting.key == "smtp_password").first()
        if existing_pwd:
            smtp_password = existing_pwd.value
        else:
            raise HTTPException(status_code=400, detail="SMTP Password is required for connection test")

    # Construct temporary settings dict for dry run
    # We will temporarily insert them into database (transaction rollback or delete afterwards)
    # Let's save them and run email, if fails, we return error. 
    # But to prevent permanent save, we'll run send_email and handle auth/connection.
    
    # We can write a custom helper or just temporarily change them in the DB and rollback
    # Since we need to test the actual configuration, let's temporarily set them, test, and commit if successful, or rollback.
    # Actually, a simpler way is to patch get_smtp_settings to accept temporary overrides,
    # but since it's already in smtplib, we can just call standard sendmail with overrides directly.
    # Let's implement connection testing using smtplib directly.
    import smtplib
    import ssl
    try:
        context = ssl.create_default_context()
        
        # Construct test email message first
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{data.smtp_from_name} <{data.smtp_user}>"
        msg["To"] = data.smtp_user
        msg["Subject"] = "Stitch ATS — SMTP connection test successful"
        
        html_content = f"""
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #1a1a2e; padding: 20px;">
            <h2 style="color: #4ade80;">SMTP Connection Successful!</h2>
            <p>Hello,</p>
            <p>This email confirms that your SMTP configuration for **Stitch ATS** is working correctly.</p>
            <p>Emails can now be sent successfully to your candidates.</p>
            <br>
            <p>Regards,<br>Stitch ATS System</p>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_content, "html", "utf-8"))
        
        if data.smtp_port == 465:
            with smtplib.SMTP_SSL(data.smtp_host, data.smtp_port, timeout=5, context=context) as server:
                server.login(data.smtp_user, smtp_password)
                server.sendmail(data.smtp_user, data.smtp_user, msg.as_string())
        else:
            with smtplib.SMTP(data.smtp_host, data.smtp_port, timeout=5) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(data.smtp_user, smtp_password)
                server.sendmail(data.smtp_user, data.smtp_user, msg.as_string())
                
        return {"success": True, "message": "Connection test successful! Test email sent to your inbox."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMTP Connection Test Failed: {str(e)}")


@router.get("/email-provider")
def get_email_provider(db: Session = Depends(get_db)):
    """Get the active email provider."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "active_email_provider").first()
    return {"provider": setting.value if setting and setting.value else "smtp"}

@router.put("/email-provider")
def update_email_provider(data: EmailProviderUpdate, db: Session = Depends(get_db)):
    """Update the active email provider."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "active_email_provider").first()
    if not setting:
        setting = SystemSetting(key="active_email_provider", value=data.provider)
        db.add(setting)
    else:
        setting.value = data.provider
    db.commit()
    return {"message": "Email provider updated successfully"}

@router.get("/outlook", response_model=SMTPSettingsResponse)
def get_outlook_settings(db: Session = Depends(get_db)):
    """Retrieve Outlook SMTP settings from database."""
    keys = ["outlook_host", "outlook_port", "outlook_user", "outlook_password", "outlook_from_name"]
    settings = db.query(SystemSetting).filter(SystemSetting.key.in_(keys)).all()
    settings_dict = {s.key: s.value for s in settings}

    host = settings_dict.get("outlook_host", "smtp-mail.outlook.com")
    port = int(settings_dict.get("outlook_port", "587") or "587")
    user = settings_dict.get("outlook_user", "sameeraj@qcerebrum.com")
    password = settings_dict.get("outlook_password", "")
    from_name = settings_dict.get("outlook_from_name", "Stitch ATS")

    masked_password = ""
    if password:
        masked_password = "•" * min(len(password), 12)

    return SMTPSettingsResponse(
        smtp_host=host,
        smtp_port=port,
        smtp_user=user,
        smtp_password_masked=masked_password,
        smtp_from_name=from_name
    )

@router.put("/outlook")
def update_outlook_settings(data: SMTPSettingsUpdate, db: Session = Depends(get_db)):
    """Update Outlook settings."""
    settings_data = {
        "outlook_host": data.smtp_host,
        "outlook_port": str(data.smtp_port),
        "outlook_user": data.smtp_user,
        "outlook_from_name": data.smtp_from_name
    }

    if data.smtp_password and "•" not in data.smtp_password:
        settings_data["outlook_password"] = data.smtp_password

    for key, val in settings_data.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not setting:
            setting = SystemSetting(key=key, value=val)
            db.add(setting)
        else:
            setting.value = val

    activity = Activity(
        action="Outlook Config Updated",
        description=f"Outlook configuration updated for {data.smtp_user}",
        icon="⚙️",
        color="#0078d4"
    )
    db.add(activity)
    db.commit()

    return {"message": "Outlook settings updated successfully"}

@router.post("/outlook/test")
def test_outlook_settings(data: SMTPSettingsUpdate, db: Session = Depends(get_db)):
    """Test Outlook settings by sending a test email."""
    smtp_password = data.smtp_password
    if not smtp_password or "•" in smtp_password:
        existing_pwd = db.query(SystemSetting).filter(SystemSetting.key == "outlook_password").first()
        if existing_pwd:
            smtp_password = existing_pwd.value
        else:
            raise HTTPException(status_code=400, detail="Outlook Password is required for connection test")

    import smtplib
    import ssl
    try:
        context = ssl.create_default_context()
        
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{data.smtp_from_name} <{data.smtp_user}>"
        msg["To"] = data.smtp_user
        msg["Subject"] = "Stitch ATS — Outlook connection test successful"
        
        html_content = f"""
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #1a1a2e; padding: 20px;">
            <h2 style="color: #0078d4;">Outlook Connection Successful!</h2>
            <p>Hello,</p>
            <p>This email confirms that your Outlook configuration for **Stitch ATS** is working correctly.</p>
            <br>
            <p>Regards,<br>Stitch ATS System</p>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_content, "html", "utf-8"))
        
        if data.smtp_port == 465:
            with smtplib.SMTP_SSL(data.smtp_host, data.smtp_port, timeout=5, context=context) as server:
                server.login(data.smtp_user, smtp_password)
                server.sendmail(data.smtp_user, data.smtp_user, msg.as_string())
        else:
            with smtplib.SMTP(data.smtp_host, data.smtp_port, timeout=5) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(data.smtp_user, smtp_password)
                server.sendmail(data.smtp_user, data.smtp_user, msg.as_string())
                
        return {"success": True, "message": "Connection test successful! Test email sent to your inbox."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Outlook Connection Test Failed: {str(e)}")


# ===== GOOGLE CALENDAR SETTINGS =====

@router.get("/gcal")
def get_gcal_settings(db: Session = Depends(get_db)):
    """Retrieve Google Calendar settings."""
    keys = ["gcal_organizer_email", "gcal_calendar_id", "gcal_credentials_json"]
    settings = db.query(SystemSetting).filter(SystemSetting.key.in_(keys)).all()
    settings_dict = {s.key: s.value for s in settings}

    organizer_email = settings_dict.get("gcal_organizer_email", "harasameeraj.7@gmail.com")
    calendar_id = settings_dict.get("gcal_calendar_id", "")
    credentials_json = settings_dict.get("gcal_credentials_json", "")

    # Mask credentials if they exist
    creds_masked = ""
    if credentials_json:
        creds_masked = credentials_json[:50] + "..." if len(credentials_json) > 50 else credentials_json

    return {
        "gcal_organizer_email": organizer_email,
        "gcal_calendar_id": calendar_id,
        "gcal_credentials_json_masked": creds_masked,
        "has_api_credentials": bool(credentials_json and calendar_id)
    }


from pydantic import BaseModel as PydanticBaseModel

class GCalSettingsUpdate(PydanticBaseModel):
    gcal_organizer_email: str = ""
    gcal_calendar_id: str = ""
    gcal_credentials_json: str = ""


@router.put("/gcal")
def update_gcal(data: GCalSettingsUpdate, db: Session = Depends(get_db)):
    """Update Google Calendar settings."""
    settings_data = {}
    
    if data.gcal_organizer_email:
        settings_data["gcal_organizer_email"] = data.gcal_organizer_email
    if data.gcal_calendar_id:
        settings_data["gcal_calendar_id"] = data.gcal_calendar_id
    # Only update credentials if provided and not a masked placeholder
    if data.gcal_credentials_json and "..." not in data.gcal_credentials_json:
        settings_data["gcal_credentials_json"] = data.gcal_credentials_json

    for key, val in settings_data.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not setting:
            setting = SystemSetting(key=key, value=val)
            db.add(setting)
        else:
            setting.value = val

    activity = Activity(
        action="Google Calendar Config Updated",
        description=f"Google Calendar integration updated — organizer: {data.gcal_organizer_email}",
        icon="📅",
        color="#4285f4"
    )
    db.add(activity)
    db.commit()

    return {"message": "Google Calendar settings updated successfully"}


@router.post("/gcal/test")
def test_gcal_connection(db: Session = Depends(get_db)):
    """Test Google Calendar API connection using stored credentials."""
    creds_setting = db.query(SystemSetting).filter(SystemSetting.key == "gcal_credentials_json").first()
    cal_id_setting = db.query(SystemSetting).filter(SystemSetting.key == "gcal_calendar_id").first()

    if not creds_setting or not creds_setting.value or not cal_id_setting or not cal_id_setting.value:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar API credentials and Calendar ID must be configured first. Note: The Google Calendar link generation (without API) works without credentials."
        )

    try:
        import json
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds_dict = json.loads(creds_setting.value)
        creds = service_account.Credentials.from_service_account_info(
            creds_dict,
            scopes=["https://www.googleapis.com/auth/calendar.readonly"],
        )
        service = build("calendar", "v3", credentials=creds)

        events_result = service.events().list(
            calendarId=cal_id_setting.value,
            maxResults=1
        ).execute()

        return {"success": True, "message": "Google Calendar API connection successful! Calendar is accessible."}
    except ImportError:
        raise HTTPException(status_code=400, detail="google-api-python-client is not installed. Install it with: pip install google-api-python-client google-auth")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Calendar API Test Failed: {str(e)}")

