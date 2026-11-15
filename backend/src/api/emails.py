import logging
import threading

import requests
from django.conf import settings
from django.utils.html import escape

logger = logging.getLogger(__name__)


class EmailError(Exception):
    pass


def enviar_email(to, subject, html):
    """Envía un correo por la API de Resend (HTTPS, funciona en Render)."""
    api_key = getattr(settings, 'RESEND_API_KEY', '')
    if not api_key:
        raise EmailError('RESEND_API_KEY no está configurada')

    try:
        r = requests.post(
            'https://api.resend.com/emails',
            headers={'Authorization': f'Bearer {api_key}'},
            json={'from': settings.RESEND_FROM, 'to': [to], 'subject': subject, 'html': html},
            timeout=10,
        )
    except requests.RequestException as e:
        raise EmailError(f'No se pudo contactar a Resend: {e}')

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
    Con EMAIL_RELAY_GMAIL=True el correo va a ADMIN_EMAIL (el único que Resend
    permite sin dominio) y el Apps Script de Google lo reenvía al paciente.
    """
    cuerpo = (
        f'<p>Hola <b>{escape(nombre)}</b>, tu cuenta en <strong>KineConnect</strong> fue creada.</p>'
        f'<p>Descarga la aplicación móvil e ingresa con estos datos:</p>'
        f'<ul><li><b>Usuario (RUT sin puntos ni guion):</b> {escape(username)}</li>'
        f'<li><b>Contraseña temporal:</b> {escape(password)}</li></ul>'
        f'<p>Te recomendamos cambiarla al ingresar.</p>'
    )
    asunto = 'Tus credenciales de acceso a KineConnect'

    if getattr(settings, 'EMAIL_RELAY_GMAIL', False):
        html = f'<p>PARA: {escape(destino)}</p><p>KC-INICIO</p>{cuerpo}<p>KC-FIN</p>'
        return enviar_email(settings.ADMIN_EMAIL, f'[KC-ENVIAR] {asunto}', html)
    return enviar_email(destino, asunto, cuerpo)


def enviar_credenciales_en_segundo_plano(*args, **kwargs):
    def _run():
        try:
            enviar_credenciales(*args, **kwargs)
        except Exception:
            logger.exception('Falló el envío de credenciales')
    threading.Thread(target=_run, daemon=True).start()