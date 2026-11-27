import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Modal, Portal, Switch, Text, useTheme } from 'react-native-paper';
import { useAccessibility } from '../context/AccessibilityContext';

export default function AccessibilityModal() {
  const theme = useTheme();
  const isDark = theme.dark;
  const { prefs, panelVisible, closePanel, updatePref, applyPreset, resetPrefs } = useAccessibility();

  const c = {
    surface: isDark ? '#1E293B' : '#FFFFFF',
    surfaceSoft: isDark ? '#0F172A' : '#F8FAFC',
    border: isDark ? '#334155' : '#E2E8F0',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textSub: isDark ? '#CBD5E1' : '#475569',
    primary: isDark ? '#38BDF8' : '#0284C7',
    accentBg: isDark ? '#082F49' : '#E0F2FE',
  };

  const seleccionarPreset = (nombre) => {
    Haptics.selectionAsync();
    applyPreset(nombre);
  };

  return (
    <Portal>
      <Modal
        visible={panelVisible}
        onDismiss={closePanel}
        contentContainerStyle={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.iconBadge, { backgroundColor: c.accentBg }]}>
                <MaterialCommunityIcons name="human" size={22} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textMain, fontSize: 17, fontWeight: '800' }}>
                  Comodidad y Accesibilidad
                </Text>
                <Text style={{ color: c.textSub, fontSize: 12.5, marginTop: 1 }}>
                  Adapta la app a tus necesidades visuales o motoras
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={closePanel} accessibilityRole="button" accessibilityLabel="Cerrar panel">
              <MaterialCommunityIcons name="close" size={22} color={c.textSub} />
            </TouchableOpacity>
          </View>

          {/* Perfiles rápidos */}
          <Text style={[styles.sectionTitle, { color: c.textSub }]}>PERFILES RÁPIDOS DE UN TOQUE</Text>
          <View style={styles.presetsGrid}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => seleccionarPreset('adulto_mayor')}
              style={[styles.presetBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
            >
              <MaterialCommunityIcons name="glasses" size={18} color={c.primary} />
              <Text style={{ color: c.textMain, fontSize: 12.5, fontWeight: '700' }}>Adulto Mayor / Visión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => seleccionarPreset('motricidad')}
              style={[styles.presetBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
            >
              <MaterialCommunityIcons name="gesture-tap-button" size={18} color="#10B981" />
              <Text style={{ color: c.textMain, fontSize: 12.5, fontWeight: '700' }}>Motricidad Fina</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => seleccionarPreset('auditivo')}
              style={[styles.presetBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
            >
              <MaterialCommunityIcons name="closed-caption-outline" size={18} color="#F59E0B" />
              <Text style={{ color: c.textMain, fontSize: 12.5, fontWeight: '700' }}>Apoyo Auditivo</Text>
            </TouchableOpacity>
          </View>

          {/* Tamaño de texto */}
          <View style={[styles.blockBox, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
            <Text style={{ color: c.textMain, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
              Tamaño de letra
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'Normal', val: 1 },
                { label: 'Grande (A+)', val: 1.15 },
                { label: 'Extra (A++)', val: 1.28 },
              ].map((op) => {
                const activo = prefs.fontScale === op.val;
                return (
                  <TouchableOpacity
                    key={op.label}
                    onPress={() => {
                      Haptics.selectionAsync();
                      updatePref('fontScale', op.val);
                    }}
                    style={[
                      styles.sizePill,
                      {
                        backgroundColor: activo ? c.primary : c.surface,
                        borderColor: activo ? c.primary : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: activo ? (isDark ? '#0F172A' : '#FFFFFF') : c.textMain,
                        fontSize: 12.5,
                        fontWeight: '800',
                      }}
                    >
                      {op.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Opciones individuales */}
          <View style={[styles.switchRow, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textMain, fontSize: 14, fontWeight: '700' }}>Alto contraste</Text>
              <Text style={{ color: c.textSub, fontSize: 12 }}>Bordes más definidos en tarjetas y botones</Text>
            </View>
            <Switch
              value={prefs.highContrast}
              onValueChange={(v) => updatePref('highContrast', v)}
              color={c.primary}
            />
          </View>

          <View style={[styles.switchRow, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textMain, fontSize: 14, fontWeight: '700' }}>Botones ampliados</Text>
              <Text style={{ color: c.textSub, fontSize: 12 }}>Mayor área táctil para evitar toques accidentales</Text>
            </View>
            <Switch
              value={prefs.largeTargets}
              onValueChange={(v) => updatePref('largeTargets', v)}
              color={c.primary}
            />
          </View>

          <View style={[styles.switchRow, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textMain, fontSize: 14, fontWeight: '700' }}>Apoyo visual y vibración</Text>
              <Text style={{ color: c.textSub, fontSize: 12 }}>Refuerza alertas hápticas e instrucciones escritas</Text>
            </View>
            <Switch
              value={prefs.visualSupport}
              onValueChange={(v) => updatePref('visualSupport', v)}
              color={c.primary}
            />
          </View>

          <View style={styles.footerRow}>
            <Button mode="outlined" onPress={resetPrefs} textColor={c.textSub} style={{ borderColor: c.border }}>
              Restablecer
            </Button>
            <Button
              mode="contained"
              onPress={closePanel}
              buttonColor={c.primary}
              textColor={isDark ? '#0F172A' : '#FFFFFF'}
              style={{ borderRadius: 12 }}
            >
              Guardar y Cerrar
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalCard: {
    margin: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
  },
  blockBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  sizePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
});