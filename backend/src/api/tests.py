from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from api.models import Perfil

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


class PerfilEscalamientoRolTests(APITestCase):
    """H-20: un paciente no puede modificar su rol, RUT ni kinesiólogo asignado."""

    def setUp(self):
        self.kine = User.objects.create_user(username='kine_h20', password='x-no-usar-1')
        Perfil.objects.create(user=self.kine, rut='11111111-1', rol='KINE')
        self.paciente = User.objects.create_user(username='pac_h20', password='x-no-usar-2')
        self.perfil = Perfil.objects.create(user=self.paciente, rut='22222222-2', rol='PACIENTE')
        self.url = f'/api/v1/perfiles/{self.perfil.id}/'
        self.client.force_authenticate(user=self.paciente)

    def test_paciente_no_puede_promoverse_a_kine(self):
        resp = self.client.patch(self.url, {'rol': 'KINE'}, format='json')
        self.perfil.refresh_from_db()
        self.assertEqual(self.perfil.rol, 'PACIENTE')
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_paciente_no_puede_cambiar_rut_ni_kine_asignado(self):
        resp = self.client.put(
            self.url,
            {'rut': '33333333-3', 'rol': 'PACIENTE', 'kinesiologo_asignado': self.kine.id},
            format='json',
        )
        self.perfil.refresh_from_db()
        self.assertEqual(self.perfil.rut, '22222222-2')
        self.assertIsNone(self.perfil.kinesiologo_asignado)
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_paciente_no_puede_borrar_su_perfil(self):
        resp = self.client.delete(self.url)
        self.assertTrue(Perfil.objects.filter(pk=self.perfil.pk).exists())
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_paciente_sigue_viendo_su_perfil(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['rol'], 'PACIENTE')


class AccionesKinesiologoTests(APITestCase):
    """H-21: las acciones de kinesiólogo de /perfiles/ no están disponibles para pacientes."""

    def setUp(self):
        self.kine = User.objects.create_user(username='kine_h21', password='x-no-usar-3')
        Perfil.objects.create(user=self.kine, rut='44444444-4', rol='KINE')
        self.paciente = User.objects.create_user(username='pac_h21', password='x-no-usar-4')
        Perfil.objects.create(user=self.paciente, rut='55555555-5', rol='PACIENTE', kinesiologo_asignado=self.kine)
        self.url_registrar = '/api/v1/perfiles/registrar-paciente/'
        self.datos_nuevo = {'first_name': 'Nuevo', 'last_name': 'Paciente', 'rut': '66666666-6'}  # sin email: no envía correo

    def test_paciente_no_puede_registrar_pacientes(self):
        self.client.force_authenticate(user=self.paciente)
        resp = self.client.post(self.url_registrar, self.datos_nuevo, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Perfil.objects.filter(rut='66666666-6').exists())
        self.assertFalse(User.objects.filter(username='666666666').exists())

    def test_paciente_no_accede_a_listados_de_kinesiologo(self):
        self.client.force_authenticate(user=self.paciente)
        for url in ('/api/v1/perfiles/mis-pacientes/', '/api/v1/perfiles/alertas-abandono/'):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

    def test_kinesiologo_registra_paciente_asignado_a_el(self):
        self.client.force_authenticate(user=self.kine)
        resp = self.client.post(self.url_registrar, self.datos_nuevo, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        perfil = Perfil.objects.get(rut='66666666-6')
        self.assertEqual(perfil.rol, 'PACIENTE')
        self.assertEqual(perfil.kinesiologo_asignado, self.kine)

    def test_kinesiologo_ve_sus_pacientes(self):
        self.client.force_authenticate(user=self.kine)
        resp = self.client.get('/api/v1/perfiles/mis-pacientes/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual([p['rut'] for p in resp.data], ['55555555-5'])

    def test_username_existente_devuelve_400_y_no_500(self):
        User.objects.create_user(username='666666666', password='x-no-usar-5')  # cuenta sin Perfil con ese RUT
        self.client.force_authenticate(user=self.kine)
        resp = self.client.post(self.url_registrar, self.datos_nuevo, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rut', resp.data)