import re
import threading
from django.contrib.auth.models import User
from rest_framework import serializers
from django.core.mail import send_mail
from .models import Perfil, Ejercicio, Pauta, PautaEjercicio, RegistroFeedback


def validar_rut_chileno(rut: str) -> str:
    """Limpia y valida formato básico de RUT chileno (ej: 12345678-9 o 12345678-K)."""
    rut_limpio = rut.replace('.', '').replace(' ', '').upper()
    if not re.match(r'^\d{7,8}-[\dK]$', rut_limpio):
        raise serializers.ValidationError(
            "El formato del RUT es inválido. Use el formato sin puntos y con guión (ej: 12345678-9)."
        )
    return rut_limpio


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
        
        # Username y password por defecto basados en RUT sin guión para login simplificado
        username = rut.replace('-', '')
        
        # 1. SOLUCIÓN DE SEGURIDAD: Contraseña aleatoria segura
        password_temporal = User.objects.make_random_password(length=12)
        
        user = User.objects.create_user(
            username=username,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            email=validated_data.get('email', ''),
            password=password_temporal 
        )

        Perfil.objects.create(
            user=user,
            rut=rut,
            rol='PACIENTE',
            kinesiologo_asignado=kinesiologo
        )

        # 2. SOLUCIÓN RENDIMIENTO: Enviar correo al paciente usando un hilo en segundo plano (Threading)
        if user.email:
            email_thread = threading.Thread(
                target=send_mail,
                args=(
                    'Bienvenido a Kineconect - Tu cuenta',
                    f'Hola {user.first_name}, el kinesiólogo te ha registrado. Tu contraseña temporal es: {password_temporal}. Por favor, cámbiala al iniciar sesión.',
                    'noreply@kineconect.cl',
                    [user.email]
                ),
                kwargs={'fail_silently': True}
            )
            email_thread.start()

        return user


class PerfilSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Perfil
        fields = ('id', 'rut', 'rol', 'nombre_completo', 'email', 'kinesiologo_asignado')


class EjercicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ejercicio
        # Agregamos los campos de imagen y gif_url que definiste en models.py
        fields = ('id', 'nombre', 'descripcion', 'zona_cuerpo', 'video_url', 'imagen', 'gif_url')


# ==========================================
# NUEVOS SERIALIZADORES PARA LA API REST
# ==========================================

class PautaEjercicioSerializer(serializers.ModelSerializer):
    """Serializador para el Detalle de la Pauta (Los ejercicios específicos)"""
    
    # SOLUCIÓN DATOS MÓVILES: Descomentado para hidratar la información del ejercicio para Matías
    ejercicio_info = EjercicioSerializer(source='ejercicio', read_only=True)

    class Meta:
        model = PautaEjercicio
        # Agregado 'ejercicio_info' al array de fields
        fields = ('ejercicio', 'ejercicio_info', 'series', 'repeticiones', 'tiempo_descanso_segundos')


class PautaCreateSerializer(serializers.ModelSerializer):
    """Serializador transaccional para crear la Cabecera y el Detalle en un solo POST"""
    ejercicios_detalle = PautaEjercicioSerializer(many=True)

    class Meta:
        model = Pauta
        fields = ('paciente', 'titulo', 'ejercicios_detalle')

    def validate_paciente(self, value):
        if not hasattr(value, 'perfil') or value.perfil.rol != 'PACIENTE':
            raise serializers.ValidationError("El usuario seleccionado no tiene rol de PACIENTE.")
        return value

    def create(self, validated_data):
        ejercicios_data = validated_data.pop('ejercicios_detalle')
        # El Kinesiólogo se extrae automáticamente del token de autenticación
        validated_data['kinesiologo'] = self.context['request'].user
        
        # 1. Crear Cabecera
        pauta = Pauta.objects.create(**validated_data)
        
        # 2. Crear Detalles usando Bulk Create (optimización de base de datos)
        PautaEjercicio.objects.bulk_create([
            PautaEjercicio(pauta=pauta, **detalle) for detalle in ejercicios_data
        ])
        
        return pauta


class PautaReadSerializer(serializers.ModelSerializer):
    """Serializador para leer las Pautas en GET (App Móvil y Web)"""
    ejercicios_detalle = PautaEjercicioSerializer(many=True, read_only=True)
    kinesiologo_nombre = serializers.CharField(source='kinesiologo.get_full_name', read_only=True)
    paciente_nombre = serializers.CharField(source='paciente.get_full_name', read_only=True)

    class Meta:
        model = Pauta
        fields = ('id', 'titulo', 'kinesiologo_nombre', 'paciente_nombre', 'activo', 'creado_en', 'ejercicios_detalle')


class RegistroFeedbackSerializer(serializers.ModelSerializer):
    """Serializador para que Matías conecte la pantalla de feedback móvil"""
    class Meta:
        model = RegistroFeedback
        fields = ('id', 'pauta', 'completado', 'escala_dolor', 'comentario', 'fecha_ejecucion')
        read_only_fields = ('fecha_ejecucion',)