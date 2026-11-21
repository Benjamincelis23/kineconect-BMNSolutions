import os
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import models, transaction
from api.models import Ejercicio


AREAS_CLINICAS = [
    'Rehabilitación General',
    'Traumatología',
    'Inmunología / VIH-SIDA',
    'Neurorehabilitación',
    'Post-Operatorio',
    'Cardiorrespiratorio',
    'Adulto Mayor / Geriatría',
]

VIDEOS_CONFIRMADOS = {
    'videos_ejercicios/bird_dog.mp4',
    'videos_ejercicios/clamshell.mp4',
    'videos_ejercicios/tobillo_abecedario.mp4',
}

ejercicios_data = [
    # =========================================================================
    # 0. EJERCICIOS BASE CON VIDEO DEMOSTRATIVO
    # =========================================================================
    {
        'nombre': 'Bird Dog (Perro de Caza)',
        'descripcion': (
            'Posición inicial: en cuatro apoyos (cuadrupedia) con manos alineadas bajo los hombros, '
            'rodillas bajo las caderas y columna en posición neutra. '
            'Ejecución: extiende simultáneamente un brazo hacia adelante y la pierna contraria hacia atrás '
            'hasta alinearlos con el tronco, regresa al centro con control y alterna de lado. '
            'Ritmo y respiración: exhala durante los 3 segundos de extensión, sostén 2 segundos arriba e inhala al volver. '
            'Precaución postural: evita arquear la zona lumbar o rotar la pelvis al elevar la pierna.'
        ),
        'zona_corporal': 'Core / Lumbar',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/bird_dog.mp4',
        'areas': ['Rehabilitación General', 'Traumatología', 'Neurorehabilitación', 'Adulto Mayor / Geriatría'],
    },
    {
        'nombre': 'Clamshell (Almeja)',
        'descripcion': (
            'Posición inicial: acostado de lado con caderas flexionadas a 45 grados, rodillas dobladas a 90 grados '
            'y ambos pies juntos uno sobre el otro. '
            'Ejecución: eleva la rodilla superior separándola de la inferior como una almeja mientras mantienes '
            'los pies en contacto, y desciende lentamente a la posición inicial. '
            'Ritmo y respiración: exhala al abrir la rodilla en 2 segundos, pausa 2 segundos arriba e inhala al bajar en 3 segundos. '
            'Precaución postural: mantén la pelvis completamente estable sin dejar que la cadera caiga hacia atrás.'
        ),
        'zona_corporal': 'Cadera / Glúteos',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/clamshell.mp4',
        'areas': ['Rehabilitación General', 'Traumatología', 'Post-Operatorio', 'Adulto Mayor / Geriatría'],
    },
    {
        'nombre': 'Abecedario de Tobillo',
        'descripcion': (
            'Posición inicial: sentado con la espalda apoyada y la pierna elevada (puedes sostener el muslo con ambas manos) '
            'dejando el tobillo libre en el aire. '
            'Ejecución: dibuja lentamente en el aire las letras del abecedario en mayúscula moviendo únicamente el pie '
            'en todo su rango articular sin mover la rodilla. '
            'Ritmo y respiración: trazos amplios y continuos de 2 a 3 segundos por letra manteniendo respiración tranquila. '
            'Precaución postural: detén o reduce la amplitud si aparece dolor agudo o chasquido articular.'
        ),
        'zona_corporal': 'Tobillo / Pie',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/tobillo_abecedario.mp4',
        'areas': ['Rehabilitación General', 'Traumatología', 'Post-Operatorio', 'Neurorehabilitación', 'Adulto Mayor / Geriatría'],
    },

    # =========================================================================
    # 1. CUELLO
    # =========================================================================
    {
        'nombre': 'Retracción Cervical Profunda (Chin Tuck)',
        'descripcion': (
            'Posición inicial: sentado con la espalda apoyada en el respaldo y la mirada al frente. '
            'Ejecución: desliza suavemente el mentón hacia atrás en línea horizontal como intentando '
            'formar una doble papada, sin inclinar la cabeza hacia arriba ni hacia abajo. '
            'Ritmo y respiración: mantén la contracción suave durante 5 segundos exhalando lento y relaja al inhalar. '
            'Precaución postural: evita apretar los dientes o elevar los hombros durante la retracción.'
        ),
        'zona_corporal': 'Cuello',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/retraccion_cervical_chin_tuck.mp4',
        'areas': ['Rehabilitación General', 'Traumatología', 'Neurorehabilitación'],
    },
    {
        'nombre': 'Inclinación Lateral Cervical Controlada',
        'descripcion': (
            'Posición inicial: sedente con hombros relajados y manos apoyadas sobre los muslos. '
            'Ejecución: lleva lentamente la oreja derecha hacia el hombro derecho hasta percibir un estiramiento '
            'suave en el lateral del cuello, regresa al centro y repite hacia el lado izquierdo. '
            'Ritmo y respiración: inhala en el centro, exhala durante los 3 segundos de inclinación y sostén 5 segundos. '
            'Precaución postural: no eleves el hombro contrario ni gires el mentón hacia el techo.'
        ),
        'zona_corporal': 'Cuello',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/inclinacion_lateral_cervical.mp4',
        'areas': ['Rehabilitación General', 'Traumatología', 'Adulto Mayor / Geriatría'],
    },
    {
        'nombre': 'Rotación Cervical Activa en Sedente',
        'descripcion': (
            'Posición inicial: sentado con columna erguida y mirada horizontal. '
            'Ejecución: gira la cabeza lentamente hacia la derecha intentando alinear el mentón con el hombro, '
            'vuelve al eje central con control y repite hacia la izquierda dentro de un rango libre de dolor. '
            'Ritmo y respiración: 3 segundos para girar exhalando suavemente, 2 segundos de pausa y 3 segundos de retorno inhalando. '
            'Precaución postural: mantén el tronco inmóvil; el movimiento ocurre exclusivamente en la columna cervical.'
        ),
        'zona_corporal': 'Cuello',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/rotacion_cervical_activa_sedente.mp4',
        'areas': ['Rehabilitación General', 'Post-Operatorio', 'Adulto Mayor / Geriatría'],
    },
    {
        'nombre': 'Flexión Craneocervical Isométrica en Supino',
        'descripcion': (
            'Posición inicial: acostado boca arriba con rodillas flexionadas, pies apoyados y una toalla fina bajo el occipucio. '
            'Ejecución: realiza un asentimiento suave con la cabeza (como diciendo "sí") presionando levemente la toalla '
            'sin despegar el cráneo de la superficie para activar los flexores cervicales profundos. '
            'Ritmo y respiración: sostén 6 a 8 segundos manteniendo respiración nasal fluida y descansa 5 segundos. '
            'Precaución postural: evita activar los músculos superficiales del cuello (esternocleidomastoideo) o contener la respiración.'
        ),
        'zona_corporal': 'Cuello',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/flexion_craneocervical_isometrica.mp4',
        'areas': ['Traumatología', 'Neurorehabilitación', 'Post-Operatorio'],
    },

    # =========================================================================
    # 2. HOMBRO
    # =========================================================================
    {
        'nombre': 'Ejercicio Pendular de Codman',
        'descripcion': (
            'Posición inicial: de pie junto a una mesa o silla, apoya la mano sana sobre la superficie e inclina '
            'el tronco hacia adelante dejando colgar el brazo afectado completamente relajado. '
            'Ejecución: inicia pequeños círculos suaves (en sentido horario y antihorario) usando el balanceo del cuerpo, '
            'no la fuerza del hombro. '
            'Ritmo y respiración: realiza oscilaciones lentas y rítmicas durante 30 a 45 segundos respirando profundamente. '
            'Precaución postural: mantén el brazo y la mano totalmente sueltos para favorecer la descompresión articular.'
        ),
        'zona_corporal': 'Hombro',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/ejercicio_pendular_codman.mp4',
        'areas': ['Post-Operatorio', 'Traumatología', 'Rehabilitación General'],
    },
    {
        'nombre': 'Deslizamiento Escapular en Pared (Wall Slides)',
        'descripcion': (
            'Posición inicial: de pie frente a una pared, apoya los bordes cubitales de ambos antebrazos sobre ella '
            'con codos flexionados a 90 grados y separación al ancho de hombros. '
            'Ejecución: desliza los antebrazos hacia arriba por la pared extendiendo progresivamente los codos '
            'hasta donde el control escapular lo permita y desciende con lentitud. '
            'Ritmo y respiración: inhala al deslizar hacia arriba en 3 segundos y exhala al descender en 3 segundos. '
            'Precaución postural: evita arquear la zona lumbar o encoger los hombros hacia las orejas al subir.'
        ),
        'zona_corporal': 'Hombro',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/deslizamiento_escapular_pared.mp4',
        'areas': ['Rehabilitación General', 'Traumatología', 'Post-Operatorio'],
    },
    {
        'nombre': 'Rotación Externa de Hombro con Banda Elástica',
        'descripcion': (
            'Posición inicial: de pie con el codo pegado al costado del tronco flexionado a 90 grados (con una toalla doblada '
            'entre codo y costillas) sujetando una banda elástica anclada lateralmente. '
            'Ejecución: lleva el antebrazo hacia afuera separando la mano del abdomen mediante rotación pura del hombro '
            'y regresa lentamente a la posición inicial. '
            'Ritmo y respiración: exhala en 2 segundos al abrir hacia afuera e inhala en 3 segundos al controlar el retorno. '
            'Precaución postural: no despegues el codo del costado ni gires el torso para compensar la resistencia.'
        ),
        'zona_corporal': 'Hombro',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/rotacion_externa_hombro_banda.mp4',
        'areas': ['Traumatología', 'Post-Operatorio', 'Rehabilitación General'],
    },
    {
        'nombre': 'Elevación en Plano Escapular (Scaption)',
        'descripcion': (
            'Posición inicial: de pie con postura erguida, brazos a los costados y pulgares apuntando hacia arriba. '
            'Ejecución: eleva ambos brazos en un ángulo diagonal de 30 grados hacia adelante respecto al plano frontal '
            'hasta alcanzar la altura de los hombros (90 grados) y desciende de forma controlada. '
            'Ritmo y respiración: inhala al elevar en 2 segundos, pausa 1 segundo arriba y exhala al bajar en 3 segundos. '
            'Precaución postural: detén el ascenso si aparece pinzamiento subacromial o elevación compensatoria del trapecio.'
        ),
        'zona_corporal': 'Hombro',
        'dificultad': 'Avanzado',
        'video': 'videos_ejercicios/elevacion_plano_escapular_scaption.mp4',
        'areas': ['Traumatología', 'Inmunología / VIH-SIDA', 'Rehabilitación General'],
    },

    # =========================================================================
    # 3. BRAZOS / MUÑECA
    # =========================================================================
    {
        'nombre': 'Deslizamiento Tendinoso de Mano y Dedos',
        'descripcion': (
            'Posición inicial: sentado con el codo apoyado sobre una mesa y el antebrazo vertical con muñeca neutra. '
            'Ejecución: transita secuencialmente por cinco posturas de mano: dedos rectos, flexión en gancho, '
            'puño completo, mesa (flexión metacarpofalángica a 90 grados) y puño recto, manteniendo 2 segundos cada fase. '
            'Ritmo y respiración: movimiento lento y fluido sin movimientos bruscos, acompañando con respiración tranquila. '
            'Precaución postural: realiza la secuencia sin forzar el rango si existe edema o rigidez postquirúrgica.'
        ),
        'zona_corporal': 'Brazos / Muñeca',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/deslizamiento_tendinoso_mano.mp4',
        'areas': ['Post-Operatorio', 'Traumatología', 'Neurorehabilitación'],
    },
    {
        'nombre': 'Extensión Excéntrica de Muñeca con Carga Ligera',
        'descripcion': (
            'Posición inicial: sentado con el antebrazo apoyado sobre el muslo o una mesa, palma mirando hacia abajo '
            'y la muñeca sobresaliendo del borde sujetando una mancuerna ligera o botella. '
            'Ejecución: ayuda con la mano contraria a elevar el dorso de la mano (extensión) y luego desciende el peso '
            'lentamente en solitario durante 4 segundos hasta la flexión completa. '
            'Ritmo y respiración: inhala al asistir la subida y exhala de forma continua durante los 4 segundos de descenso. '
            'Precaución postural: mantén el antebrazo firme sobre el apoyo sin levantar el codo.'
        ),
        'zona_corporal': 'Brazos / Muñeca',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/flexo_extension_excentrica_muneca.mp4',
        'areas': ['Traumatología', 'Rehabilitación General'],
    },
    {
        'nombre': 'Pronosupinación Controlada de Antebrazo',
        'descripcion': (
            'Posición inicial: sentado con el codo pegado al costado del cuerpo flexionado a 90 grados y pulgar apuntando al techo. '
            'Ejecución: gira lentamente el antebrazo para llevar la palma hacia arriba (supinación), vuelve al centro '
            'y gira para orientar la palma hacia el suelo (pronación). '
            'Ritmo y respiración: 2 segundos hacia cada extremo con pausa de 1 segundo, respirando de forma pausada. '
            'Precaución postural: evita separar el codo del tronco o inclinar el cuerpo lateralmente para ganar giro.'
        ),
        'zona_corporal': 'Brazos / Muñeca',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/pronosupinacion_controlada_antebrazo.mp4',
        'areas': ['Post-Operatorio', 'Traumatología', 'Neurorehabilitación'],
    },
    {
        'nombre': 'Flexión de Bíceps en Sedente con Banda Elástica',
        'descripcion': (
            'Posición inicial: sentado con espalda recta, pisando el centro de una banda elástica y sujetando los extremos '
            'con las palmas mirando hacia adelante. '
            'Ejecución: flexiona ambos codos llevando las manos hacia los hombros de manera controlada y extiende '
            'hasta casi completar el recorrido sin bloquear la articulación. '
            'Ritmo y respiración: exhala al flexionar en 2 segundos e inhala al extender en 3 segundos. '
            'Precaución postural: mantén los codos estables a los costados sin balancear el tronco hacia atrás.'
        ),
        'zona_corporal': 'Brazos / Muñeca',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/flexion_biceps_sedente_progresiva.mp4',
        'areas': ['Inmunología / VIH-SIDA', 'Adulto Mayor / Geriatría', 'Rehabilitación General'],
    },

    # =========================================================================
    # 4. PECHO
    # =========================================================================
    {
        'nombre': 'Respiración Diafragmática con Expansión Costal',
        'descripcion': (
            'Posición inicial: acostado boca arriba con rodillas flexionadas, una mano sobre el esternón y la otra sobre el abdomen. '
            'Ejecución: inhala profundamente por la nariz dirigiendo el aire hacia la base de los pulmones para expandir '
            'las costillas inferiores y el abdomen, y exhala lentamente con labios fruncidos. '
            'Ritmo y respiración: 4 segundos de inspiración nasal, 2 segundos de pausa y 6 segundos de espiración prolongada. '
            'Precaución postural: evita elevar la parte superior del pecho y los hombros al tomar aire.'
        ),
        'zona_corporal': 'Pecho',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/respiracion_diafragmatica_expansion_costal.mp4',
        'areas': ['Cardiorrespiratorio', 'Post-Operatorio', 'Inmunología / VIH-SIDA'],
    },
    {
        'nombre': 'Apertura Torácica en Decúbito Lateral (Libro Abierto)',
        'descripcion': (
            'Posición inicial: acostado de lado con caderas y rodillas flexionadas a 90 grados y ambos brazos extendidos '
            'al frente a la altura de los hombros, palma con palma. '
            'Ejecución: eleva el brazo superior describiendo un amplio arco hacia el lado contrario, rotando la caja torácica '
            'y siguiendo la mano con la mirada hasta acercar la escápula al suelo. '
            'Ritmo y respiración: inhala al iniciar el arco, exhala profundamente al abrir el tórax y sostén 4 segundos. '
            'Precaución postural: mantén ambas rodillas juntas y apoyadas en el suelo para aislar la rotación torácica.'
        ),
        'zona_corporal': 'Pecho',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/apertura_toracica_libro_abierto.mp4',
        'areas': ['Cardiorrespiratorio', 'Rehabilitación General', 'Traumatología'],
    },
    {
        'nombre': 'Estiramiento Pectoral Bilateral en Marco de Puerta',
        'descripcion': (
            'Posición inicial: de pie en el umbral de una puerta, apoya ambos antebrazos sobre los marcos laterales '
            'con los codos ligeramente por debajo de la altura de los hombros y un pie adelantado. '
            'Ejecución: adelanta suavemente el peso del cuerpo hacia el pie delantero hasta sentir una apertura '
            'cómoda en la musculatura anterior del pecho. '
            'Ritmo y respiración: mantén la posición durante 20 a 30 segundos con respiraciones torácicas lentas y profundas. '
            'Precaución postural: mantén el abdomen levemente activo para no hiperextender la columna lumbar.'
        ),
        'zona_corporal': 'Pecho',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/estiramiento_pectoral_marco_puerta.mp4',
        'areas': ['Rehabilitación General', 'Cardiorrespiratorio', 'Post-Operatorio'],
    },
    {
        'nombre': 'Flexiones de Brazos Inclinadas en Pared (Wall Push-Ups)',
        'descripcion': (
            'Posición inicial: de pie frente a una pared a un brazo de distancia, apoya las palmas a la altura '
            'y ancho de los hombros con el cuerpo formando una línea recta desde la cabeza hasta los talones. '
            'Ejecución: flexiona los codos en un ángulo de 45 grados respecto al torso acercando el pecho a la pared '
            'y empuja con control hasta volver a la posición inicial. '
            'Ritmo y respiración: inhala al descender hacia la pared en 3 segundos y exhala al empujar en 2 segundos. '
            'Precaución postural: evita dejar caer la cadera hacia adelante o abrir los codos completamente en cruz.'
        ),
        'zona_corporal': 'Pecho',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/flexiones_inclinadas_pared.mp4',
        'areas': ['Inmunología / VIH-SIDA', 'Adulto Mayor / Geriatría', 'Rehabilitación General'],
    },

    # =========================================================================
    # 5. ESPALDA
    # =========================================================================
    {
        'nombre': 'Retracción Escapular en Sedente (W-Squeeze)',
        'descripcion': (
            'Posición inicial: sentado con espalda erguida, brazos flexionados a los costados formando una letra "W" '
            'con las palmas mirando hacia adelante. '
            'Ejecución: junta suavemente los omóplatos hacia la columna y hacia abajo como intentando guardarlos '
            'en los bolsillos traseros del pantalón. '
            'Ritmo y respiración: exhala al juntar las escápulas, sostén 5 segundos y relaja lentamente al inhalar. '
            'Precaución postural: evita sacar las costillas inferiores hacia adelante o tensionar el cuello.'
        ),
        'zona_corporal': 'Espalda',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/retraccion_escapular_sedente.mp4',
        'areas': ['Rehabilitación General', 'Cardiorrespiratorio', 'Adulto Mayor / Geriatría'],
    },
    {
        'nombre': 'Movilización Segmentaria Gato-Camello (Cat-Cow)',
        'descripcion': (
            'Posición inicial: en cuatro apoyos (cuadrupedia) con manos alineadas bajo los hombros y rodillas bajo las caderas. '
            'Ejecución: redondea lentamente toda la espalda hacia el techo llevando el mentón al pecho (camello), '
            'y luego invierte el movimiento descendiendo el abdomen y abriendo el pecho hacia el frente (gato). '
            'Ritmo y respiración: exhala al redondear la espalda hacia arriba e inhala al extender suavemente. '
            'Precaución postural: realiza la transición vértebra por vértebra sin forzar los extremos del rango lumbar.'
        ),
        'zona_corporal': 'Espalda',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/movilizacion_toracica_gato_camello.mp4',
        'areas': ['Rehabilitación General', 'Neurorehabilitación', 'Cardiorrespiratorio'],
    },
    {
        'nombre': 'Remo Sentado con Banda Elástica',
        'descripcion': (
            'Posición inicial: sentado con piernas extendidas o levemente flexionadas, pasa una banda elástica '
            'alrededor de la planta de ambos pies y sujeta los extremos con brazos extendidos. '
            'Ejecución: tracciona los codos hacia atrás pegados al tronco juntando las escápulas al final del recorrido '
            'y retorna hacia adelante frenando la tensión de la banda. '
            'Ritmo y respiración: exhala al traccionar en 2 segundos e inhala al extender los brazos en 3 segundos. '
            'Precaución postural: mantén el tronco vertical sin inclinarte hacia atrás para impulsar el movimiento.'
        ),
        'zona_corporal': 'Espalda',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/remo_sentado_banda_elastica.mp4',
        'areas': ['Inmunología / VIH-SIDA', 'Traumatología', 'Adulto Mayor / Geriatría'],
    },
    {
        'nombre': 'Extensión Torácica en Decúbito Prono (Prone Cobra)',
        'descripcion': (
            'Posición inicial: acostado boca abajo con la frente apoyada sobre una toalla doblada y los brazos '
            'extendidos a los costados con las palmas mirando hacia el suelo. '
            'Ejecución: despega suavemente el pecho y los brazos unos centímetros del suelo mientras rotas las palmas '
            'hacia afuera y juntas las escápulas, manteniendo la mirada hacia la colchoneta. '
            'Ritmo y respiración: inhala al elevar el tórax, sostén 4 segundos respirando corto y exhala al descender. '
            'Precaución postural: mantén los glúteos levemente activos y no extiendas el cuello mirando hacia el frente.'
        ),
        'zona_corporal': 'Espalda',
        'dificultad': 'Avanzado',
        'video': 'videos_ejercicios/extension_toracica_prone_cobra.mp4',
        'areas': ['Traumatología', 'Rehabilitación General', 'Neurorehabilitación'],
    },

    # =========================================================================
    # 6. CORE / LUMBAR
    # =========================================================================
    {
        'nombre': 'Basculación Pélvica Posterior en Supino',
        'descripcion': (
            'Posición inicial: acostado boca arriba con rodillas flexionadas y plantas de los pies apoyadas al ancho de caderas. '
            'Ejecución: contrae suavemente el abdomen profundo y los glúteos para aplanar la curvatura lumbar contra '
            'la colchoneta (retroversión pélvica) y luego regresa a la posición neutra. '
            'Ritmo y respiración: exhala mientras aplana la zona lumbar en 3 segundos, sostén 3 segundos e inhala al soltar. '
            'Precaución postural: evita empujar con los talones para despegar los glúteos del suelo.'
        ),
        'zona_corporal': 'Core / Lumbar',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/basculacion_pelvica_supino.mp4',
        'areas': ['Rehabilitación General', 'Post-Operatorio', 'Traumatología'],
    },
    {
        'nombre': 'Bicho Muerto (Dead Bug) Controlado',
        'descripcion': (
            'Posición inicial: acostado boca arriba con brazos extendidos hacia el techo y caderas y rodillas flexionadas a 90 grados. '
            'Ejecución: extiende simultáneamente el brazo derecho hacia atrás y la pierna izquierda hacia adelante sin que '
            'toquen el suelo, manteniendo la zona lumbar estable; regresa al centro y alterna de lado. '
            'Ritmo y respiración: exhala lentamente durante toda la extensión (3 segundos) e inhala al volver al centro. '
            'Precaución postural: si la zona lumbar se arquea despegándose del suelo, reduce la amplitud de descenso de la pierna.'
        ),
        'zona_corporal': 'Core / Lumbar',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/bicho_muerto_dead_bug.mp4',
        'areas': ['Neurorehabilitación', 'Traumatología', 'Rehabilitación General'],
    },
    {
        'nombre': 'Plancha Lateral Modificada sobre Rodillas',
        'descripcion': (
            'Posición inicial: acostado de lado apoyado sobre el antebrazo (codo bajo el hombro) y con ambas rodillas '
            'flexionadas a 90 grados alineadas con el tronco. '
            'Ejecución: eleva la pelvis del suelo formando una línea recta desde la cabeza hasta las rodillas y mantén '
            'la estabilidad lateral del tronco sin rotar. '
            'Ritmo y respiración: sostén de 15 a 25 segundos con respiración diafragmática continua y cambia de lado. '
            'Precaución postural: empuja activamente el suelo con el antebrazo para evitar que el hombro colapse.'
        ),
        'zona_corporal': 'Core / Lumbar',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/plancha_lateral_rodillas.mp4',
        'areas': ['Traumatología', 'Rehabilitación General', 'Inmunología / VIH-SIDA'],
    },
    {
        'nombre': 'Disociación Lumbopélvica en Sedestación sobre Balón',
        'descripcion': (
            'Posición inicial: sentado en el centro de un balón terapéutico (fitball) con pies separados al ancho de hombros '
            'y rodillas a 90 grados. '
            'Ejecución: realiza movimientos lentos de anteversión y retroversión pélvica, seguidos de inclinaciones laterales '
            'de la pelvis manteniendo la parte superior del tronco estable. '
            'Ritmo y respiración: 3 segundos por fase de movimiento acompañando con respiración fluida y continua. '
            'Precaución postural: mantén ambos pies firmes en el suelo y evita compensar el equilibrio con los hombros.'
        ),
        'zona_corporal': 'Core / Lumbar',
        'dificultad': 'Avanzado',
        'video': 'videos_ejercicios/disociacion_lumbopelvica_balon.mp4',
        'areas': ['Neurorehabilitación', 'Rehabilitación General'],
    },

    # =========================================================================
    # 7. CADERA / GLÚTEOS
    # =========================================================================
    {
        'nombre': 'Puente Glúteo Supino (Glute Bridge)',
        'descripcion': (
            'Posición inicial: acostado boca arriba con rodillas flexionadas, pies apoyados al ancho de caderas y brazos '
            'a los costados con palmas hacia el suelo. '
            'Ejecución: presiona los talones contra la superficie y contrae los glúteos para elevar la pelvis hasta '
            'alinear rodillas, caderas y hombros; desciende vértebra por vértebra. '
            'Ritmo y respiración: exhala al subir en 2 segundos, sostén 2 segundos arriba e inhala al bajar en 3 segundos. '
            'Precaución postural: evita hiperextender la espalda baja empujando con el abdomen en lugar de los glúteos.'
        ),
        'zona_corporal': 'Cadera / Glúteos',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/puente_gluteo_supino.mp4',
        'areas': ['Rehabilitación General', 'Traumatología', 'Post-Operatorio', 'Adulto Mayor / Geriatría'],
    },
    {
        'nombre': 'Abducción de Cadera en Bipedestación con Apoyo',
        'descripcion': (
            'Posición inicial: de pie detrás de una silla firme o mesón, sujetando el respaldo suavemente con ambas manos. '
            'Ejecución: manteniendo la rodilla extendida y el pie apuntando hacia adelante, separa una pierna lateralmente '
            'unos 30 a 40 grados sin inclinar el tronco y regresa con control. '
            'Ritmo y respiración: exhala al abrir la pierna en 2 segundos e inhala al regresar en 3 segundos. '
            'Precaución postural: no inclines el torso hacia el lado contrario ni gires la punta del pie hacia afuera.'
        ),
        'zona_corporal': 'Cadera / Glúteos',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/abduccion_cadera_bipedestacion.mp4',
        'areas': ['Adulto Mayor / Geriatría', 'Post-Operatorio', 'Inmunología / VIH-SIDA'],
    },
    {
        'nombre': 'Desplazamiento Lateral con Banda (Monster Walk)',
        'descripcion': (
            'Posición inicial: de pie con una banda elástica circular alrededor de los muslos (sobre las rodillas) '
            'y en ligera semiflexión de cadera y rodillas (mini-sentadilla). '
            'Ejecución: da un paso lateral controlado manteniendo la tensión constante de la banda y acompaña con el otro pie '
            'sin juntarlos completamente; completa la serie hacia ambos lados. '
            'Ritmo y respiración: pasos lentos de 2 segundos cada uno manteniendo respiración rítmica constante. '
            'Precaución postural: evita que las rodillas colapsen hacia adentro (valgo) durante cada paso.'
        ),
        'zona_corporal': 'Cadera / Glúteos',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/desplazamiento_lateral_monster_walk.mp4',
        'areas': ['Traumatología', 'Neurorehabilitación', 'Rehabilitación General'],
    },
    {
        'nombre': 'Puente Glúteo Unilateral (Single-Leg Glute Bridge)',
        'descripcion': (
            'Posición inicial: acostado boca arriba con una pierna flexionada con el pie apoyado y la otra pierna '
            'extendida en el aire alineada con el muslo contrario. '
            'Ejecución: empuja con el talón de la pierna de apoyo elevando la pelvis de forma simétrica hasta alinear '
            'el tronco y desciende lentamente sin dejar caer un lado de la cadera. '
            'Ritmo y respiración: exhala al elevar en 2 segundos, pausa 1 segundo arriba e inhala al descender en 3 segundos. '
            'Precaución postural: mantén ambas crestas ilíacas niveladas evitando que la pelvis rote hacia la pierna libre.'
        ),
        'zona_corporal': 'Cadera / Glúteos',
        'dificultad': 'Avanzado',
        'video': 'videos_ejercicios/puente_gluteo_unilateral.mp4',
        'areas': ['Traumatología', 'Neurorehabilitación'],
    },

    # =========================================================================
    # 8. PIERNAS / RODILLA
    # =========================================================================
    {
        'nombre': 'Activación Isométrica de Cuádriceps (Quad Sets)',
        'descripcion': (
            'Posición inicial: sentado o acostado con las piernas extendidas y una toalla enrollada pequeña bajo la rodilla afectada. '
            'Ejecución: contrae firmemente el muslo anterior presionando la parte posterior de la rodilla contra la toalla '
            'mientras llevas los dedos del pie hacia ti. '
            'Ritmo y respiración: mantén la contracción isométrica durante 6 segundos exhalando lento y relaja 4 segundos. '
            'Precaución postural: mantén el talón en contacto con la superficie y la espalda apoyada sin tensión.'
        ),
        'zona_corporal': 'Piernas / Rodilla',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/isometrico_cuadriceps_quad_sets.mp4',
        'areas': ['Post-Operatorio', 'Traumatología', 'Adulto Mayor / Geriatría'],
    },
    {
        'nombre': 'Deslizamiento de Talón en Supino (Heel Slides)',
        'descripcion': (
            'Posición inicial: acostado boca arriba con ambas piernas extendidas sobre una superficie lisa (puedes usar un calcetín). '
            'Ejecución: desliza lentamente el talón hacia los glúteos flexionando la rodilla y la cadera hasta alcanzar '
            'una flexión cómoda sin dolor agudo, y desliza de regreso a la extensión. '
            'Ritmo y respiración: inhala al deslizar en flexión (3 segundos), sostén 2 segundos y exhala al extender (3 segundos). '
            'Precaución postural: mantén la pelvis apoyada en el suelo y la rodilla alineada con el segundo dedo del pie.'
        ),
        'zona_corporal': 'Piernas / Rodilla',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/deslizamiento_talon_heel_slides.mp4',
        'areas': ['Post-Operatorio', 'Traumatología', 'Rehabilitación General'],
    },
    {
        'nombre': 'Transferencia Sedente a Bípedo (Sit-to-Stand)',
        'descripcion': (
            'Posición inicial: sentado en el borde anterior de una silla estable con pies separados al ancho de hombros '
            'y ligeramente retrasados bajo las rodillas. '
            'Ejecución: inclina el tronco levemente hacia adelante, empuja con ambos pies hasta ponerte completamente de pie '
            'y vuelve a sentarte despacio controlando el descenso sin dejarte caer. '
            'Ritmo y respiración: exhala al ponerte de pie en 2 segundos e inhala al descender hacia la silla en 3 segundos. '
            'Precaución postural: mantén las rodillas separadas alineadas con los pies evitando que se junten al levantarte.'
        ),
        'zona_corporal': 'Piernas / Rodilla',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/transferencia_sedente_bipedo.mp4',
        'areas': ['Adulto Mayor / Geriatría', 'Inmunología / VIH-SIDA', 'Cardiorrespiratorio', 'Neurorehabilitación'],
    },
    {
        'nombre': 'Sentadilla Isométrica en Pared (Wall Sit)',
        'descripcion': (
            'Posición inicial: de pie con la espalda y la cabeza apoyadas contra una pared lisa y pies adelantados unos 50 cm. '
            'Ejecución: desliza la espalda hacia abajo flexionando caderas y rodillas hasta alcanzar entre 45 y 75 grados '
            'de flexión, manteniendo las tibias verticales y los muslos activos. '
            'Ritmo y respiración: sostén la posición de 20 a 40 segundos manteniendo una respiración nasal lenta y profunda. '
            'Precaución postural: asegúrate de que las rodillas queden directamente sobre los tobillos sin sobrepasar los dedos.'
        ),
        'zona_corporal': 'Piernas / Rodilla',
        'dificultad': 'Avanzado',
        'video': 'videos_ejercicios/sentadilla_isometrica_pared.mp4',
        'areas': ['Traumatología', 'Inmunología / VIH-SIDA', 'Rehabilitación General'],
    },

    # =========================================================================
    # 9. TOBILLO / PIE
    # =========================================================================
    {
        'nombre': 'Bombeo Tibiotarsiano (Ankle Pumps)',
        'descripcion': (
            'Posición inicial: acostado boca arriba o sentado con las piernas extendidas y los tobillos libres. '
            'Ejecución: lleva activamente la punta de ambos pies hacia las espinillas (dorsiflexión) y luego empújalas '
            'hacia adelante como presionando un pedal (flexión plantar) en todo el rango disponible. '
            'Ritmo y respiración: movimiento rítmico y continuo de 2 segundos por dirección mientras respiras pausadamente. '
            'Precaución postural: realiza el movimiento exclusivamente desde los tobillos manteniendo las rodillas relajadas.'
        ),
        'zona_corporal': 'Tobillo / Pie',
        'dificultad': 'Básico',
        'video': 'videos_ejercicios/bombeo_tibiotarsiano_ankle_pumps.mp4',
        'areas': ['Post-Operatorio', 'Cardiorrespiratorio', 'Adulto Mayor / Geriatría', 'Inmunología / VIH-SIDA'],
    },
    {
        'nombre': 'Elevación de Talones en Bipedestación (Heel Raises)',
        'descripcion': (
            'Posición inicial: de pie frente a una pared o respaldo de silla apoyando suavemente las yemas de los dedos '
            'para mantener el equilibrio, con los pies separados al ancho de caderas. '
            'Ejecución: eleva ambos talones del suelo subiendo sobre la base de los dedos y desciende con lentitud '
            'hasta apoyar los talones completamente. '
            'Ritmo y respiración: exhala al elevar en 2 segundos, pausa 1 segundo arriba e inhala al bajar en 3 segundos. '
            'Precaución postural: distribuye el peso de forma uniforme entre el dedo gordo y el quinto metatarsiano sin volcar el tobillo.'
        ),
        'zona_corporal': 'Tobillo / Pie',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/elevacion_talones_bipedestacion.mp4',
        'areas': ['Adulto Mayor / Geriatría', 'Traumatología', 'Inmunología / VIH-SIDA'],
    },
    {
        'nombre': 'Equilibrio Unipodal Progresivo (Apoyo Monopodal)',
        'descripcion': (
            'Posición inicial: de pie cerca de una pared o silla de seguridad con la mirada fija en un punto estable al frente. '
            'Ejecución: levanta un pie unos centímetros del suelo flexionando ligeramente la rodilla y mantén el equilibrio '
            'sobre la pierna de apoyo activando la musculatura intrínseca del pie y el glúteo medio. '
            'Ritmo y respiración: sostén de 15 a 30 segundos por pierna manteniendo una respiración tranquila y constante. '
            'Precaución postural: evita apoyar el pie elevado contra la pierna de soporte o inclinar el tronco lateralmente.'
        ),
        'zona_corporal': 'Tobillo / Pie',
        'dificultad': 'Intermedio',
        'video': 'videos_ejercicios/equilibrio_unipodal_progresivo.mp4',
        'areas': ['Neurorehabilitación', 'Adulto Mayor / Geriatría', 'Traumatología', 'Inmunología / VIH-SIDA'],
    },
    {
        'nombre': 'Marcha en Tándem (Talón-Punta)',
        'descripcion': (
            'Posición inicial: de pie junto a un pasillo o pared de referencia con postura erguida y mirada al frente. '
            'Ejecución: camina en línea recta colocando el talón del pie que avanza justo delante y en contacto con '
            'la punta de los dedos del pie trasero en cada paso. '
            'Ritmo y respiración: avanza lentamente dando 8 a 10 pasos controlados con pausa de 1 segundo por apoyo. '
            'Precaución postural: mantén los brazos relajados a los costados y la vista al horizonte (sin mirar el suelo).'
        ),
        'zona_corporal': 'Tobillo / Pie',
        'dificultad': 'Avanzado',
        'video': 'videos_ejercicios/marcha_tandem_talon_punta.mp4',
        'areas': ['Neurorehabilitación', 'Adulto Mayor / Geriatría', 'Inmunología / VIH-SIDA'],
    },
]


