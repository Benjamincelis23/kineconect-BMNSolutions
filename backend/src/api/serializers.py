import secrets
import string
import threading
from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Perfil, Ejercicio, Pauta, PautaEjercicio, RegistroFeedback


def validar_rut_chileno(rut: str) -> str:
    """
    Limpia el RUT permitiendo cualquier valor por el momento,
    sin exigir formato estricto ni validar dígito verificador.
    """
    rut_limpio = rut.replace('.', '').replace(' ', '').strip().upper()
    if not rut_limpio:
        raise serializers.ValidationError("El RUT no puede estar vacío.")

    # Si viene sin guion pero tiene al menos 2 caracteres, añadimos el guion antes del último dígito
    if '-' not in rut_limpio and len(rut_limpio) >= 2:
        rut_limpio = f"{rut_limpio[:-1]}-{rut_limpio[-1]}"

    return rut_limpio[:12]


class PacienteRegistroSerializer(serializers.ModelSerializer):
    """Serializador para HU-001: Registro y vinculación de Paciente por el Kinesiólogo."""
    first_name = serializers.CharField(max_length=150, required=True)
    last_name = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    rut = serializers.CharField(max_length=12, required=True)

    class Meta:
        model = User
        fields = ('id', 'first_name', 'last_name', 'email', 'rut')

    def validate_rut(self, value):
        rut_valido = validar_rut_chileno(value)
        if Perfil.objects.filter(rut=rut_valido).exists():
            raise serializers.ValidationError("Este RUT ya se encuentra registrado en el sistema.")
        return rut_valido

    def create(self, validated_data):
        rut = validated_data.pop('rut')
        kinesiologo = self.context['request'].user

        # Username basado en el RUT limpio sin puntos ni guion para login simplificado
        username = rut.replace('-', '').replace('.', '').upper()

        # Clave alfanumérica limpia (sin símbolos que fallen en teclados móviles)
        alfabeto = string.ascii_letters + string.digits
        password_temporal = ''.join(secrets.choice(alfabeto) for _ in range(10))
        correo_paciente = validated_data.get('email', '')

        user = User.objects.create_user(
            username=username,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            email=correo_paciente,
            password=password_temporal
        )
        # Adjuntamos la clave en memoria para que views.py la devuelva sin sobrescribirla
        user._password_temporal = password_temporal

        Perfil.objects.update_or_create(
            user=user,
            defaults={
                'rut': rut,
                'rol': 'PACIENTE',
                'kinesiologo_asignado': kinesiologo
            }
        )

        # El correo va SOLO al administrador (Resend en modo prueba rechaza
        # cualquier otro destinatario). El correo del paciente va en el cuerpo
        # para que el administrador lo reenvíe como respaldo.
        destinatarios = [getattr(settings, 'ADMIN_EMAIL', None) or 'benj.celis@duocuc.cl']

        email_thread = threading.Thread(
            target=send_mail,
            args=(
                f'[Kineconect] Credenciales - Paciente: {user.get_full_name()} (RUT: {rut})',
                f'Hola,\n\nSe ha registrado el acceso a Kineconect para {user.get_full_name()}.\n\n'
                f'Correo del paciente (para reenviar): {correo_paciente or "no indicado"}\n\n'
                f'Datos de acceso generados:\n'
                f'- Usuario (RUT sin puntos ni guion): {username}\n'
                f'- Contraseña temporal: {password_temporal}\n\n'
                f'Te recomendamos cambiar tu contraseña al ingresar a la aplicación móvil.',
                None,
                destinatarios
            ),
            kwargs={'fail_silently': False}
        )
        email_thread.start()

        return user


class PerfilSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    nombre_completo = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = Perfil
        fields = ('id', 'user_id', 'user', 'rut', 'rol', 'nombre_completo', 'email', 'kinesiologo_asignado')

    def get_user(self, obj):
        return {
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'email': obj.user.email
        }


class EjercicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ejercicio
        fields = ('id', 'nombre', 'descripcion', 'zona_cuerpo', 'video', 'imagen', 'gif_url')


# ==========================================
# SERIALIZADORES PARA LA API REST DE PAUTAS
# ==========================================

class PautaEjercicioSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source='ejercicio.nombre', read_only=True)
    zona = serializers.CharField(source='ejercicio.zona_cuerpo', read_only=True)
    media_url = serializers.SerializerMethodField()
    descanso_seg = serializers.IntegerField(source='tiempo_descanso_segundos', read_only=True)

    class Meta:
        model = PautaEjercicio
        fields = ['id', 'nombre', 'zona', 'series', 'repeticiones', 'descanso_seg', 'media_url']

    def get_media_url(self, obj):
        request = self.context.get('request')
        if obj.ejercicio and obj.ejercicio.video:
            if request:
                return request.build_absolute_uri(obj.ejercicio.video.url)
            return obj.ejercicio.video.url
        return getattr(obj.ejercicio, 'video_url', None)


class PautaListSerializer(serializers.ModelSerializer):
    total_ejercicios = serializers.IntegerField(source='ejercicios_detalle.count', read_only=True)
    cantidad_ejercicios = serializers.IntegerField(source='ejercicios_detalle.count', read_only=True)
    fecha_creacion = serializers.DateTimeField(source='creado_en', read_only=True)
    paciente_nombre = serializers.SerializerMethodField()
    ejercicios_detalle = PautaEjercicioSerializer(many=True, read_only=True)

    class Meta:
        model = Pauta
        fields = [
            'id', 'titulo', 'notas', 'paciente', 'paciente_nombre',
            'creado_en', 'fecha_creacion', 'activo',
            'total_ejercicios', 'cantidad_ejercicios', 'es_plantilla',
            'ejercicios_detalle'
        ]

    def get_paciente_nombre(self, obj):
        if not obj.paciente:
            return "Plantilla General"
        p = obj.paciente
        nombre_completo = f'{p.first_name} {p.last_name}'.strip()
        return nombre_completo or p.username


class PautaDetailSerializer(serializers.ModelSerializer):
    ejercicios = PautaEjercicioSerializer(source='ejercicios_detalle', many=True)
    fecha_creacion = serializers.DateTimeField(source='creado_en', read_only=True)

    class Meta:
        model = Pauta
        fields = ['id', 'titulo', 'notas', 'fecha_creacion', 'ejercicios']


# Alias de compatibilidad
PautaReadSerializer = PautaDetailSerializer


def _extraer_ejercicio_id(detalle):
    """Busca el id del ejercicio en las distintas formas en que lo puede mandar el frontend."""
    for clave in ('ejercicio_id', 'id_ejercicio', 'ejercicio'):
        valor = detalle.get(clave)
        if isinstance(valor, dict):
            valor = valor.get('id')
        if valor not in (None, ''):
            return valor
    return detalle.get('id')


def _a_entero(valor, defecto):
    try:
        return int(valor)
    except (TypeError, ValueError):
        return defecto


