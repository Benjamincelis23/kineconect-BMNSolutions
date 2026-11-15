import logging
import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max, Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt

from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .emails import enviar_email
from .models import Ejercicio, Pauta, Perfil, RegistroFeedback, SolicitudRegistro
from .serializers import (
    EjercicioSerializer,
    PacienteRegistroSerializer,
    PautaCreateSerializer,
    PautaDetailSerializer,
    PautaListSerializer,
    PerfilSerializer,
    RegistroFeedbackSerializer,
    validar_rut_chileno,
)

logger = logging.getLogger(__name__)

SALT = 'aprobacion-registro'


# =========================================================
# UTILIDADES
# =========================================================

def _es_admin(user):
    return user.is_staff or user.is_superuser


def _rol(user):
    """Devuelve 'PACIENTE', 'KINE' o None si el usuario no tiene perfil."""
    perfil = getattr(user, 'perfil', None)
    return perfil.rol if perfil else None


def _pacientes_visibles(user):
    """Perfiles de pacientes que el usuario puede ver."""
    if _es_admin(user):
        return Perfil.objects.filter(rol='PACIENTE')
    qs = Perfil.objects.filter(rol='PACIENTE', kinesiologo_asignado=user)
    # Atajo de desarrollo: en producción un kine sin pacientes ve una lista vacía.
    if not qs.exists() and settings.DEBUG:
        return Perfil.objects.filter(rol='PACIENTE')
    return qs


