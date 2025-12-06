import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests

# Configure logging
logger = logging.getLogger(__name__)

def send_email(to_email, subject, body_html):
    """
    Sends an email using SMTP credentials from environment variables.
    """
    email_host = os.getenv("EMAIL_HOST")
    email_port = os.getenv("EMAIL_PORT")
    email_user = os.getenv("EMAIL_USER")
    email_password = os.getenv("EMAIL_PASSWORD")
    from_email = os.getenv("EMAIL_FROM", email_user)

    if not all([email_host, email_port, email_user, email_password]):
        logger.warning("Email config missing. Skipping email send.")
        return False

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body_html, 'html'))

    try:
        server = smtplib.SMTP(email_host, int(email_port))
        server.starttls()
        server.login(email_user, email_password)
        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False

def send_push_notification(user_id, title, message, data=None):
    """
    Sends a push notification using a generic API endpoint.
    """
    api_key = os.getenv("NOTIFICATION_API_KEY")
    endpoint = os.getenv("NOTIFICATION_ENDPOINT")

    if not all([api_key, endpoint]):
        logger.warning("Notification config missing. Skipping push notification.")
        return False

    payload = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "data": data or {}
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(endpoint, json=payload, headers=headers, timeout=5)
        if response.status_code in [200, 201]:
             logger.info(f"Notification sent to user {user_id}")
             return True
        else:
             logger.error(f"Notification failed: {response.status_code} {response.text}")
             return False
    except Exception as e:
        logger.error(f"Notification exception for user {user_id}: {e}")
        return False
