import re
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Perfil, Ejercicio, Pauta, RegistroFeedback


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
        
        user = User.objects.create_user(
            username=username,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            email=validated_data.get('email', ''),
            password=username  # Clave por defecto = RUT sin guión
        )

        Perfil.objects.create(
            user=user,
            rut=rut,
            rol='PACIENTE',
            kinesiologo_asignado=kinesiologo
        )
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
        fields = ('id', 'nombre', 'descripcion', 'zona_cuerpo', 'video_url')