class Command(BaseCommand):
    help = 'Pobla o actualiza las áreas clínicas y el catálogo de ejercicios terapéuticos en KineConnect.'

    @transaction.atomic
    def handle(self, *args, **options):
        campos_ejercicio = {f.name: f for f in Ejercicio._meta.get_fields()}

        # 1. Detectar campo de nombre y descripción en Ejercicio
        campo_nombre_ej = 'nombre' if 'nombre' in campos_ejercicio else 'titulo'
        campo_desc_ej = 'descripcion' if 'descripcion' in campos_ejercicio else None

        # 2. Detectar campo de zona anatómica (zona_cuerpo, grupo_muscular, zona_corporal, etc.)
        campo_zona_ej = next(
            (
                c for c in ('zona_cuerpo', 'grupo_muscular', 'zona_corporal', 'zona', 'region_corporal')
                if c in campos_ejercicio
            ),
            None,
        )
        es_zona_fk = False
        if campo_zona_ej:
            zona_field = campos_ejercicio[campo_zona_ej]
            es_zona_fk = isinstance(zona_field, models.ForeignKey)
            if es_zona_fk:
                ZonaModel = zona_field.related_model
                campo_nombre_zona = next(
                    (f.name for f in ZonaModel._meta.fields if f.name in ('nombre', 'name', 'titulo')),
                    'nombre',
                )

        # 3. Detectar campo opcional de dificultad y video
        campo_dificultad_ej = next(
            (c for c in ('dificultad', 'nivel', 'nivel_dificultad') if c in campos_ejercicio),
            None,
        )
        campo_video_ej = next(
            (c for c in ('video', 'archivo_video', 'video_url') if c in campos_ejercicio),
            None,
        )

        # 4. Detectar campo relacional de áreas clínicas
        m2m_fields = [f for f in Ejercicio._meta.get_fields() if f.many_to_many]
        fk_fields = [
            f for f in Ejercicio._meta.get_fields()
            if isinstance(f, models.ForeignKey)
            and any(k in f.name.lower() for k in ('area', 'condicion', 'categoria', 'especialidad'))
        ]

        if m2m_fields:
            area_field = next(
                (
                    f for f in m2m_fields
                    if any(
                        k in f.name.lower() or k in f.related_model.__name__.lower()
                        for k in ('area', 'condicion', 'categoria', 'clinica', 'especialidad')
                    )
                ),
                m2m_fields[0],
            )
            es_m2m = True
        elif fk_fields:
            area_field = fk_fields[0]
            es_m2m = False
        else:
            raise CommandError(
                f"No se encontró relación de áreas en Ejercicio. Campos: {list(campos_ejercicio.keys())}"
            )

        AreaModel = area_field.related_model
        campo_nombre_area = next(
            (f.name for f in AreaModel._meta.fields if f.name in ('nombre', 'name', 'titulo')),
            None,
        )
        if not campo_nombre_area:
            raise CommandError(
                f"No se encontró campo de nombre en {AreaModel.__name__}: "
                f"{[f.name for f in AreaModel._meta.fields]}"
            )

        # 5. Asegurar las 7 áreas clínicas en la base de datos
        areas_map = {}
        for nombre_area in AREAS_CLINICAS:
            area_obj, _ = AreaModel.objects.get_or_create(**{campo_nombre_area: nombre_area})
            areas_map[nombre_area] = area_obj

        # 6. Poblar o actualizar ejercicios
        creados = 0
        actualizados = 0

        for item in ejercicios_data:
            defaults = {}

            if campo_desc_ej:
                defaults[campo_desc_ej] = item['descripcion']

            if campo_zona_ej:
                if es_zona_fk:
                    zona_val, _ = ZonaModel.objects.get_or_create(
                        **{campo_nombre_zona: item['zona_corporal']}
                    )
                else:
                    zona_val = item['zona_corporal']
                defaults[campo_zona_ej] = zona_val

            if campo_dificultad_ej:
                defaults[campo_dificultad_ej] = item['dificultad']

            if campo_video_ej:
                ruta_relativa = item.get('video', '')
                ruta_fisica = os.path.join(settings.MEDIA_ROOT, ruta_relativa) if ruta_relativa else ''
                if ruta_relativa in VIDEOS_CONFIRMADOS or (ruta_fisica and os.path.exists(ruta_fisica)):
                    defaults[campo_video_ej] = ruta_relativa
                else:
                    defaults[campo_video_ej] = ''

            if not es_m2m:
                defaults[area_field.name] = areas_map[item['areas'][0]]

            ejercicio, creado = Ejercicio.objects.update_or_create(
                **{campo_nombre_ej: item['nombre']},
                defaults=defaults,
            )

            if es_m2m:
                accessor = area_field.get_accessor_name() if area_field.auto_created else area_field.name
                getattr(ejercicio, accessor).set([areas_map[a] for a in item['areas']])

            if creado:
                creados += 1
            else:
                actualizados += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Catálogo cargado ({campo_zona_ej} | {area_field.name} -> {AreaModel.__name__}): '
                f'{creados} creados, {actualizados} actualizados.'
            )
        )
