import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import EvaModal from '../components/EvaModal';
import Skeleton from '../components/Skeleton';
import { API_URL } from '../constants/config';
import api from '../services/api';
import { cacheGet, cacheSet, enviarFeedback } from '../services/offline';

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
    .replace(/\bpronosupinación\b/gi, 'giro de palma hacia arriba y abajo')
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
  const candidatos = [
    respuestaItem?.kinesiologo_nombre,
    pauta?.kinesiologo_nombre,
  ];
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
  const player = useVideoPlayer(uri, (p) => { p.loop = true; });
  return <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />;
}

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
    surface: isDark ? '#1E293B' : '#FFFFFF',
    surfaceSoft: isDark ? '#0B1220' : '#F1F5F9',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textSub: isDark ? '#94A3B8' : '#64748B',
    accentBg: isDark ? '#082F49' : '#E0F2FE',
    accentText: isDark ? '#38BDF8' : '#0369A1',
    primary: isDark ? '#38BDF8' : '#0284C7',
    success: '#10B981',
    successBg: isDark ? '#064E3B' : '#D1FAE5',
    warning: '#F59E0B',
    warningBg: isDark ? '#451A03' : '#FEF3C7',
    danger: isDark ? '#FCA5A5' : '#DC2626',
    dangerBg: isDark ? '#7F1D1D' : '#FEE2E2',
    dangerBorder: isDark ? '#EF4444' : '#FCA5A5',
  };

  const [pauta, setPauta] = useState(pautaInicial);
  const [catalogoMap, setCatalogoMap] = useState({});
  const [respuestasPauta, setRespuestasPauta] = useState([]);
  const [error, setError] = useState(false);
  const [metaCumplidaApi, setMetaCumplidaApi] = useState(Boolean(soloConsultaParam));
  const [completadaHoyApi, setCompletadaHoyApi] = useState(
    Boolean(bloqueadaHoyParam) || Boolean(pautaInicial?.completada_hoy)
  );

  const [seriesHechas, setSeriesHechas] = useState({});
  const [modoGuiado, setModoGuiado] = useState(false);
  const [indiceActual, setIndiceActual] = useState(0);
  const [descansoRestante, setDescansoRestante] = useState(null);

  const [evaOpen, setEvaOpen] = useState(false);
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
              String(item.respuesta_kinesiologo).trim().length > 0
          )
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

  useEffect(() => { cargar(); }, [cargar]);

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

  const ejercicios = useMemo(() => {
    const rawList = pauta?.ejercicios_detalle || pauta?.ejercicios || [];
    return rawList.map((item, idx) => {
      const ejObj = item.ejercicio && typeof item.ejercicio === 'object' ? item.ejercicio : {};
      const ejId = typeof item.ejercicio === 'number' ? item.ejercicio : (item.ejercicio_id || ejObj.id);
      const nombre = humanizarLenguajePaciente(
        item.nombre || item.ejercicio_nombre || ejObj.nombre || 'Ejercicio terapéutico'
      );
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

  const completarSiguienteSerie = (ej) => {
    if (esSoloConsulta) return;
    const actuales = seriesHechas[ej.key] || [];
    if (actuales.length >= ej.series) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const siguienteIdx = actuales.length;
    const nuevas = [...actuales, siguienteIdx];
    setSeriesHechas((prev) => ({ ...prev, [ej.key]: nuevas }));

    const esUltimaSerieFinal = nuevas.length >= ej.series && indiceActual === totalEjercicios - 1;
    if (!esUltimaSerieFinal && ej.descanso > 0) {
      setDescansoRestante(ej.descanso);
    }
    if (nuevas.length >= ej.series && indiceActual < totalEjercicios - 1) {
      setTimeout(() => {
        setIndiceActual((prev) => Math.min(totalEjercicios - 1, prev + 1));
      }, 450);
    }
  };

  const abrirEvaluacionDolor = () => {
    if (esSoloConsulta) return;
    setDescansoRestante(null);
    setEvaOpen(true);
  };

  const solicitarFinalizarRutina = () => {
    if (esSoloConsulta) return;
    if (seriesCompletadas === 0) {
      Alert.alert(
        'Aún no registras series',
        'Completa al menos una serie antes de finalizar la sesión, o usa el botón inferior si sentiste dolor agudo.'
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
          { text: 'Finalizar igual', onPress: abrirEvaluacionDolor },
        ]
      );
      return;
    }
    abrirEvaluacionDolor();
  };

  const enviar = async (nivel, comentario) => {
    const evaNivel = Number(nivel);
    setSending(true);
    try {
      const resumen = `Series: ${seriesCompletadas}/${totalSeries} (${ejerciciosCompletados}/${totalEjercicios} ejercicios).`;
      const comentarioFinal = comentario?.trim() ? `${comentario.trim()} | ${resumen}` : resumen;

      const estado = await enviarFeedback({
        pauta: pauta.id,
        nivel_dolor: evaNivel,
        comentario: comentarioFinal,
        completado: rutinaCompleta,
      });

      setEvaOpen(false);
      if (rutinaCompleta) {
        setCompletadaHoyApi(true);
        cacheSet(`pauta_${id}`, { ...pauta, completada_hoy: true });
      }

      const estadoEnvioTexto =
        estado === 'enviado'
          ? 'Tu kinesiólogo ya recibió este reporte.'
          : 'Sin conexión: se enviará automáticamente en cuanto recuperes señal.';

      if (evaNivel >= 7) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          `Alerta de Dolor Severo (EVA ${evaNivel}/10)`,
          `Se activó una alerta clínica prioritaria. ${estadoEnvioTexto}\n\nPor seguridad, suspende los ejercicios por hoy, mantén reposo relativo y espera la indicación de tu kinesiólogo.`,
          [{ text: 'Entendido', onPress: () => navigation.goBack() }]
        );
      } else if (evaNivel >= 6) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          `Dolor Elevado Registrado (EVA ${evaNivel}/10)`,
          `Se envió una alerta clínica para revisar la carga de tu pauta. ${estadoEnvioTexto}\n\nEvita forzar repeticiones adicionales hoy si persiste la molestia.`,
          [{ text: 'Entendido', onPress: () => navigation.goBack() }]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          '¡Sesión registrada!',
          estado === 'enviado'
            ? 'Tu sesión diaria quedó completada. Podrás realizar la siguiente sesión mañana.'
            : 'Sin conexión: se enviará automáticamente cuando recuperes señal.',
          [{ text: 'Listo', onPress: () => navigation.goBack() }]
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
            <Text style={{ color: c.warning, fontSize: 12.5, fontWeight: '800' }}>
              Sesión diaria completada • Disponible mañana
            </Text>
            <Text style={{ color: c.textSub, fontSize: 11.5, marginTop: 2, lineHeight: 16 }}>
              Por hoy ya cumpliste tu entrenamiento de esta pauta (meta: {metaSemanalPauta} {metaSemanalPauta === 1 ? 'vez' : 'veces'}/semana). Puedes repasar la técnica cuando quieras.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.readOnlyBanner, { backgroundColor: c.successBg, borderColor: c.success }]}>
        <MaterialCommunityIcons name="eye-check-outline" size={20} color={c.success} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.success, fontSize: 12.5, fontWeight: '800' }}>
            Modo Repaso • Meta semanal cumplida ({metaSemanalPauta}/{metaSemanalPauta})
          </Text>
          <Text style={{ color: c.textSub, fontSize: 11.5, marginTop: 2, lineHeight: 16 }}>
            Puedes revisar las indicaciones y la técnica postural, mientras el registro de nuevas sesiones queda pausado hasta tu próximo ciclo.
          </Text>
        </View>
      </View>
    );
  };

  // ================= VISTA GUIADA DE EJERCICIO (JERARQUÍA CLÍNICA + HEADER STICKY) =================
  if (modoGuiado && totalEjercicios > 0) {
    const ej = ejercicios[indiceActual] || ejercicios[0];
    const hechas = seriesHechas[ej.key] || [];
    const ejTerminado = hechas.length >= ej.series;
    const etiquetaUnidad = ej.unidad === 'SEG' ? 'Segundos' : 'Repeticiones';
    const sufijoUnidad = ej.unidad === 'SEG' ? 'seg' : 'reps';

    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {/* Header Sticky fijo arriba */}
        <View style={[styles.stickyHeader, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => { setDescansoRestante(null); setModoGuiado(false); }}
              style={[styles.pillBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color={c.primary} />
              <Text style={{ color: c.textMain, fontWeight: '700', fontSize: 13 }}>Ver lista</Text>
            </TouchableOpacity>

            <Text style={{ color: c.textMain, fontWeight: '800', fontSize: 13.5 }}>
              Ejercicio {indiceActual + 1} de {totalEjercicios}
            </Text>

            <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>
              {esSoloConsulta ? 'Repaso' : `${Math.round(progresoGlobal * 100)}%`}
            </Text>
          </View>

          {!esSoloConsulta && (
            <ProgressBar
              progress={progresoGlobal}
              color={rutinaCompleta ? c.success : c.primary}
              style={{ height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 8 }}
            />
          )}
        </View>

        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(56, insets.bottom + 32) }]}>
          {renderBannerSoloConsulta()}

          <View style={[styles.mainCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            {/* 1. PRIMERO: Qué ejercicio es y cuántas series son */}
            <View style={{ padding: 18, paddingBottom: 14 }}>
              <Text style={{ color: c.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                {ej.zona} • Nivel {ej.dificultad}
              </Text>
              <Text style={{ color: c.textMain, fontSize: 21, fontWeight: '800', marginBottom: 14, lineHeight: 27 }}>
                {ej.nombre}
              </Text>

              <View style={[styles.metricsStrip, { backgroundColor: c.surfaceSoft, borderColor: c.border, marginBottom: esSoloConsulta ? 0 : 14 }]}>
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 19, fontWeight: '900' }}>{ej.series}</Text>
                  <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>Series</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: c.border }]} />
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 19, fontWeight: '900' }}>{ej.repeticiones}</Text>
                  <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>{etiquetaUnidad}</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: c.border }]} />
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 19, fontWeight: '900' }}>{ej.descanso}s</Text>
                  <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>Descanso</Text>
                </View>
              </View>

              {/* Controles de series: indicadores pasivos S1..Sn + un solo botón de acción */}
              {!esSoloConsulta && (
                <>
                  <View style={styles.seriesDotsRow}>
                    {Array.from({ length: ej.series }).map((_, sIdx) => {
                      const done = hechas.includes(sIdx);
                      return (
                        <View
                          key={sIdx}
                          style={[
                            styles.serieDot,
                            {
                              backgroundColor: done ? c.successBg : c.surfaceSoft,
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MaterialCommunityIcons name="timer-sand" size={22} color={c.primary} />
                        <View>
                          <Text style={{ color: c.textMain, fontWeight: '800', fontSize: 16 }}>
                            Descanso: {descansoRestante}s
                          </Text>
                          <Text style={{ color: c.textSub, fontSize: 11.5 }}>
                            Respira profundo antes de la siguiente serie
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => setDescansoRestante(null)}
                        style={[styles.skipRestBtn, { backgroundColor: c.surface, borderColor: c.primary }]}
                      >
                        <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12.5 }}>Saltar →</Text>
                      </TouchableOpacity>
                    </View>
                  ) : !ejTerminado ? (
                    <Button
                      mode="contained"
                      icon="check"
                      onPress={() => completarSiguienteSerie(ej)}
                      buttonColor={c.primary}
                      textColor={isDark ? '#0F172A' : '#FFFFFF'}
                      style={{ borderRadius: 14 }}
                      contentStyle={{ paddingVertical: 6 }}
                    >
                      Completar Serie {hechas.length + 1} de {ej.series} ({ej.repeticiones} {sufijoUnidad})
                    </Button>
                  ) : (
                    <View style={[styles.doneBox, { backgroundColor: c.successBg }]}>
                      <MaterialCommunityIcons name="check-circle" size={20} color={c.success} />
                      <Text style={{ color: c.success, fontWeight: '700', fontSize: 14 }}>
                        ¡Ejercicio completado!
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* 2. SEGUNDO: Video demostrativo si existe, o tarjeta visual honesta sin prometer videos */}
            {ej.mediaUrl ? (
              <VideoMedia uri={ej.mediaUrl} />
            ) : (
              <View style={[styles.noVideoBanner, { backgroundColor: c.surfaceSoft, borderTopColor: c.border, borderBottomColor: c.border }]}>
                <MaterialCommunityIcons name="human-handsup" size={22} color={c.primary} />
                <Text style={{ flex: 1, color: c.textSub, fontSize: 12.5, fontWeight: '600' }}>
                  Guía paso a paso • Sigue las indicaciones posturales de abajo
                </Text>
              </View>
            )}

            {/* 3. TERCERO: Instrucciones claras en español humano */}
            <View style={[styles.stepsContainer, { backgroundColor: c.surfaceSoft }]}>
              <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Cómo realizar este ejercicio
              </Text>
              {ej.pasos.length > 0 ? (
                ej.pasos.map((p, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={[styles.stepNumber, { backgroundColor: c.accentBg }]}>
                      <Text style={{ color: c.accentText, fontWeight: '800', fontSize: 11 }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, color: c.textMain, fontSize: 13.5, lineHeight: 20 }}>
                      <Text style={{ fontWeight: '700', color: c.textMain }}>{p.titulo}: </Text>
                      {p.contenido}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: c.textSub, fontSize: 13 }}>
                  Ejecuta el movimiento de forma lenta y controlada sin dolor agudo.
                </Text>
              )}
            </View>
          </View>

          {/* Navegación entre ejercicios (sin trampa visual en Finalizar Rutina) */}
          <View style={styles.footerNav}>
            <Button
              mode="outlined"
              disabled={indiceActual === 0}
              onPress={() => { setDescansoRestante(null); setIndiceActual((p) => Math.max(0, p - 1)); }}
              style={{ flex: 1, borderRadius: 12, borderColor: c.border }}
              textColor={c.textMain}
            >
              Anterior
            </Button>

            {indiceActual < totalEjercicios - 1 ? (
              <Button
                mode={ejTerminado || esSoloConsulta ? 'contained' : 'outlined'}
                onPress={() => { setDescansoRestante(null); setIndiceActual((p) => Math.min(totalEjercicios - 1, p + 1)); }}
                buttonColor={ejTerminado || esSoloConsulta ? c.primary : undefined}
                textColor={ejTerminado || esSoloConsulta ? (isDark ? '#0F172A' : '#FFFFFF') : c.textMain}
                style={{ flex: 1, borderRadius: 12, borderColor: c.border }}
              >
                Siguiente →
              </Button>
            ) : esSoloConsulta ? (
              <Button
                mode="contained"
                onPress={() => setModoGuiado(false)}
                buttonColor={c.primary}
                textColor={isDark ? '#0F172A' : '#FFFFFF'}
                style={{ flex: 1, borderRadius: 12 }}
              >
                Volver a la Lista
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
                Finalizar Rutina
              </Button>
            )}
          </View>

          {!esSoloConsulta && !ejTerminado && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={abrirEvaluacionDolor}
              style={[
                styles.painStopBtn,
                { backgroundColor: c.dangerBg, borderColor: c.dangerBorder },
              ]}
            >
              <MaterialCommunityIcons name="alert-octagon" size={20} color={c.danger} />
              <Text style={{ color: c.danger, fontWeight: '800', fontSize: 13 }}>
                ¿Dolor agudo? Detener sesión y reportar
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <EvaModal
          visible={evaOpen}
          onDismiss={() => setEvaOpen(false)}
          onSubmit={enviar}
          sending={sending}
        />
      </View>
    );
  }

  // ================= VISTA RESUMEN DE PAUTA =================
  const autorRespuestaPauta = resolverAutorKinesiologo(pauta, respuestasPauta[0]);
  const autorIndicacionPauta = resolverAutorKinesiologo(pauta);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: 16, paddingBottom: Math.max(56, insets.bottom + 32) }]}>
        <Text style={{ color: c.textMain, fontSize: 22, fontWeight: '800' }}>
          {pauta.titulo || 'Tu Sesión'}
        </Text>

        {/* Indicaciones clínicas ARRIBA del todo para que el paciente las lea antes de empezar */}
        {!!pauta.notas && (
          <View
            style={[
              styles.indicacionBox,
              { backgroundColor: c.accentBg, borderColor: c.primary },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="stethoscope" size={17} color={c.primary} />
                <Text style={{ color: c.accentText, fontSize: 12.5, fontWeight: '800' }}>
                  Indicación de {autorIndicacionPauta}
                </Text>
              </View>
              {!!pauta.actualizado_en && (
                <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>
                  {new Date(pauta.actualizado_en).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}
                </Text>
              )}
            </View>
            <Text style={{ color: c.textMain, fontSize: 13.5, lineHeight: 19 }}>
              {pauta.notas}
            </Text>
          </View>
        )}

        {respuestasPauta.length > 0 && (
          <View style={[styles.kineReplyBox, { backgroundColor: c.surfaceSoft, borderColor: c.primary }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <MaterialCommunityIcons name="doctor" size={17} color={c.primary} />
                <Text style={{ color: c.primary, fontSize: 12.5, fontWeight: '800' }}>
                  Comentario reciente de {autorRespuestaPauta}
                </Text>
              </View>
              {!!formatearFechaHora(respuestasPauta[0].fecha_respuesta || respuestasPauta[0].fecha_ejecucion) && (
                <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>
                  {formatearFechaHora(respuestasPauta[0].fecha_respuesta || respuestasPauta[0].fecha_ejecucion)}
                </Text>
              )}
            </View>
            <Text style={{ color: c.textMain, fontSize: 13.5, lineHeight: 19 }}>
              {String(respuestasPauta[0].respuesta_kinesiologo).trim()}
            </Text>
          </View>
        )}

        {renderBannerSoloConsulta()}

        {/* Progreso solo si la sesión está activa */}
        {!esSoloConsulta && (
          <View style={[styles.summaryBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: c.textMain, fontWeight: '700', fontSize: 14 }}>Progreso de hoy</Text>
              <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>
                {seriesCompletadas}/{totalSeries} series
              </Text>
            </View>
            <ProgressBar
              progress={progresoGlobal}
              color={rutinaCompleta ? c.success : c.primary}
              style={{ height: 8, borderRadius: 4, backgroundColor: c.border }}
            />
          </View>
        )}

        {/* Botón principal directo (sin caja envolvente extra) */}
        <Button
          mode="contained"
          icon={esSoloConsulta ? 'book-open-variant-outline' : 'play'}
          onPress={() => {
            const pendiente = ejercicios.findIndex((ej) => (seriesHechas[ej.key]?.length || 0) < ej.series);
            setIndiceActual(!esSoloConsulta && pendiente >= 0 ? pendiente : 0);
            setModoGuiado(true);
          }}
          buttonColor={c.primary}
          textColor={isDark ? '#0F172A' : '#FFFFFF'}
          style={{ borderRadius: 14, marginTop: 2 }}
          contentStyle={{ paddingVertical: 6 }}
        >
          {esSoloConsulta
            ? 'Repasar Rutina y Técnica'
            : seriesCompletadas > 0
              ? 'Continuar Sesión'
              : 'Comenzar Sesión Guiada'}
        </Button>

        {ejercicios.map((ej, index) => {
          const hechas = seriesHechas[ej.key]?.length || 0;
          const listo = !esSoloConsulta && hechas >= ej.series;
          const sufijo = ej.unidad === 'SEG' ? 'seg' : 'reps';
          return (
            <TouchableOpacity
              key={ej.key}
              activeOpacity={0.75}
              onPress={() => { setIndiceActual(index); setModoGuiado(true); }}
              style={[
                styles.listCard,
                {
                  backgroundColor: c.surface,
                  borderColor: listo ? c.success : c.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textMain, fontWeight: '700', fontSize: 15 }}>
                  {index + 1}. {ej.nombre}
                </Text>
                <Text style={{ color: c.textSub, fontSize: 12.5, marginTop: 3 }}>
                  {ej.series} {ej.series === 1 ? 'serie' : 'series'} × {ej.repeticiones} {sufijo} • Descanso {ej.descanso}s • {ej.zona}
                </Text>
              </View>

              <View style={[styles.badgeStatus, { backgroundColor: listo ? c.successBg : c.accentBg }]}>
                <Text style={{ color: listo ? c.success : c.accentText, fontWeight: '700', fontSize: 12 }}>
                  {esSoloConsulta ? 'Ver guía' : listo ? 'Listo' : `${hechas}/${ej.series}`}
                </Text>
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
        onDismiss={() => setEvaOpen(false)}
        onSubmit={enviar}
        sending={sending}
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
  container: { padding: 16, gap: 10, paddingBottom: 56 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
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
  mainCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  media: { width: '100%', height: 200, backgroundColor: '#000' },
  noVideoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  stepsContainer: { padding: 16, gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  metricsStrip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 10, marginBottom: 14 },
  metricCol: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 26 },
  seriesDotsRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  serieDot: { flex: 1, minWidth: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  restActionBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5 },
  skipRestBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  doneBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14 },
  footerNav: { flexDirection: 'row', gap: 10, marginTop: 6 },
  painStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 6,
  },
  summaryBox: { padding: 14, borderRadius: 16, borderWidth: 1 },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  badgeStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  kineReplyBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderLeftWidth: 4,
    gap: 6,
  },
});