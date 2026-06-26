"""
Stitch ATS — Email Sending Service
Sends emails via Gmail/Custom SMTP using database-configured settings or environment variables fallback.
"""

import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from ..models import SystemSetting

# Load .env from the backend directory (parent of services/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


def get_smtp_settings(db: Session = None) -> dict:
    """Get SMTP configuration resolving database overrides first, then env variables."""
    settings = {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_name": os.getenv("SMTP_FROM_NAME", "Stitch ATS")
    }

    if db:
        try:
            db_settings = db.query(SystemSetting).filter(SystemSetting.key.like("smtp_%")).all()
            for s in db_settings:
                if s.key == "smtp_host" and s.value:
                    settings["host"] = s.value
                elif s.key == "smtp_port" and s.value:
                    try:
                        settings["port"] = int(s.value)
                    except ValueError:
                        pass
                elif s.key == "smtp_user" and s.value:
                    settings["user"] = s.value
                elif s.key == "smtp_password" and s.value:
                    settings["password"] = s.value
                elif s.key == "smtp_from_name" and s.value:
                    settings["from_name"] = s.value
        except Exception:
            pass  # Fall back to env on DB errors

    return settings


def is_email_configured(db: Session = None) -> bool:
    """Check if SMTP credentials are configured."""
    settings = get_smtp_settings(db)
    return bool(settings["user"] and settings["password"])


def send_email(to_email: str, subject: str, body: str, reply_to: str = None, db: Session = None) -> dict:
    """
    Send an email via SMTP.
    
    Args:
        to_email: Recipient email address
        subject: Email subject line
        body: Email body (plain text)
        reply_to: Optional reply-to address
        db: Optional database Session for retrieving dynamic settings
    
    Returns:
        dict with success status and message
    """
    settings = get_smtp_settings(db)
    
    if not (settings["user"] and settings["password"]):
        return {
            "success": False,
            "message": "SMTP credentials not configured. Please set them up in System Settings or .env file."
        }

    try:
        # Create the email message
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings['from_name']} <{settings['user']}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        if reply_to:
            msg["Reply-To"] = reply_to

        # Create plain text version
        text_part = MIMEText(body, "plain", "utf-8")
        msg.attach(text_part)

        # Create an HTML version with nice formatting
        html_body = body.replace("\n", "<br>")
        html_content = f"""
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                      line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="border-bottom: 3px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px;">
                <h2 style="margin: 0; color: #6366f1; font-size: 18px;">Stitch ATS</h2>
            </div>
            <div style="font-size: 15px;">
                {html_body}
            </div>
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; 
                        font-size: 12px; color: #9ca3af;">
                Sent via Stitch ATS — AI-Powered Hiring Platform
            </div>
        </body>
        </html>
        """
        html_part = MIMEText(html_content, "html", "utf-8")
        msg.attach(html_part)

        # Connect to SMTP and send
        context = ssl.create_default_context()
        if settings["port"] == 465:
            with smtplib.SMTP_SSL(settings["host"], settings["port"], context=context) as server:
                server.login(settings["user"], settings["password"])
                server.sendmail(settings["user"], to_email, msg.as_string())
        else:
            with smtplib.SMTP(settings["host"], settings["port"]) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(settings["user"], settings["password"])
                server.sendmail(settings["user"], to_email, msg.as_string())

        return {
            "success": True,
            "message": f"Email successfully sent to {to_email}"
        }

    except smtplib.SMTPAuthenticationError:
        return {
            "success": False,
            "message": f"SMTP authentication failed for user {settings['user']}. Please check your credentials."
        }
    except smtplib.SMTPRecipientsRefused:
        return {
            "success": False,
            "message": f"Recipient email address rejected: {to_email}"
        }
    except smtplib.SMTPException as e:
        return {
            "success": False,
            "message": f"SMTP error: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to send email: {str(e)}"
        }
