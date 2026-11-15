import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import api from '../services/api';
import { cacheGet, cacheSet, vaciarCola } from '../services/offline';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [me, setMe] = useState(null);
  const [pautas, setPautas] = useState(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    try {
      vaciarCola();
      const [m, p] = await Promise.all([api.get('/api/me/'), api.get('/api/pautas/')]);
      const lista = p.data.results ?? p.data;
      setMe(m.data);
      setPautas(lista);
      cacheSet('home', { me: m.data, pautas: lista });
    } catch {
      const c = await cacheGet('home');
      if (c) {
        setMe(c.me);
        setPautas(c.pautas);
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

  // EL RANDOMIZER DEBE IR AQUÍ, ANTES DE CUALQUIER "IF"
  const saludoAleatorio = useMemo(() => {
    const frases = [
      "¡A darlo todo hoy",
      "Listo para tu sesión",
      "Un día más de progreso",
      "Tu cuerpo te lo agradecerá",
      "Vamos por esa meta",
      "Excelente día para moverte",
      "Tu rehabilitación te espera"
    ];
    const emojis = ["💪", "🏃‍♂️", "🔥", "✨", "🙌", "🚀", "🦴"];

    const frase = frases[Math.floor(Math.random() * frases.length)];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    return { frase, emoji };
  }, []);

  // AHORA SÍ VAN LOS "IF" QUE RETORNAN VISTAS DE CARGA O ERROR
  if (error) {
    return (
      <View style={[styles.mainWrapper, { paddingTop: insets.top }]}>
         <EmptyState icon="wifi-off" onRetry={cargar} subtitle="Revisa tu conexión e inténtalo otra vez." title="No pudimos cargar tus datos" />
      </View>
    );
  }

  if (!me || !pautas) {
    return (
      <ScrollView style={styles.mainWrapper} contentContainerStyle={[styles.scrollPadding, { paddingTop: insets.top + 24 }]}>
        <Skeleton height={80} />
        <Skeleton height={140} />
        <Skeleton height={100} />
      </ScrollView>
    );
  }

  const progreso = Math.min(1, me.sesiones_semana / me.meta_semanal);

  return (
    <View style={[styles.mainWrapper, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor="#0284C7" />}
      >

        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            {/* AQUÍ SE IMPRIME EL SALUDO ALEATORIO */}
            <Text style={styles.greeting}>{saludoAleatorio.frase}, {me.nombre} {saludoAleatorio.emoji}</Text>
            {me.kinesiologo ? (
              <View style={styles.kineTag}>
                <MaterialCommunityIcons color="#0284C7" name="stethoscope" size={14} />
                <Text style={styles.kineText}>Kinesiólogo: {me.kinesiologo.nombre}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{me.nombre ? me.nombre.charAt(0).toUpperCase() : ''}</Text>
          </View>
        </View>

        <View style={styles.statsWidget}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Progreso semanal</Text>
            <MaterialCommunityIcons color="#0284C7" name="target" size={20} />
          </View>

          <View style={styles.progressNumbersRow}>
            <Text style={styles.currentSessions}>{me.sesiones_semana}</Text>
            <Text style={styles.totalSessions}> / {me.meta_semanal} sesiones</Text>
          </View>

          <ProgressBar color="#0284C7" progress={progreso} style={styles.thickProgressBar} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tus pautas activas</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pautas.length}</Text>
          </View>
        </View>

        {pautas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState onRetry={cargar} subtitle="Tu kinesiólogo te asignará una pronto." title="Aún no tienes pautas" />
          </View>
        ) : (
          pautas.map((p) => (
            <TouchableOpacity activeOpacity={0.7} key={p.id} onPress={() => navigation.navigate('PautaDetail', { id: p.id })} style={styles.pautaItem}>
              <View style={styles.pautaIconWrapper}>
                <MaterialCommunityIcons color="#0284C7" name="clipboard-text-play-outline" size={26} />
              </View>

              <View style={styles.pautaInfo}>
                <Text numberOfLines={1} style={styles.pautaTitle}>{p.titulo}</Text>
                <Text style={styles.pautaSubtitle}>
                  {p.total_ejercicios} ejercicios • {new Date(p.fecha_creacion).toLocaleDateString('es-CL')}
                </Text>
              </View>

              <View style={styles.playButton}>
                <MaterialCommunityIcons color="#94A3B8" name="chevron-right" size={24} />
              </View>
            </TouchableOpacity>
          ))
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollPadding: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 28,
  },
  headerTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  kineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#E0F2FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kineText: {
    fontSize: 13,
    color: '#0369A1',
    fontWeight: '600',
    marginLeft: 4,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  statsWidget: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  progressNumbersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
    marginBottom: 16,
  },
  currentSessions: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalSessions: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 4,
  },
  thickProgressBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  emptyContainer: {
    marginTop: 20,
  },
  pautaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pautaIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  pautaInfo: {
    flex: 1,
  },
  pautaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  pautaSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  playButton: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'flex-end',
  }
});