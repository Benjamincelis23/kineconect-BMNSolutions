#panel de visualizacion de panel de control
from django.contrib import admin
from .models import Perfil, Ejercicio, Pauta, RegistroFeedback

admin.site.register(Perfil)
admin.site.register(Ejercicio)
admin.site.register(Pauta)
admin.site.register(RegistroFeedback)