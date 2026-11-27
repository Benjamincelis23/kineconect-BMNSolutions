import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import api from '../services/api';
import { cacheGet, cacheSet, contarPendientesCola, vaciarCola } from '../services/offline';

const CACHE_KEY_VISTAS = 'respuestas_kine_vistas_v1';
const CACHE_KEY_OCULTAS = 'respuestas_kine_ocultas_v1';

function obtenerClaveRespuesta(item, idx = 0) {
  const idBase = item?.id != null ? String(item.id) : `idx_${idx}`;
  const marcaTiempo = String(item?.fecha_respuesta || item?.fecha_ejecucion || '');
  return `${idBase}_${marcaTiempo}`;
}

function capitalizarNombre(texto) {
  if (!texto || typeof texto !== 'string') return 'Paciente';
  const limpio = texto.trim();
  if (!limpio) return 'Paciente';
  return limpio
    .split(/\s+/)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

function formatearFechaCorta(isoStr) {
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

function obtenerPautaIdRespuesta(item) {
  if (!item) return null;
  if (typeof item.pauta === 'number' || typeof item.pauta === 'string') {
    const num = Number(item.pauta);
    return Number.isNaN(num) ? item.pauta : num;
  }
  if (item.pauta && typeof item.pauta === 'object' && item.pauta.id != null) {
    return item.pauta.id;
  }
  if (item.pauta_id != null) {
    return item.pauta_id;
  }
  return null;
}

function ordenarRespuestasRecientes(items = []) {
  return [...items].sort((a, b) => {
    const tA = new Date(a?.fecha_respuesta || a?.fecha_ejecucion || 0).getTime();
    const tB = new Date(b?.fecha_respuesta || b?.fecha_ejecucion || 0).getTime();
    return (Number.isNaN(tB) ? 0 : tB) - (Number.isNaN(tA) ? 0 : tA);
  });
}

function combinarRespuestasKine(listaFeedback = [], listaPautas = []) {
  const mapa = new Map();

  if (Array.isArray(listaFeedback)) {
    listaFeedback.forEach((item) => {
      if (item?.respuesta_kinesiologo && String(item.respuesta_kinesiologo).trim().length > 0) {
        const key = item.id != null ? `fb_${item.id}` : `p_${obtenerPautaIdRespuesta(item)}_${item.fecha_respuesta || ''}`;
        mapa.set(key, item);
      }
    });
  }

  if (Array.isArray(listaPautas)) {
    listaPautas.forEach((p) => {
      const ult = p?.ultima_respuesta_kine;
      if (ult?.respuesta && String(ult.respuesta).trim().length > 0) {
        const key = ult.feedback_id != null ? `fb_${ult.feedback_id}` : `p_${p.id}_${ult.fecha_respuesta || ''}`;
        if (!mapa.has(key)) {
          mapa.set(key, {
            id: ult.feedback_id ?? `pauta_${p.id}`,
            pauta: p.id,
            pauta_titulo: p.titulo,
            kinesiologo_nombre: p.kinesiologo_nombre,
            nivel_dolor: ult.nivel_dolor_reportado ?? 0,
            respuesta_kinesiologo: ult.respuesta,
            fecha_respuesta: ult.fecha_respuesta,
          });
        }
      }
      if (p?.notas && String(p.notas).trim().length > 0) {
        const keyNota = `nota_${p.id}_${p.actualizado_en || p.creado_en || ''}`;
        if (!mapa.has(keyNota)) {
          mapa.set(keyNota, {
            id: keyNota,
            pauta: p.id,
            pauta_titulo: p.titulo,
            kinesiologo_nombre: p.kinesiologo_nombre,
            nivel_dolor: 0,
            respuesta_kinesiologo: String(p.notas).trim(),
            fecha_respuesta: p.actualizado_en || p.creado_en || '',
            esIndicacionPauta: true,
          });
        }
      }
    });
  }

  return ordenarRespuestasRecientes(Array.from(mapa.values()));
}

function obtenerInfoKinesiologo(me, pautas = []) {
  const k = me?.kinesiologo;
  const pautaConKine = Array.isArray(pautas)
    ? pautas.find((p) => p?.kinesiologo_nombre || p?.kinesiologo)
    : null;

  if (!k && !me?.kinesiologo_nombre && !pautaConKine) {
    return { asignado: false, nombre: '' };
  }

  let nombre = '';
  if (typeof k === 'string') {
    nombre = k.trim();
  } else if (k && typeof k === 'object') {
    const full = `${k.first_name || ''} ${k.last_name || ''}`.trim();
    nombre = (k.nombre_completo || k.nombre || full || k.username || '').trim();
  }

  if (!nombre) {
    nombre = (me?.kinesiologo_nombre || pautaConKine?.kinesiologo_nombre || '').trim();
  }

  return {
    asignado: true,
    nombre: nombre ? capitalizarNombre(nombre) : 'Asignado',
  };
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDark = theme.dark;

  const [me, setMe] = useState(null);
  const [pautas, setPautas] = useState(null);
  const [respuestasKine, setRespuestasKine] = useState([]);
  const [respuestasVistas, setRespuestasVistas] = useState({});
  const [respuestasOcultas, setRespuestasOcultas] = useState({});
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendientesOffline, setPendientesOffline] = useState(0);

  const c = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    surfaceSoft: isDark ? '#0B1220' : '#F1F5F9',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textSub: isDark ? '#CBD5E1' : '#475569',
    accentBg: isDark ? '#082F49' : '#E0F2FE',
    accentText: isDark ? '#38BDF8' : '#0369A1',
    primary: isDark ? '#38BDF8' : '#0284C7',
    success: '#10B981',
    successBg: isDark ? '#064E3B' : '#D1FAE5',
    warning: '#F59E0B',
    warningBg: isDark ? '#451A03' : '#FEF3C7',
  };

  const cargar = useCallback(async () => {
    setError(false);
    const [vistasGuardadas, ocultasGuardadas] = await Promise.all([
      cacheGet(CACHE_KEY_VISTAS),
      cacheGet(CACHE_KEY_OCULTAS),
    ]);
    setRespuestasVistas(vistasGuardadas || {});
    setRespuestasOcultas(ocultasGuardadas || {});

    try {
      await vaciarCola();
      const [m, p, fb, pend] = await Promise.all([
        api.get('/api/me/'),
        api.get('/api/pautas/'),
        api.get('/api/v1/feedback/').catch(() => ({ data: [] })),
        contarPendientesCola(),
      ]);

      const lista = p.data.results ?? p.data ?? [];
      const listaFeedback = fb.data.results ?? fb.data ?? [];
      const conRespuesta = combinarRespuestasKine(listaFeedback, lista);

      setMe(m.data);
      setPautas(lista);
      setRespuestasKine(conRespuesta);
      setPendientesOffline(pend);
      cacheSet('home', { me: m.data, pautas: lista, respuestasKine: conRespuesta });
    } catch {
      const [cData, pend] = await Promise.all([cacheGet('home'), contarPendientesCola()]);
      setPendientesOffline(pend);
      if (cData) {
        setMe(cData.me);
        setPautas(cData.pautas);
        setRespuestasKine(combinarRespuestasKine(cData.respuestasKine || [], cData.pautas || []));
      } else {
        setError(true);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  };

  const marcarComoVisto = async (clave) => {
    if (respuestasVistas[clave]) return;
    Haptics.selectionAsync();
    const actualizado = { ...respuestasVistas, [clave]: true };
    setRespuestasVistas(actualizado);
    await cacheSet(CACHE_KEY_VISTAS, actualizado);
  };

  const ocultarRespuesta = async (clave) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nuevasVistas = { ...respuestasVistas, [clave]: true };
    const nuevasOcultas = { ...respuestasOcultas, [clave]: true };
    setRespuestasVistas(nuevasVistas);
    setRespuestasOcultas(nuevasOcultas);
    await Promise.all([
      cacheSet(CACHE_KEY_VISTAS, nuevasVistas),
      cacheSet(CACHE_KEY_OCULTAS, nuevasOcultas),
    ]);
  };

  const limpiarRespuestasLeidas = async (listaConClave) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nuevasOcultas = { ...respuestasOcultas };
    listaConClave.forEach(({ clave }) => {
      if (respuestasVistas[clave]) {
        nuevasOcultas[clave] = true;
      }
    });
    setRespuestasOcultas(nuevasOcultas);
    await cacheSet(CACHE_KEY_OCULTAS, nuevasOcultas);
  };

  const mensajeMotivacional = useMemo(() => {
    const mensajes = [
      { texto: '¡Cada repetición cuenta en tu recuperación!', emoji: '💪' },
      { texto: 'Un día más de progreso para sentirte mejor.', emoji: '🚀' },
      { texto: 'La constancia es la clave de tu bienestar.', emoji: '✨' },
      { texto: 'Tu cuerpo te va a agradecer este esfuerzo.', emoji: '🙌' },
      { texto: 'Paso a paso vuelves a tu mejor versión.', emoji: '🔥' },
      { texto: 'Hoy es un gran día para avanzar en tu pauta.', emoji: '🏃‍♂️' },
    ];
    return mensajes[Math.floor(Math.random() * mensajes.length)];
  }, []);

  if (error) {
    return (
      <View
        style={[
          styles.mainWrapper,
          { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: c.bg },
        ]}
      >
        <EmptyState
          icon="wifi-off"
          onRetry={cargar}
          subtitle="Revisa tu conexión e inténtalo otra vez."
          title="No pudimos cargar tus datos"
        />
      </View>
    );
  }

  if (!me || !pautas) {
    return (
      <ScrollView
        style={[styles.mainWrapper, { backgroundColor: c.bg }]}
        contentContainerStyle={[
          styles.scrollPadding,
          { paddingTop: insets.top + 24, paddingBottom: Math.max(36, insets.bottom + 24) },
        ]}
      >
        <Skeleton height={80} />
        <Skeleton height={130} />
        <Skeleton height={110} />
      </ScrollView>
    );
  }

  const nombrePaciente = capitalizarNombre(me.nombre);
  const infoKine = obtenerInfoKinesiologo(me, pautas);

  const pautasConConteo = Array.isArray(pautas)
    ? pautas.filter((p) => p && p.sesiones_semana != null)
    : [];

  const metaSemanal = pautasConConteo.length > 0
    ? pautasConConteo.reduce((acc, p) => acc + Math.max(1, Number(p.frecuencia_semanal || p.meta_semanal || 3)), 0)
    : Math.max(1, Number(me.meta_semanal || 3));

  const sesionesSemana = pautasConConteo.length > 0
    ? pautasConConteo.reduce((acc, p) => {
        const metaP = Math.max(1, Number(p.frecuencia_semanal || p.meta_semanal || 3));
        return acc + Math.min(Number(p.sesiones_semana || 0), metaP);
      }, 0)
    : Number(me.sesiones_semana || 0);

  const progreso = Math.min(1, sesionesSemana / metaSemanal);
  const metaGlobalCumplida = sesionesSemana >= metaSemanal;

  const esPautaCumplida = (pauta) => {
    if (!pauta) return metaGlobalCumplida;
    const metaP = Math.max(1, Number(pauta.frecuencia_semanal || pauta.meta_semanal || 3));
    if (pauta.sesiones_semana != null) {
      return Number(pauta.sesiones_semana) >= metaP;
    }
    return metaGlobalCumplida;
  };

  const esPautaBloqueadaHoy = (pauta) => Boolean(pauta?.completada_hoy);

  const abrirPauta = (pauta) => {
    if (!pauta?.id) return;
    const cumplida = esPautaCumplida(pauta);
    const bloqueadaHoy = esPautaBloqueadaHoy(pauta);
    navigation.navigate('PautaDetail', {
      id: pauta.id,
      pautaInicial: pauta,
      soloConsulta: cumplida || bloqueadaHoy,
      bloqueadaHoy,
    });
  };

  const abrirPautaDesdeRespuesta = async (item, clave) => {
    await marcarComoVisto(clave);
    const pautaId = obtenerPautaIdRespuesta(item);
    if (!pautaId) return;
    const encontrada = Array.isArray(pautas)
      ? pautas.find((p) => Number(p?.id) === Number(pautaId))
      : null;

    const cumplida = encontrada ? esPautaCumplida(encontrada) : false;
    const bloqueadaHoy = encontrada ? esPautaBloqueadaHoy(encontrada) : false;

    navigation.navigate('PautaDetail', {
      id: encontrada?.id ?? pautaId,
      pautaInicial: encontrada || null,
      soloConsulta: cumplida || bloqueadaHoy,
      bloqueadaHoy,
    });
  };

  const respuestasVisibles = respuestasKine
    .map((item, idx) => ({ item, clave: obtenerClaveRespuesta(item, idx) }))
    .filter(({ clave }) => !respuestasOcultas[clave])
    .slice(0, 4);

  const cantidadNuevas = respuestasVisibles.filter(({ clave }) => !respuestasVistas[clave]).length;
  const hayLeidasVisibles = respuestasVisibles.some(({ clave }) => Boolean(respuestasVistas[clave]));

  return (
    <View style={[styles.mainWrapper, { paddingTop: insets.top, backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollPadding, { paddingBottom: Math.max(36, insets.bottom + 24) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={c.primary} />}
      >
        {/* Cabecera superior */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.subGreeting, { color: c.primary }]}>MI REHABILITACIÓN</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.greeting, { color: c.textMain }]}>
              ¡Hola, {nombrePaciente}!
            </Text>
            <Text style={{ color: c.textSub, fontSize: 14, fontWeight: '600', marginTop: 3, lineHeight: 20 }}>
              {mensajeMotivacional.emoji} {mensajeMotivacional.texto}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <View
                style={[
                  styles.kineTag,
                  {
                    backgroundColor: infoKine.asignado ? c.accentBg : c.surface,
                    borderColor: infoKine.asignado ? c.primary : c.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  color={infoKine.asignado ? c.accentText : c.textSub}
                  name={infoKine.asignado ? 'stethoscope' : 'account-clock-outline'}
                  size={15}
                />
                <Text style={[styles.kineText, { color: infoKine.asignado ? c.accentText : c.textSub }]}>
                  {infoKine.asignado ? `Kinesiólogo: ${infoKine.nombre}` : 'En espera de asignación'}
                </Text>
              </View>

              {pendientesOffline > 0 && (
                <View
                  style={[
                    styles.kineTag,
                    { backgroundColor: c.warningBg, borderColor: c.warning },
                  ]}
                >
                  <MaterialCommunityIcons color={c.warning} name="cloud-upload-outline" size={15} />
                  <Text style={[styles.kineText, { color: c.warning }]}>
                    {pendientesOffline} por enviar
                  </Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Perfil')}
            style={[styles.avatarPlaceholder, { backgroundColor: c.accentBg, borderColor: c.primary }]}
          >
            <Text style={[styles.avatarText, { color: c.primary }]}>
              {nombrePaciente.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tarjeta de Adherencia Semanal (solo si tiene pautas activas) */}
        {pautas.length > 0 && (
          <View style={[styles.heroCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.statsHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.miniIconBox, { backgroundColor: metaGlobalCumplida ? c.successBg : c.accentBg }]}>
                  <MaterialCommunityIcons
                    color={metaGlobalCumplida ? c.success : c.primary}
                    name={metaGlobalCumplida ? 'trophy-outline' : 'target'}
                    size={18}
                  />
                </View>
                <Text style={[styles.statsTitle, { color: c.textMain }]}>Adherencia semanal</Text>
              </View>

              <View
                style={[
                  styles.goalBadge,
                  { backgroundColor: metaGlobalCumplida ? c.successBg : c.surfaceSoft },
                ]}
              >
                <Text
                  style={{
                    color: metaGlobalCumplida ? c.success : c.textSub,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {metaGlobalCumplida ? '✓ Meta semanal cumplida' : `${Math.round(progreso * 100)}%`}
                </Text>
              </View>
            </View>

            <View style={styles.progressNumbersRow}>
              <Text style={[styles.currentSessions, { color: c.textMain }]}>
                {Math.min(sesionesSemana, metaSemanal)}
              </Text>
              <Text style={[styles.totalSessions, { color: c.textSub }]}>
                {' '}/ {metaSemanal} sesiones esta semana
              </Text>
            </View>

            <ProgressBar
              color={metaGlobalCumplida ? c.success : c.primary}
              progress={progreso}
              style={[styles.thickProgressBar, { backgroundColor: c.surfaceSoft }]}
            />
          </View>
        )}

        {/* Listado de Pautas Activas o Guía de Onboarding */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: c.textMain }]}>Tus pautas activas</Text>
          <View style={[styles.badge, { backgroundColor: c.accentBg }]}>
            <Text style={[styles.badgeText, { color: c.accentText }]}>{pautas.length}</Text>
          </View>
        </View>

        {pautas.length === 0 ? (
          <View style={[styles.onboardingCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.onboardingIconBox, { backgroundColor: c.accentBg }]}>
                <MaterialCommunityIcons name="clipboard-text-clock-outline" size={26} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textMain, fontSize: 16.5, fontWeight: '800' }}>
                  Tu plan terapéutico está en preparación
                </Text>
                <Text style={{ color: c.textSub, fontSize: 13.5, marginTop: 2, lineHeight: 19 }}>
                  {infoKine.asignado
                    ? `${infoKine.nombre} aún no ha publicado tu rutina activa.`
                    : 'Tu cuenta está activa y lista para recibir tu primera pauta.'}
                </Text>
              </View>
            </View>

            <View style={[styles.onboardingStepsBox, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
              <View style={styles.onboardingStepRow}>
                <Text style={[styles.onboardingStepNum, { backgroundColor: c.accentBg, color: c.primary }]}>1</Text>
                <Text style={{ flex: 1, color: c.textMain, fontSize: 13.5, lineHeight: 19 }}>
                  Tu kinesiólogo configurará tus ejercicios según tu evaluación clínica.
                </Text>
              </View>

              <View style={styles.onboardingStepRow}>
                <Text style={[styles.onboardingStepNum, { backgroundColor: c.accentBg, color: c.primary }]}>2</Text>
                <Text style={{ flex: 1, color: c.textMain, fontSize: 13.5, lineHeight: 19 }}>
                  Desliza hacia abajo o pulsa <Text style={{ fontWeight: '800' }}>Actualizar</Text> cuando te avisen que ya está lista.
                </Text>
              </View>

              <View style={styles.onboardingStepRow}>
                <Text style={[styles.onboardingStepNum, { backgroundColor: c.accentBg, color: c.primary }]}>3</Text>
                <Text style={{ flex: 1, color: c.textMain, fontSize: 13.5, lineHeight: 19 }}>
                  Si ingresaste con clave temporal, te recomendamos actualizarla en <Text style={{ fontWeight: '800' }}>Mi Perfil</Text>.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                mode="contained"
                icon="refresh"
                onPress={onRefresh}
                loading={refreshing}
                buttonColor={c.primary}
                textColor={isDark ? '#0F172A' : '#FFFFFF'}
                style={{ flex: 1, borderRadius: 12 }}
              >
                Actualizar
              </Button>
              <Button
                mode="outlined"
                icon="account-cog-outline"
                onPress={() => navigation.navigate('Perfil')}
                textColor={c.textMain}
                style={{ flex: 1, borderRadius: 12, borderColor: c.border }}
              >
                Mi Perfil
              </Button>
            </View>
          </View>
        ) : (
          pautas.map((p) => {
            const totalEj = p.total_ejercicios ?? p.ejercicios_detalle?.length ?? 0;
            const pautaCumplida = esPautaCumplida(p);
            const pautaBloqueadaHoy = esPautaBloqueadaHoy(p);
            const soloLectura = pautaCumplida || pautaBloqueadaHoy;
            const metaP = Math.max(1, Number(p.frecuencia_semanal || p.meta_semanal || 3));
            const hechasP = p.sesiones_semana != null ? Math.min(Number(p.sesiones_semana), metaP) : null;
            const indicacion = (p.notas || '').trim();

            return (
              <TouchableOpacity
                activeOpacity={0.78}
                key={p.id}
                onPress={() => abrirPauta(p)}
                style={[
                  styles.pautaItem,
                  {
                    backgroundColor: c.surface,
                    borderColor: pautaCumplida ? c.success : pautaBloqueadaHoy ? c.warning : c.border,
                  },
                ]}
              >
                <View style={styles.pautaTopRow}>
                  <View
                    style={[
                      styles.pautaIconWrapper,
                      {
                        backgroundColor: pautaCumplida
                          ? c.successBg
                          : pautaBloqueadaHoy
                          ? c.warningBg
                          : c.accentBg,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      color={pautaCumplida ? c.success : pautaBloqueadaHoy ? c.warning : c.primary}
                      name={
                        pautaCumplida
                          ? 'check-decagram-outline'
                          : pautaBloqueadaHoy
                          ? 'calendar-check-outline'
                          : 'dumbbell'
                      }
                      size={24}
                    />
                  </View>

                  <View style={styles.pautaInfo}>
                    <Text numberOfLines={1} style={[styles.pautaTitle, { color: c.textMain }]}>
                      {p.titulo}
                    </Text>
                    <Text style={[styles.pautaSubtitle, { color: c.textSub }]}>
                      {totalEj} {totalEj === 1 ? 'ejercicio' : 'ejercicios'} •{' '}
                      {pautaCumplida
                        ? `Meta semanal cumplida (${metaP}/${metaP})`
                        : pautaBloqueadaHoy
                        ? `Sesión de hoy completada (${hechasP ?? 1}/${metaP})`
                        : hechasP != null
                        ? `${hechasP}/${metaP} sesiones esta semana`
                        : `Frecuencia: ${metaP}x/semana`}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.actionPill,
                      { backgroundColor: soloLectura ? c.accentBg : c.primary },
                    ]}
                  >
                    <Text
                      style={{
                        color: soloLectura ? c.primary : (isDark ? '#0F172A' : '#FFFFFF'),
                        fontSize: 12.5,
                        fontWeight: '800',
                      }}
                    >
                      {soloLectura ? 'Repasar' : 'Iniciar'}
                    </Text>
                  </View>
                </View>

                {!!indicacion && (
                  <View style={[styles.indicacionPreview, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
                    <MaterialCommunityIcons name="clipboard-text-outline" size={16} color={c.primary} />
                    <Text numberOfLines={2} style={{ flex: 1, color: c.accentText, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
                      Indicación: {indicacion}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* Indicaciones y Respuestas del Kinesiólogo */}
        <View style={[styles.sectionHeader, { marginTop: 14, justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.sectionTitle, { color: c.textMain }]}>Indicaciones del kinesiólogo</Text>
            {respuestasVisibles.length > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: cantidadNuevas > 0 ? c.accentBg : c.surfaceSoft },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: cantidadNuevas > 0 ? c.accentText : c.textSub },
                  ]}
                >
                  {cantidadNuevas > 0
                    ? `${cantidadNuevas} nueva${cantidadNuevas > 1 ? 's' : ''}`
                    : 'Leídas'}
                </Text>
              </View>
            )}
          </View>

          {hayLeidasVisibles && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => limpiarRespuestasLeidas(respuestasVisibles)}
            >
              <Text style={{ color: c.textSub, fontSize: 12.5, fontWeight: '700' }}>
                Limpiar leídas
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {respuestasVisibles.length === 0 ? (
          <View style={[styles.respuestaEmptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <MaterialCommunityIcons name="message-text-outline" size={20} color={c.textSub} />
            <Text style={{ flex: 1, color: c.textSub, fontSize: 13.5, lineHeight: 19 }}>
              No tienes indicaciones nuevas de tu kinesiólogo.
            </Text>
          </View>
        ) : (
          respuestasVisibles.map(({ item, clave }) => {
            const fechaTexto = formatearFechaCorta(item.fecha_respuesta || item.fecha_ejecucion);
            const tituloPauta = item.pauta_titulo || item.titulo_pauta || '';
            const autorKine = capitalizarNombre(item.kinesiologo_nombre || infoKine.nombre || 'Tu Kinesiólogo');
            const pautaId = obtenerPautaIdRespuesta(item);
            const yaVisto = Boolean(respuestasVistas[clave]);
            const esNueva = !yaVisto;

            return (
              <TouchableOpacity
                activeOpacity={0.85}
                key={clave}
                onPress={() => {
                  if (pautaId != null) {
                    abrirPautaDesdeRespuesta(item, clave);
                  } else if (esNueva) {
                    marcarComoVisto(clave);
                  }
                }}
                style={[
                  styles.respuestaCard,
                  {
                    backgroundColor: esNueva ? c.surfaceSoft : c.surface,
                    borderColor: esNueva ? c.primary : c.border,
                    borderLeftColor: esNueva ? c.primary : c.border,
                    borderWidth: esNueva ? 1.5 : 1,
                    opacity: esNueva ? 1 : 0.9,
                  },
                ]}
              >
                <View style={styles.respuestaHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <MaterialCommunityIcons
                      name="doctor"
                      size={16}
                      color={esNueva ? c.primary : c.textSub}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.respuestaTitle,
                        { color: esNueva ? c.primary : c.textSub },
                      ]}
                    >
                      {tituloPauta ? `${autorKine} • ${tituloPauta}` : autorKine}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {esNueva ? (
                      <View style={[styles.nuevaPill, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
                        <Text style={[styles.nuevaText, { color: c.accentText }]}>Nueva</Text>
                      </View>
                    ) : (
                      <View style={[styles.nuevaPill, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
                        <Text style={[styles.nuevaText, { color: c.textSub }]}>✓ Leída</Text>
                      </View>
                    )}

                    {!!fechaTexto && (
                      <Text style={{ color: c.textSub, fontSize: 11.5, fontWeight: '600' }}>
                        {fechaTexto}
                      </Text>
                    )}

                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => ocultarRespuesta(clave)}
                      style={[styles.closeMsgBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
                    >
                      <MaterialCommunityIcons name="close" size={14} color={c.textSub} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text
                  style={{
                    color: esNueva ? c.textMain : c.textSub,
                    fontSize: 14.5,
                    lineHeight: 20,
                    fontWeight: esNueva ? '600' : '400',
                  }}
                >
                  {String(item.respuesta_kinesiologo).trim()}
                </Text>

                {(esNueva || pautaId != null) && (
                  <View style={styles.respuestaFooterRow}>
                    {esNueva ? (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => marcarComoVisto(clave)}
                        style={[styles.vistoBtn, { backgroundColor: c.accentBg, borderColor: c.primary }]}
                      >
                        <MaterialCommunityIcons name="check" size={14} color={c.primary} />
                        <Text style={[styles.verPautaLink, { color: c.primary }]}>
                          Marcar como leída
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}

                    {pautaId != null && (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => abrirPautaDesdeRespuesta(item, clave)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <Text style={[styles.verPautaLink, { color: c.primary }]}>
                          Ir a la pauta
                        </Text>
                        <MaterialCommunityIcons name="arrow-right" size={14} color={c.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1 },
  scrollPadding: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  headerTextContainer: { flex: 1 },
  subGreeting: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 29,
  },
  kineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  kineText: { fontSize: 12.5, fontWeight: '700' },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 19, fontWeight: '800' },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 22,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  miniIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsTitle: { fontSize: 15.5, fontWeight: '700' },
  goalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  progressNumbersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  currentSessions: { fontSize: 30, fontWeight: '900' },
  totalSessions: { fontSize: 14.5, fontWeight: '600' },
  thickProgressBar: { height: 9, borderRadius: 5 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17.5, fontWeight: '800' },
  badge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12.5, fontWeight: '800' },
  onboardingCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    gap: 14,
    marginBottom: 12,
  },
  onboardingIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingStepsBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    gap: 10,
  },
  onboardingStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  onboardingStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
  pautaItem: {
    padding: 15,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 12,
    gap: 10,
  },
  pautaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pautaIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pautaInfo: { flex: 1 },
  pautaTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  pautaSubtitle: { fontSize: 13 },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicacionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  respuestaEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  respuestaCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 10,
    gap: 8,
  },
  respuestaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  respuestaTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  nuevaPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  nuevaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  closeMsgBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  respuestaFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  vistoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  verPautaLink: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});