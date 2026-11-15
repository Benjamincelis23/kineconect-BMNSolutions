from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.conf import settings
from django.conf.urls.static import static
from api import views
from api.views import (
    CustomTokenObtainPairView,
    RegistroView,
    aprobar_view,
    MeView,
    PautaListView,
    PautaDetailView,
    FeedbackCreateView,
    CambiarPasswordView
)

router = DefaultRouter()
router.register(r'perfiles', views.PerfilViewSet, basename='perfil')
router.register(r'ejercicios', views.EjercicioViewSet, basename='ejercicio')
router.register(r'pautas', views.PautaViewSet, basename='pauta')
router.register(r'feedback', views.RegistroFeedbackViewSet, basename='feedback')

urlpatterns = [
    path('admin/', admin.site.urls),

    # 1. Endpoints de Autenticación JWT y Refresco (Ambos normalizan RUT)
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # 2. Endpoints específicos para la App Móvil
    path('api/me/', MeView.as_view(), name='usuario_me'),
    path('api/pautas/', PautaListView.as_view(), name='mis_pautas_list'),
    path('api/pautas/<int:pk>/', PautaDetailView.as_view(), name='pauta_detalle'),
    path('api/feedback/', FeedbackCreateView.as_view(), name='feedback_crear'),
    path('api/cambiar-password/', CambiarPasswordView.as_view(), name='cambiar_password'),

    # 3. Endpoints generales de la API REST (ViewSets con Router)
    path('api/v1/', include(router.urls)),

    # 4. Endpoints manuales para el registro por correo y aprobación
    path('api/v1/registro/', RegistroView.as_view(), name='solicitud_registro'),
    path('api/v1/registro/aprobar/<str:token>/', aprobar_view, name='aprobar_registro'),

    # 5. Documentación Swagger (drf-spectacular)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)