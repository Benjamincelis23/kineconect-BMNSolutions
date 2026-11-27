import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import EvaModal from '../components/EvaModal';
import Skeleton from '../components/Skeleton';
import { API_URL } from '../constants/config';
import api from '../services/api';
import { cacheGet, cacheSet, enviarFeedback } from '../services/offline';

/* ───────────── Helpers ───────────── */

function norm(txt) {
  return String(txt ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function humanizarLenguajePaciente(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/\boccipucio\b/gi, 'nuca')
    .replace(/\ben sedente\b/gi, 'sentado')
    .replace(/\bsedente\b/gi, 'sentado')
    .replace(/\ben supino\b/gi, 'acostado boca arriba')
    .replace(/\bdecúbito supino\b/gi, 'acostado boca arriba')
    .replace(/\bdecúbito prono\b/gi, 'acostado boca abajo')
    .replace(/\bdecúbito lateral\b/gi, 'acostado de lado')
    .replace(/\besternocleidomastoideo\b/gi, 'músculos laterales del cuello')
    .replace(/\bmetacarpofalángica\b/gi, 'de los nudillos');
}

function formatearFechaHora(isoStr) {
  if (!isoStr) return '';
  const fecha = new Date(isoStr);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function capitalizarNombre(texto) {
  if (!texto || typeof texto !== 'string') return '';
  const limpio = texto.trim();
  if (!limpio) return '';
  return limpio
    .split(/\s+/)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

function resolverAutorKinesiologo(pauta, respuestaItem = null) {
  const nombrePaciente = norm(pauta?.paciente_nombre);
  const candidatos = [respuestaItem?.kinesiologo_nombre, pauta?.kinesiologo_nombre];
  for (const cand of candidatos) {
    const limpio = capitalizarNombre(cand);
    if (limpio && norm(limpio) !== 'kineconnect' && (!nombrePaciente || norm(limpio) !== nombrePaciente)) {
      return limpio;
    }
  }
  return 'tu Kinesiólogo';
}

function ordenarRespuestasRecientes(items = []) {
  return [...items].sort((a, b) => {
    const tA = new Date(a?.fecha_respuesta || a?.fecha_ejecucion || 0).getTime();
    const tB = new Date(b?.fecha_respuesta || b?.fecha_ejecucion || 0).getTime();
    return (Number.isNaN(tB) ? 0 : tB) - (Number.isNaN(tA) ? 0 : tA);
  });
}

function resolverMediaUrl(item, extra = {}) {
  const ej = item?.ejercicio && typeof item.ejercicio === 'object' ? item.ejercicio : {};
  const raw =
    item?.media_url ||
    item?.video ||
    item?.video_url ||
    ej?.media_url ||
    ej?.video ||
    ej?.video_url ||
    extra?.video ||
    extra?.media_url ||
    '';

  if (!raw || typeof raw !== 'string') return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const base = API_URL.replace(/\/+$/, '');
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function obtenerDescansoPorIntensidad(item, extra = {}) {
  const ej = item?.ejercicio && typeof item.ejercicio === 'object' ? item.ejercicio : {};
  const dificultadRaw = item?.dificultad || ej?.dificultad || extra?.dificultad || 'Básico';
  const dif = norm(dificultadRaw);

  let recomendado = 30;
  if (dif.includes('avanzad')) recomendado = 60;
  else if (dif.includes('intermedi')) recomendado = 45;

  const prescrito = Number(item?.tiempo_descanso_segundos ?? item?.descanso_seg ?? 0);
  const segundos = Number.isFinite(prescrito) && prescrito > 0 ? prescrito : recomendado;

  return { segundos, dificultad: dificultadRaw };
}

function parsearPasosClinicos(descripcion) {
  if (!descripcion) return [];
  const claves = ['Posición inicial:', 'Ejecución:', 'Ritmo y respiración:', 'Precaución postural:'];
  const texto = humanizarLenguajePaciente(String(descripcion));
  const bloques = [];

  claves.forEach((clave, idx) => {
    const pos = texto.indexOf(clave);
    if (pos === -1) return;
    let fin = texto.length;
    for (let j = idx + 1; j < claves.length; j++) {
      const nextPos = texto.indexOf(claves[j]);
      if (nextPos !== -1 && nextPos < fin) fin = nextPos;
    }
    const contenido = texto.slice(pos + clave.length, fin).trim();
    if (contenido) {
      bloques.push({ titulo: clave.replace(':', ''), contenido });
    }
  });

  if (bloques.length === 0 && texto.trim()) {
    bloques.push({ titulo: 'Cómo realizarlo', contenido: texto.trim() });
  }
  return bloques;
}

function iconoPaso(titulo) {
  const t = norm(titulo);
  if (t.includes('posicion')) return 'human-handsdown';
  if (t.includes('ejecucion')) return 'play-circle-outline';
  if (t.includes('ritmo')) return 'lungs';
  if (t.includes('precaucion')) return 'alert-outline';
  return 'information-outline';
}

function minutosEstimados(ejercicios) {
  const segs = ejercicios.reduce((acc, ej) => {
    const porSerie = ej.unidad === 'SEG' ? ej.repeticiones : ej.repeticiones * 3;
    return acc + ej.series * porSerie + Math.max(0, ej.series - 1) * ej.descanso;
  }, 0);
  return Math.max(1, Math.round(segs / 60));
}

async function fetchTodosLosEjercicios() {
  const rutas = ['/api/ejercicios/', '/api/v1/ejercicios/'];
  for (const ruta of rutas) {
    try {
      const res = await api.get(ruta);
      const data = res?.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) {
        const acumulados = [...data.results];
        let nextUrl = data.next;
        let guard = 0;
        while (nextUrl && guard < 10) {
          guard++;
          const segura = nextUrl.replace(/^http:\/\//i, 'https://');
          const pag = await api.get(segura);
          if (pag?.data && Array.isArray(pag.data.results)) {
            acumulados.push(...pag.data.results);
            nextUrl = pag.data.next;
          } else {
            break;
          }
        }
        return acumulados;
      }
    } catch {
      // Intenta la siguiente ruta disponible
    }
  }
  return [];
}

function VideoMedia({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />;
}

/* ───────────── Pantalla ───────────── */

export default function PautaDetailScreen({ route, navigation }) {
  const {
    id,
    pautaInicial = null,
    soloConsulta: soloConsultaParam = false,
    bloqueadaHoy: bloqueadaHoyParam = false,
  } = route.params;
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();

  const c = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    surface: isDark ? '#172033' : '#FFFFFF',
    surfaceSoft: isDark ? '#0B1220' : '#F1F5F9',
    border: isDark ? '#2A3A52' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textSub: isDark ? '#CBD5E1' : '#475569',
    accentBg: isDark ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE',
    accentText: isDark ? '#BAE6FD' : '#0369A1',
    primary: isDark ? '#38BDF8' : '#0284C7',
    success: '#10B981',
    successBg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#D1FAE5',
    warning: '#F59E0B',
    warningBg: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7',
    danger: isDark ? '#FCA5A5' : '#DC2626',
    dangerBg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
    dangerBorder: isDark ? 'rgba(239, 68, 68, 0.6)' : '#FCA5A5',
  };

  const sombra = {
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.35 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };

  const scrollRef = useRef(null);

  const [pauta, setPauta] = useState(pautaInicial);
  const [catalogoMap, setCatalogoMap] = useState({});
  const [respuestasPauta, setRespuestasPauta] = useState([]);
  const [error, setError] = useState(false);
  const [metaCumplidaApi, setMetaCumplidaApi] = useState(Boolean(soloConsultaParam));
  const [completadaHoyApi, setCompletadaHoyApi] = useState(
    Boolean(bloqueadaHoyParam) || Boolean(pautaInicial?.completada_hoy),
  );

  const [seriesHechas, setSeriesHechas] = useState({});
  const [modoGuiado, setModoGuiado] = useState(false);
  const [indiceActual, setIndiceActual] = useState(0);
  const [textoGrande, setTextoGrande] = useState(false);

  // Temporizador de descanso entre series
  const [descansoRestante, setDescansoRestante] = useState(null);
  const [descansoTotal, setDescansoTotal] = useState(0);

  // Temporizador activo de ejecución para ejercicios prescritos por tiempo (SEG)
  const [tiempoEjecucionRestante, setTiempoEjecucionRestante] = useState(null);
  const [ejecucionTotal, setEjecucionTotal] = useState(0);
  const [ejecucionPausada, setEjecucionPausada] = useState(false);

  // Modal de cierre / emergencia
  const [evaOpen, setEvaOpen] = useState(false);
  const [detencionPorDolor, setDetencionPorDolor] = useState(false);
  const [sending, setSending] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    try {
      const [resPauta, listaEj, resMe, resFb] = await Promise.all([
        api.get(`/api/pautas/${id}/`),
        fetchTodosLosEjercicios(),
        api.get('/api/me/').catch(() => null),
        api.get(`/api/v1/feedback/?pauta=${id}`).catch(() => ({ data: [] })),
      ]);

      setPauta(resPauta.data);
      cacheSet(`pauta_${id}`, resPauta.data);

      const rawFb = resFb?.data?.results ?? resFb?.data ?? [];
      const filtradas = Array.isArray(rawFb)
        ? ordenarRespuestasRecientes(
            rawFb.filter(
              (item) =>
                Number(item?.pauta) === Number(id) &&
                item?.respuesta_kinesiologo &&
                String(item.respuesta_kinesiologo).trim().length > 0,
            ),
          )
        : [];
      setRespuestasPauta(filtradas);
      cacheSet(`pauta_feedback_${id}`, filtradas);

      if (resPauta?.data) {
        if (resPauta.data.completada_hoy != null) {
          setCompletadaHoyApi(Boolean(resPauta.data.completada_hoy));
        }
        if (resPauta.data.sesiones_semana != null) {
          const metaP = Math.max(1, Number(resPauta.data.frecuencia_semanal || resPauta.data.meta_semanal || 3));
          setMetaCumplidaApi(Number(resPauta.data.sesiones_semana) >= metaP);
        }
      } else if (resMe?.data) {
        const meta = Math.max(1, Number(resMe.data.meta_semanal || 3));
        const sem = Number(resMe.data.sesiones_semana || 0);
        setMetaCumplidaApi(sem >= meta);
      }

      if (listaEj.length > 0) {
        const mapa = {};
        listaEj.forEach((ej) => {
          if (ej.id) mapa[`id_${ej.id}`] = ej;
          if (ej.nombre) mapa[`nom_${norm(ej.nombre)}`] = ej;
        });
        setCatalogoMap(mapa);
        cacheSet('catalogo_ejercicios_map_v2', mapa);
      } else {
        const cachedMap = await cacheGet('catalogo_ejercicios_map_v2');
        if (cachedMap) setCatalogoMap(cachedMap);
      }
    } catch {
      const [cachedPauta, cachedMap, cachedFb, homeCache] = await Promise.all([
        cacheGet(`pauta_${id}`),
        cacheGet('catalogo_ejercicios_map_v2'),
        cacheGet(`pauta_feedback_${id}`),
        cacheGet('home'),
      ]);
      if (cachedMap) setCatalogoMap(cachedMap);
      if (Array.isArray(cachedFb)) setRespuestasPauta(ordenarRespuestasRecientes(cachedFb));

      const pautaDesdeHome = Array.isArray(homeCache?.pautas)
        ? homeCache.pautas.find((item) => Number(item?.id) === Number(id))
        : null;
      const respaldo = cachedPauta || pautaInicial || pautaDesdeHome;

      if (respaldo) {
        setPauta(respaldo);
        if (respaldo.completada_hoy) setCompletadaHoyApi(true);
      } else {
        setError(true);
      }
    }
  }, [id, pautaInicial]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejercicios = useMemo(() => {
    const rawList = pauta?.ejercicios_detalle || pauta?.ejercicios || [];
    return rawList.map((item, idx) => {
      const ejObj = item.ejercicio && typeof item.ejercicio === 'object' ? item.ejercicio : {};
      const ejId = typeof item.ejercicio === 'number' ? item.ejercicio : item.ejercicio_id || ejObj.id;
      const nombre = item.nombre || item.ejercicio_nombre || ejObj.nombre || 'Ejercicio terapéutico';

      const extra = (ejId && catalogoMap[`id_${ejId}`]) || catalogoMap[`nom_${norm(nombre)}`] || {};

      const series = Math.max(1, Number(item.series || 3));
      const repeticiones = Math.max(1, Number(item.repeticiones || 10));
      const unidad = String(item.unidad_medida || 'REPS').toUpperCase() === 'SEG' ? 'SEG' : 'REPS';
      const zona = item.zona_cuerpo || item.zona || ejObj.zona_cuerpo || extra.zona_cuerpo || 'General';
      const descripcion = item.descripcion || ejObj.descripcion || extra.descripcion || '';
      const mediaUrl = resolverMediaUrl(item, extra);
      const { segundos, dificultad } = obtenerDescansoPorIntensidad(item, extra);

      return {
        key: String(item.id ?? idx),
        nombre,
        series,
        repeticiones,
        unidad,
        zona,
        pasos: parsearPasosClinicos(descripcion),
        mediaUrl,
        descanso: segundos,
        dificultad,
      };
    });
  }, [pauta, catalogoMap]);

  // Efecto para temporizador de descanso
  useEffect(() => {
    if (descansoRestante === null) return;
    if (descansoRestante <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDescansoRestante(null);
      return;
    }
    const timer = setTimeout(() => setDescansoRestante((prev) => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [descansoRestante]);

  // Efecto para temporizador de ejecución por tiempo (SEG)
  useEffect(() => {
    if (tiempoEjecucionRestante === null || ejecucionPausada) return;
    if (tiempoEjecucionRestante <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTiempoEjecucionRestante(null);
      setEjecucionPausada(false);
      const ejActual = ejercicios[indiceActual];
      if (ejActual) {
        completarSiguienteSerie(ejActual);
      }
      return;
    }
    const timer = setTimeout(() => {
      setTiempoEjecucionRestante((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [tiempoEjecucionRestante, ejecucionPausada, ejercicios, indiceActual]);

  useEffect(() => {
    setTiempoEjecucionRestante(null);
    setEjecucionPausada(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [indiceActual, modoGuiado]);

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg, paddingBottom: insets.bottom }]}>
        <EmptyState icon="wifi-off" title="No pudimos cargar la pauta" onRetry={cargar} />
      </View>
    );
  }

  if (!pauta) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: 16, paddingBottom: Math.max(56, insets.bottom + 32) },
          ]}
        >
          <Skeleton height={90} />
          <Skeleton height={240} />
        </ScrollView>
      </View>
    );
  }

  const bloqueadaHastaManana = Boolean(bloqueadaHoyParam) || completadaHoyApi;
  const metaSemanalPauta = Math.max(1, Number(pauta?.frecuencia_semanal || pauta?.meta_semanal || 3));
  const esSoloConsulta = Boolean(soloConsultaParam) || metaCumplidaApi || bloqueadaHastaManana;

  const totalEjercicios = ejercicios.length;
  const totalSeries = ejercicios.reduce((acc, ej) => acc + ej.series, 0);
  const seriesCompletadas = ejercicios.reduce((acc, ej) => acc + (seriesHechas[ej.key]?.length || 0), 0);
  const ejerciciosCompletados = ejercicios.filter((ej) => (seriesHechas[ej.key]?.length || 0) >= ej.series).length;
  const rutinaCompleta = totalEjercicios > 0 && ejerciciosCompletados === totalEjercicios;
  const progresoGlobal = totalSeries > 0 ? seriesCompletadas / totalSeries : 0;

  const iniciarDescanso = (seg) => {
    setDescansoTotal(seg);
    setDescansoRestante(seg);
  };

  const iniciarCronometroEjercicio = (ej) => {
    if (esSoloConsulta) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEjecucionTotal(ej.repeticiones);
    setTiempoEjecucionRestante(ej.repeticiones);
    setEjecucionPausada(false);
  };

  function completarSiguienteSerie(ej) {
    if (esSoloConsulta) return;
    const actuales = seriesHechas[ej.key] || [];
    if (actuales.length >= ej.series) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const siguienteIdx = actuales.length;
    const nuevas = [...actuales, siguienteIdx];
    setSeriesHechas((prev) => ({ ...prev, [ej.key]: nuevas }));

    const esUltimaSerieFinal = nuevas.length >= ej.series && indiceActual === totalEjercicios - 1;
    if (!esUltimaSerieFinal && ej.descanso > 0) {
      iniciarDescanso(ej.descanso);
    }
    if (nuevas.length >= ej.series && indiceActual < totalEjercicios - 1) {
      setTimeout(() => {
        setIndiceActual((prev) => Math.min(totalEjercicios - 1, prev + 1));
      }, 450);
    }
  }

  const abrirEvaluacionNormal = () => {
    if (esSoloConsulta) return;
    setDescansoRestante(null);
    setTiempoEjecucionRestante(null);
    setDetencionPorDolor(false);
    setEvaOpen(true);
  };

  const abrirFlujoEmergenciaDolor = () => {
    if (esSoloConsulta) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDescansoRestante(null);
    setTiempoEjecucionRestante(null);
    setDetencionPorDolor(true);
    setEvaOpen(true);
  };

  const solicitarFinalizarRutina = () => {
    if (esSoloConsulta) return;
    if (seriesCompletadas === 0) {
      Alert.alert(
        'Aún no registras series',
        'Completa al menos una serie antes de finalizar la sesión, o usa el botón inferior si sentiste dolor agudo.',
      );
      return;
    }
    if (!rutinaCompleta) {
      const faltantes = totalSeries - seriesCompletadas;
      Alert.alert(
        'Tienes series pendientes',
        `Aún te faltan ${faltantes} ${faltantes === 1 ? 'serie' : 'series'} por completar. ¿Deseas finalizar la rutina de todas formas?`,
        [
          { text: 'Seguir entrenando', style: 'cancel' },
          { text: 'Finalizar igual', onPress: abrirEvaluacionNormal },
        ],
      );
      return;
    }
    abrirEvaluacionNormal();
  };

  const enviar = async (nivel, comentario) => {
    const evaNivel = Number(nivel);
    const esEmergencia = detencionPorDolor;
    const ejActual = ejercicios[indiceActual] || ejercicios[0];

    setSending(true);
    try {
      const resumen = `Series: ${seriesCompletadas}/${totalSeries} (${ejerciciosCompletados}/${totalEjercicios} ejercicios).`;
      const prefijoEmergencia =
        esEmergencia && ejActual
          ? `[DETENCIÓN POR DOLOR AGUDO en Ej. ${indiceActual + 1}: ${ejActual.nombre}] `
          : '';
      const cuerpoTexto = `${prefijoEmergencia}${(comentario || '').trim()}`.trim();
      const comentarioFinal = cuerpoTexto ? `${cuerpoTexto} | ${resumen}` : resumen;
      const sesionCompletadaFinal = esEmergencia ? false : rutinaCompleta;

      const estado = await enviarFeedback({
        pauta: pauta.id,
        nivel_dolor: evaNivel,
        comentario: comentarioFinal,
        completado: sesionCompletadaFinal,
      });

      setEvaOpen(false);
      setDetencionPorDolor(false);

      if (sesionCompletadaFinal) {
        setCompletadaHoyApi(true);
        cacheSet(`pauta_${id}`, { ...pauta, completada_hoy: true });
      }

      const estadoEnvioTexto =
        estado === 'enviado'
          ? 'Tu kinesiólogo ya recibió este reporte.'
          : 'Sin conexión: se enviará automáticamente en cuanto recuperes señal.';

      if (esEmergencia || evaNivel >= 7) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          `Sesión Detenida · Alerta Clínica (EVA ${evaNivel}/10)`,
          `Registramos la detención en "${ejActual?.nombre || 'tu ejercicio'}". ${estadoEnvioTexto}\n\nSuspende los ejercicios por hoy. Recuerda que KineConnect realiza seguimiento asincrónico y no reemplaza atención médica de urgencia 24/7.`,
          [{ text: 'Entendido', onPress: () => navigation.goBack() }],
        );
      } else if (evaNivel >= 6) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          `Dolor Elevado Registrado (EVA ${evaNivel}/10)`,
          `Se envió una alerta clínica para revisar la carga de tu pauta. ${estadoEnvioTexto}\n\nEvita forzar repeticiones adicionales hoy si persiste la molestia.`,
          [{ text: 'Entendido', onPress: () => navigation.goBack() }],
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          '¡Sesión registrada!',
          estado === 'enviado'
            ? 'Tu sesión diaria quedó completada. Podrás realizar la siguiente sesión mañana.'
            : 'Sin conexión: se enviará automáticamente cuando recuperes señal.',
          [{ text: 'Listo', onPress: () => navigation.goBack() }],
        );
      }
    } catch (err) {
      const data = err?.response?.data;
      let detalle = 'No se pudo registrar el feedback. Revisa tu conexión e inténtalo de nuevo.';
      if (typeof data === 'string' && data.trim() && !data.trim().startsWith('<')) {
        detalle = data.slice(0, 220);
      } else if (Array.isArray(data) && data[0]) {
        detalle = String(data[0]);
      } else if (data && typeof data === 'object') {
        const primerValor = data.detail || data.non_field_errors || Object.values(data)[0];
        if (Array.isArray(primerValor) && primerValor[0]) {
          detalle = String(primerValor[0]);
        } else if (typeof primerValor === 'string') {
          detalle = primerValor;
        }
      }
      Alert.alert('No se pudo enviar el reporte', detalle);
    } finally {
      setSending(false);
    }
  };

  const renderBannerSoloConsulta = () => {
    if (!esSoloConsulta) return null;

    if (bloqueadaHastaManana && !metaCumplidaApi) {
      return (
        <View style={[styles.readOnlyBanner, { backgroundColor: c.warningBg, borderColor: c.warning }]}>
          <MaterialCommunityIcons name="calendar-check-outline" size={21} color={c.warning} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.warning, fontSize: 13.5, fontWeight: '800' }}>
              Sesión de hoy completada · Disponible mañana
            </Text>
            <Text style={{ color: c.textSub, fontSize: 12.5, marginTop: 2, lineHeight: 18 }}>
              Ya cumpliste tu entrenamiento de hoy (meta: {metaSemanalPauta}{' '}
              {metaSemanalPauta === 1 ? 'vez' : 'veces'} por semana). Puedes repasar la técnica cuando quieras.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.readOnlyBanner, { backgroundColor: c.successBg, borderColor: c.success }]}>
        <MaterialCommunityIcons name="eye-check-outline" size={20} color={c.success} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.success, fontSize: 13.5, fontWeight: '800' }}>
            Modo repaso · Meta semanal cumplida ({metaSemanalPauta}/{metaSemanalPauta})
          </Text>
          <Text style={{ color: c.textSub, fontSize: 12.5, marginTop: 2, lineHeight: 18 }}>
            Puedes revisar las indicaciones y la técnica. El registro de nuevas sesiones queda pausado hasta tu próximo
            ciclo.
          </Text>
        </View>
      </View>
    );
  };

  /* ═════════ VISTA GUIADA ═════════ */
  if (modoGuiado && totalEjercicios > 0) {
    const ej = ejercicios[indiceActual] || ejercicios[0];
    const hechas = seriesHechas[ej.key] || [];
    const ejTerminado = hechas.length >= ej.series;
    const esPorTiempo = ej.unidad === 'SEG';
    const etiquetaUnidad = esPorTiempo ? 'Segundos' : 'Repeticiones';
    const sufijoUnidad = esPorTiempo ? 'seg' : 'reps';
    const textoBoton = isDark ? '#0F172A' : '#FFFFFF';

    // Escala tipográfica accesible (Adulto Mayor)
    const sizeTituloPaso = textoGrande ? 16.5 : 14.5;
    const sizeTextoPaso = textoGrande ? 17.5 : 15;
    const lineTextoPaso = textoGrande ? 26 : 22.5;

    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {/* Header sticky con selector de tamaño de letra A / A+ */}
        <View style={[styles.stickyHeader, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => {
                setDescansoRestante(null);
                setTiempoEjecucionRestante(null);
                setModoGuiado(false);
              }}
              style={[styles.pillBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color={c.primary} />
              <Text style={{ color: c.textMain, fontWeight: '700', fontSize: 13 }}>Lista</Text>
            </TouchableOpacity>

            <Text style={{ color: c.textMain, fontWeight: '800', fontSize: 13.5 }}>
              Ejercicio {indiceActual + 1} de {totalEjercicios}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setTextoGrande((prev) => !prev)}
                accessibilityLabel="Cambiar tamaño de letra"
                style={[
                  styles.pillBtn,
                  {
                    backgroundColor: textoGrande ? c.accentBg : c.surfaceSoft,
                    borderColor: textoGrande ? c.primary : c.border,
                    paddingHorizontal: 10,
                  },
                ]}
              >
                <Text style={{ color: textoGrande ? c.primary : c.textMain, fontWeight: '900', fontSize: 13 }}>
                  {textoGrande ? 'A+' : 'A'}
                </Text>
              </TouchableOpacity>

              <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>
                {esSoloConsulta ? 'Repaso' : `${Math.round(progresoGlobal * 100)}%`}
              </Text>
            </View>
          </View>

          {!esSoloConsulta && (
            <ProgressBar
              progress={progresoGlobal}
              color={rutinaCompleta ? c.success : c.primary}
              style={{ height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 8 }}
            />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.container, { paddingBottom: Math.max(56, insets.bottom + 32) }]}
        >
          {renderBannerSoloConsulta()}

          <View style={[styles.mainCard, sombra, { backgroundColor: c.surface, borderColor: c.border }]}>
            {/* 1. Título y dosificación */}
            <View style={{ padding: 18, paddingBottom: 14 }}>
              <View style={[styles.zonaChip, { backgroundColor: c.accentBg }]}>
                <MaterialCommunityIcons name="human" size={14} color={c.primary} />
                <Text style={{ color: c.primary, fontSize: 12.5, fontWeight: '700' }}>
                  {ej.zona} · Nivel {ej.dificultad}
                </Text>
              </View>

              <Text
                style={{
                  color: c.textMain,
                  fontSize: textoGrande ? 24 : 21.5,
                  fontWeight: '800',
                  marginTop: 10,
                  lineHeight: textoGrande ? 31 : 28,
                }}
              >
                {ej.nombre}
              </Text>

              <View style={[styles.metricsStrip, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 20, fontWeight: '900' }}>{ej.series}</Text>
                  <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '700' }}>Series</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: c.border }]} />
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 20, fontWeight: '900' }}>{ej.repeticiones}</Text>
                  <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '700' }}>{etiquetaUnidad}</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: c.border }]} />
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 20, fontWeight: '900' }}>{ej.descanso}s</Text>
                  <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '700' }}>Descanso</Text>
                </View>
              </View>
            </View>

            {/* 2. Video (solo si existe URL real) */}
            {!!ej.mediaUrl && <VideoMedia uri={ej.mediaUrl} />}

            {/* 3. Instrucciones arriba con tipografía de alto contraste */}
            <View style={[styles.stepsContainer, { borderTopWidth: 1, borderTopColor: c.border }]}>
              <Text style={{ color: c.textMain, fontWeight: '800', fontSize: textoGrande ? 18 : 16, marginBottom: 2 }}>
                Cómo realizar este ejercicio
              </Text>
              {ej.pasos.length > 0 ? (
                ej.pasos.map((p, i) => {
                  const esPrecaucion = norm(p.titulo).includes('precaucion');
                  return (
                    <View
                      key={i}
                      style={[
                        styles.stepRow,
                        esPrecaucion && {
                          backgroundColor: c.warningBg,
                          borderRadius: 12,
                          padding: 12,
                          marginHorizontal: -4,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.stepIcon,
                          { backgroundColor: esPrecaucion ? 'rgba(245, 158, 11, 0.2)' : c.accentBg },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={iconoPaso(p.titulo)}
                          size={18}
                          color={esPrecaucion ? c.warning : c.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: esPrecaucion ? c.warning : c.textMain,
                            fontWeight: '800',
                            fontSize: sizeTituloPaso,
                            marginBottom: 3,
                          }}
                        >
                          {p.titulo}
                        </Text>
                        <Text style={{ color: c.textMain, fontSize: sizeTextoPaso, lineHeight: lineTextoPaso }}>
                          {p.contenido}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: c.textSub, fontSize: sizeTextoPaso, lineHeight: lineTextoPaso }}>
                  Ejecuta el movimiento de forma lenta y controlada, sin dolor agudo.
                </Text>
              )}
            </View>

            {/* 4. Registro de series abajo (con cronómetro activo si es por tiempo SEG) */}
            {!esSoloConsulta && (
              <View style={[styles.seriesBlock, { backgroundColor: c.surfaceSoft, borderTopColor: c.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ color: c.textMain, fontWeight: '800', fontSize: 15.5 }}>Tus series</Text>
                  <Text style={{ color: ejTerminado ? c.success : c.primary, fontWeight: '800', fontSize: 13.5 }}>
                    {hechas.length} de {ej.series}
                  </Text>
                </View>

                <View style={styles.seriesDotsRow}>
                  {Array.from({ length: ej.series }).map((_, sIdx) => {
                    const done = hechas.includes(sIdx);
                    return (
                      <View
                        key={sIdx}
                        style={[
                          styles.serieDot,
                          {
                            backgroundColor: done ? c.successBg : c.surface,
                            borderColor: done ? c.success : c.border,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={done ? 'check-circle' : 'circle-outline'}
                          size={15}
                          color={done ? c.success : c.textSub}
                        />
                        <Text style={{ color: done ? c.success : c.textSub, fontWeight: '700', fontSize: 12.5 }}>
                          Serie {sIdx + 1}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {descansoRestante !== null ? (
                  <View style={[styles.restActionBox, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <MaterialCommunityIcons name="timer-sand" size={24} color={c.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.textMain, fontWeight: '800', fontSize: 16 }}>
                          Descanso · {descansoRestante}s
                        </Text>
                        <Text style={{ color: c.textSub, fontSize: 12.5, lineHeight: 17 }}>
                          Respira profundo antes de la siguiente serie
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setDescansoRestante(null)}
                        style={[styles.skipRestBtn, { backgroundColor: c.surface, borderColor: c.primary }]}
                      >
                        <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12.5 }}>Saltar</Text>
                      </TouchableOpacity>
                    </View>
                    <ProgressBar
                      progress={descansoTotal > 0 ? descansoRestante / descansoTotal : 0}
                      color={c.primary}
                      style={{ height: 5, borderRadius: 3, backgroundColor: c.border }}
                    />
                  </View>
                ) : tiempoEjecucionRestante !== null ? (
                  <View style={[styles.restActionBox, { backgroundColor: c.surface, borderColor: c.primary }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <MaterialCommunityIcons name="timer-outline" size={26} color={c.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.primary, fontWeight: '900', fontSize: 19 }}>
                          Mantén · {tiempoEjecucionRestante}s
                        </Text>
                        <Text style={{ color: c.textSub, fontSize: 12.5 }}>
                          Serie {hechas.length + 1} de {ej.series} ({ej.repeticiones} seg)
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setEjecucionPausada((prev) => !prev)}
                        style={[styles.skipRestBtn, { backgroundColor: c.accentBg, borderColor: c.primary }]}
                      >
                        <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12.5 }}>
                          {ejecucionPausada ? 'Reanudar' : 'Pausar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <ProgressBar
                      progress={ejecucionTotal > 0 ? (ejecucionTotal - tiempoEjecucionRestante) / ejecucionTotal : 0}
                      color={c.success}
                      style={{ height: 6, borderRadius: 3, backgroundColor: c.border }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setTiempoEjecucionRestante(null);
                        setEjecucionPausada(false);
                        completarSiguienteSerie(ej);
                      }}
                      style={{ alignSelf: 'flex-end', paddingTop: 2 }}
                    >
                      <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' }}>
                        Completar serie ahora
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : !ejTerminado ? (
                  esPorTiempo ? (
                    <View style={{ gap: 8 }}>
                      <Button
                        mode="contained"
                        icon="timer-play-outline"
                        onPress={() => iniciarCronometroEjercicio(ej)}
                        buttonColor={c.primary}
                        textColor={textoBoton}
                        style={{ borderRadius: 14 }}
                        contentStyle={{ paddingVertical: 6 }}
                        labelStyle={{ fontWeight: '800' }}
                      >
                        Iniciar serie {hechas.length + 1} ({ej.repeticiones} seg)
                      </Button>
                      <TouchableOpacity
                        onPress={() => completarSiguienteSerie(ej)}
                        style={{ alignSelf: 'center', paddingVertical: 4 }}
                      >
                        <Text style={{ color: c.textSub, fontSize: 12.5, fontWeight: '700' }}>
                          Ya la completé · Marcar serie lista
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Button
                      mode="contained"
                      icon="check"
                      onPress={() => completarSiguienteSerie(ej)}
                      buttonColor={c.primary}
                      textColor={textoBoton}
                      style={{ borderRadius: 14 }}
                      contentStyle={{ paddingVertical: 6 }}
                      labelStyle={{ fontWeight: '800' }}
                    >
                      Completar serie {hechas.length + 1} ({ej.repeticiones} {sufijoUnidad})
                    </Button>
                  )
                ) : (
                  <View style={[styles.doneBox, { backgroundColor: c.successBg, borderColor: c.success }]}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={c.success} />
                    <Text style={{ color: c.success, fontWeight: '800', fontSize: 14 }}>¡Ejercicio completado!</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Navegación entre ejercicios */}
          <View style={styles.footerNav}>
            <Button
              mode="outlined"
              disabled={indiceActual === 0}
              onPress={() => {
                setDescansoRestante(null);
                setIndiceActual((p) => Math.max(0, p - 1));
              }}
              style={{ flex: 1, borderRadius: 12, borderColor: c.border }}
              textColor={c.textMain}
            >
              Anterior
            </Button>

            {indiceActual < totalEjercicios - 1 ? (
              <Button
                mode={ejTerminado || esSoloConsulta ? 'contained' : 'outlined'}
                onPress={() => {
                  setDescansoRestante(null);
                  setIndiceActual((p) => Math.min(totalEjercicios - 1, p + 1));
                }}
                buttonColor={ejTerminado || esSoloConsulta ? c.primary : undefined}
                textColor={ejTerminado || esSoloConsulta ? textoBoton : c.textMain}
                style={{ flex: 1, borderRadius: 12, borderColor: c.border }}
              >
                Siguiente
              </Button>
            ) : esSoloConsulta ? (
              <Button
                mode="contained"
                onPress={() => setModoGuiado(false)}
                buttonColor={c.primary}
                textColor={textoBoton}
                style={{ flex: 1, borderRadius: 12 }}
              >
                Volver a la lista
              </Button>
            ) : (
              <Button
                mode={rutinaCompleta ? 'contained' : 'outlined'}
                disabled={seriesCompletadas === 0}
                onPress={solicitarFinalizarRutina}
                buttonColor={rutinaCompleta ? c.success : undefined}
                textColor={rutinaCompleta ? '#FFFFFF' : c.textSub}
                style={{ flex: 1, borderRadius: 12, borderColor: c.border }}
              >
                Finalizar rutina
              </Button>
            )}
          </View>

          {/* Botón de Emergencia por Dolor Agudo */}
          {!esSoloConsulta && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={abrirFlujoEmergenciaDolor}
              style={[styles.painStopBtn, { backgroundColor: c.dangerBg, borderColor: c.dangerBorder }]}
            >
              <MaterialCommunityIcons name="alert-octagon" size={20} color={c.danger} />
              <Text style={{ color: c.danger, fontWeight: '800', fontSize: 13.5 }}>
                ¿Dolor agudo? Detener sesión y reportar
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <EvaModal
          visible={evaOpen}
          onDismiss={() => {
            setEvaOpen(false);
            setDetencionPorDolor(false);
          }}
          onSubmit={enviar}
          sending={sending}
          modoEmergencia={detencionPorDolor}
          ejercicioActual={ej.nombre}
        />
      </View>
    );
  }

  /* ═════════ VISTA RESUMEN DE PAUTA ═════════ */
  const autorRespuestaPauta = resolverAutorKinesiologo(pauta, respuestasPauta[0]);
  const autorIndicacionPauta = resolverAutorKinesiologo(pauta);
  const textoBotonPrincipal = isDark ? '#0F172A' : '#FFFFFF';

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.container, { paddingTop: 16, paddingBottom: Math.max(56, insets.bottom + 32) }]}
      >
        <View>
          <Text style={{ color: c.textMain, fontSize: 24, fontWeight: '800' }}>{pauta.titulo || 'Tu sesión'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <View style={[styles.metaChip, { backgroundColor: c.surface, borderColor: c.border }]}>
              <MaterialCommunityIcons name="dumbbell" size={14} color={c.primary} />
              <Text style={{ color: c.textSub, fontSize: 12.5, fontWeight: '700' }}>
                {totalEjercicios} {totalEjercicios === 1 ? 'ejercicio' : 'ejercicios'}
              </Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: c.surface, borderColor: c.border }]}>
              <MaterialCommunityIcons name="layers-outline" size={14} color={c.primary} />
              <Text style={{ color: c.textSub, fontSize: 12.5, fontWeight: '700' }}>{totalSeries} series</Text>
            </View>
            {totalEjercicios > 0 && (
              <View style={[styles.metaChip, { backgroundColor: c.surface, borderColor: c.border }]}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={c.primary} />
                <Text style={{ color: c.textSub, fontSize: 12.5, fontWeight: '700' }}>
                  ≈ {minutosEstimados(ejercicios)} min
                </Text>
              </View>
            )}
          </View>
        </View>

        {!!pauta.notas && (
          <View style={[styles.indicacionBox, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <MaterialCommunityIcons name="stethoscope" size={17} color={c.primary} />
                <Text numberOfLines={1} style={{ color: c.primary, fontSize: 13, fontWeight: '800', flex: 1 }}>
                  Indicación de {autorIndicacionPauta}
                </Text>
              </View>
              {!!pauta.actualizado_en && (
                <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>
                  {new Date(pauta.actualizado_en).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}
                </Text>
              )}
            </View>
            <Text style={{ color: c.textMain, fontSize: 14.5, lineHeight: 21 }}>{pauta.notas}</Text>
          </View>
        )}

        {respuestasPauta.length > 0 && (
          <View style={[styles.kineReplyBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <MaterialCommunityIcons name="message-text-outline" size={17} color={c.primary} />
                <Text numberOfLines={1} style={{ color: c.primary, fontSize: 13, fontWeight: '800', flex: 1 }}>
                  Comentario reciente de {autorRespuestaPauta}
                </Text>
              </View>
              {!!formatearFechaHora(respuestasPauta[0].fecha_respuesta || respuestasPauta[0].fecha_ejecucion) && (
                <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>
                  {formatearFechaHora(respuestasPauta[0].fecha_respuesta || respuestasPauta[0].fecha_ejecucion)}
                </Text>
              )}
            </View>
            <Text style={{ color: c.textMain, fontSize: 14.5, lineHeight: 21 }}>
              {String(respuestasPauta[0].respuesta_kinesiologo).trim()}
            </Text>
          </View>
        )}

        {renderBannerSoloConsulta()}

        {!esSoloConsulta && (
          <View style={[styles.summaryBox, sombra, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <Text style={{ color: c.textMain, fontWeight: '700', fontSize: 14.5 }}>Progreso de hoy</Text>
              <Text style={{ color: rutinaCompleta ? c.success : c.primary, fontWeight: '800', fontSize: 13.5 }}>
                {seriesCompletadas}/{totalSeries} series
              </Text>
            </View>
            <ProgressBar
              progress={progresoGlobal}
              color={rutinaCompleta ? c.success : c.primary}
              style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceSoft }}
            />
          </View>
        )}

        <Button
          mode="contained"
          icon={esSoloConsulta ? 'book-open-variant' : 'play'}
          onPress={() => {
            const pendiente = ejercicios.findIndex((ej) => (seriesHechas[ej.key]?.length || 0) < ej.series);
            setIndiceActual(!esSoloConsulta && pendiente >= 0 ? pendiente : 0);
            setModoGuiado(true);
          }}
          buttonColor={c.primary}
          textColor={textoBotonPrincipal}
          style={{ borderRadius: 14, marginTop: 2 }}
          contentStyle={{ paddingVertical: 6 }}
          labelStyle={{ fontWeight: '800', fontSize: 15.5 }}
        >
          {esSoloConsulta
            ? 'Repasar rutina y técnica'
            : seriesCompletadas > 0
              ? 'Continuar sesión'
              : 'Comenzar sesión guiada'}
        </Button>

        {totalEjercicios > 0 && (
          <Text style={{ color: c.textMain, fontSize: 16.5, fontWeight: '800', marginTop: 6 }}>Ejercicios</Text>
        )}

        {ejercicios.map((ej, index) => {
          const hechas = seriesHechas[ej.key]?.length || 0;
          const listo = !esSoloConsulta && hechas >= ej.series;
          const sufijo = ej.unidad === 'SEG' ? 'seg' : 'reps';
          return (
            <TouchableOpacity
              key={ej.key}
              activeOpacity={0.75}
              onPress={() => {
                setIndiceActual(index);
                setModoGuiado(true);
              }}
              style={[
                styles.listCard,
                sombra,
                { backgroundColor: c.surface, borderColor: listo ? c.success : c.border },
              ]}
            >
              <View
                style={[
                  styles.listNumber,
                  { backgroundColor: listo ? c.successBg : c.accentBg },
                ]}
              >
                {listo ? (
                  <MaterialCommunityIcons name="check" size={18} color={c.success} />
                ) : (
                  <Text style={{ color: c.primary, fontWeight: '800', fontSize: 14 }}>{index + 1}</Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ color: c.textMain, fontWeight: '700', fontSize: 15.5 }}>
                  {ej.nombre}
                </Text>
                <Text style={{ color: c.textSub, fontSize: 13, marginTop: 3 }}>
                  {ej.series} {ej.series === 1 ? 'serie' : 'series'} × {ej.repeticiones} {sufijo} · {ej.descanso}s
                  descanso
                </Text>
                <Text style={{ color: c.textSub, fontSize: 12, marginTop: 1, opacity: 0.85 }}>{ej.zona}</Text>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[styles.badgeStatus, { backgroundColor: listo ? c.successBg : c.accentBg }]}>
                  <Text style={{ color: listo ? c.success : c.accentText, fontWeight: '700', fontSize: 12 }}>
                    {esSoloConsulta ? 'Ver guía' : listo ? 'Listo' : `${hechas}/${ej.series}`}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={c.textSub} />
              </View>
            </TouchableOpacity>
          );
        })}

        {!esSoloConsulta && seriesCompletadas > 0 && (
          <Button
            mode={rutinaCompleta ? 'contained' : 'outlined'}
            style={{ marginTop: 8, borderRadius: 14, borderColor: c.border }}
            contentStyle={{ paddingVertical: 6 }}
            buttonColor={rutinaCompleta ? c.success : undefined}
            textColor={rutinaCompleta ? '#FFFFFF' : c.textMain}
            onPress={solicitarFinalizarRutina}
          >
            Finalizar y enviar evaluación
          </Button>
        )}
      </ScrollView>

      <EvaModal
        visible={evaOpen}
        onDismiss={() => {
          setEvaOpen(false);
          setDetencionPorDolor(false);
        }}
        onSubmit={enviar}
        sending={sending}
        modoEmergencia={detencionPorDolor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  container: { padding: 16, gap: 12, paddingBottom: 56 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  indicacionBox: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 13,
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  mainCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  zonaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  media: { width: '100%', height: 210, backgroundColor: '#000' },
  stepsContainer: { padding: 18, gap: 15 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 11,
    marginTop: 14,
  },
  metricCol: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 28 },
  seriesBlock: {
    padding: 18,
    gap: 12,
    borderTopWidth: 1,
  },
  seriesDotsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  serieDot: {
    flex: 1,
    minWidth: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  restActionBox: {
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  skipRestBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  footerNav: { flexDirection: 'row', gap: 10, marginTop: 2 },
  painStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  summaryBox: { padding: 14, borderRadius: 16, borderWidth: 1 },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  listNumber: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  kineReplyBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
});