import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Modal, Portal, Text, TextInput, useTheme } from 'react-native-paper';

const ESCALA_EVA = [
  { valor: 0, titulo: 'Sin dolor', guia: 'Ejecución limpia, sin molestias durante ni después.', color: '#10B981', icono: 'emoticon-happy-outline' },
  { valor: 1, titulo: 'Dolor muy leve', guia: 'Apenas perceptible, no interfiere con el movimiento.', color: '#22C55E', icono: 'emoticon-happy-outline' },
  { valor: 2, titulo: 'Dolor leve', guia: 'Molestia ligera que desaparece al entrar en calor.', color: '#4ADE80', icono: 'emoticon-neutral-outline' },
  { valor: 3, titulo: 'Dolor leve-moderado', guia: 'Se siente al exigir el rango, pero es totalmente tolerable.', color: '#84CC16', icono: 'emoticon-neutral-outline' },
  { valor: 4, titulo: 'Dolor moderado', guia: 'Molestia constante que exige bajar un poco el ritmo.', color: '#EAB308', icono: 'emoticon-confused-outline' },
  { valor: 5, titulo: 'Dolor moderado-alto', guia: 'Incomoda al completar las últimas repeticiones.', color: '#F59E0B', icono: 'emoticon-confused-outline' },
  { valor: 6, titulo: 'Dolor fuerte', guia: 'Limita parcialmente el rango o la fuerza del ejercicio.', color: '#F97316', icono: 'emoticon-sad-outline' },
  { valor: 7, titulo: 'Dolor intenso', guia: 'Cuesta mantener la técnica por la molestia.', color: '#EA580C', icono: 'emoticon-sad-outline' },
  { valor: 8, titulo: 'Dolor muy intenso', guia: 'Obliga a detener o modificar el ejercicio.', color: '#EF4444', icono: 'emoticon-cry-outline' },
  { valor: 9, titulo: 'Dolor severo', guia: 'Dolor agudo persistente incluso en reposo.', color: '#DC2626', icono: 'emoticon-cry-outline' },
  { valor: 10, titulo: 'Dolor insoportable', guia: 'Máximo dolor posible; requiere revisión kinésica.', color: '#B91C1C', icono: 'alert-circle-outline' },
];

const SENSACIONES_RAPIDAS = [
  'Buena tolerancia',
  'Fatiga muscular',
  'Rigidez / Tensión',
  'Molestia al final',
  'Mejor que la sesión anterior',
];

