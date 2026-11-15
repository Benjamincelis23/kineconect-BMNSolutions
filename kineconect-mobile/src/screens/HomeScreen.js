import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import api from '../services/api';
import { cacheGet, cacheSet, vaciarCola } from '../services/offline';

export default function HomeScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [me, setMe] = useState(null);
  const [pautas, setPautas] = useState(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    try {
      vaciarCola(); // sincroniza feedback pendiente si ya hay señal
      const [m, p] = await Promise.all([api.get('/api/me/'), api.get('/api/pautas/')]);
      const lista = p.data.results ?? p.data;
      setMe(m.data); setPautas(lista);
      cacheSet('home', { me: m.data, pautas: lista });
    } catch {
      const c = await cacheGet('home'); // modo offline: última versión guardada
      if (c) { setMe(c.me); setPautas(c.pautas); } else setError(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  if (error) return <EmptyState icon="wifi-off" title="No pudimos cargar tus datos"
    subtitle="Revisa tu conexión e inténtalo otra vez." onRetry={cargar} />;

  // Vista de carga (Skeleton) arreglada con fondo y padding
  if (!me || !pautas) return (
    <ScrollView 
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      <Skeleton height={130} /><Skeleton /><Skeleton />
    </ScrollView>
  );

  const progreso = Math.min(1, me.sesiones_semana / me.meta_semanal);

  return (
    <ScrollView 
      style={{ backgroundColor: theme.colors.background }} // Forza el color de fondo general
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]} // Empuja el contenido hacia abajo
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={styles.card} mode="elevated">
        <Card.Content style={{ gap: 8 }}>
          <Text variant="headlineSmall">Hola, {me.nombre} 👋</Text>
          {me.kinesiologo && <Text variant="bodyMedium">Tu kinesiólogo: {me.kinesiologo.nombre}</Text>}
          <ProgressBar progress={progreso} style={{ height: 8, borderRadius: 4 }} />
          <Text variant="bodySmall">{me.sesiones_semana} de {me.meta_semanal} sesiones esta semana</Text>
        </Card.Content>
      </Card>

      <Text variant="titleLarge" style={{ marginVertical: 8, color: theme.colors.onBackground }}>
        Tus pautas activas
      </Text>

      {pautas.length === 0 ? (
        <EmptyState title="Aún no tienes pautas" subtitle="Tu kinesiólogo te asignará una pronto." onRetry={cargar} />
      ) : pautas.map((p) => (
        <Card key={p.id} style={styles.card} mode="elevated">
          <Card.Title title={p.titulo} subtitle={`${p.total_ejercicios} ejercicios · ${new Date(p.fecha_creacion).toLocaleDateString('es-CL')}`} />
          <Card.Actions>
            <Button mode="contained" onPress={() => navigation.navigate('PautaDetail', { id: p.id })}>
              Comenzar sesión
            </Button>
          </Card.Actions>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4 },
  card: { borderRadius: 20, marginBottom: 12 },
});