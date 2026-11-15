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
  const segundos = prescrito > 0 && prescrito !== 60 ? prescrito : recomendado;

  return { segundos, dificultad: dificultadRaw };
}

function parsearPasosClinicos(descripcion) {
  if (!descripcion) return [];
  const claves = ['Posición inicial:', 'Ejecución:', 'Ritmo y respiración:', 'Precaución postural:'];
  const texto = String(descripcion);
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
  const { id } = route.params;
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
  };

  const [pauta, setPauta] = useState(null);
  const [catalogoMap, setCatalogoMap] = useState({});
  const [error, setError] = useState(false);

  const [seriesHechas, setSeriesHechas] = useState({});
  const [modoGuiado, setModoGuiado] = useState(false);
  const [indiceActual, setIndiceActual] = useState(0);
  const [mostrarGuiaVideo, setMostrarGuiaVideo] = useState(false);
  const [descansoRestante, setDescansoRestante] = useState(null);

  const [evaOpen, setEvaOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    try {
      const [resPauta, listaEj] = await Promise.all([
        api.get(`/api/pautas/${id}/`),
        fetchTodosLosEjercicios(),
      ]);

      setPauta(resPauta.data);
      cacheSet(`pauta_${id}`, resPauta.data);

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
      const cachedPauta = await cacheGet(`pauta_${id}`);
      const cachedMap = await cacheGet('catalogo_ejercicios_map_v2');
      if (cachedMap) setCatalogoMap(cachedMap);
      if (cachedPauta) setPauta(cachedPauta);
      else setError(true);
    }
  }, [id]);

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
      const nombre = item.nombre || item.ejercicio_nombre || ejObj.nombre || 'Ejercicio terapéutico';
      const extra = (ejId && catalogoMap[`id_${ejId}`]) || catalogoMap[`nom_${norm(nombre)}`] || {};

      const series = Math.max(1, Number(item.series || 3));
      const repeticiones = Math.max(1, Number(item.repeticiones || 10));
      const zona = item.zona_cuerpo || item.zona || ejObj.zona_cuerpo || extra.zona_cuerpo || 'General';
      const descripcion = item.descripcion || ejObj.descripcion || extra.descripcion || '';
      const mediaUrl = resolverMediaUrl(item, extra);
      const { segundos, dificultad } = obtenerDescansoPorIntensidad(item, extra);

      return {
        key: String(item.id ?? idx),
        nombre,
        series,
        repeticiones,
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
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <EmptyState icon="wifi-off" title="No pudimos cargar la pauta" onRetry={cargar} />
      </View>
    );
  }

  if (!pauta) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
          <Skeleton height={90} />
          <Skeleton height={240} />
        </ScrollView>
      </View>
    );
  }

  const totalEjercicios = ejercicios.length;
  const totalSeries = ejercicios.reduce((acc, ej) => acc + ej.series, 0);
  const seriesCompletadas = ejercicios.reduce((acc, ej) => acc + (seriesHechas[ej.key]?.length || 0), 0);
  const ejerciciosCompletados = ejercicios.filter((ej) => (seriesHechas[ej.key]?.length || 0) >= ej.series).length;
  const rutinaCompleta = totalEjercicios > 0 && ejerciciosCompletados === totalEjercicios;
  const progresoGlobal = totalSeries > 0 ? seriesCompletadas / totalSeries : 0;

  const toggleSerie = (ej, serieIdx) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const actuales = seriesHechas[ej.key] || [];
    const yaEstaba = actuales.includes(serieIdx);
    const nuevas = yaEstaba
      ? actuales.filter((s) => s !== serieIdx)
      : [...actuales, serieIdx].sort((a, b) => a - b);

    setSeriesHechas((prev) => ({ ...prev, [ej.key]: nuevas }));

    if (!yaEstaba) {
      const esUltimaSerieFinal = nuevas.length >= ej.series && indiceActual === totalEjercicios - 1;
      if (!esUltimaSerieFinal && ej.descanso > 0) {
        setDescansoRestante(ej.descanso);
      }
      if (modoGuiado && nuevas.length >= ej.series && indiceActual < totalEjercicios - 1) {
        setTimeout(() => {
          setMostrarGuiaVideo(false);
          setIndiceActual((prev) => Math.min(totalEjercicios - 1, prev + 1));
        }, 400);
      }
    } else {
      setDescansoRestante(null);
    }
  };

  const completarSiguienteSerie = (ej) => {
    const actuales = seriesHechas[ej.key] || [];
    for (let i = 0; i < ej.series; i++) {
      if (!actuales.includes(i)) {
        toggleSerie(ej, i);
        return;
      }
    }
  };

  const enviar = async (nivel, comentario) => {
    setSending(true);
    try {
      const resumen = `Series: ${seriesCompletadas}/${totalSeries} (${ejerciciosCompletados}/${totalEjercicios} ejercicios).`;
      const comentarioFinal = comentario?.trim() ? `${comentario.trim()} | ${resumen}` : resumen;

      const estado = await enviarFeedback({
        pauta: pauta.id,
        nivel_dolor: nivel,
        comentario: comentarioFinal,
        completado: rutinaCompleta,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEvaOpen(false);
      Alert.alert(
        '¡Sesión registrada!',
        estado === 'enviado'
          ? 'Tu kinesiólogo ya puede ver tu avance y nivel de dolor.'
          : 'Sin conexión: se enviará automáticamente cuando recuperes señal.'
      );
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo registrar el feedback.');
    } finally {
      setSending(false);
    }
  };

  // =========================================================================
  // VISTA GUIADA PASO A PASO (LIMPIA Y ENFOCADA)
  // =========================================================================
  if (modoGuiado && totalEjercicios > 0) {
    const ej = ejercicios[indiceActual] || ejercicios[0];
    const hechas = seriesHechas[ej.key] || [];
    const ejTerminado = hechas.length >= ej.series;

    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
          {/* Navegación superior minimalista */}
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => { setDescansoRestante(null); setModoGuiado(false); }}
              style={[styles.pillBtn, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color={c.primary} />
              <Text style={{ color: c.textMain, fontWeight: '600', fontSize: 13 }}>Lista</Text>
            </TouchableOpacity>

            <Text style={{ color: c.textSub, fontWeight: '700', fontSize: 13 }}>
              Ejercicio {indiceActual + 1} de {totalEjercicios}
            </Text>

            <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>
              {Math.round(progresoGlobal * 100)}%
            </Text>
          </View>

          <ProgressBar
            progress={progresoGlobal}
            color={rutinaCompleta ? c.success : c.primary}
            style={{ height: 6, borderRadius: 3, backgroundColor: c.border, marginBottom: 12 }}
          />

          {/* Tarjeta principal del ejercicio */}
          <View style={[styles.mainCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            {/* Demostración: Video MP4 o Guía Paso a Paso */}
            {ej.mediaUrl ? (
              <View>
                <VideoMedia uri={ej.mediaUrl} />
                {ej.pasos.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setMostrarGuiaVideo((v) => !v)}
                    style={[styles.toggleStepsBar, { backgroundColor: c.surfaceSoft, borderBottomColor: c.border }]}
                  >
                    <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12.5 }}>
                      {mostrarGuiaVideo ? 'Ocultar instrucciones escritas' : 'Ver instrucciones paso a paso'}
                    </Text>
                    <MaterialCommunityIcons
                      name={mostrarGuiaVideo ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={c.primary}
                    />
                  </TouchableOpacity>
                )}
                {mostrarGuiaVideo && ej.pasos.length > 0 && (
                  <View style={[styles.stepsContainer, { backgroundColor: c.surfaceSoft, borderBottomColor: c.border }]}>
                    {ej.pasos.map((p, i) => (
                      <View key={i} style={styles.stepRow}>
                        <View style={[styles.stepNumber, { backgroundColor: c.accentBg }]}>
                          <Text style={{ color: c.accentText, fontWeight: '800', fontSize: 11 }}>{i + 1}</Text>
                        </View>
                        <Text style={{ flex: 1, color: c.textMain, fontSize: 13, lineHeight: 19 }}>
                          <Text style={{ fontWeight: '700', color: c.primary }}>{p.titulo}: </Text>
                          {p.contenido}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.stepsContainer, { backgroundColor: c.surfaceSoft, borderBottomColor: c.border }]}>
                <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
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
            )}

            {/* Título y Franja Única de Dosificación */}
            <View style={{ padding: 18 }}>
              <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
                {ej.zona} • Nivel {ej.dificultad}
              </Text>
              <Text style={{ color: c.textMain, fontSize: 20, fontWeight: '800', marginBottom: 14 }}>
                {ej.nombre}
              </Text>

              {/* 3 Métricas limpias */}
              <View style={[styles.metricsStrip, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 18, fontWeight: '800' }}>{ej.series}</Text>
                  <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>Series</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: c.border }]} />
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 18, fontWeight: '800' }}>{ej.repeticiones}</Text>
                  <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>Repeticiones</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: c.border }]} />
                <View style={styles.metricCol}>
                  <Text style={{ color: c.primary, fontSize: 18, fontWeight: '800' }}>{ej.descanso}s</Text>
                  <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>Descanso</Text>
                </View>
              </View>

              {/* Píldoras compactas por Serie */}
              <View style={styles.seriesDotsRow}>
                {Array.from({ length: ej.series }).map((_, sIdx) => {
                  const done = hechas.includes(sIdx);
                  return (
                    <TouchableOpacity
                      key={sIdx}
                      onPress={() => toggleSerie(ej, sIdx)}
                      style={[
                        styles.serieDot,
                        {
                          backgroundColor: done ? c.successBg : c.surfaceSoft,
                          borderColor: done ? c.success : c.border,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={done ? 'check' : 'circle-outline'}
                        size={15}
                        color={done ? c.success : c.textSub}
                      />
                      <Text style={{ color: done ? c.success : c.textMain, fontWeight: '700', fontSize: 12.5 }}>
                        S{sIdx + 1}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Botón Principal Único (Acción de Serie o Descanso en curso) */}
              {descansoRestante !== null ? (
                <View style={[styles.restActionBox, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="timer-sand" size={22} color={c.primary} />
                    <Text style={{ color: c.textMain, fontWeight: '800', fontSize: 16 }}>
                      Descanso: {descansoRestante}s
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDescansoRestante(null)}>
                    <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>Saltar →</Text>
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
                  Completar Serie {hechas.length + 1} de {ej.series} ({ej.repeticiones} reps)
                </Button>
              ) : (
                <View style={[styles.doneBox, { backgroundColor: c.successBg }]}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={c.success} />
                  <Text style={{ color: c.success, fontWeight: '700', fontSize: 14 }}>
                    ¡Ejercicio completado!
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Navegación Inferior */}
          <View style={styles.footerNav}>
            <Button
              mode="outlined"
              disabled={indiceActual === 0}
              onPress={() => { setDescansoRestante(null); setMostrarGuiaVideo(false); setIndiceActual((p) => Math.max(0, p - 1)); }}
              style={{ flex: 1, borderRadius: 12, borderColor: c.border }}
              textColor={c.textMain}
            >
              Anterior
            </Button>

            {indiceActual < totalEjercicios - 1 ? (
              <Button
                mode="contained"
                onPress={() => { setDescansoRestante(null); setMostrarGuiaVideo(false); setIndiceActual((p) => Math.min(totalEjercicios - 1, p + 1)); }}
                buttonColor={ejTerminado ? c.primary : c.surfaceSoft}
                textColor={ejTerminado ? (isDark ? '#0F172A' : '#FFFFFF') : c.textMain}
                style={{ flex: 1, borderRadius: 12 }}
              >
                Siguiente →
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={() => setEvaOpen(true)}
                buttonColor={rutinaCompleta ? c.success : c.primary}
                textColor="#FFFFFF"
                style={{ flex: 1, borderRadius: 12 }}
              >
                Finalizar Rutina
              </Button>
            )}
          </View>
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

  // =========================================================================
  // VISTA GENERAL DE LA PAUTA (RESUMEN INICIAL)
  // =========================================================================
  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Text style={{ color: c.textMain, fontSize: 22, fontWeight: '800' }}>
          {pauta.titulo || 'Tu Sesión'}
        </Text>
        {!!pauta.notas && (
          <Text style={{ color: c.textSub, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>
            {pauta.notas}
          </Text>
        )}

        {/* Tarjeta de inicio rápido */}
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
          <Button
            mode="contained"
            icon="play"
            onPress={() => {
              const pendiente = ejercicios.findIndex((ej) => (seriesHechas[ej.key]?.length || 0) < ej.series);
              setIndiceActual(pendiente >= 0 ? pendiente : 0);
              setModoGuiado(true);
            }}
            buttonColor={c.primary}
            textColor={isDark ? '#0F172A' : '#FFFFFF'}
            style={{ marginTop: 14, borderRadius: 12 }}
          >
            {seriesCompletadas > 0 ? 'Continuar Sesión' : 'Comenzar Sesión Guiada'}
          </Button>
        </View>

        {/* Lista limpia de ejercicios */}
        {ejercicios.map((ej, index) => {
          const hechas = seriesHechas[ej.key]?.length || 0;
          const listo = hechas >= ej.series;
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
                  {ej.series} series × {ej.repeticiones} reps • Descanso {ej.descanso}s • {ej.zona}
                </Text>
              </View>

              <View style={[styles.badgeStatus, { backgroundColor: listo ? c.successBg : c.accentBg }]}>
                <Text style={{ color: listo ? c.success : c.accentText, fontWeight: '700', fontSize: 12 }}>
                  {listo ? 'Listo' : `${hechas}/${ej.series}`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <Button
          mode="contained"
          style={{ marginTop: 8, borderRadius: 14 }}
          contentStyle={{ paddingVertical: 6 }}
          disabled={seriesCompletadas === 0}
          buttonColor={rutinaCompleta ? c.success : c.primary}
          textColor="#FFFFFF"
          onPress={() => setEvaOpen(true)}
        >
          Finalizar y enviar evaluación
        </Button>
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
  container: { padding: 16, gap: 10, paddingBottom: 56 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  mainCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  media: { width: '100%', height: 200, backgroundColor: '#000' },
  toggleStepsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  stepsContainer: { padding: 16, gap: 10, borderBottomWidth: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  metricsStrip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 10, marginBottom: 14 },
  metricCol: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, height: 26 },
  seriesDotsRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  serieDot: { flex: 1, minWidth: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  restActionBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5 },
  doneBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14 },
  footerNav: { flexDirection: 'row', gap: 10, marginTop: 6 },
  summaryBox: { padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 4 },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  badgeStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
});