from django.contrib import admin
from django import forms
from django.db import transaction
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from .models import Perfil, Ejercicio, Pauta, RegistroFeedback

# 1. Extendemos el formulario maestro para incluir campos de Perfil y User
class CustomUserCreationForm(UserCreationForm):
    # Campos que se guardarán en el modelo User nativo
    first_name = forms.CharField(max_length=30, required=True, label="Nombre")
    last_name = forms.CharField(max_length=30, required=True, label="Apellidos")
    
    # Campos extras que se guardarán en tu modelo Perfil
    rut = forms.CharField(max_length=12, required=True, label="RUT", help_text="Ej: 12.345.678-9")
    
    # Define aquí los roles exactos que configuraste en tu modelo Perfil
    ROLES = (
        ('kinesiologo', 'Kinesiólogo'),
        ('paciente', 'Paciente'),
        ('admin', 'Administrador'),
    )
    rol = forms.ChoiceField(choices=ROLES, required=True, label="Rol")

    class Meta(UserCreationForm.Meta):
        model = User
        # Mantenemos los campos nativos y sumamos nombre y apellido
        fields = UserCreationForm.Meta.fields + ('first_name', 'last_name')

    def save(self, commit=True):
        # Obtenemos la instancia del User (esto ya maneja el hasheo de la contraseña)
        user = super().save(commit=False)
        user.first_name = self.cleaned_data['first_name']
        user.last_name = self.cleaned_data['last_name']
        
        if commit:
            # transaction.atomic asegura que si falla el perfil, no se guarde un usuario fantasma
            with transaction.atomic():
                user.save()
                # Creamos el Perfil inmediatamente vinculado al usuario nuevo
                # IMPORTANTE: Si en tu modelo Perfil la conexión no se llama 'usuario', 
                # cámbialo aquí (ej. user=user)
                Perfil.objects.create(
                    usuario=user, 
                    rut=self.cleaned_data['rut'],
                    rol=self.cleaned_data['rol']
                )
        return user

# 2. Configuramos el administrador para que muestre todos los campos dinámicamente
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    
    def get_fieldsets(self, request, obj=None):
        if not obj:
            # Magia: Extraemos las llaves de TODOS los campos declarados en el formulario.
            # Esto soluciona la desaparición de las contraseñas sin romper Django.
            campos_del_form = list(self.add_form().fields.keys())
            return (
                ('Creación Inmediata de Usuario y Perfil', {
                    'classes': ('wide',),
                    'fields': campos_del_form,
                }),
            )
        return super().get_fieldsets(request, obj)

# 3. Registramos los modelos
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)
admin.site.register(Perfil)
admin.site.register(Ejercicio)
admin.site.register(Pauta)
admin.site.register(RegistroFeedback)