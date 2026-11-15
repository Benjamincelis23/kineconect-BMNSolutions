from django.core.management.base import BaseCommand
from api.models import Ejercicio, AreaClinica


class Command(BaseCommand):
    help = 'Carga los ejercicios base (Bird Dog, Clamshell y Tobillo Abecedario) con sus rutas de video'

    def handle(self, *args, **options):
        ejercicios_data = [
            {
                'nombre': 'Bird Dog (Perro de Caza)',
                'descripcion': (
                    'Ejercicio de estabilización lumbopélvica y control motor del core. '
                    'En posición de cuadrupedia (manos bajo hombros y rodillas bajo caderas), '
                    'extiende de forma simultánea y controlada un brazo hacia adelante y la pierna '
                    'contraria hacia atrás manteniendo la columna neutra sin rotar la pelvis.'
                ),
                'zona_corporal': 'Columna / Core',
                'dificultad': 'Básico',
                'video': 'videos_ejercicios/bird_dog.mp4',
                'areas': ['Rehabilitación General', 'Traumatología', 'Neurorehabilitación'],
            },
            {
                'nombre': 'Clamshell (Almeja)',
                'descripcion': (
                    'Fortalecimiento selectivo de glúteo medio y rotadores externos de cadera. '
                    'Acostado de lado con rodillas flexionadas a 45° y pies juntos, eleva la rodilla '
                    'superior separándola de la inferior sin dejar que la pelvis caiga hacia atrás, '
                    'manteniendo 2 segundos arriba antes de descender lentamente.'
                ),
                'zona_corporal': 'Cadera / Pelvis',
                'dificultad': 'Básico',
                'video': 'videos_ejercicios/clamshell.mp4',
                'areas': ['Rehabilitación General', 'Traumatología', 'Post-Operatorio'],
            },
            {
                'nombre': 'Abecedario de Tobillo',
                'descripcion': (
                    'Ejercicio de movilidad articular activa en todos los planos del complejo '
                    'tobillo-pie. Sentado con la pierna elevada y sin apoyar el talón, dibuja en el aire '
                    'las letras del abecedario en mayúscula moviendo únicamente el pie desde el tobillo '
                    'de forma amplia y sin dolor.'
                ),
                'zona_corporal': 'Tobillo / Pie',
                'dificultad': 'Básico',
                'video': 'videos_ejercicios/tobillo_abecedario.mp4',
                'areas': ['Rehabilitación General', 'Traumatología', 'Post-Operatorio', 'Adulto Mayor / Geriatría'],
            },
        ]

        campos_modelo = {f.name for f in Ejercicio._meta.get_fields()}

        for item in ejercicios_data:
            defaults = {
                'descripcion': item['descripcion'],
                'video': item['video'],
            }
            if 'zona_corporal' in campos_modelo:
                defaults['zona_corporal'] = item['zona_corporal']
            if 'dificultad' in campos_modelo:
                defaults['dificultad'] = item['dificultad']

            areas_existentes = AreaClinica.objects.filter(nombre__in=item['areas'])
            if 'area' in campos_modelo and areas_existentes.exists():
                defaults['area'] = areas_existentes.first()

            ejercicio, creado = Ejercicio.objects.update_or_create(
                nombre=item['nombre'],
                defaults=defaults,
            )

            if 'areas' in campos_modelo and areas_existentes.exists():
                ejercicio.areas.set(areas_existentes)

            estado = 'Creado' if creado else 'Actualizado'
            self.stdout.write(self.style.SUCCESS(f'{estado}: {ejercicio.nombre} -> {ejercicio.video}'))