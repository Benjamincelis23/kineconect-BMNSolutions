import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import KineConnectLogo from '../components/KineConnectLogo';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function LoginScreen() {
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [loading, setLoading] = useState(false);

  const c = {
    bg: isDark ? '#070F1C' : '#F8FAFC',
    logoCardBg: isDark ? '#0F1B2E' : '#FFFFFF',
    logoCardBorder: isDark ? '#1E293B' : '#E2E8F0',
    cardBg: isDark ? '#142033' : '#FFFFFF',
    cardBorder: isDark ? '#24344D' : '#E2E8F0',
    title: isDark ? '#F8FAFC' : '#0F172A',
    subtitle: isDark ? '#94A3B8' : '#64748B',
    label: isDark ? '#E2E8F0' : '#334155',
    inputBg: isDark ? '#0D1726' : '#F8FAFC',
    inputBorder: isDark ? '#2A3B55' : '#CBD5E1',
    inputText: isDark ? '#F8FAFC' : '#0F172A',
    placeholder: isDark ? '#64748B' : '#94A3B8',
    accent: isDark ? '#38BDF8' : '#0284C7',
    buttonBg: '#0284C7',
    buttonText: '#FFFFFF',
  };

  const iniciarSesion = async () => {
    if (!rut.trim() || !password) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu RUT y contraseña.');
      return;
    }

    try {
      setLoading(true);
      const cleanRut = rut.trim().replace(/\./g, '').replace(/-/g, '').toUpperCase();

      const response = await api.post('/api/v1/auth/login/', {
        username: cleanRut,
        password: password,
      });

      await login(response.data.access, response.data.refresh);
    } catch (error) {
      console.error(error);
      Alert.alert('Acceso denegado', 'El RUT o la clave son incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: Math.max(24, insets.top + 16),
            paddingBottom: Math.max(28, insets.bottom + 20),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <View
            style={[
              styles.logoCard,
              { backgroundColor: c.logoCardBg, borderColor: c.logoCardBorder },
            ]}
          >
            <KineConnectLogo variant={isDark ? 'dark' : 'light'} iconSize={72} fontSize={30} />
          </View>
          <Text style={[styles.subtitle, { color: c.subtitle }]}>
            Tu rehabilitación kinésica en casa
          </Text>
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: c.cardBg, borderColor: c.cardBorder },
          ]}
        >
          <Text style={[styles.cardTitle, { color: c.title }]}>Iniciar sesión</Text>
          <Text style={[styles.cardSubtitle, { color: c.subtitle }]}>
            Accede a tus pautas y ejercicios asignados.
          </Text>

          <Text style={[styles.label, { color: c.label }]}>Usuario / RUT</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.inputBg,
                borderColor: c.inputBorder,
                color: c.inputText,
              },
            ]}
            placeholder="Ej: 12345678-9"
            placeholderTextColor={c.placeholder}
            value={rut}
            onChangeText={setRut}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { color: c.label }]}>Contraseña</Text>
          <View
            style={[
              styles.passwordWrapper,
              { backgroundColor: c.inputBg, borderColor: c.inputBorder },
            ]}
          >
            <TextInput
              style={[styles.passwordInput, { color: c.inputText }]}
              placeholder="Ingresa tu clave"
              placeholderTextColor={c.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!mostrarClave}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setMostrarClave((prev) => !prev)}
              style={styles.toggleBtn}
            >
              <Text style={[styles.toggleText, { color: c.accent }]}>
                {mostrarClave ? 'Ocultar' : 'Mostrar'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.button, { backgroundColor: c.buttonBg }, loading && { opacity: 0.7 }]}
            onPress={iniciarSesion}
            disabled={loading}
          >
            <Text style={[styles.buttonText, { color: c.buttonText }]}>
              {loading ? 'Iniciando sesión...' : 'Ingresar'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCard: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    marginTop: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 16,
    paddingRight: 8,
    marginBottom: 22,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 8,
    fontSize: 15,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});