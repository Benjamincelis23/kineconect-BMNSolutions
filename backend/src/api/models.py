from django.db import models 
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class SolicitudRegistro(models.Model):
    ESTADOS = [
        ('PENDIENTE', 'Pendiente'),
        ('APROBADA', 'Aprobada'),
        ('RECHAZADA', 'Rechazada')
    ]
    rut = models.CharField(max_length=12, unique=True)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    email = models.EmailField()
    telefono = models.CharField(max_length=20, blank=True)
    estado = models.CharField(max_length=10, choices=ESTADOS, default='PENDIENTE')
    creada = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.rut} - {self.nombre} {self.apellido} ({self.estado})"


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
    video = models.FileField(upload_to="videos_ejercicios/", blank=True, null=True)
    imagen = models.ImageField(upload_to="ejercicios/", blank=True, null=True)
    gif_url = models.URLField(
        blank=True, null=True,
        help_text="URL de un GIF demostrativo del ejercicio (opcional)."
    )

    def __str__(self):
        return self.nombre


class Pauta(models.Model):
    titulo = models.CharField(max_length=150, default="Rutina de Ejercicios")
    kinesiologo = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pautas_creadas')
    
    # ADAPTACIÓN DE NICOLÁS (Plantillas sin paciente obligatorio):
    paciente = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pautas_asignadas', null=True, blank=True)
    es_plantilla = models.BooleanField(default=False)
    
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    notas = models.TextField(blank=True, default='') 

    def clean(self):
        if self.paciente and hasattr(self.paciente, 'perfil') and self.paciente.perfil.rol != 'PACIENTE':
            raise ValidationError({'paciente': 'El usuario asignado debe tener el rol de PACIENTE.'})
        
        if hasattr(self.kinesiologo, 'perfil') and self.kinesiologo.perfil.rol != 'KINE':
            raise ValidationError({'kinesiologo': 'El usuario creador debe tener el rol de KINE.'})

        if not self.es_plantilla and not self.paciente:
            raise ValidationError({'paciente': 'Una pauta que no es plantilla debe tener un paciente asignado.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        destinatario = self.paciente.username if self.paciente else "Plantilla General"
        return f"Pauta de {destinatario} - {self.creado_en.strftime('%d/%m/%Y')}"


class PautaEjercicio(models.Model):
    pauta = models.ForeignKey(Pauta, on_delete=models.CASCADE, related_name='ejercicios_detalle')
    ejercicio = models.ForeignKey(Ejercicio, on_delete=models.CASCADE)
    series = models.PositiveIntegerField(default=3)
    repeticiones = models.PositiveIntegerField(default=10)
    tiempo_descanso_segundos = models.PositiveIntegerField(default=60)

    def __str__(self):
        return f"{self.ejercicio.nombre} ({self.series}x{self.repeticiones})"


class RegistroFeedback(models.Model):
    pauta = models.ForeignKey(Pauta, on_delete=models.CASCADE, related_name='feedbacks')
    completado = models.BooleanField(default=False)
    
    # Adaptado a nivel_dolor para que el frontend móvil lo reciba bien
    nivel_dolor = models.PositiveSmallIntegerField(choices=[(i, str(i)) for i in range(0, 11)], null=True, blank=True)
    comentario = models.TextField(blank=True, null=True)
    fecha_ejecucion = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        usuario = self.pauta.paciente.username if self.pauta.paciente else "Anónimo"
        return f"Feedback de {usuario} - Dolor: {self.nivel_dolor}"