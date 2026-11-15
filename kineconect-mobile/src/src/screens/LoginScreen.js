import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import KineConnectLogo from '../components/KineConnectLogo';
import api from '../services/api';
// 1. Importamos el hook que creaste en tu contexto
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 2. Extraemos la función login de tu contexto
  const { login } = useAuth();

  const iniciarSesion = async () => {
    if (!rut || !password) {
      Alert.alert('Campos incompletos', 'Por favor ingresa tu RUT y contraseña.');
      return;
    }

    try {
      setLoading(true);
      const cleanRut = rut.trim().replace(/\./g, '').replace(/-/g, '');

      const response = await api.post('/api/token/', {
        username: cleanRut,
        password: password,
      });

      // 3. Pasamos los tokens al contexto. Esto guarda en SecureStore
      // y mágicamente hace que App.js cambie a la pantalla "Main"
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
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <KineConnectLogo variant="light" iconSize={76} fontSize={32} />
          <Text style={styles.subtitle}>Tu rehabilitación kinésica en casa</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Usuario / RUT</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 12345678-9"
            placeholderTextColor="#94A3B8"
            value={rut}
            onChangeText={setRut}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingresa tu clave"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={iniciarSesion}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Iniciando sesión...' : 'Ingresar'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 18,
  },
  button: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});