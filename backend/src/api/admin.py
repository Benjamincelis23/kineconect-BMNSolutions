from django.contrib import admin
from django import forms
from django.db import transaction
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from .models import Perfil, Ejercicio, Pauta, RegistroFeedback, AreaClinica


# 1. Formulario maestro para incluir campos de Perfil y User
class CustomUserCreationForm(UserCreationForm):
    first_name = forms.CharField(max_length=30, required=True, label="Nombre")
    last_name = forms.CharField(max_length=30, required=True, label="Apellidos")
    rut = forms.CharField(max_length=12, required=True, label="RUT", help_text="Ej: 12.345.678-9")

    ROLES = (
        ('kinesiologo', 'Kinesiólogo'),
        ('paciente', 'Paciente'),
        ('admin', 'Administrador'),
    )
    rol = forms.ChoiceField(choices=ROLES, required=True, label="Rol")

    class Meta(UserCreationForm.Meta):
        model = User
        fields = UserCreationForm.Meta.fields + ('first_name', 'last_name')

    def save(self, commit=True):
        user = super().save(commit=False)
        user.first_name = self.cleaned_data['first_name']
        user.last_name = self.cleaned_data['last_name']

        if commit:
            with transaction.atomic():
                user.save()
                Perfil.objects.create(
                    usuario=user,
                    rut=self.cleaned_data['rut'],
                    rol=self.cleaned_data['rol']
                )
        return user


# 2. Administrador de Usuarios
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm

    def get_fieldsets(self, request, obj=None):
        if not obj:
            campos_del_form = list(self.add_form().fields.keys())
            return (
                ('Creación Inmediata de Usuario y Perfil', {
                    'classes': ('wide',),
                    'fields': campos_del_form,
                }),
            )
        return super().get_fieldsets(request, obj)


# 3. Formulario y Admin de Ejercicios con Checkboxes
class EjercicioAdminForm(forms.ModelForm):
    class Meta:
        model = Ejercicio
        fields = '__all__'
        widgets = {
            'areas_clinicas': forms.CheckboxSelectMultiple(),
        }


@admin.register(Ejercicio)
class EjercicioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'zona_cuerpo', 'mostrar_areas')

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == "area_clinica":
            kwargs["widget"] = forms.CheckboxSelectMultiple()
        return super().formfield_for_manytomany(db_field, request, **kwargs)

    def mostrar_areas(self, obj):
        return ", ".join([a.nombre for a in obj.area_clinica.all()])
    mostrar_areas.short_description = "Áreas Clínicas"

# 4. Registro de modelos restantes (sin repetir Ejercicio)
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)
admin.site.register(AreaClinica)
admin.site.register(Perfil)
admin.site.register(Pauta)
admin.site.register(RegistroFeedback)