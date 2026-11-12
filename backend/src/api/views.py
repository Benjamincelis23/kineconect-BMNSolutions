from datetime import timedelta
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import generics, status, viewsets, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.views import TokenObtainPairView
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.core import signing
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
import secrets
import string
from django.conf import settings

from .emails import enviar_email
from .models import Perfil, Ejercicio, Pauta, RegistroFeedback, SolicitudRegistro
from .serializers import (
    PerfilSerializer, EjercicioSerializer, PautaCreateSerializer,
    PautaReadSerializer, RegistroFeedbackSerializer, PacienteRegistroSerializer,
    PautaListSerializer, PautaDetailSerializer, CustomTokenObtainPairSerializer
)

SALT = 'aprobacion-registro'


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


def _calcular_alertas_abandono(user):
    if user.is_staff or user.is_superuser:
        pacientes = Perfil.objects.filter(rol='PACIENTE').select_related('user')
    else:
        pacientes = Perfil.objects.filter(rol='PACIENTE', kinesiologo_asignado=user).select_related('user')
        if not pacientes.exists():
            pacientes = Perfil.objects.filter(rol='PACIENTE').select_related('user')

    limite = timezone.now() - timedelta(days=7)
    alertas = []

    for perfil in pacientes:
        tiene_pauta = Pauta.objects.filter(paciente=perfil.user, activo=True, es_plantilla=False).exists()
        if not tiene_pauta:
            continue

        ultimo_fb = RegistroFeedback.objects.filter(
            pauta__paciente=perfil.user
        ).order_by('-fecha_ejecucion').first()

        if not ultimo_fb or ultimo_fb.fecha_ejecucion < limite:
            dias = (timezone.now() - ultimo_fb.fecha_ejecucion).days if ultimo_fb else None
            alertas.append({
                'paciente_id': perfil.user.id,
                'perfil_id': perfil.id,
                'nombre_completo': perfil.user.get_full_name() or perfil.user.username,
                'rut': perfil.rut,
                'dias_inactivo': dias,
                'ultima_actividad': ultimo_fb.fecha_ejecucion if ultimo_fb else None,
                'mensaje': f'Sin actividad hace {dias} días' if dias is not None else 'Aún no inicia su primera sesión'
            })

    return alertas


# =========================================================
# LÓGICA DE SOLICITUD DE REGISTRO Y APROBACIÓN POR CORREO
# =========================================================

class SolicitudSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolicitudRegistro
        fields = ['rut', 'nombre', 'apellido', 'email', 'telefono']


class RegistroView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = SolicitudSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        s = ser.save()
        token = signing.dumps(s.id, salt=SALT)

        link = f'{settings.PUBLIC_BASE_URL}/api/v1/registro/aprobar/{token}/'

        enviar_email(
            settings.ADMIN_EMAIL,
            f'Nueva solicitud de paciente: {s.nombre} {s.apellido}',
            f'<p>RUT: {s.rut}<br>Correo: {s.email}<br>Tel: {s.telefono}</p>'
            f'<p><a href="{link}">Haga clic aquí para revisar y aprobar la solicitud</a></p>',
        )
        return Response({'detail': 'Solicitud enviada, pendiente de aprobación.'}, status=status.HTTP_201_CREATED)


def _generar_password(n=12):
    alfabeto = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alfabeto) for _ in range(n))


@csrf_exempt
def aprobar_view(request, token):
    try:
        sid = signing.loads(token, salt=SALT, max_age=60*60*72)
        s = SolicitudRegistro.objects.get(id=sid)
    except (signing.BadSignature, SolicitudRegistro.DoesNotExist):
        return HttpResponse('El enlace de aprobación es inválido o ha expirado.', status=400)

    if s.estado != 'PENDIENTE':
        return HttpResponse(f'Esta solicitud ya fue {s.estado.lower()}.')

    if request.method == 'GET':
        return HttpResponse(
            f'<h3>Aprobar paciente: {s.nombre} {s.apellido} ({s.rut})</h3><p>Email: {s.email}</p>'
            '<form method="post">'
            '<button name="accion" value="aprobar" style="background-color: green; color: white; padding: 10px; margin-right: 10px;">Aprobar Paciente</button>'
            '<button name="accion" value="rechazar" style="background-color: red; color: white; padding: 10px;">Rechazar</button>'
            '</form>'
        )

    if request.POST.get('accion') == 'rechazar':
        s.estado = 'RECHAZADA'
        s.save()
        return HttpResponse('Solicitud rechazada correctamente.')

    User = get_user_model()
    password = _generar_password()
    username_limpio = s.rut.replace('.', '').replace('-', '').strip().upper()

    user = User.objects.create_user(
        username=username_limpio,
        email=s.email,
        first_name=s.nombre,
        last_name=s.apellido,
        password=password
    )

    Perfil.objects.create(
        user=user,
        rut=s.rut,
        rol='PACIENTE'
    )

    s.estado = 'APROBADA'
    s.save()

    enviar_email(
        s.email, 'Tus credenciales de acceso a Kineconect',
        f'<p>Hola {s.nombre}, tu solicitud fue aprobada por el kinesiólogo.</p>'
        f'<p>Descarga la app e ingresa con los siguientes datos:</p>'
        f'<p><b>Usuario (RUT):</b> {username_limpio}<br><b>Contraseña temporal:</b> {password}</p>'
        '<p>Te recomendamos cambiarla una vez que ingreses a la plataforma.</p>',
    )
    return HttpResponse('Paciente aprobado. Las credenciales temporales fueron enviadas a su correo.')


