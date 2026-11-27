import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Modal, Portal, Text, TextInput, useTheme } from 'react-native-paper';

const ESCALA_EVA = [
  { valor: 0, titulo: 'Sin dolor', guia: 'Ejecución limpia, sin molestias durante ni después.', color: '#10B981', icono: 'emoticon-happy-outline' },
  { valor: 1, titulo: 'Muy leve', guia: 'Apenas perceptible, no interfiere con el movimiento.', color: '#22C55E', icono: 'emoticon-happy-outline' },
  { valor: 2, titulo: 'Leve', guia: 'Molestia ligera que desaparece al entrar en calor.', color: '#4ADE80', icono: 'emoticon-neutral-outline' },
  { valor: 3, titulo: 'Leve-moderado', guia: 'Se siente al exigir el rango, pero es tolerable.', color: '#84CC16', icono: 'emoticon-neutral-outline' },
  { valor: 4, titulo: 'Moderado', guia: 'Molestia constante que exige bajar el ritmo.', color: '#EAB308', icono: 'emoticon-confused-outline' },
  { valor: 5, titulo: 'Moderado-alto', guia: 'Incomoda al completar las últimas repeticiones.', color: '#F59E0B', icono: 'emoticon-confused-outline' },
  { valor: 6, titulo: 'Fuerte', guia: 'Limita parcialmente el rango o la fuerza.', color: '#F97316', icono: 'emoticon-sad-outline' },
  { valor: 7, titulo: 'Intenso', guia: 'Cuesta mantener la técnica por la molestia.', color: '#EA580C', icono: 'emoticon-sad-outline' },
  { valor: 8, titulo: 'Muy intenso', guia: 'Obliga a detener o modificar el ejercicio.', color: '#EF4444', icono: 'emoticon-cry-outline' },
  { valor: 9, titulo: 'Severo', guia: 'Dolor agudo persistente incluso en reposo.', color: '#DC2626', icono: 'emoticon-cry-outline' },
  { valor: 10, titulo: 'Insoportable', guia: 'Máximo dolor posible; requiere revisión kinésica.', color: '#B91C1C', icono: 'alert-circle-outline' },
];

const NIVELES_ESFUERZO = [
  { valor: 2, etiqueta: 'Muy liviano', desc: 'Casi sin esfuerzo, pude hacerlo muy fácil.', icono: 'feather', color: '#10B981' },
  { valor: 4, etiqueta: 'Moderado', desc: 'Se sintió el trabajo muscular a buen ritmo.', icono: 'walk', color: '#84CC16' },
  { valor: 6, etiqueta: 'Exigente', desc: 'Me costó un poco, manteniendo buena técnica.', icono: 'run', color: '#EAB308' },
  { valor: 8, etiqueta: 'Muy exigente', desc: 'Terminé bastante cansado en las últimas series.', icono: 'fire', color: '#F97316' },
  { valor: 10, etiqueta: 'Al límite', desc: 'Agotamiento máximo, no podía dar más.', icono: 'lightning-bolt', color: '#EF4444' },
];

const TAGS_NORMALES = [
  'Buena tolerancia',
  'Fatiga muscular',
  'Rigidez / Tensión',
  'Molestia al final',
  'Mejor que la sesión anterior',
];

const TAGS_DOLOR_ALTO = [
  'Dolor punzante / agudo',
  'Tuve que detener la rutina',
  'Molestia articular',
  'Irradiación o hormigueo',
  'Inflamación / Calor local',
];

