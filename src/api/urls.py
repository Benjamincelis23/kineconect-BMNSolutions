from django.contrib.auth import views as auth_views
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# 1. Instanciación y registro de rutas en el Router de Django REST Framework
router = DefaultRouter()
router.register(r'api/v1/ejercicios', views.EjercicioViewSet, basename='api_ejercicios')
router.register(r'api/v1/pacientes', views.PacienteViewSet, basename='api_pacientes')

# 2. Lista principal de URLs (Vistas HTML de Django + Endpoints de la API)
urlpatterns = [
    # Panel Web / Vistas HTML
    path("", views.dashboard, name="dashboard"),
    path("login/", views.KineLoginView.as_view(), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("pacientes/", views.pacientes_list, name="pacientes_list"),
    path("pacientes/nuevo/", views.paciente_create, name="paciente_create"),
    path("seguimiento/", views.seguimiento_list, name="seguimiento_list"),
    path("catalogo/", views.catalogo_muscular_view, name="catalogo_muscular"),
    path("pautas/nueva/", views.pauta_create, name="pauta_create"),

    # Rutas del Selector y Carrito de Ejercicios (LAS QUE FALTABAN)
    path("selector/", views.selector_ejercicios, name="selector_ejercicios"),
    path("carrito/", views.carrito_ver, name="carrito_ver"),
    path("carrito/agregar/<int:ejercicio_id>/", views.carrito_agregar, name="carrito_agregar"),
    path("carrito/quitar/<int:ejercicio_id>/", views.carrito_quitar, name="carrito_quitar"),
    path("carrito/confirmar/", views.carrito_confirmar, name="carrito_confirmar"),

    # Rutas REST de la API (DRF)
    path("", include(router.urls)),
]