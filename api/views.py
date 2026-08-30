import uuid
from functools import wraps

from django.contrib import messages
from django.contrib.auth import views as auth_views
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response

from .forms import PacienteRegistroForm, PautaCrearForm
from .models import Ejercicio, Pauta, Perfil, RegistroFeedback
from .serializers import (
    EjercicioSerializer,
    PacienteRegistroSerializer,
    PerfilSerializer,
)

# Umbral de dolor (escala 1-10) a partir del cual se dispara una alerta
# en el panel de seguimiento del kinesiólogo.
UMBRAL_DOLOR_ALERTA = 7

# Clave de sesión donde vive el "carrito" de ejercicios seleccionados
# mientras el kinesiólogo arma una pauta con varios ejercicios a la vez.
CARRITO_SESSION_KEY = "carrito_ejercicios"

# Valores por defecto con los que un ejercicio entra al carrito.
CARRITO_DEFAULTS = {
    "series": 3,
    "repeticiones": 10,
    "tiempo_descanso_segundos": 60,
}


# ==============================================================================
# DECORADORES Y AUTENTICACIÓN WEB
# ==============================================================================

def kine_required(view_func):
    """Restringe el acceso al portal web solo a usuarios con rol KINE."""

    @wraps(view_func)
    @login_required
    def wrapper(request, *args, **kwargs):
        perfil = getattr(request.user, "perfil", None)
        if not perfil or perfil.rol != "KINE":
            messages.error(
                request,
                "Esta cuenta no tiene permisos de kinesiólogo para acceder al portal web.",
            )
            return redirect("login")
        return view_func(request, *args, **kwargs)

    return wrapper


class KineLoginView(auth_views.LoginView):
    template_name = "registration/login.html"
    redirect_authenticated_user = True


# ==============================================================================
# VISTAS WEB DEL PORTAL (DJANGO TEMPLATES / HTML)
# ==============================================================================

@kine_required
def dashboard(request):
    """Hub Principal: '¿Qué deseas hacer hoy?' con accesos y métricas clave."""
    # 1. Total de pacientes vinculados al profesional
    pacientes_count = Perfil.objects.filter(
        rol="PACIENTE", kinesiologo_asignado=request.user
    ).count()

    # 2. Total de pautas activas
    pautas_activas_count = Pauta.objects.filter(
        kinesiologo=request.user, activo=True
    ).count()

    # 3. Total de ejercicios en catálogo
    ejercicios_count = Ejercicio.objects.count()

    # 4. Alertas de dolor recientes (>= UMBRAL_DOLOR_ALERTA)
    alertas_recientes = (
        RegistroFeedback.objects.filter(
            pauta__kinesiologo=request.user,
            escala_dolor__gte=UMBRAL_DOLOR_ALERTA,
        )
        .select_related("pauta__paciente", "pauta__ejercicio")
        .order_by("-fecha_ejecucion")[:5]
    )

    context = {
        "pacientes_count": pacientes_count,
        "pautas_activas_count": pautas_activas_count,
        "ejercicios_count": ejercicios_count,
        "alertas_recientes": alertas_recientes,
        "total_alertas": alertas_recientes.count(),
        "umbral_alerta": UMBRAL_DOLOR_ALERTA,
    }
    return render(request, "inicio/index.html", context)


@kine_required
def pacientes_list(request):
    pacientes = (
        Perfil.objects.filter(rol="PACIENTE", kinesiologo_asignado=request.user)
        .select_related("user")
        .order_by("user__first_name", "user__last_name")
    )
    return render(request, "pacientes/list.html", {"pacientes": pacientes})


@kine_required
def paciente_create(request):
    if request.method == "POST":
        form = PacienteRegistroForm(request.POST)
        if form.is_valid():
            paciente = form.save(kinesiologo=request.user)
            messages.success(
                request,
                f"Paciente {paciente.get_full_name()} registrado correctamente.",
            )
            return redirect("pacientes_list")
    else:
        form = PacienteRegistroForm()
    return render(request, "pacientes/form.html", {"form": form})