export default function EvaModal({
  visible,
  onDismiss,
  onSubmit,
  sending,
  modoEmergencia = false,
  ejercicioActual = '',
}) {
  const theme = useTheme();
  const isDark = theme.dark;

  // Sin preselección por defecto para evitar registros falsos
  const [paso, setPaso] = useState(1);
  const [dolor, setDolor] = useState(null);
  const [borg, setBorg] = useState(null);
  const [tagsSeleccionados, setTagsSeleccionados] = useState([]);
  const [comentario, setComentario] = useState('');

  const c = {
    surface: isDark ? '#1E293B' : '#FFFFFF',
    surfaceSoft: isDark ? '#0F172A' : '#F8FAFC',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textSub: isDark ? '#CBD5E1' : '#475569',
    primary: isDark ? '#38BDF8' : '#0284C7',
    accentBg: isDark ? '#082F49' : '#E0F2FE',
    dangerBg: isDark ? '#450A0A' : '#FEF2F2',
    dangerBorder: isDark ? '#EF4444' : '#FCA5A5',
    dangerText: isDark ? '#FCA5A5' : '#DC2626',
  };

  const nivelActual = dolor !== null ? ESCALA_EVA[dolor] : null;
  const esfuerzoActual = borg !== null ? NIVELES_ESFUERZO.find((b) => b.valor === borg) : null;
  const esDolorAlto = dolor !== null && dolor >= 7;
  const esAlertaCritica = modoEmergencia || esDolorAlto;
  const listaTags = esAlertaCritica ? TAGS_DOLOR_ALTO : TAGS_NORMALES;

  const totalPasos = modoEmergencia ? 2 : 3;
  const pasoVisual = modoEmergencia ? (paso === 1 ? 1 : 2) : paso;

  const seleccionarDolor = (val) => {
    Haptics.selectionAsync();
    setDolor(val);
    setTagsSeleccionados(
      modoEmergencia ? ['Tuve que detener la rutina'] : []
    );
  };

  const seleccionarEsfuerzo = (val) => {
    Haptics.selectionAsync();
    setBorg(val);
  };

  const toggleTag = (tag) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTagsSeleccionados((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const reiniciarEstado = () => {
    setPaso(1);
    setDolor(null);
    setBorg(null);
    setTagsSeleccionados([]);
    setComentario('');
  };

  const cerrarModal = () => {
    reiniciarEstado();
    onDismiss();
  };

  const avanzarPaso = () => {
    Haptics.selectionAsync();
    if (modoEmergencia && paso === 1) {
      setPaso(3);
      return;
    }
    setPaso((prev) => Math.min(3, prev + 1));
  };

  const retrocederPaso = () => {
    Haptics.selectionAsync();
    if (modoEmergencia && paso === 3) {
      setPaso(1);
      return;
    }
    setPaso((prev) => Math.max(1, prev - 1));
  };

  const limpiarYEnviar = () => {
    if (dolor === null) return;
    if (!modoEmergencia && esfuerzoActual === null) return;

    const partes = [];
    if (!modoEmergencia && esfuerzoActual) {
      partes.push(`Esfuerzo Borg: ${esfuerzoActual.valor}/10 (${esfuerzoActual.etiqueta})`);
    }
    if (tagsSeleccionados.length > 0) {
      partes.push(`[${tagsSeleccionados.join(', ')}]`);
    }
    if (comentario.trim()) {
      partes.push(comentario.trim());
    }

    onSubmit(dolor, partes.join(' • '));
    reiniciarEstado();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={cerrarModal}
        contentContainerStyle={[
          styles.modalContainer,
          {
            backgroundColor: c.surface,
            borderColor: modoEmergencia ? c.dangerBorder : c.border,
          },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {modoEmergencia && (
            <View style={[styles.emergencyBanner, { backgroundColor: c.dangerBg, borderColor: c.dangerBorder }]}>
              <MaterialCommunityIcons name="alert-octagon" size={20} color={c.dangerText} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.dangerText, fontSize: 12.5, fontWeight: '900', letterSpacing: 0.4 }}>
                  DETENCIÓN POR DOLOR AGUDO
                </Text>
                {!!ejercicioActual && (
                  <Text numberOfLines={2} style={{ color: c.textMain, fontSize: 12.5, fontWeight: '700', marginTop: 2 }}>
                    Ejercicio: {ejercicioActual}
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.stepHeader}>
            <Text style={[styles.stepCounter, { color: modoEmergencia ? c.dangerText : c.primary }]}>
              PASO {pasoVisual} DE {totalPasos}
            </Text>
            <View style={styles.stepDotsRow}>
              {Array.from({ length: totalPasos }).map((_, idx) => {
                const num = idx + 1;
                return (
                  <View
                    key={num}
                    style={[
                      styles.stepBar,
                      {
                        backgroundColor:
                          num <= pasoVisual
                            ? modoEmergencia
                              ? '#EF4444'
                              : c.primary
                            : c.border,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* ================= PASO 1: DOLOR (EVA) ================= */}
          {paso === 1 && (
            <View>
              <Text style={[styles.title, { color: c.textMain }]}>
                {modoEmergencia ? '¿Qué intensidad de dolor sientes?' : '¿Sentiste dolor físico?'}
              </Text>
              <Text style={[styles.subtitle, { color: c.textSub }]}>
                {modoEmergencia
                  ? 'La sesión se pausará y enviaremos alerta prioritaria a tu kinesiólogo'
                  : 'Selecciona un número del 0 al 10 para continuar'}
              </Text>

              <View
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: c.surfaceSoft,
                    borderColor: nivelActual ? nivelActual.color : c.border,
                  },
                ]}
              >
                {nivelActual ? (
                  <>
                    <View style={styles.heroTopRow}>
                      <View style={[styles.scoreBadge, { backgroundColor: nivelActual.color }]}>
                        <Text style={styles.scoreNumber}>{nivelActual.valor}</Text>
                        <Text style={styles.scoreMax}>/10</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <MaterialCommunityIcons
                            name={nivelActual.icono}
                            size={20}
                            color={nivelActual.color}
                          />
                          <Text style={{ color: nivelActual.color, fontWeight: '800', fontSize: 16.5 }}>
                            {nivelActual.titulo}
                          </Text>
                        </View>
                        <Text style={{ color: c.textMain, fontSize: 13.5, marginTop: 4, lineHeight: 19 }}>
                          {nivelActual.guia}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.trackBar}>
                      {ESCALA_EVA.map((item) => (
                        <View
                          key={item.valor}
                          style={[
                            styles.trackSegment,
                            { backgroundColor: item.valor <= dolor ? item.color : c.border },
                          ]}
                        />
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                    <Text style={{ color: c.textSub, fontSize: 14, fontWeight: '600' }}>
                      Toca una opción abajo para evaluar tu dolor
                    </Text>
                  </View>
                )}
              </View>

              {!modoEmergencia && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => seleccionarDolor(0)}
                  style={[
                    styles.zeroBtn,
                    {
                      backgroundColor: dolor === 0 ? '#10B981' : c.surfaceSoft,
                      borderColor: dolor === 0 ? '#10B981' : c.border,
                    },
                  ]}
                >
                  <Text style={{ color: dolor === 0 ? '#FFFFFF' : c.textMain, fontWeight: '800', fontSize: 14.5 }}>
                    0 • Sin dolor
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.gridRow5}>
                {ESCALA_EVA.slice(1, 6).map((item) => {
                  const activo = dolor === item.valor;
                  return (
                    <TouchableOpacity
                      key={item.valor}
                      activeOpacity={0.75}
                      onPress={() => seleccionarDolor(item.valor)}
                      style={[
                        styles.numBtn5,
                        {
                          backgroundColor: activo ? item.color : c.surfaceSoft,
                          borderColor: activo ? item.color : c.border,
                        },
                      ]}
                    >
                      <Text style={{ color: activo ? '#FFFFFF' : c.textMain, fontWeight: '800', fontSize: 16 }}>
                        {item.valor}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.gridRow5, { marginTop: 8 }]}>
                {ESCALA_EVA.slice(6, 11).map((item) => {
                  const activo = dolor === item.valor;
                  return (
                    <TouchableOpacity
                      key={item.valor}
                      activeOpacity={0.75}
                      onPress={() => seleccionarDolor(item.valor)}
                      style={[
                        styles.numBtn5,
                        {
                          backgroundColor: activo ? item.color : c.surfaceSoft,
                          borderColor: activo ? item.color : c.border,
                        },
                      ]}
                    >
                      <Text style={{ color: activo ? '#FFFFFF' : c.textMain, fontWeight: '800', fontSize: 16 }}>
                        {item.valor}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.extremosRow}>
                <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '600' }}>1–3 Leve</Text>
                <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '600' }}>4–6 Moderado</Text>
                <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '600' }}>7–10 Intenso</Text>
              </View>

              <View style={styles.actions}>
                <Button mode="text" onPress={cerrarModal} textColor={c.textSub}>
                  {modoEmergencia ? 'Volver a rutina' : 'Cancelar'}
                </Button>
                <Button
                  mode="contained"
                  icon="arrow-right"
                  disabled={dolor === null}
                  contentStyle={{ flexDirection: 'row-reverse', paddingVertical: 4 }}
                  onPress={avanzarPaso}
                  buttonColor={modoEmergencia ? '#EF4444' : c.primary}
                  textColor={modoEmergencia ? '#FFFFFF' : isDark ? '#0F172A' : '#FFFFFF'}
                  style={{ borderRadius: 12 }}
                >
                  Siguiente
                </Button>
              </View>
            </View>
          )}

          {/* ================= PASO 2: CANSANCIO / ESFUERZO (SOLO SESIÓN NORMAL) ================= */}
          {paso === 2 && !modoEmergencia && (
            <View>
              <Text style={[styles.title, { color: c.textMain }]}>
                ¿Qué tan cansado quedaste?
              </Text>
              <Text style={[styles.subtitle, { color: c.textSub }]}>
                Elige una opción para continuar
              </Text>

              <View style={styles.esfuerzoList}>
                {NIVELES_ESFUERZO.map((item) => {
                  const activo = borg === item.valor;
                  return (
                    <TouchableOpacity
                      key={item.valor}
                      activeOpacity={0.78}
                      onPress={() => seleccionarEsfuerzo(item.valor)}
                      style={[
                        styles.esfuerzoCard,
                        {
                          backgroundColor: activo ? c.surfaceSoft : c.surface,
                          borderColor: activo ? item.color : c.border,
                          borderWidth: activo ? 2 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.esfuerzoIconBox,
                          { backgroundColor: activo ? item.color : c.surfaceSoft },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={item.icono}
                          size={20}
                          color={activo ? '#FFFFFF' : item.color}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: activo ? item.color : c.textMain,
                            fontWeight: '800',
                            fontSize: 15,
                          }}
                        >
                          {item.etiqueta}
                        </Text>
                        <Text
                          style={{
                            color: c.textSub,
                            fontSize: 12.5,
                            marginTop: 2,
                            lineHeight: 17,
                          }}
                        >
                          {item.desc}
                        </Text>
                      </View>

                      <MaterialCommunityIcons
                        name={activo ? 'check-circle' : 'radiobox-blank'}
                        size={22}
                        color={activo ? item.color : c.border}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.actionsBetween}>
                <Button
                  mode="outlined"
                  icon="arrow-left"
                  onPress={retrocederPaso}
                  textColor={c.textMain}
                  style={{ borderRadius: 12, borderColor: c.border }}
                >
                  Atrás
                </Button>
                <Button
                  mode="contained"
                  icon="arrow-right"
                  disabled={borg === null}
                  contentStyle={{ flexDirection: 'row-reverse', paddingVertical: 4 }}
                  onPress={avanzarPaso}
                  buttonColor={c.primary}
                  textColor={isDark ? '#0F172A' : '#FFFFFF'}
                  style={{ borderRadius: 12 }}
                >
                  Siguiente
                </Button>
              </View>
            </View>
          )}

          {/* ================= PASO FINAL: SÍNTOMAS, RESGUARDO MÉDICO Y ENVÍO ================= */}
          {paso === 3 && nivelActual && (modoEmergencia || esfuerzoActual) && (
            <View>
              <Text style={[styles.title, { color: c.textMain }]}>
                {modoEmergencia ? 'Reportar detención de sesión' : 'Comentarios finales'}
              </Text>
              <Text style={[styles.subtitle, { color: c.textSub }]}>
                Confirma tu reporte para enviarlo a tu kinesiólogo
              </Text>

              {esAlertaCritica && (
                <View style={[styles.alertSafetyBox, { backgroundColor: c.dangerBg, borderColor: c.dangerBorder }]}>
                  <MaterialCommunityIcons name="hospital-box-outline" size={22} color={c.dangerText} />
                  <Text style={{ flex: 1, color: c.dangerText, fontSize: 12.5, fontWeight: '700', lineHeight: 18 }}>
                    Suspende los ejercicios por hoy. KineConnect realiza seguimiento asincrónico y no reemplaza atención médica de urgencia 24/7. Si el dolor es insoportable o notas pérdida de fuerza, acude a urgencias.
                  </Text>
                </View>
              )}

              {/* Resumen simétrico */}
              <View style={[styles.resumenStrip, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
                <View style={styles.resumenItem}>
                  <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '700' }}>DOLOR (EVA)</Text>
                  <Text numberOfLines={1} style={{ color: nivelActual.color, fontSize: 14, fontWeight: '800', marginTop: 3 }}>
                    {nivelActual.valor}/10 • {nivelActual.titulo}
                  </Text>
                </View>
                <View style={[styles.resumenDivider, { backgroundColor: c.border }]} />
                <View style={styles.resumenItem}>
                  <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '700' }}>
                    {modoEmergencia ? 'ESTADO SESIÓN' : 'ESFUERZO'}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: modoEmergencia ? c.dangerText : esfuerzoActual.color,
                      fontSize: 14,
                      fontWeight: '800',
                      marginTop: 3,
                    }}
                  >
                    {modoEmergencia ? 'Detenida por dolor' : esfuerzoActual.etiqueta}
                  </Text>
                </View>
              </View>

              <Text style={[styles.sectionLabel, { color: c.textMain }]}>
                {esAlertaCritica ? '¿Qué síntoma sentiste?' : 'Sensaciones predominantes:'}
              </Text>
              <View style={styles.tagsWrap}>
                {listaTags.map((tag) => {
                  const marcado = tagsSeleccionados.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      activeOpacity={0.75}
                      onPress={() => toggleTag(tag)}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: marcado ? (esAlertaCritica ? c.dangerBg : c.accentBg) : c.surfaceSoft,
                          borderColor: marcado ? (esAlertaCritica ? c.dangerBorder : c.primary) : c.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: marcado ? (esAlertaCritica ? c.dangerText : c.primary) : c.textSub,
                          fontSize: 13,
                          fontWeight: marcado ? '700' : '500',
                        }}
                      >
                        {marcado ? `✓ ${tag}` : tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                mode="outlined"
                label={modoEmergencia ? 'Describe dónde y cómo apareció el dolor' : 'Observaciones para tu kinesiólogo (opcional)'}
                placeholder={
                  modoEmergencia
                    ? 'Ej: Pinchazo agudo al levantar el brazo en la 2da serie...'
                    : 'Ej: Sentí tirantez en el cuello al final...'
                }
                value={comentario}
                onChangeText={setComentario}
                multiline
                numberOfLines={3}
                textColor={c.textMain}
                outlineColor={c.border}
                activeOutlineColor={esAlertaCritica ? '#EF4444' : c.primary}
                style={[styles.input, { backgroundColor: c.surfaceSoft }]}
              />

              {!esAlertaCritica && (
                <Text style={[styles.disclaimerFooter, { color: c.textSub }]}>
                  Aviso: Monitoreo kinésico asincrónico · No reemplaza atención de urgencia 24/7.
                </Text>
              )}

              <View style={styles.actionsBetween}>
                <Button
                  mode="outlined"
                  icon="arrow-left"
                  onPress={retrocederPaso}
                  disabled={sending}
                  textColor={c.textMain}
                  style={{ borderRadius: 12, borderColor: c.border }}
                >
                  Atrás
                </Button>
                <Button
                  mode="contained"
                  icon={esAlertaCritica ? 'alert-circle' : 'send'}
                  onPress={limpiarYEnviar}
                  loading={sending}
                  disabled={sending}
                  buttonColor={esAlertaCritica ? '#EF4444' : c.primary}
                  textColor={esAlertaCritica ? '#FFFFFF' : isDark ? '#0F172A' : '#FFFFFF'}
                  style={{ borderRadius: 12 }}
                  contentStyle={{ paddingVertical: 4 }}
                >
                  {modoEmergencia ? 'Detener y Alertar' : 'Enviar Reporte'}
                </Button>
              </View>
            </View>
          )}
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
    maxHeight: '90%',
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  stepCounter: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stepDotsRow: {
    flexDirection: 'row',
    gap: 6,
    width: '55%',
  },
  stepBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 19,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
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
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 66,
  },
  scoreNumber: {
    color: '#FFFFFF',
    fontSize: 25,
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
  zeroBtn: {
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridRow5: {
    flexDirection: 'row',
    gap: 8,
  },
  numBtn5: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extremosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  esfuerzoList: {
    gap: 8,
    marginBottom: 16,
  },
  esfuerzoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  esfuerzoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertSafetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  resumenStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  resumenItem: {
    flex: 1,
    alignItems: 'center',
  },
  resumenDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },
  tagChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    marginBottom: 12,
    fontSize: 14,
  },
  disclaimerFooter: {
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  actionsBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
});