class SoloLecturaParaPacientes(permissions.BasePermission):
    """Los pacientes pueden consultar pautas, pero no crearlas, editarlas ni borrarlas."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return _es_admin(user) or _rol(user) != 'PACIENTE'


# =========================================================
# SOLICITUD DE REGISTRO Y APROBACIÓN POR CORREO
# =========================================================

class SolicitudSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolicitudRegistro
        fields = ['rut', 'nombre', 'apellido', 'email', 'telefono']

    def validate_rut(self, value):
        rut_valido = validar_rut_chileno(value)
        if Perfil.objects.filter(rut=rut_valido).exists():
            raise serializers.ValidationError("Este RUT ya se encuentra registrado en el sistema.")
        return rut_valido


class RegistroView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = SolicitudSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            # Si el correo falla, la solicitud se revierte y el paciente puede reintentar.
            with transaction.atomic():
                s = ser.save()
                token = signing.dumps(s.id, salt=SALT)
                link = f'{settings.PUBLIC_BASE_URL}/api/v1/registro/aprobar/{token}/'
                enviar_email(
                    settings.ADMIN_EMAIL,
                    f'Nueva solicitud de paciente: {escape(s.nombre)} {escape(s.apellido)}',
                    f'<p>RUT: {escape(s.rut)}<br>Correo: {escape(s.email)}<br>Tel: {escape(s.telefono or "")}</p>'
                    f'<p><a href="{link}">Haga clic aquí para revisar y aprobar la solicitud</a></p>',
                )
        except Exception:
            logger.exception('No se pudo enviar el correo de aprobación')
            return Response(
                {'detail': 'No pudimos procesar tu solicitud en este momento. Inténtalo más tarde.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {'detail': 'Solicitud enviada, pendiente de aprobación.'},
            status=status.HTTP_201_CREATED,
        )


def _generar_password(n=12):
    alfabeto = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alfabeto) for _ in range(n))


@csrf_exempt
def aprobar_view(request, token):
    try:
        sid = signing.loads(token, salt=SALT, max_age=60 * 60 * 72)
        s = SolicitudRegistro.objects.get(id=sid)
    except (signing.BadSignature, SolicitudRegistro.DoesNotExist):
        return HttpResponse('El enlace de aprobación es inválido o ha expirado.', status=400)

    if s.estado != 'PENDIENTE':
        return HttpResponse(f'Esta solicitud ya fue {escape(s.estado.lower())}.')

    if request.method == 'GET':
        return HttpResponse(
            f'<h3>Aprobar paciente: {escape(s.nombre)} {escape(s.apellido)} ({escape(s.rut)})</h3>'
            f'<p>Email: {escape(s.email)}</p>'
            '<form method="post">'
            '<button name="accion" value="aprobar" style="background-color: green; color: white; padding: 10px; margin-right: 10px;">Aprobar Paciente</button>'
            '<button name="accion" value="rechazar" style="background-color: red; color: white; padding: 10px;">Rechazar</button>'
            '</form>'
        )

    if request.method != 'POST':
        return HttpResponse('Método no permitido.', status=405)

    if request.POST.get('accion') == 'rechazar':
        s.estado = 'RECHAZADA'
        s.save()
        return HttpResponse('Solicitud rechazada correctamente.')

    User = get_user_model()
    username_limpio = s.rut.replace('.', '').replace('-', '').strip().upper()

    if User.objects.filter(username=username_limpio).exists():
        return HttpResponse('Ya existe un usuario con ese RUT. Revisa el panel de administración.', status=409)

    password = _generar_password()

    try:
        # Usuario, perfil, estado y correo van juntos: si algo falla, no queda nada a medias.
        with transaction.atomic():
            user = User.objects.create_user(
                username=username_limpio,
                email=s.email,
                first_name=s.nombre,
                last_name=s.apellido,
                password=password,
            )
            Perfil.objects.create(user=user, rut=s.rut, rol='PACIENTE')
            s.estado = 'APROBADA'
            s.save()

            enviar_email(
                s.email,
                'Tus credenciales de acceso a Kineconect',
                f'<p>Hola {escape(s.nombre)}, tu solicitud fue aprobada por el kinesiólogo.</p>'
                f'<p>Descarga la app e ingresa con los siguientes datos:</p>'
                f'<p><b>Usuario (RUT sin puntos ni guion):</b> {escape(username_limpio)}<br>'
                f'<b>Contraseña temporal:</b> {escape(password)}</p>'
                '<p>Te recomendamos cambiarla una vez que ingreses a la plataforma.</p>',
            )
    except Exception:
        logger.exception('Fallo al aprobar la solicitud %s', s.id)
        return HttpResponse(
            'No se pudo completar la aprobación (¿falló el envío del correo?). '
            'No se creó nada; puedes volver a intentarlo con el mismo enlace.',
            status=500,
        )

    return HttpResponse('Paciente aprobado. Las credenciales temporales fueron enviadas a su correo.')


# =========================================================
# VISTAS PARA LA APP MÓVIL (ME, PAUTAS, FEEDBACK, PASSWORD)
# =========================================================

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        ultima = (
            Pauta.objects.filter(paciente=u, es_plantilla=False)
            .select_related('kinesiologo')
            .order_by('-creado_en')
            .first()
        )

        kine = None
        if ultima and ultima.kinesiologo:
            k = ultima.kinesiologo
            nombre = f'{k.first_name} {k.last_name}'.strip() or k.username
            kine = {'nombre': nombre, 'email': k.email}

        semana = RegistroFeedback.objects.filter(
            pauta__paciente=u,
            fecha_ejecucion__gte=timezone.now() - timedelta(days=7),
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
        return (
            Pauta.objects.filter(paciente=self.request.user, activo=True, es_plantilla=False)
            .prefetch_related('ejercicios_detalle')
            .order_by('-creado_en')
        )


class PautaDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PautaDetailSerializer

    def get_queryset(self):
        return (
            Pauta.objects.filter(paciente=self.request.user, es_plantilla=False)
            .prefetch_related('ejercicios_detalle', 'ejercicios_detalle__ejercicio')
        )


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
# ALERTAS DE ABANDONO
# =========================================================

def _calcular_alertas_abandono(user):
    ahora = timezone.now()
    umbral_dias = 3
    fecha_limite = ahora - timedelta(days=umbral_dias)

    pacientes_qs = _pacientes_visibles(user).select_related('user')

    alertas = []
    for perfil in pacientes_qs:
        paciente_user = perfil.user
        ultimo_feedback = RegistroFeedback.objects.filter(
            pauta__paciente=paciente_user
        ).aggregate(ultima_fecha=Max('fecha_ejecucion'))['ultima_fecha']

        if ultimo_feedback:
            dias_inactivo = (ahora - ultimo_feedback).days
            en_riesgo = ultimo_feedback < fecha_limite
            ultima_fecha_str = ultimo_feedback.strftime('%d/%m/%Y %H:%M')
        else:
            dias_inactivo = (ahora - paciente_user.date_joined).days
            en_riesgo = True
            ultima_fecha_str = "Sin registros"

        if en_riesgo:
            estado_alerta = 'peligro'
        elif dias_inactivo >= 2:
            estado_alerta = 'advertencia'
        else:
            estado_alerta = 'activo'

        nombre_completo = (
            f"{paciente_user.first_name} {paciente_user.last_name}".strip() or paciente_user.username
        )

        alertas.append({
            'paciente_id': paciente_user.id,
            'rut': perfil.rut,
            'nombre_completo': nombre_completo,
            'email': paciente_user.email,
            'ultima_sesion': ultima_fecha_str,
            'dias_inactivo': dias_inactivo,
            'en_riesgo_abandono': en_riesgo,
            'estado_alerta': estado_alerta,
        })

    alertas.sort(key=lambda x: x['dias_inactivo'], reverse=True)

    return {
        'total_pacientes': len(alertas),
        'pacientes_en_riesgo': sum(1 for p in alertas if p['en_riesgo_abandono']),
        'pacientes': alertas,
    }


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
            "password_temporal": password_temporal,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='mis-pacientes')
    def mis_pacientes(self, request):
        serializer = PerfilSerializer(_pacientes_visibles(request.user), many=True)
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
    permission_classes = [SoloLecturaParaPacientes]

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

        # 1) Primero se limita por rol (nunca se devuelve nada fuera de este alcance).
        if _es_admin(user):
            qs = base_qs
        else:
            rol = _rol(user)
            if rol == 'PACIENTE':
                qs = base_qs.filter(paciente=user, activo=True, es_plantilla=False)
            elif rol == 'KINE':
                qs = base_qs.filter(
                    Q(kinesiologo=user)
                    | Q(paciente__perfil__kinesiologo_asignado=user)
                    | Q(es_plantilla=True)
                ).distinct()
                if not qs.exists() and settings.DEBUG:
                    qs = base_qs
            else:
                qs = base_qs if settings.DEBUG else base_qs.none()

        # 2) Después, el filtro opcional de la web: ?es_plantilla=true|false
        es_plantilla_param = self.request.query_params.get('es_plantilla')
        if es_plantilla_param is not None:
            qs = qs.filter(es_plantilla=es_plantilla_param.lower() in ['true', '1'])

        return qs

    @action(detail=False, methods=['get'], url_path='alertas-abandono')
    def alertas_abandono(self, request):
        return Response(_calcular_alertas_abandono(request.user), status=status.HTTP_200_OK)


class RegistroFeedbackViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = RegistroFeedback.objects.select_related('pauta').order_by('-fecha_ejecucion')

        if _es_admin(user):
            return base

        rol = _rol(user)
        if rol == 'PACIENTE':
            return base.filter(pauta__paciente=user)

        if rol == 'KINE':
            qs = base.filter(
                Q(pauta__kinesiologo=user) | Q(pauta__paciente__perfil__kinesiologo_asignado=user)
            ).distinct()
            if not qs.exists() and settings.DEBUG:
                return base
            return qs

        return base if settings.DEBUG else base.none()

    def perform_create(self, serializer):
        user = self.request.user
        pauta = serializer.validated_data['pauta']
        if _rol(user) == 'PACIENTE' and not _es_admin(user) and pauta.paciente_id != user.id:
            raise PermissionDenied('Esa pauta no es tuya.')
        serializer.save()