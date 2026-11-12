import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Checkbox, Chip, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import EvaModal from '../components/EvaModal';
import Skeleton from '../components/Skeleton';
import api from '../services/api';
import { cacheGet, cacheSet, enviarFeedback } from '../services/offline';

// Componente para Video
function VideoMedia({ uri }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; });
  return <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />;
}

// Componente Multimedia Híbrido (Imagen/Video)
function Media({ url }) {
  if (!url) return null;
  return /\.(mp4|mov|m4v)(\?|$)/i.test(url)
    ? <VideoMedia uri={url} />
    : <Image source={{ uri: url }} style={styles.media} contentFit="contain" />;
}

// Cronómetro Visual Interactivo para Descansos
function WorkoutTimer({ seconds, label = 'Descanso', icon = 'timer-outline' }) {
  const [left, setLeft] = useState(null);
  const theme = useTheme();

  useEffect(() => {
    if (left === null) return;
    if (left === 0) { 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
      setLeft(null); 
      return; 
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const isRunning = left !== null;

  return (
    <Button 
      icon={icon} 
      mode={isRunning ? "contained" : "outlined"} 
      compact 
      disabled={isRunning} 
      onPress={() => setLeft(seconds)}
      buttonColor={isRunning ? theme.colors.primary : undefined}
    >
      {isRunning ? `${left}s` : `${label} ${seconds}s`}
    </Button>
  );
}

export default function PautaDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [pauta, setPauta] = useState(null);
  const [error, setError] = useState(false);
  const [hechos, setHechos] = useState({});
  const [evaOpen, setEvaOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    try {
      const { data } = await api.get(`/api/pautas/${id}/`);
      setPauta(data); 
      cacheSet(`pauta_${id}`, data);
    } catch {
      const c = await cacheGet(`pauta_${id}`);
      c ? setPauta(c) : setError(true);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <EmptyState icon="wifi-off" title="No pudimos cargar la pauta" onRetry={cargar} />
      </View>
    );
  }
  
  if (!pauta) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
          <Skeleton height={100} /><Skeleton height={220} /><Skeleton height={220} />
        </ScrollView>
      </View>
    );
  }

  const ejerciciosSeguros = pauta.ejercicios || [];
  const total = ejerciciosSeguros.length;
  const completados = ejerciciosSeguros.filter((e) => hechos[e.id]).length;
  const progreso = total ? completados / total : 0;

  const toggle = (eid) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHechos((h) => ({ ...h, [eid]: !h[eid] }));
  };

  const enviar = async (nivel, comentario) => {
    setSending(true);
    try {
      const estado = await enviarFeedback({ pauta: pauta.id, nivel_dolor: nivel, comentario });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEvaOpen(false);
      Alert.alert(
        '¡Sesión registrada!',
        estado === 'enviado' ? 'Tu kinesiólogo ya puede ver tu avance.' : 'Sin conexión: se enviará automáticamente cuando recuperes señal.'
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'No se pudo registrar el feedback.');
    } finally { 
      setSending(false); 
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
        
        {/* Cabecera y Notas del Kinesiólogo */}
        <View style={styles.headerBox}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: 'bold' }}>
            {pauta.titulo || 'Tu Sesión'}
          </Text>
        </View>

        {!!pauta.notas && (
          <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Card.Title 
              title="Indicaciones clínicas" 
              left={(p) => <Card.Title {...p} />} 
              titleVariant="titleSmall" 
              titleStyle={{ color: theme.colors.primary }}
            />
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{pauta.notas}</Text>
            </Card.Content>
          </Card>
        )}

        {/* Barra de Progreso */}
        <View style={{ marginVertical: 8 }}>
          <ProgressBar progress={progreso} style={{ height: 8, borderRadius: 4 }} color={theme.colors.primary} />
          <Text variant="bodySmall" style={{ marginTop: 6, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            {completados} de {total} ejercicios completados
          </Text>
        </View>

        {/* Lista Interactiva de Ejercicios */}
        {ejerciciosSeguros.map((e, index) => (
          <Card key={e.id} style={[styles.card, hechos[e.id] && { opacity: 0.6 }]} mode="elevated">
            <Media url={e.media_url} />
            <Card.Title 
              title={`${index + 1}. ${e.nombre || e.ejercicio?.nombre}`} 
              subtitle={`${e.series} series × ${e.repeticiones} reps`}
              titleStyle={{ fontWeight: 'bold', color: theme.colors.onSurface }}
              right={() => (
                <Checkbox 
                  status={hechos[e.id] ? 'checked' : 'unchecked'} 
                  onPress={() => toggle(e.id)} 
                  color={theme.colors.primary}
                />
              )} 
            />
            <Card.Content style={styles.row}>
              <Chip compact icon="human" style={{ backgroundColor: theme.colors.surfaceVariant }}>
                {e.zona || e.ejercicio?.zona || 'General'}
              </Chip>
              
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Botón de descanso basado en el backend de Nicolás */}
                {!!e.descanso_seg && (
                  <WorkoutTimer seconds={e.descanso_seg} label="Descanso" />
                )}
              </View>
            </Card.Content>
          </Card>
        ))}

        {/* Botón de Finalizar que levanta el Modal del Feedback de Dolor */}
        <Button 
          mode="contained" 
          style={styles.finishButton} 
          contentStyle={{ paddingVertical: 8 }}
          disabled={total > 0 && completados === 0} 
          onPress={() => setEvaOpen(true)}
        >
          Finalizar sesión y enviar feedback
        </Button>
      </ScrollView>

      {/* Modal de Escala EVA */}
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
  screen: {
    flex: 1,
  },
  container: { 
    padding: 16, 
    gap: 8, 
    paddingBottom: 60 
  },
  headerBox: {
    marginBottom: 8,
  },
  card: { 
    borderRadius: 20, 
    marginBottom: 12, 
    overflow: 'hidden' 
  },
  media: { 
    width: '100%', 
    height: 200, 
    backgroundColor: '#000' 
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  finishButton: {
    marginTop: 16,
    borderRadius: 30,
  }
});