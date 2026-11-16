import secrets
import string
from datetime import timedelta
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Perfil, Ejercicio, Pauta, PautaEjercicio, RegistroFeedback
from .emails import enviar_credenciales_en_segundo_plano


def validar_rut_chileno(rut: str) -> str:
    """
    Limpia el RUT permitiendo cualquier valor por el momento,
    sin exigir formato estricto ni validar dígito verificador.
    """
    rut_limpio = rut.replace('.', '').replace(' ', '').strip().upper()
    if not rut_limpio:
        raise serializers.ValidationError("El RUT no puede estar vacío.")

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

        username = rut.replace('-', '').replace('.', '').upper()
        alfabeto = string.ascii_letters + string.digits
        password_temporal = ''.join(secrets.choice(alfabeto) for _ in range(10))
        correo_paciente = validated_data.get('email', '')

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                first_name=validated_data.get('first_name', ''),
                last_name=validated_data.get('last_name', ''),
                email=correo_paciente,
                password=password_temporal,
            )
            Perfil.objects.update_or_create(
                user=user,
                defaults={
                    'rut': rut,
                    'rol': 'PACIENTE',
                    'kinesiologo_asignado': kinesiologo,
                },
            )
        user._password_temporal = password_temporal

        if correo_paciente:
            enviar_credenciales_en_segundo_plano(
                correo_paciente, user.get_full_name(), username, password_temporal
            )

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
            'email': obj.user.email,
        }


class EjercicioSerializer(serializers.ModelSerializer):
    area_clinica = serializers.SlugRelatedField(
        many=True,
        read_only=True,
        slug_field='nombre',
    )

    class Meta:
        model = Ejercicio
        fields = '__all__'


# ==========================================
# SERIALIZADORES PARA LA API REST DE PAUTAS
# ==========================================

class PautaEjercicioSerializer(serializers.ModelSerializer):
    ejercicio_id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(source='ejercicio.nombre', read_only=True)
    zona = serializers.CharField(source='ejercicio.zona_cuerpo', read_only=True)
    media_url = serializers.SerializerMethodField()
    descanso_seg = serializers.IntegerField(source='tiempo_descanso_segundos', read_only=True)
    tiempo_descanso_segundos = serializers.IntegerField(read_only=True)

    class Meta:
        model = PautaEjercicio
        fields = ['id', 'ejercicio_id', 'nombre', 'zona', 'series', 'repeticiones',
                  'descanso_seg', 'tiempo_descanso_segundos', 'media_url']

    def get_media_url(self, obj):
        request = self.context.get('request')
        if obj.ejercicio and getattr(obj.ejercicio, 'video', None):
            if request:
                return request.build_absolute_uri(obj.ejercicio.video.url)
            return obj.ejercicio.video.url
        return getattr(obj.ejercicio, 'video_url', None)


def _nombre_o_username(u):
    return f'{u.first_name} {u.last_name}'.strip() or u.username


def _contar_sesiones_pauta(obj):
    desde = timezone.now() - timedelta(days=7)
    marca = getattr(obj, 'actualizado_en', None) or getattr(obj, 'creado_en', None)
    if marca and marca > desde:
        desde = marca
    return RegistroFeedback.objects.filter(pauta=obj, fecha_ejecucion__gte=desde).count()


class PautaListSerializer(serializers.ModelSerializer):
    total_ejercicios = serializers.IntegerField(source='ejercicios_detalle.count', read_only=True)
    cantidad_ejercicios = serializers.IntegerField(source='ejercicios_detalle.count', read_only=True)
    fecha_creacion = serializers.DateTimeField(source='creado_en', read_only=True)
    paciente_nombre = serializers.SerializerMethodField()
    kinesiologo_nombre = serializers.SerializerMethodField()
    ejercicios_detalle = PautaEjercicioSerializer(many=True, read_only=True)
    sesiones_semana = serializers.SerializerMethodField()
    meta_semanal = serializers.SerializerMethodField()

    class Meta:
        model = Pauta
        fields = [
            'id', 'titulo', 'notas', 'paciente', 'paciente_nombre',
            'kinesiologo_nombre', 'creado_en', 'fecha_creacion', 'activo',
            'total_ejercicios', 'cantidad_ejercicios', 'es_plantilla',
            'sesiones_semana', 'meta_semanal', 'ejercicios_detalle',
        ]

    def get_paciente_nombre(self, obj):
        return _nombre_o_username(obj.paciente) if obj.paciente else "Plantilla General"

    def get_kinesiologo_nombre(self, obj):
        return _nombre_o_username(obj.kinesiologo) if obj.kinesiologo else "KineConnect"

    def get_meta_semanal(self, obj):
        return getattr(obj, 'frecuencia_semanal', None) or 3

    def get_sesiones_semana(self, obj):
        return _contar_sesiones_pauta(obj)


