import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import api from '../services/api';
import { cacheGet, cacheSet } from '../services/offline';

const REMINDER_KEY = '@kineconnect_recordatorio';
const HORARIOS_SUGERIDOS = ['09:00', '12:30', '18:30', '20:30'];

function resolverKinesiologo(me) {
  const k = me?.kinesiologo;
  if (!k && !me?.kinesiologo_nombre) return { asignado: false, nombre: '' };

  let nombre = '';
  if (typeof k === 'string') {
    nombre = k.trim();
  } else if (k && typeof k === 'object') {
    const full = `${k.first_name || ''} ${k.last_name || ''}`.trim();
    nombre = (k.nombre_completo || k.nombre || full || k.username || '').trim();
  }
  if (!nombre && me?.kinesiologo_nombre) nombre = String(me.kinesiologo_nombre).trim();

  return {
    asignado: true,
    nombre: nombre || 'Kinesiólogo Asignado',
  };
}

async function fetchHistorialPaciente() {
  const rutas = ['/api/v1/feedback/', '/api/feedback/'];
  for (const ruta of rutas) {
    try {
      const res = await api.get(ruta);
      const data = res?.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results;
    } catch {
      // Intenta la siguiente ruta
    }
  }
  return null;
}

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { mode, setMode } = useAppTheme();
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();

  const [me, setMe] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [recordatorioActivo, setRecordatorioActivo] = useState(true);
  const [horaRecordatorio, setHoraRecordatorio] = useState('18:30');

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [verClaves, setVerClaves] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const savedRem = await AsyncStorage.getItem(REMINDER_KEY);
          if (savedRem) {
            const parsed = JSON.parse(savedRem);
            setRecordatorioActivo(Boolean(parsed.activo));
            if (parsed.hora) setHoraRecordatorio(parsed.hora);
          }
        } catch {
          // Ignora errores de almacenamiento local
        }

        try {
          const [resMe, listaHist] = await Promise.all([
            api.get('/api/me/'),
            fetchHistorialPaciente(),
          ]);
          setMe(resMe.data);
          await cacheSet('me', resMe.data);

          if (Array.isArray(listaHist)) {
            setHistorial(listaHist);
            await cacheSet('perfil_historial_eva', listaHist);
          } else {
            const cachedHist = await cacheGet('perfil_historial_eva');
            if (Array.isArray(cachedHist)) setHistorial(cachedHist);
          }
        } catch {
          const cached = await cacheGet('me');
          if (cached) setMe(cached);
          const cachedHist = await cacheGet('perfil_historial_eva');
          if (Array.isArray(cachedHist)) setHistorial(cachedHist);
        }
      })();
    }, [])
  );

  const guardarRecordatorio = async (activo, hora) => {
    setRecordatorioActivo(activo);
    setHoraRecordatorio(hora);
    try {
      await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ activo, hora }));
    } catch {
      // Ignora error
    }
  };

  const cambiar = async () => {
    if (!actual || !nueva) {
      Alert.alert('Atención', 'Por favor completa ambos campos de contraseña.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/cambiar-password/', { actual, nueva });
      setActual('');
      setNueva('');
      Alert.alert('Listo', 'Tu contraseña fue actualizada correctamente.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  const handleSupport = () => {
    Alert.alert(
      'Centro de Ayuda',
      'Comunícate con tu centro kinesiológico al +56 9 1234 5678 o al correo soporte@kineconect.cl'
    );
  };

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
    warn: '#F59E0B',
    danger: '#EF4444',
    logoutBg: isDark ? '#450A0A' : '#FEF2F2',
    logoutBorder: isDark ? '#7F1D1D' : '#FECACA',
    logoutText: isDark ? '#F87171' : '#DC2626',
  };

  const nombreCompleto = me ? `${me.nombre || ''} ${me.apellido || ''}`.trim() || 'Paciente' : 'Cargando...';
  const iniciales = nombreCompleto
    .split(' ')
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  const infoKine = resolverKinesiologo(me);

  // Métricas clínicas calculadas del historial
  const totalSesiones = historial.length;
  const sesionesCompletas = historial.filter((h) => Boolean(h.completado)).length;
  const promedioEva =
    totalSesiones > 0
      ? (historial.reduce((acc, h) => acc + Number(h.escala_dolor ?? 0), 0) / totalSesiones).toFixed(1)
      : '—';

  return (
    <View style={[styles.mainWrapper, { paddingTop: insets.top, backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
        {/* Tarjeta Hero del Paciente */}
        <View style={[styles.heroProfileCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
            <Text style={[styles.avatarInitials, { color: c.primary }]}>{iniciales || 'P'}</Text>
          </View>

          <Text style={[styles.name, { color: c.textMain }]}>{nombreCompleto}</Text>

          <View style={styles.metaPillsRow}>
            {!!me?.rut && (
              <View style={[styles.metaPill, { backgroundColor: c.surfaceSoft }]}>
                <MaterialCommunityIcons name="card-account-details-outline" size={14} color={c.textSub} />
                <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '600' }}>{me.rut}</Text>
              </View>
            )}
            {!!me?.email && (
              <View style={[styles.metaPill, { backgroundColor: c.surfaceSoft }]}>
                <MaterialCommunityIcons name="email-outline" size={14} color={c.textSub} />
                <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '600' }}>{me.email}</Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.kineBanner,
              {
                backgroundColor: infoKine.asignado ? c.accentBg : c.surfaceSoft,
                borderColor: infoKine.asignado ? c.primary : c.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={infoKine.asignado ? 'stethoscope' : 'account-clock-outline'}
              size={18}
              color={infoKine.asignado ? c.accentText : c.textSub}
            />
            <Text style={{ color: infoKine.asignado ? c.accentText : c.textSub, fontSize: 13, fontWeight: '700' }}>
              {infoKine.asignado ? `Kinesiólogo: ${infoKine.nombre}` : 'Sin kinesiólogo asignado'}
            </Text>
          </View>
        </View>

        {/* Tarjeta Nueva 1: Mi Evolución Clínica */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: c.successBg }]}>
              <MaterialCommunityIcons name="chart-line" size={19} color={c.success} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: c.textMain }]}>Mi Evolución Clínica</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSub }]}>Resumen de sesiones y dolor percibido</Text>
            </View>
          </View>

          <View style={[styles.kpiStrip, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}>
            <View style={styles.kpiCol}>
              <Text style={{ color: c.primary, fontSize: 18, fontWeight: '800' }}>{totalSesiones}</Text>
              <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>Reportes</Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: c.border }]} />
            <View style={styles.kpiCol}>
              <Text style={{ color: c.success, fontSize: 18, fontWeight: '800' }}>{sesionesCompletas}</Text>
              <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>Completas</Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: c.border }]} />
            <View style={styles.kpiCol}>
              <Text style={{ color: c.warn, fontSize: 18, fontWeight: '800' }}>{promedioEva}</Text>
              <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600' }}>EVA Promedio</Text>
            </View>
          </View>

          {historial.length > 0 ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              {historial.slice(0, 4).map((item, idx) => {
                const eva = Number(item.escala_dolor ?? 0);
                const evaColor = eva >= 6 ? c.danger : eva >= 4 ? c.warn : c.success;
                const fecha = item.fecha_ejecucion
                  ? new Date(item.fecha_ejecucion).toLocaleDateString('es-CL')
                  : 'Reciente';

                return (
                  <View
                    key={item.id ?? idx}
                    style={[styles.historyRow, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.textMain, fontSize: 13, fontWeight: '700' }}>
                        Sesión del {fecha}
                      </Text>
                      <Text numberOfLines={1} style={{ color: c.textSub, fontSize: 11.5, marginTop: 2 }}>
                        {item.comentario || (item.completado ? 'Rutina completada' : 'Sesión parcial')}
                      </Text>
                    </View>
                    <View style={[styles.evaPill, { backgroundColor: `${evaColor}22`, borderColor: evaColor }]}>
                      <Text style={{ color: evaColor, fontSize: 11.5, fontWeight: '800' }}>
                        EVA {eva}/10
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: c.textSub, fontSize: 12.5, marginTop: 10 }}>
              Completa tu primera rutina para visualizar tu historial de evolución aquí.
            </Text>
          )}
        </View>

        {/* Tarjeta Nueva 2: Recordatorio Diario */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: c.accentBg }]}>
              <MaterialCommunityIcons name="bell-ring-outline" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.textMain }]}>Horario Habitual de Rutina</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSub }]}>
                {recordatorioActivo ? `Meta diaria a las ${horaRecordatorio} hrs` : 'Recordatorio desactivado'}
              </Text>
            </View>
            <Switch
              value={recordatorioActivo}
              onValueChange={(val) => guardarRecordatorio(val, horaRecordatorio)}
              trackColor={{ false: c.border, true: c.primary }}
            />
          </View>

          {recordatorioActivo && (
            <View style={styles.themeGrid}>
              {HORARIOS_SUGERIDOS.map((hora) => {
                const activo = horaRecordatorio === hora;
                return (
                  <TouchableOpacity
                    key={hora}
                    activeOpacity={0.75}
                    onPress={() => guardarRecordatorio(true, hora)}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: activo ? c.primary : c.surfaceSoft,
                        borderColor: activo ? c.primary : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: activo ? (isDark ? '#0F172A' : '#FFFFFF') : c.textMain,
                        fontWeight: '700',
                        fontSize: 12.5,
                      }}
                    >
                      {hora}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Apariencia */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: c.accentBg }]}>
              <MaterialCommunityIcons name="palette-outline" size={18} color={c.primary} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: c.textMain }]}>Apariencia</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSub }]}>Tema visual de la aplicación</Text>
            </View>
          </View>

          <View style={styles.themeGrid}>
            {[
              { id: 'light', label: 'Claro', icon: 'white-balance-sunny' },
              { id: 'dark', label: 'Oscuro', icon: 'moon-waning-crescent' },
              { id: 'system', label: 'Auto', icon: 'cellphone-cog' },
            ].map((opt) => {
              const activo = mode === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.75}
                  onPress={() => setMode(opt.id)}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: activo ? c.primary : c.surfaceSoft,
                      borderColor: activo ? c.primary : c.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={18}
                    color={activo ? (isDark ? '#0F172A' : '#FFFFFF') : c.textSub}
                  />
                  <Text
                    style={{
                      color: activo ? (isDark ? '#0F172A' : '#FFFFFF') : c.textMain,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Seguridad */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: c.accentBg }]}>
              <MaterialCommunityIcons name="shield-lock-outline" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.textMain }]}>Seguridad</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSub }]}>Actualiza tu contraseña de acceso</Text>
            </View>
            <TouchableOpacity onPress={() => setVerClaves((v) => !v)}>
              <MaterialCommunityIcons
                name={verClaves ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={c.textSub}
              />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 10, marginTop: 12 }}>
            <TextInput
              mode="outlined"
              label="Contraseña actual"
              secureTextEntry={!verClaves}
              value={actual}
              onChangeText={setActual}
              outlineColor={c.border}
              activeOutlineColor={c.primary}
              textColor={c.textMain}
              style={{ backgroundColor: c.surfaceSoft }}
            />
            <TextInput
              mode="outlined"
              label="Nueva contraseña"
              secureTextEntry={!verClaves}
              value={nueva}
              onChangeText={setNueva}
              outlineColor={c.border}
              activeOutlineColor={c.primary}
              textColor={c.textMain}
              style={{ backgroundColor: c.surfaceSoft }}
            />
            <Button
              mode="contained"
              onPress={cambiar}
              loading={saving}
              disabled={saving || !actual || !nueva}
              buttonColor={c.primary}
              textColor={isDark ? '#0F172A' : '#FFFFFF'}
              style={{ borderRadius: 12, marginTop: 4 }}
              contentStyle={{ paddingVertical: 4 }}
            >
              Actualizar Contraseña
            </Button>
          </View>
        </View>

        {/* Soporte */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleSupport}
          style={[styles.supportCard, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <View style={[styles.iconBadge, { backgroundColor: c.accentBg }]}>
            <MaterialCommunityIcons name="help-circle-outline" size={20} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.textMain, fontWeight: '700', fontSize: 14.5 }}>
              Centro de Ayuda y Soporte
            </Text>
            <Text style={{ color: c.textSub, fontSize: 12.5 }}>
              Contacto directo con tu equipo kinesiológico
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={c.textSub} />
        </TouchableOpacity>

        {/* Cerrar Sesión */}
        <Button
          mode="outlined"
          icon="logout"
          onPress={logout}
          textColor={c.logoutText}
          style={[styles.logoutButton, { backgroundColor: c.logoutBg, borderColor: c.logoutBorder }]}
          contentStyle={{ paddingVertical: 4 }}
        >
          Cerrar sesión
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1 },
  scrollPadding: { padding: 20, gap: 14, paddingBottom: 44 },
  heroProfileCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 26,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitials: { fontSize: 28, fontWeight: '900' },
  name: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  metaPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  kineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 15.5, fontWeight: '700' },
  cardSubtitle: { fontSize: 12 },
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    marginTop: 14,
  },
  kpiCol: { flex: 1, alignItems: 'center' },
  kpiDivider: { width: 1, height: 26 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  evaPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  logoutButton: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
});