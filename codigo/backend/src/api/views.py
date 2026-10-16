from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Perfil, Ejercicio, Pauta, RegistroFeedback
from .serializers import (
    PerfilSerializer, EjercicioSerializer, PautaCreateSerializer,
    PautaReadSerializer, RegistroFeedbackSerializer, PacienteRegistroSerializer
)

class PerfilViewSet(viewsets.ModelViewSet):
    """
    Endpoint para gestionar perfiles y registrar pacientes.
    Reemplaza: dashboard, pacientes_list, paciente_create y PacienteViewSet (anterior).
    """
    queryset = Perfil.objects.all()
    serializer_class = PerfilSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='registrar-paciente')
    def registrar_paciente(self, request):
        """
        Reemplaza la antigua vista web de registro de pacientes y el POST del anterior PacienteViewSet.
        Nicolás simplemente enviará un POST aquí desde React.
        """
        serializer = PacienteRegistroSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "mensaje": "Paciente registrado con éxito. Se ha enviado la clave temporal a su correo.", 
                "usuario_id": user.id,
                "rut": user.perfil.rut,
                "username": user.username
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='mis-pacientes')
    def mis_pacientes(self, request):
        """
        Reemplaza: pacientes_list.
        Devuelve los pacientes asignados al kinesiólogo autenticado.
        """
        pacientes = Perfil.objects.filter(rol='PACIENTE', kinesiologo_asignado=request.user)
        serializer = PerfilSerializer(pacientes, many=True)
        return Response(serializer.data)


class EjercicioViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Catálogo de ejercicios. 
    Reemplaza: catalogo_muscular_view, selector_ejercicios y EjercicioViewSet (anterior).
    """
    queryset = Ejercicio.objects.all()
    serializer_class = EjercicioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        zona = self.request.query_params.get("zona_cuerpo", None)
        if zona:
            queryset = queryset.filter(zona_cuerpo__iexact=zona)
        return queryset


class PautaViewSet(viewsets.ModelViewSet):
    """
    Gestión de Pautas.
    Reemplaza TODO el flujo de carritos: carrito_agregar, carrito_quitar, carrito_ver, 
    carrito_confirmar y pauta_create.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return PautaCreateSerializer
        return PautaReadSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'perfil'):
            if user.perfil.rol == 'PACIENTE':
                return Pauta.objects.filter(paciente=user)
            elif user.perfil.rol == 'KINE':
                return Pauta.objects.filter(kinesiologo=user)
        return Pauta.objects.none()


class RegistroFeedbackViewSet(viewsets.ModelViewSet):
    """
    Gestión de Feedback (Dolor).
    Reemplaza el manejo de alertas de dolor de seguimiento_list y dashboard.
    """
    serializer_class = RegistroFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Los pacientes ven sus propios envíos, los kines ven los de sus pacientes
        if hasattr(user, 'perfil') and user.perfil.rol == 'PACIENTE':
            return RegistroFeedback.objects.filter(pauta__paciente=user)
        elif hasattr(user, 'perfil') and user.perfil.rol == 'KINE':
            return RegistroFeedback.objects.filter(pauta__kinesiologo=user)
        return RegistroFeedback.objects.none()