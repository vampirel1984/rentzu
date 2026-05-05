from __future__ import annotations

import json
import os
import smtplib
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Tuple


OUTBOX_DIR = Path(r'D:\apps\rentzu\server\outbox')


def _build_verification_email(email: str, code: str):
    subject = 'Your Rentzu verification code'
    text_body = (
        f'Your Rentzu verification code is: {code}\n\n'
        'If you did not request this, you can ignore this email.'
    )
    html_body = f"""
    <html>
      <body style=\"font-family: Arial, sans-serif; color: #0f172a;\">
        <h2>Rentzu verification</h2>
        <p>Your verification code is:</p>
        <div style=\"font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb; margin: 16px 0;\">{code}</div>
        <p>If you did not request this, you can ignore this email.</p>
      </body>
    </html>
    """.strip()
    return subject, text_body, html_body


def _write_outbox_email(email: str, subject: str, code: str, text_body: str, html_body: str, reason: str):
    OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    safe_email = email.replace('@', '_at_').replace('.', '_')
    outbox_file = OUTBOX_DIR / f"{timestamp}-{safe_email}.json"
    outbox_file.write_text(
        json.dumps(
            {
                'to': email,
                'subject': subject,
                'code': code,
                'text_body': text_body,
                'html_body': html_body,
                'mode': 'local-outbox-fallback',
                'reason': reason,
                'created_at_utc': timestamp,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )
    return outbox_file


def send_verification_email(email: str, code: str) -> Tuple[bool, str]:
    smtp_host = os.getenv('SMTP_HOST')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_password = os.getenv('SMTP_PASSWORD')
    smtp_from = os.getenv('SMTP_FROM', smtp_user or 'no-reply@rentzu.local')
    smtp_use_tls = os.getenv('SMTP_USE_TLS', 'true').lower() not in {'0', 'false', 'no'}

    subject, text_body, html_body = _build_verification_email(email, code)

    if smtp_host and smtp_user and smtp_password:
        try:
            message = EmailMessage()
            message['Subject'] = subject
            message['From'] = smtp_from
            message['To'] = email
            message.set_content(text_body)
            message.add_alternative(html_body, subtype='html')

            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.ehlo()
                if smtp_use_tls:
                    server.starttls()
                    server.ehlo()
                server.login(smtp_user, smtp_password)
                server.send_message(message)
            return True, f'Verification email sent to {email} via SMTP'
        except Exception as exc:
            outbox_file = _write_outbox_email(email, subject, code, text_body, html_body, f'SMTP send failed: {exc}')
            return False, f'SMTP send failed, wrote verification email to {outbox_file}'

    outbox_file = _write_outbox_email(email, subject, code, text_body, html_body, 'SMTP not configured')
    return False, f'No SMTP configured. Wrote verification email to {outbox_file}'
