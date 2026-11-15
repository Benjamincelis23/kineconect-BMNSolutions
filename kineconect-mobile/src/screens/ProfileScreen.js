import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, List, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import api from '../services/api';
import { cacheGet, cacheSet } from '../services/offline';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { mode, setMode } = useAppTheme();

  // Recuperamos el theme para saber en qué modo estamos
  const theme = useTheme();
  const isDark = theme.dark;

  const insets = useSafeAreaInsets();

  const [me, setMe] = useState(null);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/me/');
        setMe(data);
        await cacheSet('me', data);
      }
      catch (e) {
        const cached = await cacheGet('me');
        if (cached) setMe(cached);
      }
    })();
  }, []));

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
    Alert.alert("Centro de Ayuda", "Comunícate con tu centro kinesiológico al +56 9 1234 5678 o al correo soporte@kineconect.cl");
  };

  const nombreCompleto = me ? `${me.nombre || ''} ${me.apellido || ''}`.trim() : 'Cargando perfil...';
  const rutPaciente = me?.rut ? `RUT: ${me.rut}` : '';

  // PALETA DINÁMICA PREMIUM (Reacciona al botón de Oscuro/Claro)
  const c = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#F1F5F9',
    textMain: isDark ? '#F8FAFC' : '#0F172A',
    textSub: isDark ? '#94A3B8' : '#64748B',
    kineBg: isDark ? '#082F49' : '#E0F2FE',
    kineText: isDark ? '#38BDF8' : '#0369A1',
    inputBg: isDark ? '#0F172A' : '#FFFFFF',
    logoutBg: isDark ? '#450A0A' : '#FEF2F2',
    logoutBorder: isDark ? '#7F1D1D' : '#FECACA',
    logoutText: isDark ? '#F87171' : '#DC2626',
    primary: isDark ? '#38BDF8' : '#0284C7'
  };

  return (
    <View style={[styles.mainWrapper, { paddingTop: insets.top, backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>

        {/* ENCABEZADO */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatarContainer, { backgroundColor: c.surface }]}>
            <Avatar.Image
              size={88}
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
              style={{ backgroundColor: isDark ? '#0C4A6E' : '#F0F9FF' }}
            />
          </View>
          <Text style={[styles.name, { color: c.textMain }]}>{nombreCompleto}</Text>
          {rutPaciente ? <Text style={[styles.rut, { color: c.textSub }]}>{rutPaciente}</Text> : null}
          <Text style={[styles.email, { color: c.textSub }]}>{me?.email}</Text>

          {me?.kinesiologo && (
            <View style={[styles.kineBox, { backgroundColor: c.kineBg }]}>
              <MaterialCommunityIcons name="stethoscope" size={16} color={c.kineText} />
              <Text style={[styles.kineText, { color: c.kineText }]}>
                <Text style={{ fontWeight: '700' }}>Kinesiólogo:</Text> {me.kinesiologo.nombre}
              </Text>
            </View>
          )}
        </View>

        {/* APARIENCIA */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="palette-outline" size={22} color={c.primary} />
            <Text style={[styles.cardTitle, { color: c.textMain }]}>Apariencia</Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: c.textSub }]}>Personaliza el estilo visual de la app</Text>

          <SegmentedButtons
            value={mode}
            onValueChange={setMode}
            buttons={[
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' },
              { value: 'system', label: 'Auto' }
            ]}
            style={styles.segmented}
            theme={{
              colors: {
                secondaryContainer: isDark ? '#0369A1' : '#E0F2FE',
                onSecondaryContainer: isDark ? '#F8FAFC' : '#0284C7',
                outline: c.border,
                onSurface: c.textMain // Color de la letra de los no-seleccionados
              }
            }}
          />
        </View>

        {/* SEGURIDAD */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="shield-lock-outline" size={22} color={c.primary} />
            <Text style={[styles.cardTitle, { color: c.textMain }]}>Seguridad</Text>
          </View>

          <View style={{ gap: 12, marginTop: 12 }}>
            <TextInput
              mode="outlined"
              label="Contraseña actual"
              secureTextEntry
              value={actual}
              onChangeText={setActual}
              outlineColor={c.border}
              activeOutlineColor={c.primary}
              textColor={c.textMain}
              style={[styles.input, { backgroundColor: c.inputBg }]}
            />
            <TextInput
              mode="outlined"
              label="Nueva contraseña"
              secureTextEntry
              value={nueva}
              onChangeText={setNueva}
              outlineColor={c.border}
              activeOutlineColor={c.primary}
              textColor={c.textMain}
              style={[styles.input, { backgroundColor: c.inputBg }]}
            />
            <Button
              mode="contained"
              onPress={cambiar}
              loading={saving}
              disabled={saving || !actual || !nueva}
              buttonColor={c.primary}
              textColor={isDark ? '#0F172A' : '#FFFFFF'}
              style={styles.primaryButton}
            >
              Actualizar Contraseña
            </Button>
          </View>
        </View>

        {/* SOPORTE */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <List.Item
            title="Centro de Ayuda y Soporte"
            description="Contacto con tu centro"
            titleStyle={[styles.listTitle, { color: c.textMain }]}
            descriptionStyle={[styles.listDescription, { color: c.textSub }]}
            left={props => <List.Icon {...props} icon="help-circle-outline" color={c.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" color={c.textSub} />}
            onPress={handleSupport}
            style={styles.listItem}
          />
        </View>

        {/* CERRAR SESIÓN */}
        <Button
          mode="outlined"
          icon="logout"
          onPress={logout}
          textColor={c.logoutText}
          style={[styles.logoutButton, { backgroundColor: c.logoutBg, borderColor: c.logoutBorder }]}
        >
          Cerrar sesión
        </Button>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
  },
  scrollPadding: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    padding: 4,
    borderRadius: 50,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
  },
  rut: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  email: {
    fontSize: 14,
    marginTop: 2,
  },
  kineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  kineText: {
    fontSize: 13,
    marginLeft: 6,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 16,
    marginLeft: 30,
  },
  segmented: {
    marginTop: 4,
  },
  input: {
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  listDescription: {
    fontSize: 13,
  },
  listItem: {
    padding: 0,
    marginHorizontal: -8,
  },
  logoutButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 8,
  },
});