export default function EvaModal({ visible, onDismiss, onSubmit, sending }) {
  const theme = useTheme();
  const isDark = theme.dark;

  const [dolor, setDolor] = useState(0);
  const [tagsSeleccionados, setTagsSeleccionados] = useState([]);
  const [comentario, setComentario] = useState('');

  const c = {
    surface: isDark ? '#1E293B' : '#FFFFFF',
    surfaceSoft: isDark ? '#0F172A' : '#F8FAFC',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textSub: isDark ? '#94A3B8' : '#64748B',
    primary: isDark ? '#38BDF8' : '#0284C7',
    accentBg: isDark ? '#082F49' : '#E0F2FE',
  };

  const nivelActual = ESCALA_EVA[dolor] || ESCALA_EVA[0];

  const seleccionarValor = (val) => {
    Haptics.selectionAsync();
    setDolor(val);
  };

  const toggleTag = (tag) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTagsSeleccionados((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const limpiarYEnviar = () => {
    const partes = [];
    if (tagsSeleccionados.length > 0) {
      partes.push(`[${tagsSeleccionados.join(', ')}]`);
    }
    if (comentario.trim()) {
      partes.push(comentario.trim());
    }
    onSubmit(dolor, partes.join(' '));
    setDolor(0);
    setTagsSeleccionados([]);
    setComentario('');
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: c.textMain }]}>
            Evaluación Post-Sesión
          </Text>
          <Text style={[styles.subtitle, { color: c.textSub }]}>
            Indica tu nivel de dolor actual (Escala EVA 0–10)
          </Text>

          {/* Tarjeta dinámica del nivel seleccionado */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: c.surfaceSoft,
                borderColor: nivelActual.color,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View style={[styles.scoreBadge, { backgroundColor: nivelActual.color }]}>
                <Text style={styles.scoreNumber}>{nivelActual.valor}</Text>
                <Text style={styles.scoreMax}>/10</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons
                    name={nivelActual.icono}
                    size={18}
                    color={nivelActual.color}
                  />
                  <Text style={{ color: nivelActual.color, fontWeight: '800', fontSize: 15 }}>
                    {nivelActual.titulo}
                  </Text>
                </View>
                <Text style={{ color: c.textSub, fontSize: 12.5, marginTop: 3, lineHeight: 17 }}>
                  {nivelActual.guia}
                </Text>
              </View>
            </View>

            {/* Barra segmentada continua 0..10 */}
            <View style={styles.trackBar}>
              {ESCALA_EVA.map((item) => (
                <View
                  key={item.valor}
                  style={[
                    styles.trackSegment,
                    {
                      backgroundColor: item.valor <= dolor ? item.color : c.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Selector completo del 0 al 10 */}
          <View style={styles.gridNumeros}>
            {ESCALA_EVA.map((item) => {
              const activo = dolor === item.valor;
              return (
                <TouchableOpacity
                  key={item.valor}
                  activeOpacity={0.75}
                  onPress={() => seleccionarValor(item.valor)}
                  style={[
                    styles.numBtn,
                    {
                      backgroundColor: activo ? item.color : c.surfaceSoft,
                      borderColor: activo ? item.color : c.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: activo ? '#FFFFFF' : c.textMain,
                      fontWeight: activo ? '800' : '600',
                      fontSize: 14,
                    }}
                  >
                    {item.valor}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.extremosRow}>
            <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>0 • Sin dolor</Text>
            <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>5 • Moderado</Text>
            <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>10 • Máximo</Text>
          </View>

          {/* Sensaciones rápidas */}
          <Text style={[styles.sectionLabel, { color: c.textMain }]}>
            ¿Qué sensación predominó? (opcional)
          </Text>
          <View style={styles.tagsWrap}>
            {SENSACIONES_RAPIDAS.map((tag) => {
              const marcado = tagsSeleccionados.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  activeOpacity={0.75}
                  onPress={() => toggleTag(tag)}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: marcado ? c.accentBg : c.surfaceSoft,
                      borderColor: marcado ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: marcado ? c.primary : c.textSub,
                      fontSize: 12,
                      fontWeight: marcado ? '700' : '500',
                    }}
                  >
                    {marcado ? `✓ ${tag}` : tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Comentario libre */}
          <TextInput
            mode="outlined"
            label="Observaciones para tu kinesiólogo (opcional)"
            placeholder="Ej: Sentí leve tirantez en la última serie..."
            value={comentario}
            onChangeText={setComentario}
            multiline
            numberOfLines={2}
            textColor={c.textMain}
            outlineColor={c.border}
            activeOutlineColor={c.primary}
            style={[styles.input, { backgroundColor: c.surfaceSoft }]}
          />

          {/* Botones */}
          <View style={styles.actions}>
            <Button
              mode="text"
              onPress={onDismiss}
              disabled={sending}
              textColor={c.textSub}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              icon="send"
              onPress={limpiarYEnviar}
              loading={sending}
              disabled={sending}
              buttonColor={c.primary}
              textColor={isDark ? '#0F172A' : '#FFFFFF'}
              style={{ borderRadius: 12 }}
            >
              Enviar Reporte
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    maxHeight: '88%',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 14,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 64,
  },
  scoreNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  scoreMax: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 1,
  },
  trackBar: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
  },
  trackSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  gridNumeros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  numBtn: {
    width: '14.5%',
    minWidth: 42,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extremosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    marginBottom: 16,
    fontSize: 13.5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
});