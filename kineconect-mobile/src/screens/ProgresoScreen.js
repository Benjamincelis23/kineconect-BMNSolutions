import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import api from '../services/api';
import { cacheGet, cacheSet } from '../services/offline';

const TZ = 'America/Santiago';
const SLOTS = 7;
const ALTO_BARRA = 92;
const ALTO_FECHA = 24;
const ALTO_VALOR = 22;

function formatearFechaHora(isoStr) {
  if (!isoStr) return 'Reciente';
  const f = new Date(isoStr);
  if (Number.isNaN(f.getTime())) return 'Reciente';
  const dia = f
    .toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: TZ })
    .replace('.', '');
  const hora = f.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  });
  return `${dia} · ${hora}`;
}

function formatearDiaCorto(isoStr, fallback) {
  if (!isoStr) return fallback;
  const f = new Date(isoStr);
  if (Number.isNaN(f.getTime())) return fallback;
  return f.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', timeZone: TZ });
}

function evaDe(item) {
  return Number(item?.nivel_dolor ?? item?.escala_dolor ?? 0);
}

function estadoPorEva(eva) {
  const val = Number(eva ?? 0);
  if (val >= 7) {
    return {
      color: '#EF4444',
      bgDark: 'rgba(239, 68, 68, 0.14)',
      bgLight: '#FEE2E2',
      icono: 'alert-circle-outline',
      etiqueta: 'Dolor intenso',
      mensaje: 'Tu kinesiólogo revisará estos reportes y ajustará tu plan.',
    };
  }
  if (val >= 4) {
    return {
      color: '#F59E0B',
      bgDark: 'rgba(245, 158, 11, 0.14)',
      bgLight: '#FEF3C7',
      icono: 'minus-circle-outline',
      etiqueta: 'Molestia moderada',
      mensaje: 'Mantén el ritmo y avisa si la molestia aumenta.',
    };
  }
  return {
    color: '#10B981',
    bgDark: 'rgba(16, 185, 129, 0.14)',
    bgLight: '#D1FAE5',
    icono: 'check-circle-outline',
    etiqueta: 'Buena tolerancia',
    mensaje: 'Vas muy bien, sigue con tu rutina.',
  };
}

function parsearComentarioClinico(raw) {
  if (!raw) return { chips: [], notaPaciente: '' };
  const partes = String(raw)
    .split(/\s*[|•]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chips = [];
  const notas = [];

  partes.forEach((p) => {
    if (p.startsWith('Esfuerzo Borg:')) {
      const limpio = p
        .replace('Esfuerzo Borg:', '')
        .replace(/\d+\/10\s*/, '')
        .replace(/[()]/g, '')
        .trim();
      if (limpio) chips.push({ icon: 'lightning-bolt-outline', text: limpio });
    } else if (p.startsWith('Series:')) {
      const m = p.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) chips.push({ icon: 'check-all', text: `${m[1]} de ${m[2]} series` });
    } else if (p.startsWith('[') && p.endsWith(']')) {
      p.slice(1, -1)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((tag) => chips.push({ icon: 'tag-outline', text: tag }));
    } else {
      notas.push(p);
    }
  });

  return { chips, notaPaciente: notas.join('. ') };
}

async function fetchHistorial() {
  for (const ruta of ['/api/v1/feedback/', '/api/feedback/']) {
    try {
      const res = await api.get(ruta);
      const data = res?.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results;
    } catch {
      // Intenta siguiente ruta
    }
  }
  return null;
}

function BarraEva({ valor, color, seleccionada }) {
  const alturaObjetivo = Math.max(10, Math.round((valor / 10) * ALTO_BARRA));
  return (
    <View
      style={{
        width: '100%',
        height: alturaObjetivo,
        backgroundColor: color,
        borderRadius: 8,
        opacity: seleccionada ? 1 : 0.6,
      }}
    />
  );
}

function BarraProgreso({ pct, color, track }) {
  const anchoPct = `${Math.max(0, Math.min(100, pct))}%`;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: track, overflow: 'hidden' }}>
      <View
        style={{
          height: '100%',
          borderRadius: 3,
          backgroundColor: color,
          width: anchoPct,
        }}
      />
    </View>
  );
}