@kine_required
def catalogo_muscular_view(request):
    """Vista del catálogo de ejercicios con soporte para filtrado por etiquetas/chips."""
    zona_filtro = request.GET.get("zona", "")
    if zona_filtro:
        ejercicios = Ejercicio.objects.filter(zona_cuerpo__iexact=zona_filtro)
    else:
        ejercicios = Ejercicio.objects.all()

    zonas = Ejercicio.objects.values_list("zona_cuerpo", flat=True).distinct()
    return render(
        request,
        "pacientes/catalogo_muscular.html",
        {
            "ejercicios": ejercicios,
            "zonas": zonas,
            "zona_activa": zona_filtro,
        },
    )


@kine_required
def selector_ejercicios(request):
    """Explorador de ejercicios con búsqueda por nombre y filtro por zona.

    Cada ejercicio se puede agregar al 'carrito' de la pauta que se está
    armando, para poder asignar varios ejercicios de una sola vez en lugar
    de uno por uno.
    """
    query = request.GET.get("q", "").strip()
    zona_filtro = request.GET.get("zona", "")

    ejercicios = Ejercicio.objects.all()
    if query:
        ejercicios = ejercicios.filter(nombre__icontains=query)
    if zona_filtro:
        ejercicios = ejercicios.filter(zona_cuerpo__iexact=zona_filtro)
    ejercicios = ejercicios.order_by("zona_cuerpo", "nombre")

    zonas = Ejercicio.objects.values_list("zona_cuerpo", flat=True).distinct().order_by("zona_cuerpo")
    carrito = request.session.get(CARRITO_SESSION_KEY, {})

    return render(
        request,
        "pacientes/selector_ejercicios.html",
        {
            "ejercicios": ejercicios,
            "zonas": zonas,
            "query": query,
            "zona_activa": zona_filtro,
            "ids_en_carrito": set(carrito.keys()),
            "total_carrito": len(carrito),
        },
    )


@kine_required
def carrito_agregar(request, ejercicio_id):
    """Agrega un ejercicio al carrito de la sesión (vía fetch/AJAX)."""
    ejercicio = get_object_or_404(Ejercicio, id=ejercicio_id)
    carrito = request.session.get(CARRITO_SESSION_KEY, {})
    carrito[str(ejercicio.id)] = dict(CARRITO_DEFAULTS)
    request.session[CARRITO_SESSION_KEY] = carrito
    request.session.modified = True
    return JsonResponse({"ok": True, "total": len(carrito)})


@kine_required
def carrito_quitar(request, ejercicio_id):
    """Quita un ejercicio del carrito de la sesión (vía fetch/AJAX)."""
    carrito = request.session.get(CARRITO_SESSION_KEY, {})
    carrito.pop(str(ejercicio_id), None)
    request.session[CARRITO_SESSION_KEY] = carrito
    request.session.modified = True
    return JsonResponse({"ok": True, "total": len(carrito)})


@kine_required
def carrito_ver(request):
    """Muestra los ejercicios acumulados para parametrizarlos y elegir paciente."""
    carrito = request.session.get(CARRITO_SESSION_KEY, {})
    ejercicios = Ejercicio.objects.filter(id__in=carrito.keys())

    items = []
    for ejercicio in ejercicios:
        params = carrito.get(str(ejercicio.id), dict(CARRITO_DEFAULTS))
        items.append({"ejercicio": ejercicio, **params})
    items.sort(key=lambda item: item["ejercicio"].nombre)

    pacientes_ids = Perfil.objects.filter(
        rol="PACIENTE", kinesiologo_asignado=request.user
    ).values_list("user_id", flat=True)
    pacientes = User.objects.filter(id__in=pacientes_ids).order_by("first_name", "last_name")

    return render(
        request,
        "pacientes/carrito_ejercicios.html",
        {"items": items, "pacientes": pacientes},
    )