class PautaDetailSerializer(serializers.ModelSerializer):
    ejercicios = PautaEjercicioSerializer(source='ejercicios_detalle', many=True, read_only=True)
    ejercicios_detalle = PautaEjercicioSerializer(many=True, read_only=True)
    fecha_creacion = serializers.DateTimeField(source='creado_en', read_only=True)
    paciente_nombre = serializers.SerializerMethodField()
    kinesiologo_nombre = serializers.SerializerMethodField()
    sesiones_semana = serializers.SerializerMethodField()
    meta_semanal = serializers.SerializerMethodField()

    class Meta:
        model = Pauta
        fields = [
            'id', 'titulo', 'notas', 'paciente', 'paciente_nombre',
            'kinesiologo_nombre', 'es_plantilla', 'activo',
            'creado_en', 'fecha_creacion', 'sesiones_semana', 'meta_semanal',
            'ejercicios', 'ejercicios_detalle',
        ]

    def get_paciente_nombre(self, obj):
        return _nombre_o_username(obj.paciente) if obj.paciente else "Plantilla General"

    def get_kinesiologo_nombre(self, obj):
        return _nombre_o_username(obj.kinesiologo) if obj.kinesiologo else "KineConnect"

    def get_meta_semanal(self, obj):
        return getattr(obj, 'frecuencia_semanal', None) or 3

    def get_sesiones_semana(self, obj):
        return _contar_sesiones_pauta(obj)


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
    """Serializador transaccional para crear Pautas o Plantillas y su detalle en un solo POST"""

    ejercicios = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)
    ejercicios_detalle = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)

    paciente = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True,
    )
    notas = serializers.CharField(required=False, allow_blank=True, default='')
    es_plantilla = serializers.BooleanField(required=False, default=False)
    guardar_como_plantilla = serializers.BooleanField(required=False, default=False, write_only=True)

    class Meta:
        model = Pauta
        fields = ['id', 'titulo', 'notas', 'paciente', 'es_plantilla',
                  'guardar_como_plantilla', 'ejercicios', 'ejercicios_detalle']
        read_only_fields = ('id',)

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        if not data.get('notas'):
            for alias in ('instrucciones', 'objetivo', 'indicaciones', 'descripcion'):
                if data.get(alias):
                    data['notas'] = data[alias]
                    break
        return super().to_internal_value(data)

    def validate_paciente(self, value):
        if value:
            if not hasattr(value, 'perfil') or value.perfil.rol != 'PACIENTE':
                raise serializers.ValidationError("El usuario seleccionado no tiene rol de PACIENTE.")
        return value

    def validate(self, attrs):
        es_plantilla = attrs.get('es_plantilla', False)
        paciente = attrs.get('paciente', None)

        if not es_plantilla and not paciente:
            raise serializers.ValidationError({"paciente": "Debe asignar un paciente si no es una plantilla."})
        if es_plantilla:
            attrs['paciente'] = None

        ejercicios_raw = attrs.get('ejercicios_detalle') or attrs.get('ejercicios')
        if not ejercicios_raw:
            raise serializers.ValidationError({"ejercicios": "Debe incluir al menos un ejercicio."})

        detalles_limpios = []
        for idx, item in enumerate(ejercicios_raw):
            ej_id = _extraer_ejercicio_id(item)
            if not ej_id or not Ejercicio.objects.filter(id=ej_id).exists():
                raise serializers.ValidationError({
                    "ejercicios": f"El ejercicio en la posición {idx + 1} no es válido o no existe."
                })
            detalles_limpios.append({
                'ejercicio_id': int(ej_id),
                'series': max(1, _a_entero(item.get('series'), 3)),
                'repeticiones': max(1, _a_entero(item.get('repeticiones'), 10)),
                'tiempo_descanso_segundos': max(0, _a_entero(
                    item.get('tiempo_descanso_segundos', item.get('descanso_seg')), 60)),
            })

        attrs['_detalles_limpios'] = detalles_limpios
        return attrs

    def create(self, validated_data):
        detalles_limpios = validated_data.pop('_detalles_limpios')
        validated_data.pop('ejercicios_detalle', None)
        validated_data.pop('ejercicios', None)
        guardar_como_plantilla = validated_data.pop('guardar_como_plantilla', False)
        kinesiologo = self.context['request'].user
        validated_data['kinesiologo'] = kinesiologo

        with transaction.atomic():
            pauta = Pauta.objects.create(**validated_data)
            PautaEjercicio.objects.bulk_create([
                PautaEjercicio(pauta=pauta, **d) for d in detalles_limpios
            ])

            if guardar_como_plantilla and not pauta.es_plantilla:
                plantilla = Pauta.objects.create(
                    titulo=f"[Protocolo] {pauta.titulo}",
                    kinesiologo=kinesiologo,
                    paciente=None,
                    notas=pauta.notas,
                    es_plantilla=True,
                    activo=True,
                )
                PautaEjercicio.objects.bulk_create([
                    PautaEjercicio(pauta=plantilla, **d) for d in detalles_limpios
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

        if User.objects.filter(username=rut_sin_formato).exists():
            attrs['username'] = rut_sin_formato
        elif User.objects.filter(username__iexact=raw_username.strip()).exists():
            user = User.objects.get(username__iexact=raw_username.strip())
            attrs['username'] = user.username

        data = super().validate(attrs)

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