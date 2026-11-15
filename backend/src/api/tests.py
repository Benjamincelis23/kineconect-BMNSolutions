from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User

class KineconectSecurityTests(APITestCase):
    
    def setUp(self):
        # Este método se ejecuta antes de cada prueba.
        # Creamos un usuario de prueba ("kinesiologo")
        self.kinesiologo = User.objects.create_user(
            username='kine_prueba',
            password='password123'
        )
        # Definimos una URL protegida para intentar acceder (ej. pautas)
        self.pautas_url = '/api/v1/pautas/'

    def test_acceso_anonimo_bloqueado(self):
        """
        Prueba 1: Un usuario sin token intenta ver las pautas.
        El servidor DEBE responder con un 401 Unauthorized.
        """
        respuesta = self.client.get(self.pautas_url)
        
        # Validamos el bloqueo confirmando el código 401
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_acceso_kinesiologo_permitido(self):
        """
        Prueba 2: Un usuario con token válido intenta ver las pautas.
        El servidor DEBE dejarlo pasar y responder con 200 OK.
        """
        # Simulamos que el kinesiólogo inicia sesión y le inyectamos su token
        self.client.force_authenticate(user=self.kinesiologo)
        
        respuesta = self.client.get(self.pautas_url)
        
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)