export default function ProgresoScreen() {
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();

  const [historial, setHistorial] = useState(null);
  const [pautas, setPautas] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selIdx, setSelIdx] = useState(null);

  const fade = useRef(new Animated.Value(0)).current;

  const c = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    surface: isDark ? '#172033' : '#FFFFFF',
    surfaceSoft: isDark ? '#0B1220' : '#F1F5F9',
    border: isDark ? '#2A3A52' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textSub: isDark ? '#94A3B8' : '#64748B',
    accentBg: isDark ? 'rgba(56, 189, 248, 0.12)' : '#E0F2FE',
    accentText: isDark ? '#BAE6FD' : '#0369A1',
    primary: isDark ? '#38BDF8' : '#0284C7',
    success: '#10B981',
  };

  const sombra = {
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.35 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  };

  const cargar = useCallback(async () => {
    try {
      const [listaHist, resPautas] = await Promise.all([
        fetchHistorial(),
        api.get('/api/pautas/').catch(() => ({ data: [] })),
      ]);

      const pautasArr = resPautas?.data?.results ?? resPautas?.data ?? [];
      if (Array.isArray(pautasArr)) {
        setPautas(pautasArr);
        await cacheSet('progreso_pautas', pautasArr);
      }

      if (Array.isArray(listaHist)) {
        const ordenados = [...listaHist].sort((a, b) => {
          const tA = new Date(a?.fecha_ejecucion || 0).getTime();
          const tB = new Date(b?.fecha_ejecucion || 0).getTime();
          return tB - tA;
        });
        setHistorial(ordenados);
        await cacheSet('perfil_historial_eva', ordenados);
      } else {
        const cached = await cacheGet('perfil_historial_eva');
        setHistorial(Array.isArray(cached) ? cached : []);
      }
    } catch {
      const [cachedHist, cachedPautas] = await Promise.all([
        cacheGet('perfil_historial_eva'),
        cacheGet('progreso_pautas'),
      ]);
      setHistorial(Array.isArray(cachedHist) ? cachedHist : []);
      if (Array.isArray(cachedPautas)) setPautas(cachedPautas);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  useEffect(() => {
    if (historial !== null) {
      Animated.timing(fade, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [historial, fade]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  };

  if (historial === null) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, gap: 12 }}
      >
        <Skeleton height={110} />
        <Skeleton height={150} />
        <Skeleton height={120} />
      </ScrollView>
    );
  }

  const totalReportes = historial.length;
  const completas = historial.filter((h) => Boolean(h.completado)).length;
  const promedioNum =
    totalReportes > 0 ? historial.reduce((acc, h) => acc + evaDe(h), 0) / totalReportes : null;

  const infoPromedio = promedioNum !== null ? estadoPorEva(promedioNum) : null;
  const ultimos7 = historial.slice(0, SLOTS).reverse();
  const n = ultimos7.length;
  const slots = Array.from({ length: SLOTS }, (_, i) => ultimos7[i - (SLOTS - n)] ?? null);

  const idxSel = n > 0 ? Math.min(selIdx ?? n - 1, n - 1) : -1;
  const itemSel = idxSel >= 0 ? ultimos7[idxSel] : null;
  const estSel = itemSel ? estadoPorEva(evaDe(itemSel)) : null;

  let tendencia = null;
  if (historial.length >= 2) {
    const delta = evaDe(historial[0]) - evaDe(historial[1]);
    if (delta < 0) {
      tendencia = { icon: 'trending-down', color: c.success, texto: `${Math.abs(delta)} pt menos que la sesión anterior` };
    } else if (delta > 0) {
      tendencia = { icon: 'trending-up', color: '#EF4444', texto: `${delta} pt más que la sesión anterior` };
    } else {
      tendencia = { icon: 'trending-neutral', color: c.textSub, texto: 'Igual que la sesión anterior' };
    }
  }

  const alturaContenedor = ALTO_VALOR + ALTO_BARRA + ALTO_FECHA;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(40, insets.bottom + 24), gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <Animated.View style={{ opacity: fade, gap: 16 }}>
          <View>
            <Text style={{ color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
              SEGUIMIENTO CLÍNICO
            </Text>
            <Text style={{ color: c.textMain, fontSize: 24, fontWeight: '800', marginTop: 2 }}>
              Mi Evolución
            </Text>
          </View>

          {/* Resumen */}
          <View style={[styles.card, sombra, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={{ color: c.textMain, fontSize: 14, fontWeight: '700' }}>Dolor promedio</Text>
              <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>Escala EVA</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
              <Text
                style={{
                  color: infoPromedio?.color ?? c.textMain,
                  fontSize: 44,
                  fontWeight: '900',
                  letterSpacing: -1,
                }}
              >
                {promedioNum !== null ? promedioNum.toFixed(1) : '—'}
              </Text>
              <Text style={{ color: c.textSub, fontSize: 15, fontWeight: '700' }}>/ 10</Text>
            </View>

            <View style={{ marginTop: 6 }}>
              <BarraProgreso
                pct={(promedioNum ?? 0) * 10}
                color={infoPromedio?.color ?? c.border}
                track={c.surfaceSoft}
              />
            </View>

            {infoPromedio && (
              <View style={{ marginTop: 14, gap: 8 }}>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: isDark ? infoPromedio.bgDark : infoPromedio.bgLight },
                  ]}
                >
                  <MaterialCommunityIcons name={infoPromedio.icono} size={16} color={infoPromedio.color} />
                  <Text style={{ color: infoPromedio.color, fontSize: 12.5, fontWeight: '700' }}>
                    {infoPromedio.etiqueta}
                  </Text>
                </View>
                <Text style={{ color: c.textSub, fontSize: 12.5, lineHeight: 18 }}>{infoPromedio.mensaje}</Text>

                {tendencia && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name={tendencia.icon} size={16} color={tendencia.color} />
                    <Text style={{ color: tendencia.color, fontSize: 12, fontWeight: '700' }}>
                      {tendencia.texto}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={[styles.kpiStrip, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
              <View style={styles.kpiCol}>
                <MaterialCommunityIcons name="calendar-check-outline" size={16} color={c.primary} />
                <Text style={{ color: c.textMain, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                  {totalReportes}
                </Text>
                <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>Sesiones</Text>
              </View>
              <View style={[styles.kpiDivider, { backgroundColor: c.border }]} />
              <View style={styles.kpiCol}>
                <MaterialCommunityIcons name="check-decagram-outline" size={16} color={c.success} />
                <Text style={{ color: c.textMain, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                  {completas}
                </Text>
                <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>Completadas</Text>
              </View>
              <View style={[styles.kpiDivider, { backgroundColor: c.border }]} />
              <View style={styles.kpiCol}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={16} color={c.textSub} />
                <Text style={{ color: c.textMain, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                  {pautas.length}
                </Text>
                <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>Pautas</Text>
              </View>
            </View>
          </View>

          {/* Gráfico limpio sin líneas superpuestas */}
          {n > 0 && (
            <View style={[styles.card, sombra, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ color: c.textMain, fontSize: 15.5, fontWeight: '800' }}>
                  Dolor por sesión
                </Text>
                <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>Escala 0–10</Text>
              </View>
              <Text style={{ color: c.textSub, fontSize: 12, marginTop: 2, marginBottom: 14 }}>
                {n === 1
                  ? 'Completa más sesiones para ver tu curva de evolución'
                  : `Últimas ${n} sesiones · toca una barra para ver el detalle`}
              </Text>

              <View style={{ height: alturaContenedor }}>
                <View style={styles.barsContainer}>
                  {slots.map((item, i) => {
                    if (!item) {
                      return (
                        <View key={`g${i}`} style={styles.barItem}>
                          <View style={{ height: ALTO_VALOR }} />
                          <View
                            style={[
                              styles.barTrack,
                              { backgroundColor: c.surfaceSoft, opacity: 0.45 },
                            ]}
                          />
                          <View style={styles.fechaBox}>
                            <Text style={{ color: c.textSub, fontSize: 11, opacity: 0.4 }}>·</Text>
                          </View>
                        </View>
                      );
                    }

                    const realIdx = i - (SLOTS - n);
                    const eva = evaDe(item);
                    const est = estadoPorEva(eva);
                    const activa = realIdx === idxSel;

                    return (
                      <Pressable
                        key={item.id ?? `b${i}`}
                        style={styles.barItem}
                        onPress={() => setSelIdx(realIdx)}
                        hitSlop={6}
                      >
                        <View style={{ height: ALTO_VALOR, justifyContent: 'flex-end' }}>
                          <Text style={{ color: est.color, fontSize: 12.5, fontWeight: '800', marginBottom: 4 }}>
                            {eva}
                          </Text>
                        </View>
                        <View style={[styles.barTrack, { backgroundColor: c.surfaceSoft }]}>
                          <BarraEva valor={eva} color={est.color} seleccionada={activa || n === 1} />
                        </View>
                        <View style={styles.fechaBox}>
                          <Text
                            style={{
                              color: activa ? c.textMain : c.textSub,
                              fontSize: 10.5,
                              fontWeight: activa ? '800' : '600',
                            }}
                          >
                            {formatearDiaCorto(item.fecha_ejecucion, `#${realIdx + 1}`)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {itemSel && estSel && (
                <View style={[styles.detalleBarra, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
                  <View style={[styles.puntoEstado, { backgroundColor: estSel.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: c.textMain, fontSize: 13, fontWeight: '700' }}>
                      {itemSel.pauta_titulo || 'Sesión de rehabilitación'}
                    </Text>
                    <Text style={{ color: c.textSub, fontSize: 11.5, marginTop: 1 }}>
                      {formatearFechaHora(itemSel.fecha_ejecucion)}
                    </Text>
                  </View>
                  <Text style={{ color: estSel.color, fontSize: 13, fontWeight: '800' }}>
                    EVA {evaDe(itemSel)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Historial */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={{ color: c.textMain, fontSize: 17, fontWeight: '800' }}>Historial de sesiones</Text>
            {totalReportes > 0 && (
              <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '600' }}>
                {totalReportes} {totalReportes === 1 ? 'sesión' : 'sesiones'}
              </Text>
            )}
          </View>

          {historial.length === 0 ? (
            <EmptyState
              icon="clipboard-pulse-outline"
              title="Aún no hay sesiones registradas"
              subtitle="Cuando termines tu primera rutina verás aquí tu evolución y las indicaciones de tu kinesiólogo."
              onRetry={cargar}
            />
          ) : (
            historial.map((item, idx) => {
              const eva = evaDe(item);
              const est = estadoPorEva(eva);
              const tituloPauta = item.pauta_titulo || 'Sesión de rehabilitación';
              const respuesta = (item.respuesta_kinesiologo || '').trim();
              const { chips, notaPaciente } = parsearComentarioClinico(item.comentario);
              const completada = Boolean(item.completado);

              return (
                <View
                  key={item.id ?? idx}
                  style={[styles.historyCard, sombra, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <View style={[styles.franja, { backgroundColor: est.color }]} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: c.textMain, fontSize: 15, fontWeight: '700' }}>
                        {tituloPauta}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <MaterialCommunityIcons
                          name={completada ? 'check-circle' : 'pause-circle'}
                          size={13}
                          color={completada ? c.success : c.textSub}
                        />
                        <Text style={{ color: c.textSub, fontSize: 12 }}>
                          {formatearFechaHora(item.fecha_ejecucion)} · {completada ? 'Completada' : 'Detenida'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.evaBadge, { backgroundColor: isDark ? est.bgDark : est.bgLight }]}>
                      <Text style={{ color: est.color, fontSize: 12, fontWeight: '800' }}>EVA {eva}/10</Text>
                    </View>
                  </View>

                  {chips.length > 0 && (
                    <View style={styles.chipsRow}>
                      {chips.map((ch, cIdx) => (
                        <View
                          key={cIdx}
                          style={[styles.detailChip, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
                        >
                          <MaterialCommunityIcons name={ch.icon} size={13} color={c.textSub} />
                          <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>{ch.text}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!!notaPaciente && (
                    <Text style={{ color: c.textMain, fontSize: 13, lineHeight: 19, fontStyle: 'italic' }}>
                      “{notaPaciente}”
                    </Text>
                  )}

                  {!!respuesta && (
                    <View style={[styles.kineNote, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
                      <MaterialCommunityIcons name="stethoscope" size={18} color={c.primary} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: c.primary,
                            fontSize: 10.5,
                            fontWeight: '800',
                            letterSpacing: 0.6,
                            marginBottom: 2,
                          }}
                        >
                          INDICACIÓN DE TU KINESIÓLOGO
                        </Text>
                        <Text style={{ color: c.accentText, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
                          {respuesta}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
  },
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    marginTop: 16,
  },
  kpiCol: { flex: 1, alignItems: 'center' },
  kpiDivider: { width: 1, height: 36 },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: 24,
    height: ALTO_BARRA,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fechaBox: {
    height: ALTO_FECHA,
    justifyContent: 'flex-end',
    paddingBottom: 1,
  },
  detalleBarra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  puntoEstado: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
    paddingLeft: 19,
    gap: 10,
    overflow: 'hidden',
  },
  franja: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  evaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  kineNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
});