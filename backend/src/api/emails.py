import requests
from django.conf import settings

def enviar_email(to, subject, html):
    api_key = getattr(settings, 'RESEND_API_KEY', None)
    
    if not api_key:
        print("ADVERTENCIA: No se encontró RESEND_API_KEY en el .env. Correo omitido.")
        return False

    try:
        r = requests.post(
            'https://api.resend.com/emails',
            headers={'Authorization': f'Bearer {api_key}'},
            json={
                'from': getattr(settings, 'RESEND_FROM', 'Kineconect <onboarding@resend.dev>'), 
                'to': [to], 
                'subject': subject, 
                'html': html
            },
            timeout=10,
        )
        r.raise_for_status()
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Error interno al enviar correo a {to}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print("Detalle de Resend:", e.response.text)
        return False