# =====================================================================
        # 7. PACIENTES Y CASOS CLÍNICOS REALISTAS PARA DEMOSTRACIÓN
        # =====================================================================
        from django.contrib.auth.models import User
        from django.utils import timezone
        from datetime import timedelta
        from api.models import Perfil, Pauta, PautaEjercicio, RegistroFeedback

        kine_demo = (
            User.objects.filter(perfil__rol='KINE').first()
            or User.objects.filter(is_superuser=True).first()
        )

        if kine_demo:
            # Caso 1: Camila Valdés (Paciente con alerta de dolor EVA 8/10 lista para ajuste)
            camila, _ = User.objects.get_or_create(
                username='194528103',
                defaults={
                    'first_name': 'Camila',
                    'last_name': 'Valdés Rojas',
                    'email': 'camila.valdes.demo@kineconnect.cl',
                },
            )
            camila.set_password('Kine2026')
            camila.save()
            Perfil.objects.update_or_create(
                user=camila,
                defaults={'rut': '19452810-3', 'rol': 'PACIENTE', 'kinesiologo_asignado': kine_demo},
            )

            pauta_camila, _ = Pauta.objects.update_or_create(
                paciente=camila,
                titulo='Rehabilitación Lumbar — Fase 1',
                defaults={
                    'kinesiologo': kine_demo,
                    'activo': True,
                    'es_plantilla': False,
                    'notas': 'Ejecutar 3 veces por semana manteniendo columna neutra. Detener si EVA ≥ 6.',
                },
            )
            PautaEjercicio.objects.filter(pauta=pauta_camila).delete()
            ej_bird = Ejercicio.objects.filter(nombre__icontains='Bird Dog').first()
            ej_puente = Ejercicio.objects.filter(nombre__icontains='Puente Glúteo').first()
            if ej_bird:
                PautaEjercicio.objects.create(
                    pauta=pauta_camila, ejercicio=ej_bird, series=3, repeticiones=10, tiempo_descanso_segundos=60
                )
            if ej_puente:
                PautaEjercicio.objects.create(
                    pauta=pauta_camila, ejercicio=ej_puente, series=3, repeticiones=12, tiempo_descanso_segundos=45
                )

            RegistroFeedback.objects.filter(pauta=pauta_camila).delete()
            fb1 = RegistroFeedback.objects.create(
                pauta=pauta_camila,
                completado=True,
                nivel_dolor=4,
                comentario='Leve tensión lumbar al finalizar la última serie.',
            )
            RegistroFeedback.objects.filter(id=fb1.id).update(fecha_ejecucion=timezone.now() - timedelta(days=2))

            RegistroFeedback.objects.create(
                pauta=pauta_camila,
                completado=True,
                nivel_dolor=8,
                comentario='Dolor agudo en zona lumbar baja durante Bird Dog.',
            )

            # Caso 2: Matías Contreras (Ciclo 3/3 completado — Modo Solo Consulta y PDF)
            matias_pac, _ = User.objects.get_or_create(
                username='16834920K',
                defaults={
                    'first_name': 'Matías',
                    'last_name': 'Contreras Silva',
                    'email': 'matias.contreras.demo@kineconnect.cl',
                },
            )
            matias_pac.set_password('Kine2026')
            matias_pac.save()
            Perfil.objects.update_or_create(
                user=matias_pac,
                defaults={'rut': '16834920-K', 'rol': 'PACIENTE', 'kinesiologo_asignado': kine_demo},
            )

            pauta_matias, _ = Pauta.objects.update_or_create(
                paciente=matias_pac,
                titulo='Estabilización de Cadera y Tobillo',
                defaults={
                    'kinesiologo': kine_demo,
                    'activo': True,
                    'es_plantilla': False,
                    'notas': 'Controlar alineación de pelvis en Clamshell y movilidad completa de tobillo.',
                },
            )
            PautaEjercicio.objects.filter(pauta=pauta_matias).delete()
            ej_clam = Ejercicio.objects.filter(nombre__icontains='Clamshell').first()
            ej_tob = Ejercicio.objects.filter(nombre__icontains='Abecedario').first()
            if ej_clam:
                PautaEjercicio.objects.create(
                    pauta=pauta_matias, ejercicio=ej_clam, series=3, repeticiones=12, tiempo_descanso_segundos=45
                )
            if ej_tob:
                PautaEjercicio.objects.create(
                    pauta=pauta_matias, ejercicio=ej_tob, series=2, repeticiones=10, tiempo_descanso_segundos=30
                )

            RegistroFeedback.objects.filter(pauta=pauta_matias).delete()
            for idx, dolor in enumerate([3, 2, 1]):
                fb = RegistroFeedback.objects.create(
                    pauta=pauta_matias,
                    completado=True,
                    nivel_dolor=dolor,
                    comentario=f'Sesión {idx + 1} completada con buena tolerancia.',
                )
                RegistroFeedback.objects.filter(id=fb.id).update(
                    fecha_ejecucion=timezone.now() - timedelta(days=(4 - idx * 2))
                )