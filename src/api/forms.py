# Formularios del portal web del kinesiólogo
from django import forms
from django.contrib.auth.models import User
from .models import Perfil


class PacienteRegistroForm(forms.Form):
    """Registro rápido de un paciente nuevo, identificado por RUT.

    Crea internamente un User de Django (para poder loguearse desde la
    app móvil) y su Perfil asociado con rol PACIENTE.
    """

    rut = forms.CharField(
        max_length=12,
        label="RUT",
        widget=forms.TextInput(attrs={"placeholder": "12345678-9"}),
    )
    nombres = forms.CharField(max_length=150, label="Nombres")
    apellidos = forms.CharField(max_length=150, label="Apellidos")
    email = forms.EmailField(required=False, label="Correo (opcional)")
    username = forms.CharField(
        max_length=150,
        label="Usuario de acceso",
        help_text="Con este usuario el paciente ingresará a la app móvil.",
    )
    password = forms.CharField(
        widget=forms.PasswordInput,
        label="Contraseña temporal",
        min_length=6,
    )

    def clean_rut(self):
        rut = self.cleaned_data["rut"].strip().upper()
        if Perfil.objects.filter(rut=rut).exists():
            raise forms.ValidationError("Ya existe un paciente registrado con este RUT.")
        return rut

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError("Ese nombre de usuario ya está en uso.")
        return username

    def save(self, kinesiologo):
        data = self.cleaned_data
        user = User.objects.create_user(
            username=data["username"],
            email=data.get("email", ""),
            password=data["password"],
            first_name=data["nombres"],
            last_name=data["apellidos"],
        )
        Perfil.objects.create(
            user=user,
            rut=data["rut"],
            rol="PACIENTE",
            kinesiologo_asignado=kinesiologo,
        )
        return user

from .models import Pauta, Ejercicio

class PautaCrearForm(forms.ModelForm):
    """Formulario para prescribir y parametrizar un ejercicio a un paciente."""
    paciente = forms.ModelChoiceField(
        queryset=User.objects.none(),
        label="Paciente",
        empty_label="Seleccione un paciente",
        widget=forms.Select(attrs={"class": "form-control"})
    )
    ejercicio = forms.ModelChoiceField(
        queryset=Ejercicio.objects.all(),
        label="Ejercicio del Catálogo",
        empty_label="Seleccione un ejercicio",
        widget=forms.Select(attrs={"class": "form-control"})
    )

    class Meta:
        model = Pauta
        fields = ["paciente", "ejercicio", "series", "repeticiones", "tiempo_descanso_segundos"]
        labels = {
            "series": "Series",
            "repeticiones": "Repeticiones",
            "tiempo_descanso_segundos": "Tiempo de descanso (segundos)",
        }
        widgets = {
            "series": forms.NumberInput(attrs={"min": 1, "max": 20, "class": "form-control"}),
            "repeticiones": forms.NumberInput(attrs={"min": 1, "max": 100, "class": "form-control"}),
            "tiempo_descanso_segundos": forms.NumberInput(attrs={"min": 0, "max": 600, "class": "form-control"}),
        }

    def __init__(self, *args, kinesiologo=None, **kwargs):
        super().__init__(*args, **kwargs)
        if kinesiologo:
            # Solo muestra los pacientes asignados a este kinesiólogo
            pacientes_ids = Perfil.objects.filter(
                rol="PACIENTE", kinesiologo_asignado=kinesiologo
            ).values_list("user_id", flat=True)
            self.fields["paciente"].queryset = User.objects.filter(id__in=pacientes_ids)