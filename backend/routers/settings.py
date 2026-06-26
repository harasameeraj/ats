"""
Stitch ATS — Settings Router
Provides endpoints to manage global system configurations like SMTP email setup.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SystemSetting, Activity
from ..schemas import SMTPSettingsUpdate, SMTPSettingsResponse
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
