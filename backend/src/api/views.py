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
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .emails import enviar_email, enviar_email_en_segundo_plano
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
    if not qs.exists() and settings.DEBUG:
        return Perfil.objects.filter(rol='PACIENTE')
    return qs


def _inicio_ciclo_pauta(pauta):
    """Determina desde qué fecha se cuentan las sesiones semanales de una pauta."""
    desde = timezone.now() - timedelta(days=7)
    marca = getattr(pauta, 'actualizado_en', None) or getattr(pauta, 'creado_en', None)
    if marca and marca > desde:
        desde = marca
    return desde


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
# AUTENTICACIÓN JWT PERSONALIZADA
# =========================================================

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        raw_username = attrs.get(self.username_field, '')
        if isinstance(raw_username, str):
            limpio = raw_username.replace('.', '').replace('-', '').strip()
            User = get_user_model()
            user_obj = (
                User.objects.filter(username__iexact=raw_username.strip()).first()
                or User.objects.filter(username__iexact=limpio).first()
            )
            if user_obj:
                attrs[self.username_field] = user_obj.get_username()

        data = super().validate(attrs)
        perfil = getattr(self.user, 'perfil', None)
        data['username'] = self.user.username
        data['nombre'] = f'{self.user.first_name} {self.user.last_name}'.strip() or self.user.username
        data['rol'] = perfil.rol if perfil else ('ADMIN' if _es_admin(self.user) else 'KINE')
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


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
            'No se pudo completar la aprobación. No se creó nada; puedes volver a intentarlo.',
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
        perfil = getattr(u, 'perfil', None)
        kine_user = getattr(perfil, 'kinesiologo_asignado', None)

        pautas_activas = list(
            Pauta.objects.filter(paciente=u, activo=True, es_plantilla=False)
            .select_related('kinesiologo')
            .order_by('-creado_en')
        )

        if not kine_user and pautas_activas and pautas_activas[0].kinesiologo:
            kine_user = pautas_activas[0].kinesiologo

        kine = None
        if kine_user:
            nombre = f'{kine_user.first_name} {kine_user.last_name}'.strip() or kine_user.username
            kine = {'nombre': nombre, 'email': kine_user.email}

        semana = 0
        meta_total = 0

        for p in pautas_activas:
            meta_pauta = getattr(p, 'frecuencia_semanal', None) or 3
            meta_total += meta_pauta

            desde_pauta = _inicio_ciclo_pauta(p)
            hechas_pauta = RegistroFeedback.objects.filter(
                pauta=p,
                fecha_ejecucion__gte=desde_pauta,
            ).count()
            semana += min(hechas_pauta, meta_pauta)

        return Response({
            'nombre': u.first_name,
            'apellido': u.last_name,
            'rut': u.username,
            'email': u.email,
            'kinesiologo': kine,
            'sesiones_semana': semana,
            'meta_semanal': meta_total or 3,
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


def _validar_limite_sesiones(pauta):
    """Impide registrar más sesiones si el paciente ya cumplió su meta semanal vigente para esta pauta."""
    desde_fecha = _inicio_ciclo_pauta(pauta)
    sesiones_semana = RegistroFeedback.objects.filter(
        pauta=pauta,
        fecha_ejecucion__gte=desde_fecha,
    ).count()

    meta_semanal = getattr(pauta, 'frecuencia_semanal', None) or 3
    if sesiones_semana >= meta_semanal:
        raise DRFValidationError(
            f'Ya cumpliste las {meta_semanal} sesiones prescritas para esta pauta esta semana. '
            'Descansa y espera el siguiente ciclo o una nueva indicación de tu kinesiólogo.'
        )


def _notificar_alerta_dolor(feedback):
    eva = int(
        getattr(feedback, 'nivel_dolor', None)
        or getattr(feedback, 'escala_dolor', None)
        or getattr(feedback, 'dolor_eva', 0)
        or 0
    )
    if eva < 6:
        return

    pauta = feedback.pauta
    kine = getattr(pauta, 'kinesiologo', None)
    admin_email = getattr(settings, 'ADMIN_EMAIL', 'benj.celis@duocuc.cl')
    destino_kine = (getattr(kine, 'email', '') or '').strip() or admin_email

    paciente = pauta.paciente
    nombre_pac = f"{paciente.first_name} {paciente.last_name}".strip() or paciente.username
    observacion = (
        getattr(feedback, 'comentario', '')
        or getattr(feedback, 'notas', '')
        or 'Sin observaciones adicionales'
    )

    cuerpo = (
        f"<p><strong>Alerta Clínica KineConnect:</strong> El paciente <b>{escape(nombre_pac)}</b> "
        f"reportó dolor <b>EVA {eva}/10</b> en la pauta <i>{escape(pauta.titulo)}</i>.</p>"
        f"<p><b>Sensación / Observación:</b> {escape(observacion)}</p>"
        f"<p>Ingresa al portal web para revisar su evolución o ajustar su pauta.</p>"
    )
    html_relay = f"<p>PARA: {escape(destino_kine)}</p><p>KC-INICIO</p>{cuerpo}<p>KC-FIN</p>"

    enviar_email_en_segundo_plano(
        admin_email,
        f"[KC-ENVIAR] Alerta Dolor EVA {eva}/10 - {nombre_pac}",
        html_relay,
    )


class FeedbackCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RegistroFeedbackSerializer

    def perform_create(self, serializer):
        pauta = serializer.validated_data['pauta']
        if pauta.paciente_id != self.request.user.id:
            raise PermissionDenied('Esa pauta no es tuya.')
        _validar_limite_sesiones(pauta)
        feedback = serializer.save()
        _notificar_alerta_dolor(feedback)


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
        if self.action in ['create', 'update', 'partial_update']:
            return PautaCreateSerializer
        if self.action == 'list':
            return PautaListSerializer
        return PautaDetailSerializer

    def get_queryset(self):
        user = self.request.user
        base_qs = Pauta.objects.select_related('paciente', 'kinesiologo').prefetch_related(
            'ejercicios_detalle', 'ejercicios_detalle__ejercicio'
        ).order_by('-creado_en')

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

        es_plantilla_param = self.request.query_params.get('es_plantilla')
        if es_plantilla_param is not None:
            qs = qs.filter(es_plantilla=es_plantilla_param.lower() in ['true', '1'])

        return qs

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        user = request.user
        if not _es_admin(user) and instance.kinesiologo_id and instance.kinesiologo_id != user.id:
            raise PermissionDenied('Solo el kinesiólogo que creó esta pauta puede modificarla.')

        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        ejercicios_data = data.get('ejercicios', None)

        with transaction.atomic():
            serializer = self.get_serializer(instance, data=data, partial=partial)
            serializer.is_valid(raise_exception=True)
            instance = serializer.save()

            # Solo reinicia el contador si la pauta ya había cumplido su meta semanal;
            # si estaba en desarrollo (ej. 1/3 o 2/3), conserva las sesiones ya realizadas.
            meta_pauta = getattr(instance, 'frecuencia_semanal', None) or 3
            hechas_ciclo = RegistroFeedback.objects.filter(
                pauta=instance,
                fecha_ejecucion__gte=_inicio_ciclo_pauta(instance),
            ).count()

            if hechas_ciclo >= meta_pauta:
                ahora = timezone.now()
                update_fields = []
                if hasattr(instance, 'actualizado_en'):
                    instance.actualizado_en = ahora
                    update_fields.append('actualizado_en')
                if hasattr(instance, 'creado_en'):
                    instance.creado_en = ahora
                    update_fields.append('creado_en')
                if update_fields:
                    instance.save(update_fields=update_fields)

            if isinstance(ejercicios_data, list) and hasattr(instance, 'ejercicios_detalle'):
                DetalleModel = instance.ejercicios_detalle.model
                instance.ejercicios_detalle.all().delete()
                campos_validos = {f.name for f in DetalleModel._meta.get_fields()}
                for idx, item in enumerate(ejercicios_data):
                    ej_id = item.get('ejercicio') or item.get('ejercicio_id')
                    if not ej_id:
                        continue
                    kwargs_det = {'pauta': instance}
                    if 'ejercicio_id' in campos_validos or 'ejercicio' in campos_validos:
                        kwargs_det['ejercicio_id'] = int(ej_id)
                    if 'series' in campos_validos:
                        kwargs_det['series'] = int(item.get('series', 3))
                    if 'repeticiones' in campos_validos:
                        kwargs_det['repeticiones'] = int(item.get('repeticiones', 12))
                    if 'tiempo_descanso_segundos' in campos_validos:
                        kwargs_det['tiempo_descanso_segundos'] = int(item.get('tiempo_descanso_segundos', 60))
                    if 'orden' in campos_validos:
                        kwargs_det['orden'] = int(item.get('orden', idx + 1))
                    DetalleModel.objects.create(**kwargs_det)

        return Response(PautaDetailSerializer(instance, context={'request': request}).data)

    def perform_destroy(self, instance):
        user = self.request.user
        if not _es_admin(user) and instance.kinesiologo_id and instance.kinesiologo_id != user.id:
            raise PermissionDenied('Solo el kinesiólogo que creó esta pauta puede eliminarla.')

        forzar = self.request.query_params.get('forzar', '').lower() in ('true', '1', 'yes')

        if forzar or not instance.activo:
            RegistroFeedback.objects.filter(pauta=instance).delete()
            instance.delete()
        elif RegistroFeedback.objects.filter(pauta=instance).exists():
            instance.activo = False
            instance.save(update_fields=['activo'])
        else:
            instance.delete()

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
        _validar_limite_sesiones(pauta)
        feedback = serializer.save()
        _notificar_alerta_dolor(feedback)