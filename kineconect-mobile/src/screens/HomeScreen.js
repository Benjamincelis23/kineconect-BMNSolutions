import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import api from '../services/api';
import { cacheGet, cacheSet, contarPendientesCola, vaciarCola } from '../services/offline';

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
    nombre: nombre || 'Kinesiólogo Asignado',
  };
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDark = theme.dark;

  const [me, setMe] = useState(null);
  const [pautas, setPautas] = useState(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendientesOffline, setPendientesOffline] = useState(0);

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
  };

  const cargar = useCallback(async () => {
    setError(false);
    try {
      await vaciarCola();
      const [m, p, pend] = await Promise.all([
        api.get('/api/me/'),
        api.get('/api/pautas/'),
        contarPendientesCola(),
      ]);
      const lista = p.data.results ?? p.data;
      setMe(m.data);
      setPautas(lista);
      setPendientesOffline(pend);
      cacheSet('home', { me: m.data, pautas: lista });
    } catch {
      const [cData, pend] = await Promise.all([cacheGet('home'), contarPendientesCola()]);
      setPendientesOffline(pend);
      if (cData) {
        setMe(cData.me);
        setPautas(cData.pautas);
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

  const saludoAleatorio = useMemo(() => {
    const frases = [
      '¡A darlo todo hoy',
      'Listo para tu sesión',
      'Un día más de progreso',
      'Tu cuerpo te lo agradecerá',
      'Vamos por esa meta',
      'Excelente día para moverte',
    ];
    const emojis = ['💪', '🏃‍♂️', '🔥', '✨', '🙌', '🚀'];
    return {
      frase: frases[Math.floor(Math.random() * frases.length)],
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    };
  }, []);

  if (error) {
    return (
      <View style={[styles.mainWrapper, { paddingTop: insets.top, backgroundColor: c.bg }]}>
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
        contentContainerStyle={[styles.scrollPadding, { paddingTop: insets.top + 24 }]}
      >
        <Skeleton height={80} />
        <Skeleton height={160} />
        <Skeleton height={110} />
      </ScrollView>
    );
  }

  const metaSemanal = Math.max(1, Number(me.meta_semanal || 3));
  const sesionesSemana = Number(me.sesiones_semana || 0);
  const progreso = Math.min(1, sesionesSemana / metaSemanal);
  const metaGlobalCumplida = sesionesSemana >= metaSemanal;
  const infoKine = obtenerInfoKinesiologo(me, pautas);

  const esPautaCumplida = (pauta) => {
    if (!pauta) return metaGlobalCumplida;
    const metaP = Math.max(1, Number(pauta.meta_semanal || 3));
    if (pauta.sesiones_semana != null) {
      return Number(pauta.sesiones_semana) >= metaP;
    }
    return metaGlobalCumplida;
  };

  const pautaPrincipal = pautas.find((p) => !esPautaCumplida(p)) || (pautas.length > 0 ? pautas[0] : null);
  const principalCumplida = pautaPrincipal ? esPautaCumplida(pautaPrincipal) : metaGlobalCumplida;

  const abrirPauta = (pauta) => {
    navigation.navigate('PautaDetail', {
      id: pauta.id,
      soloConsulta: esPautaCumplida(pauta),
    });
  };

  return (
    <View style={[styles.mainWrapper, { paddingTop: insets.top, backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={c.primary} />}
      >
        {/* Cabecera superior */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.subGreeting, { color: c.primary }]}>PANEL DEL PACIENTE</Text>
            <Text style={[styles.greeting, { color: c.textMain }]}>
              {saludoAleatorio.frase}, {me.nombre || 'Paciente'} {saludoAleatorio.emoji}
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
                  size={14}
                />
                <Text style={[styles.kineText, { color: infoKine.asignado ? c.accentText : c.textSub }]}>
                  {infoKine.asignado ? infoKine.nombre : 'Sin kinesiólogo asignado'}
                </Text>
              </View>

              <View
                style={[
                  styles.kineTag,
                  {
                    backgroundColor: pendientesOffline > 0 ? c.warningBg : c.successBg,
                    borderColor: pendientesOffline > 0 ? c.warning : c.success,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  color={pendientesOffline > 0 ? c.warning : c.success}
                  name={pendientesOffline > 0 ? 'cloud-upload-outline' : 'cloud-check-outline'}
                  size={14}
                />
                <Text style={[styles.kineText, { color: pendientesOffline > 0 ? c.warning : c.success }]}>
                  {pendientesOffline > 0 ? `${pendientesOffline} por sincronizar` : 'Sincronizado'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Perfil')}
            style={[styles.avatarPlaceholder, { backgroundColor: c.accentBg, borderColor: c.primary }]}
          >
            <Text style={[styles.avatarText, { color: c.primary }]}>
              {me.nombre ? me.nombre.charAt(0).toUpperCase() : 'P'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tarjeta Hero: Progreso Semanal + Acción Rápida */}
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
                  fontSize: 11.5,
                  fontWeight: '700',
                }}
              >
                {metaGlobalCumplida ? '✓ Meta cumplida' : `${Math.round(progreso * 100)}%`}
              </Text>
            </View>
          </View>

          <View style={styles.progressNumbersRow}>
            <Text style={[styles.currentSessions, { color: c.textMain }]}>
              {Math.min(sesionesSemana, metaSemanal)}
            </Text>
            <Text style={[styles.totalSessions, { color: c.textSub }]}>
              {' '}/ {metaSemanal} sesiones completadas
            </Text>
          </View>

          <ProgressBar
            color={metaGlobalCumplida ? c.success : c.primary}
            progress={progreso}
            style={[styles.thickProgressBar, { backgroundColor: c.surfaceSoft }]}
          />

          {metaGlobalCumplida && (
            <View style={[styles.restNoticeBox, { backgroundColor: c.successBg, borderColor: c.success }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={c.success} />
              <Text style={{ flex: 1, color: c.success, fontSize: 12.5, fontWeight: '700', lineHeight: 17 }}>
                Meta semanal completada. Puedes repasar tus videos y técnica en modo solo consulta.
              </Text>
            </View>
          )}

          {pautaPrincipal && (
            <Button
              mode={principalCumplida ? 'outlined' : 'contained'}
              icon={principalCumplida ? 'eye-outline' : 'play'}
              onPress={() => abrirPauta(pautaPrincipal)}
              buttonColor={principalCumplida ? c.accentBg : c.primary}
              textColor={principalCumplida ? c.primary : (isDark ? '#0F172A' : '#FFFFFF')}
              style={[
                { marginTop: 16, borderRadius: 14 },
                principalCumplida && { borderColor: c.primary, borderWidth: 1.5 },
              ]}
              contentStyle={{ paddingVertical: 4 }}
            >
              {principalCumplida
                ? `Repasar ejercicios: ${pautaPrincipal.titulo}`
                : `Entrenar: ${pautaPrincipal.titulo}`}
            </Button>
          )}
        </View>

        {/* Listado de Pautas Activas */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: c.textMain }]}>Tus pautas activas</Text>
          <View style={[styles.badge, { backgroundColor: c.accentBg }]}>
            <Text style={[styles.badgeText, { color: c.accentText }]}>{pautas.length}</Text>
          </View>
        </View>

        {pautas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              onRetry={cargar}
              subtitle="Tu kinesiólogo te asignará una rutina pronto."
              title="Aún no tienes pautas"
            />
          </View>
        ) : (
          pautas.map((p) => {
            const totalEj = p.total_ejercicios ?? p.ejercicios_detalle?.length ?? 0;
            const pautaCumplida = esPautaCumplida(p);
            const metaP = Math.max(1, Number(p.meta_semanal || 3));
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
                    borderColor: pautaCumplida ? c.success : c.border,
                  },
                ]}
              >
                <View style={styles.pautaTopRow}>
                  <View
                    style={[
                      styles.pautaIconWrapper,
                      { backgroundColor: pautaCumplida ? c.successBg : c.accentBg },
                    ]}
                  >
                    <MaterialCommunityIcons
                      color={pautaCumplida ? c.success : c.primary}
                      name={pautaCumplida ? 'book-open-page-variant-outline' : 'dumbbell'}
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
                        ? 'Modo solo consulta (repaso técnico)'
                        : hechasP != null
                        ? `${hechasP}/${metaP} sesiones esta semana`
                        : `Asignada el ${new Date(p.fecha_creacion).toLocaleDateString('es-CL')}`}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.playPill,
                      {
                        backgroundColor: pautaCumplida ? c.accentBg : c.primary,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      color={pautaCumplida ? c.primary : (isDark ? '#0F172A' : '#FFFFFF')}
                      name={pautaCumplida ? 'eye-outline' : 'chevron-right'}
                      size={20}
                    />
                  </View>
                </View>

                {!!indicacion && (
                  <View style={[styles.indicacionPreview, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
                    <MaterialCommunityIcons name="clipboard-text-outline" size={15} color={c.primary} />
                    <Text numberOfLines={2} style={{ flex: 1, color: c.accentText, fontSize: 12, fontWeight: '600', lineHeight: 16 }}>
                      Indicación: {indicacion}
                    </Text>
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
    marginBottom: 20,
    gap: 12,
  },
  headerTextContainer: { flex: 1 },
  subGreeting: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
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
  kineText: { fontSize: 12, fontWeight: '700' },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800' },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 24,
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
  statsTitle: { fontSize: 15, fontWeight: '700' },
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
  totalSessions: { fontSize: 14, fontWeight: '600' },
  thickProgressBar: { height: 9, borderRadius: 5 },
  restNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  badge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12.5, fontWeight: '800' },
  emptyContainer: { marginTop: 12 },
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
  pautaTitle: { fontSize: 15.5, fontWeight: '700', marginBottom: 3 },
  pautaSubtitle: { fontSize: 12.5 },
  playPill: {
    width: 34,
    height: 34,
    borderRadius: 11,
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
});