# =========================================================
# VISTAS ESPECÍFICAS PARA LA APLICACIÓN MÓVIL (ME, PAUTAS, FEEDBACK, PASSWORD)
# =========================================================

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        ultima = Pauta.objects.filter(paciente=u).order_by('-creado_en').first()
        kine = None
        if ultima and ultima.kinesiologo:
            k = ultima.kinesiologo
            kine = {'nombre': f'{k.first_name} {k.last_name}', 'email': k.email}

        semana = RegistroFeedback.objects.filter(
            pauta__paciente=u, fecha_ejecucion__gte=timezone.now() - timedelta(days=7)
        ).count()

        return Response({
            'nombre': u.first_name,
            'apellido': u.last_name,
            'rut': u.username,
            'email': u.email,
            'kinesiologo': kine,
            'sesiones_semana': semana,
            'meta_semanal': 3,
        })


class PautaListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PautaListSerializer

    def get_queryset(self):
        return Pauta.objects.filter(paciente=self.request.user, activo=True).order_by('-creado_en')


class PautaDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PautaDetailSerializer

    def get_queryset(self):
        return Pauta.objects.filter(paciente=self.request.user)


class FeedbackCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RegistroFeedbackSerializer

    def perform_create(self, serializer):
        pauta = serializer.validated_data['pauta']
        if pauta.paciente_id != self.request.user.id:
            raise PermissionDenied('Esa pauta no es tuya.')
        serializer.save()


class CambiarPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        actual = request.data.get('actual', '')
        nueva = request.data.get('nueva', '')
        if not request.user.check_password(actual):
            return Response({'detail': 'La contraseña actual no es correcta.'}, status=400)
        try:
            validate_password(nueva, request.user)
        except ValidationError as e:
            return Response({'detail': ' '.join(e.messages)}, status=400)
        request.user.set_password(nueva)
        request.user.save()
        return Response({'detail': 'Contraseña actualizada.'})


# =========================================================
# VIEWSETS PRINCIPALES (WEB Y API REST)
# =========================================================

class PerfilViewSet(viewsets.ModelViewSet):
    serializer_class = PerfilSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Perfil.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='registrar-paciente')
    def registrar_paciente(self, request):
        serializer = PacienteRegistroSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        password_temporal = getattr(user, '_password_temporal', '')

        return Response({
            "mensaje": "Paciente registrado con éxito directamente.",
            "usuario_id": user.id,
            "rut": user.perfil.rut,
            "username": user.username,
            "password_temporal": password_temporal
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='mis-pacientes')
    def mis_pacientes(self, request):
        user = request.user
        if user.is_staff or user.is_superuser:
            pacientes = Perfil.objects.filter(rol='PACIENTE')
        else:
            pacientes = Perfil.objects.filter(rol='PACIENTE', kinesiologo_asignado=user)
            if not pacientes.exists():
                pacientes = Perfil.objects.filter(rol='PACIENTE')
        serializer = PerfilSerializer(pacientes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='alertas-abandono')
    def alertas_abandono(self, request):
        return Response(_calcular_alertas_abandono(request.user), status=status.HTTP_200_OK)


class EjercicioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Ejercicio.objects.all().order_by('id')
    serializer_class = EjercicioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        zona = self.request.query_params.get("zona_cuerpo", None)
        if zona:
            queryset = queryset.filter(zona_cuerpo__iexact=zona)
        return queryset


class PautaViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return PautaCreateSerializer
        if self.action == 'list':
            return PautaListSerializer
        return PautaDetailSerializer

    def get_queryset(self):
        user = self.request.user
        base_qs = Pauta.objects.select_related('paciente', 'kinesiologo').prefetch_related(
            'ejercicios_detalle', 'ejercicios_detalle__ejercicio'
        ).order_by('-creado_en')

        if user.is_staff or user.is_superuser:
            return base_qs

        if hasattr(user, 'perfil'):
            if user.perfil.rol == 'PACIENTE':
                return base_qs.filter(paciente=user, activo=True, es_plantilla=False)
            elif user.perfil.rol == 'KINE':
                qs = base_qs.filter(
                    Q(kinesiologo=user) | Q(paciente__perfil__kinesiologo_asignado=user)
                ).distinct()
                if not qs.exists():
                    return base_qs
                return qs

        return base_qs

    @action(detail=False, methods=['get'], url_path='alertas-abandono')
    def alertas_abandono(self, request):
        return Response(_calcular_alertas_abandono(request.user), status=status.HTTP_200_OK)


class RegistroFeedbackViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.is_staff or user.is_superuser:
            return RegistroFeedback.objects.all().order_by('-fecha_ejecucion')

        if hasattr(user, 'perfil') and user.perfil.rol == 'PACIENTE':
            return RegistroFeedback.objects.filter(pauta__paciente=user).order_by('-fecha_ejecucion')

        elif hasattr(user, 'perfil') and user.perfil.rol == 'KINE':
            qs = RegistroFeedback.objects.filter(
                Q(pauta__kinesiologo=user) | Q(pauta__paciente__perfil__kinesiologo_asignado=user)
            ).distinct().order_by('-fecha_ejecucion')
            if not qs.exists():
                return RegistroFeedback.objects.all().order_by('-fecha_ejecucion')
            return qs

        return RegistroFeedback.objects.all().order_by('-fecha_ejecucion')