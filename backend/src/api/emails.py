import logging
import os
import threading

import requests
from django.conf import settings
from django.utils.html import escape

logger = logging.getLogger(__name__)


class EmailError(Exception):
    pass


def enviar_email(to, subject, html):
    """Envía un correo por la API de Resend (HTTPS, funciona en Render)."""
    api_key = getattr(settings, 'RESEND_API_KEY', '') or os.environ.get('RESEND_API_KEY', '')
    if not api_key:
        raise EmailError('RESEND_API_KEY no está configurada')

    remitente = getattr(settings, 'RESEND_FROM', '') or os.environ.get('RESEND_FROM', 'onboarding@resend.dev')
    admin_email = getattr(settings, 'ADMIN_EMAIL', '') or os.environ.get('ADMIN_EMAIL', 'benj.celis@duocuc.cl')

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'from': remitente,
        'to': [to],
        'subject': subject,
        'html': html,
    }

    try:
        r = requests.post('https://api.resend.com/emails', json=payload, headers=headers, timeout=15)
    except requests.RequestException as e:
        raise EmailError(f'No se pudo contactar a Resend: {e}')

    # Fallback automático: si Resend responde 403 por cuenta sin dominio, envía vía relay a ADMIN_EMAIL
    if r.status_code == 403 and admin_email and to.lower() != admin_email.lower():
        logger.warning('Resend 403 para %s; redirigiendo vía relay a %s', to, admin_email)
        payload['to'] = [admin_email]
        payload['subject'] = subject if subject.startswith('[KC-ENVIAR]') else f'[KC-ENVIAR] {subject}'
        payload['html'] = (
            html
            if 'KC-INICIO' in html
            else f'<p>PARA: {escape(to)}</p><p>KC-INICIO</p>{html}<p>KC-FIN</p>'
        )
        try:
            r = requests.post('https://api.resend.com/emails', json=payload, headers=headers, timeout=15)
        except requests.RequestException as e:
            raise EmailError(f'No se pudo contactar a Resend en modo relay: {e}')

    if r.status_code >= 400:
        logger.error('Resend respondió %s: %s', r.status_code, r.text)
        raise EmailError(f'Resend {r.status_code}: {r.text}')

    return r.json()


def enviar_email_en_segundo_plano(to, subject, html):
    """No bloquea la petición y deja el error en los logs."""
    def _run():
        try:
            enviar_email(to, subject, html)
        except Exception:
            logger.exception('Falló el envío de correo a %s', to)

    threading.Thread(target=_run, daemon=True).start()


def enviar_credenciales(destino, nombre, username, password):
    """
    Con EMAIL_RELAY_GMAIL=True (o fallback 403) el correo va a ADMIN_EMAIL
    y el Apps Script de Google lo reenvía al paciente.
    """
    cuerpo = (
        f'<p>Hola <b>{escape(nombre)}</b>, tu cuenta en <strong>KineConnect</strong> fue creada.</p>'
        f'<p>Descarga la aplicación móvil e ingresa con estos datos:</p>'
        f'<ul><li><b>Usuario (RUT sin puntos ni guion):</b> {escape(username)}</li>'
        f'<li><b>Contraseña temporal:</b> {escape(password)}</li></ul>'
        f'<p>Te recomendamos cambiarla al ingresar.</p>'
    )
    asunto = 'Tus credenciales de acceso a KineConnect'

    relay_activo = getattr(settings, 'EMAIL_RELAY_GMAIL', False) or (
        os.environ.get('EMAIL_RELAY_GMAIL', '').lower() in ('true', '1', 'yes')
    )
    admin_email = getattr(settings, 'ADMIN_EMAIL', '') or os.environ.get('ADMIN_EMAIL', 'benj.celis@duocuc.cl')

    if relay_activo and admin_email:
        html = f'<p>PARA: {escape(destino)}</p><p>KC-INICIO</p>{cuerpo}<p>KC-FIN</p>'
        return enviar_email(admin_email, f'[KC-ENVIAR] {asunto}', html)

    return enviar_email(destino, asunto, cuerpo)


def enviar_credenciales_en_segundo_plano(*args, **kwargs):
    def _run():
        try:
            enviar_credenciales(*args, **kwargs)
        except Exception:
            logger.exception('Falló el envío de credenciales')

    threading.Thread(target=_run, daemon=True).start()