@kine_required
def carrito_confirmar(request):
    """Crea una Pauta por cada ejercicio del carrito, todas para el mismo paciente."""
    if request.method != "POST":
        return redirect("carrito_ver")

    carrito = request.session.get(CARRITO_SESSION_KEY, {})
    if not carrito:
        messages.error(request, "No hay ejercicios en el carrito para asignar.")
        return redirect("selector_ejercicios")

    paciente_id = request.POST.get("paciente")
    pacientes_ids = Perfil.objects.filter(
        rol="PACIENTE", kinesiologo_asignado=request.user
    ).values_list("user_id", flat=True)
    paciente = get_object_or_404(User, id=paciente_id, id__in=pacientes_ids)

    grupo_id = uuid.uuid4()
    nuevas_pautas = []
    for ejercicio_id, valores in carrito.items():
        series = int(request.POST.get(f"series_{ejercicio_id}", valores.get("series", 3)))
        repeticiones = int(request.POST.get(f"repeticiones_{ejercicio_id}", valores.get("repeticiones", 10)))
        descanso = int(request.POST.get(
            f"descanso_{ejercicio_id}", valores.get("tiempo_descanso_segundos", 60)
        ))
        nuevas_pautas.append(Pauta(
            kinesiologo=request.user,
            paciente=paciente,
            ejercicio_id=ejercicio_id,
            series=series,
            repeticiones=repeticiones,
            tiempo_descanso_segundos=descanso,
            grupo_asignacion=grupo_id,
        ))

    Pauta.objects.bulk_create(nuevas_pautas)

    request.session[CARRITO_SESSION_KEY] = {}
    request.session.modified = True

    messages.success(
        request,
        f"Se asignaron {len(nuevas_pautas)} ejercicio(s) a "
        f"{paciente.get_full_name() or paciente.username} correctamente.",
    )
    return redirect("seguimiento_list")


@kine_required
def pauta_create(request):
    """Permite al kinesiólogo asignar una rutina parametrizada a un paciente."""
    if request.method == "POST":
        form = PautaCrearForm(request.POST, kinesiologo=request.user)
        if form.is_valid():
            pauta = form.save(commit=False)
            pauta.kinesiologo = request.user
            pauta.save()
            messages.success(
                request,
                f"Pauta asignada exitosamente a {pauta.paciente.get_full_name() or pauta.paciente.username}.",
            )
            return redirect("seguimiento_list")
    else:
        form = PautaCrearForm(kinesiologo=request.user)
    return render(request, "pacientes/pauta_form.html", {"form": form})


@kine_required
def seguimiento_list(request):
    pacientes_ids = Perfil.objects.filter(
        rol="PACIENTE", kinesiologo_asignado=request.user
    ).values_list("user_id", flat=True)

    pautas = (
        Pauta.objects.filter(
            kinesiologo=request.user, paciente_id__in=pacientes_ids, activo=True
        )
        .select_related("paciente", "ejercicio")
        .prefetch_related("feedbacks")
        .order_by("paciente__first_name")
    )

    filas = []
    total_alertas = 0
    for pauta in pautas:
        ultimo_feedback = pauta.feedbacks.order_by("-fecha_ejecucion").first()
        alerta = bool(
            ultimo_feedback and ultimo_feedback.escala_dolor >= UMBRAL_DOLOR_ALERTA
        )
        if alerta:
            total_alertas += 1
        filas.append(
            {
                "pauta": pauta,
                "feedback": ultimo_feedback,
                "alerta": alerta,
            }
        )

    # Las filas con alerta se muestran primero.
    filas.sort(key=lambda f: not f["alerta"])

    return render(
        request,
        "seguimiento/list.html",
        {
            "filas": filas,
            "total_alertas": total_alertas,
            "umbral": UMBRAL_DOLOR_ALERTA,
        },
    )


# ==============================================================================
# ENDPOINTS API REST (DRF / HU-001 / CATÁLOGO)
# ==============================================================================

class PacienteViewSet(viewsets.ModelViewSet):
    """
    Endpoint REST para HU-001:
    - GET /api/v1/pacientes/ -> Lista pacientes vinculados al Kinesiólogo autenticado.
    - POST /api/v1/pacientes/ -> Registra y vincula un nuevo paciente vía JSON.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PacienteRegistroSerializer

    def get_queryset(self):
        return Perfil.objects.filter(
            rol="PACIENTE", kinesiologo_asignado=self.request.user
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = PerfilSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "mensaje": f"Paciente {user.get_full_name()} registrado y vinculado correctamente.",
                "id": user.id,
                "rut": user.perfil.rut,
                "username": user.username,
            },
            status=status.HTTP_201_CREATED,
        )


class EjercicioViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint REST para consultar el catálogo de ejercicios.
    Permite filtrar por zona anatómica: /api/v1/ejercicios/?zona_cuerpo=CUADRICEPS
    """
    queryset = Ejercicio.objects.all()
    serializer_class = EjercicioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Ejercicio.objects.all()
        zona = self.request.query_params.get("zona_cuerpo", None)
        if zona:
            queryset = queryset.filter(zona_cuerpo__iexact=zona)
        return queryset