import os
import smtplib
from email.message import EmailMessage
import resend
from django.conf import settings


def enviar_email(destinatario: str, asunto: str, html: str):
    if not destinatario:
        return

    smtp_user = os.getenv('SMTP_USER', '').strip()
    smtp_pass = os.getenv('SMTP_PASSWORD', '').strip()

    if smtp_user and smtp_pass:
        msg = EmailMessage()
        msg['Subject'] = asunto
        msg['From'] = f'KineConnect <{smtp_user}>'
        msg['To'] = destinatario
        msg.set_content('Tu cliente de correo no soporta HTML.')
        msg.add_alternative(html, subtype='html')

        with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=15) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return

    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send({
        'from': settings.DEFAULT_FROM_EMAIL,
        'to': [destinatario],
        'subject': asunto,
        'html': html,
    })