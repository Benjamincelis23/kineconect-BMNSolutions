from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# Asumiendo que tus ViewSets están en la app "api"
from api import views 

router = DefaultRouter()
router.register(r'perfiles', views.PerfilViewSet, basename='perfil')
router.register(r'ejercicios', views.EjercicioViewSet, basename='ejercicio')
router.register(r'pautas', views.PautaViewSet, basename='pauta')
router.register(r'feedback', views.RegistroFeedbackViewSet, basename='feedback')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # 1. Endpoints de Autenticación JWT
    path('api/v1/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # 2. Endpoints de la API REST
    path('api/v1/', include(router.urls)),

    # 3. Documentación Swagger (drf-spectacular)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]