class PautaCreateSerializer(serializers.ModelSerializer):
    """Serializador transaccional para crear la Cabecera y el Detalle en un solo POST"""
    ejercicios_detalle = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    ejercicios = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = Pauta
        fields = ('paciente', 'es_plantilla', 'titulo', 'ejercicios_detalle', 'ejercicios', 'notas')

    def validate_paciente(self, value):
        if value is not None:
            if not hasattr(value, 'perfil') or value.perfil.rol != 'PACIENTE':
                raise serializers.ValidationError("El usuario seleccionado no tiene rol de PACIENTE.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        detalle_a = validated_data.pop('ejercicios_detalle', None) or []
        detalle_b = validated_data.pop('ejercicios', None) or []
        ejercicios_data = detalle_a or detalle_b

        validated_data['kinesiologo'] = self.context['request'].user

        detalles = []
        for detalle in ejercicios_data:
            ejercicio_id = _a_entero(_extraer_ejercicio_id(detalle), None)
            if ejercicio_id is None:
                continue
            detalles.append({
                'ejercicio_id': ejercicio_id,
                'series': _a_entero(detalle.get('series') or detalle.get('series_count'), 3),
                'repeticiones': _a_entero(detalle.get('repeticiones') or detalle.get('reps'), 10),
                'descanso': _a_entero(
                    detalle.get('tiempo_descanso_segundos')
                    or detalle.get('descanso_seg')
                    or detalle.get('descanso'),
                    60
                ),
            })

        if ejercicios_data and not detalles:
            raise serializers.ValidationError({
                'ejercicios': 'No se pudo identificar el id de ningún ejercicio. '
                              'Envía "ejercicio_id" en cada elemento.'
            })

        ids = {d['ejercicio_id'] for d in detalles}
        existentes = set(Ejercicio.objects.filter(id__in=ids).values_list('id', flat=True))
        faltantes = ids - existentes
        if faltantes:
            raise serializers.ValidationError({
                'ejercicios': f'Estos ejercicios no existen: {sorted(faltantes)}'
            })

        pauta = Pauta.objects.create(**validated_data)

        if detalles:
            PautaEjercicio.objects.bulk_create([
                PautaEjercicio(
                    pauta=pauta,
                    ejercicio_id=d['ejercicio_id'],
                    series=d['series'],
                    repeticiones=d['repeticiones'],
                    tiempo_descanso_segundos=d['descanso'],
                )
                for d in detalles
            ])

        return pauta


class RegistroFeedbackSerializer(serializers.ModelSerializer):
    """Serializador para pantalla de feedback y registro EVA con validación 0-10"""
    escala_dolor = serializers.IntegerField(source='nivel_dolor', required=False, allow_null=True)

    class Meta:
        model = RegistroFeedback
        fields = ('id', 'pauta', 'completado', 'nivel_dolor', 'escala_dolor', 'comentario', 'fecha_ejecucion')
        read_only_fields = ('fecha_ejecucion',)

    def validate_nivel_dolor(self, value):
        if value is not None and not (0 <= int(value) <= 10):
            raise serializers.ValidationError("El nivel de dolor (escala EVA) debe estar entre 0 y 10.")
        return value

    def validate_escala_dolor(self, value):
        if value is not None and not (0 <= int(value) <= 10):
            raise serializers.ValidationError("El nivel de dolor (escala EVA) debe estar entre 0 y 10.")
        return value

    def validate_pauta(self, value):
        if value.es_plantilla:
            raise serializers.ValidationError("No puedes registrar feedback sobre una plantilla genérica.")
        return value


# ==========================================
# SERIALIZADOR DE LOGIN JWT (NORMALIZA RUT)
# ==========================================

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        raw_username = attrs.get('username', '')
        rut_sin_formato = raw_username.replace('.', '').replace('-', '').strip().upper()

        # Permite iniciar sesión tanto con 11700900K como con 11.700.900-K o 11700900-K
        if User.objects.filter(username=rut_sin_formato).exists():
            attrs['username'] = rut_sin_formato
        elif User.objects.filter(username__iexact=raw_username.strip()).exists():
            user = User.objects.get(username__iexact=raw_username.strip())
            attrs['username'] = user.username

        data = super().validate(attrs)

        # Incluimos alias de token y datos del usuario autenticado para que el móvil actualice la sesión
        data['token'] = data['access']
        data['access_token'] = data['access']
        data['refresh_token'] = data['refresh']
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'nombre_completo': self.user.get_full_name() or self.user.username,
            'email': self.user.email,
            'rol': getattr(self.user.perfil, 'rol', 'PACIENTE') if hasattr(self.user, 'perfil') else 'PACIENTE',
        }
        return data