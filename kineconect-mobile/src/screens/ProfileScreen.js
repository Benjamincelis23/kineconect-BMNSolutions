import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useCallback, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import api from '../services/api';
import { cacheGet, cacheSet } from '../services/offline';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

  // Controla qué tarjeta está desplegada: 'evolucion' | 'alarma' | 'apariencia' | 'seguridad' | null
  const [seccionAbierta, setSeccionAbierta] = useState(null);

  // Estado del selector de hora personalizada
  const [modalHoraVisible, setModalHoraVisible] = useState(false);
  const [horaTemp, setHoraTemp] = useState(18);
  const [minutoTemp, setMinutoTemp] = useState(30);

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [verClaves, setVerClaves] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleSeccion = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSeccionAbierta((prev) => (prev === key ? null : key));
  };

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

  const programarAlarmaDiaria = async (activo, horaStr) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!activo) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permiso de notificaciones',
          'Activa las notificaciones en los ajustes de tu teléfono para recibir el aviso diario.'
        );
        return;
      }

      const [hour, minute] = horaStr.split(':').map(Number);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Hora de tu rutina KineConnect',
          body: 'Realiza tus ejercicios asignados y registra tu nivel de dolor EVA.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    } catch {
      // Si el entorno no soporta programación nativa, conserva el guardado local
    }
  };

  const guardarRecordatorio = async (activo, hora) => {
    setRecordatorioActivo(activo);
    setHoraRecordatorio(hora);
    try {
      await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ activo, hora }));
    } catch {
      // Ignora error
    }
    await programarAlarmaDiaria(activo, hora);
  };

  const abrirSelectorHora = () => {
    const [h, m] = horaRecordatorio.split(':').map(Number);
    setHoraTemp(Number.isFinite(h) ? h : 18);
    setMinutoTemp(Number.isFinite(m) ? m : 30);
    setModalHoraVisible(true);
  };

  const confirmarHoraPersonalizada = async () => {
    const hh = String(horaTemp).padStart(2, '0');
    const mm = String(minutoTemp).padStart(2, '0');
    setModalHoraVisible(false);
    await guardarRecordatorio(true, `${hh}:${mm}`);
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

  const totalSesiones = historial.length;
  const sesionesCompletas = historial.filter((h) => Boolean(h.completado)).length;
  const promedioEva =
    totalSesiones > 0
      ? (
          historial.reduce((acc, h) => acc + Number(h.nivel_dolor ?? h.escala_dolor ?? 0), 0) /
          totalSesiones
        ).toFixed(1)
      : '—';

  const labelTemaActual = mode === 'light' ? 'Claro' : mode === 'dark' ? 'Oscuro' : 'Auto';

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

        {/* Tarjeta 1: Mi Evolución Clínica (Colapsable) */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => toggleSeccion('evolucion')}
            style={styles.cardHeader}
          >
            <View style={[styles.iconBadge, { backgroundColor: c.successBg }]}>
              <MaterialCommunityIcons name="chart-line" size={19} color={c.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.textMain }]}>Mi Evolución Clínica</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSub }]}>
                {totalSesiones > 0
                  ? `${totalSesiones} ${totalSesiones === 1 ? 'reporte' : 'reportes'} • EVA promedio ${promedioEva}/10`
                  : 'Sin sesiones registradas aún'}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={seccionAbierta === 'evolucion' ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={c.textSub}
            />
          </TouchableOpacity>

          {seccionAbierta === 'evolucion' && (
            <View style={[styles.accordionBody, { borderTopColor: c.border }]}>
              <View style={[styles.kpiStrip, { backgroundColor: c.surfaceSoft, borderColor: c.border, marginTop: 0 }]}>
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
                  {historial.slice(0, 6).map((item, idx) => {
                    const eva = Number(item.nivel_dolor ?? item.escala_dolor ?? 0);
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
          )}
        </View>

        {/* Tarjeta 2: Recordatorio Diario (Colapsable + Hora Adaptable) */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => toggleSeccion('alarma')}
            style={styles.cardHeader}
          >
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
              onValueChange={(val) => {
                guardarRecordatorio(val, horaRecordatorio);
                if (val && seccionAbierta !== 'alarma') toggleSeccion('alarma');
              }}
              trackColor={{ false: c.border, true: c.primary }}
            />
            <MaterialCommunityIcons
              name={seccionAbierta === 'alarma' ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={c.textSub}
            />
          </TouchableOpacity>

          {seccionAbierta === 'alarma' && (
            <View style={[styles.accordionBody, { borderTopColor: c.border }]}>
              {recordatorioActivo ? (
                <>
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

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={abrirSelectorHora}
                    style={[
                      styles.customTimeBtn,
                      { backgroundColor: c.accentBg, borderColor: c.primary },
                    ]}
                  >
                    <MaterialCommunityIcons name="clock-edit-outline" size={18} color={c.primary} />
                    <Text style={{ color: c.accentText, fontWeight: '700', fontSize: 13 }}>
                      Personalizar hora exacta ({horaRecordatorio} hrs)
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ color: c.textSub, fontSize: 12.5 }}>
                  Activa el interruptor superior para configurar tu recordatorio diario de ejercicios.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Tarjeta 3: Apariencia (Colapsable) */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => toggleSeccion('apariencia')}
            style={styles.cardHeader}
          >
            <View style={[styles.iconBadge, { backgroundColor: c.accentBg }]}>
              <MaterialCommunityIcons name="palette-outline" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.textMain }]}>Apariencia</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSub }]}>
                Tema actual: {labelTemaActual}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={seccionAbierta === 'apariencia' ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={c.textSub}
            />
          </TouchableOpacity>

          {seccionAbierta === 'apariencia' && (
            <View style={[styles.accordionBody, { borderTopColor: c.border }]}>
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
          )}
        </View>

        {/* Tarjeta 4: Seguridad (Colapsable) */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => toggleSeccion('seguridad')}
            style={styles.cardHeader}
          >
            <View style={[styles.iconBadge, { backgroundColor: c.accentBg }]}>
              <MaterialCommunityIcons name="shield-lock-outline" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.textMain }]}>Seguridad</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSub }]}>Actualiza tu contraseña de acceso</Text>
            </View>
            <MaterialCommunityIcons
              name={seccionAbierta === 'seguridad' ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={c.textSub}
            />
          </TouchableOpacity>

          {seccionAbierta === 'seguridad' && (
            <View style={[styles.accordionBody, { borderTopColor: c.border, gap: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() => setVerClaves((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <MaterialCommunityIcons
                    name={verClaves ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={c.textSub}
                  />
                  <Text style={{ color: c.textSub, fontSize: 12, fontWeight: '600' }}>
                    {verClaves ? 'Ocultar claves' : 'Mostrar claves'}
                  </Text>
                </TouchableOpacity>
              </View>

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
          )}
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

      {/* Modal Selector de Hora Exacta */}
      <Modal
        visible={modalHoraVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalHoraVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.textMain }]}>Elegir Hora de Recordatorio</Text>
            <Text style={[styles.modalSub, { color: c.textSub }]}>
              Ajusta la hora exacta en formato 24 hrs
            </Text>

            <View style={styles.pickerRow}>
              {/* Selector de Hora */}
              <View style={styles.pickerCol}>
                <TouchableOpacity
                  onPress={() => setHoraTemp((h) => (h + 1) % 24)}
                  style={[styles.stepBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
                >
                  <MaterialCommunityIcons name="chevron-up" size={24} color={c.primary} />
                </TouchableOpacity>
                <View style={[styles.timeBox, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
                  <Text style={{ color: c.primary, fontSize: 30, fontWeight: '900' }}>
                    {String(horaTemp).padStart(2, '0')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setHoraTemp((h) => (h - 1 + 24) % 24)}
                  style={[styles.stepBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
                >
                  <MaterialCommunityIcons name="chevron-down" size={24} color={c.primary} />
                </TouchableOpacity>
                <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600', marginTop: 4 }}>Horas</Text>
              </View>

              <Text style={{ color: c.textMain, fontSize: 28, fontWeight: '900', marginBottom: 18 }}>:</Text>

              {/* Selector de Minutos */}
              <View style={styles.pickerCol}>
                <TouchableOpacity
                  onPress={() => setMinutoTemp((m) => (m + 1) % 60)}
                  style={[styles.stepBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
                >
                  <MaterialCommunityIcons name="chevron-up" size={24} color={c.primary} />
                </TouchableOpacity>
                <View style={[styles.timeBox, { backgroundColor: c.accentBg, borderColor: c.primary }]}>
                  <Text style={{ color: c.primary, fontSize: 30, fontWeight: '900' }}>
                    {String(minutoTemp).padStart(2, '0')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setMinutoTemp((m) => (m - 1 + 60) % 60)}
                  style={[styles.stepBtn, { backgroundColor: c.surfaceSoft, borderColor: c.border }]}
                >
                  <MaterialCommunityIcons name="chevron-down" size={24} color={c.primary} />
                </TouchableOpacity>
                <Text style={{ color: c.textSub, fontSize: 11, fontWeight: '600', marginTop: 4 }}>Minutos</Text>
              </View>
            </View>

            {/* Atajos rápidos de minutos */}
            <View style={[styles.themeGrid, { marginTop: 12 }]}>
              {[0, 15, 30, 45].map((min) => {
                const activo = minutoTemp === min;
                return (
                  <TouchableOpacity
                    key={min}
                    onPress={() => setMinutoTemp(min)}
                    style={[
                      styles.themeOption,
                      {
                        backgroundColor: activo ? c.primary : c.surfaceSoft,
                        borderColor: activo ? c.primary : c.border,
                        paddingVertical: 7,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: activo ? (isDark ? '#0F172A' : '#FFFFFF') : c.textMain,
                        fontWeight: '700',
                        fontSize: 12,
                      }}
                    >
                      :{String(min).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button
                mode="outlined"
                onPress={() => setModalHoraVisible(false)}
                textColor={c.textSub}
                style={{ flex: 1, borderRadius: 12, borderColor: c.border }}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={confirmarHoraPersonalizada}
                buttonColor={c.primary}
                textColor={isDark ? '#0F172A' : '#FFFFFF'}
                style={{ flex: 1, borderRadius: 12 }}
              >
                Confirmar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
  accordionBody: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
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
  customTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 11,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  modalSub: { fontSize: 12.5, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  pickerCol: { alignItems: 'center' },
  stepBtn: {
    width: 68,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  timeBox: {
    width: 76,
    height: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});