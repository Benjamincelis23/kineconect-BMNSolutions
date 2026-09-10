#definimos la estructura relacional base para el proyecto(roles catalogo pautas y feedback de dolors)
from django.db import models 
from django.contrib.auth.models import User

class Perfil(models.Model):
    ROL_CHOICES = (
        ('KINE', 'Kinesiólogo'),
        ('PACIENTE', 'Paciente'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    rut = models.CharField(max_length=12, unique=True)
    rol = models.CharField(max_length=10, choices=ROL_CHOICES)
    kinesiologo_asignado = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='mis_pacientes'
    )

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} - {self.rol}"

class Ejercicio(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField()
    zona_cuerpo = models.CharField(max_length=100)
    video_url = models.URLField(blank=True, null=True)
    # Multimedia para el selector de ejercicios: foto de referencia y/o gif animado.
    imagen = models.ImageField(upload_to="ejercicios/", blank=True, null=True)
    gif_url = models.URLField(
        blank=True, null=True,
        help_text="URL de un GIF demostrativo del ejercicio (opcional).",
    )

    def __str__(self):
        return self.nombre

class Pauta(models.Model):
    kinesiologo = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pautas_creadas')
    paciente = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pautas_asignadas')
    ejercicio = models.ForeignKey(Ejercicio, on_delete=models.CASCADE)
    series = models.PositiveIntegerField(default=3)
    repeticiones = models.PositiveIntegerField(default=10)
    tiempo_descanso_segundos = models.PositiveIntegerField(default=60)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    # Identifica qué pautas se crearon juntas desde el carrito de ejercicios,
    # para poder agruparlas visualmente en el panel de seguimiento.
    grupo_asignacion = models.UUIDField(null=True, blank=True, db_index=True)

class RegistroFeedback(models.Model):
    pauta = models.ForeignKey(Pauta, on_delete=models.CASCADE, related_name='feedbacks')
    completado = models.BooleanField(default=False)
    escala_dolor = models.PositiveSmallIntegerField(choices=[(i, str(i)) for i in range(1, 11)])
    comentario = models.TextField(blank=True, null=True)
    fecha_ejecucion = models.DateTimeField(auto_now_add=True)