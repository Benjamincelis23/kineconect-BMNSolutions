<<<<<<< HEAD
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
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen({ navigation }) {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

      await SecureStore.setItemAsync('access_token', response.data.access);
      if (response.data.refresh) {
        await SecureStore.setItemAsync('refresh_token', response.data.refresh);
      }

      // Redirigir al inicio o dejar que el navegador global detecte el token
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

        {/* Encabezado con el Logo */}
        <View style={styles.headerContainer}>
          <KineConnectLogo variant="light" iconSize={76} fontSize={32} />
          <Text style={styles.subtitle}>Tu rehabilitación kinésica en casa</Text>
        </View>

        {/* Tarjeta del Formulario */}
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

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation?.navigate('Register')}
          >
            <Text style={styles.registerText}>
              ¿No tienes cuenta? <Text style={styles.registerLink}>Solicitar registro</Text>
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
    backgroundColor: '#F8FAFC', // Fondo gris muy suave y limpio
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
    backgroundColor: '#0284C7', // Azul moderno corporativo
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
  registerButton: {
    marginTop: 22,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#64748B',
  },
  registerLink: {
    color: '#0284C7',
    fontWeight: '700',
  },
=======
import { useContext, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// IMPORTAMOS AuthContext DIRECTAMENTE EN LUGAR DE useAuth
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
    const [rut, setRut] = useState('');
    const [password, setPassword] = useState('');
    
    // Usamos useContext nativo para sacar la función login
    const { login } = useContext(AuthContext);

   const iniciarSesion = async () => {
        if (!rut || !password) {
            Alert.alert("Error", "Por favor ingresa tu RUT y contraseña");
            return;
        }

        try {
            // Asegúrate de que esta IP sea la correcta de tu ipconfig actual
            const response = await fetch('http://192.168.1.9:8000/api/v1/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: rut, password: password })
            });

            // PRIMERO verificamos si la respuesta fue exitosa antes de convertir a JSON
            if (response.ok) {
                const data = await response.json();
                await login(data.access, data.refresh);
            } else {
                // Si Django arroja un error (404 o 500), lo leemos como texto para evitar el crasheo del "<"
                const errorTexto = await response.text();
                console.error("Error exacto del servidor:", errorTexto);
                Alert.alert("Acceso denegado", "El RUT o la clave son incorrectos, o la ruta de Django falló.");
            }
        } catch (error) {
            console.error("Error de red:", error);
            Alert.alert("Error", "No se pudo conectar con el servidor.");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bienvenido a Kineconect</Text>
            
            <TextInput
                style={styles.input}
                placeholder="RUT (ej: 12345678-9)"
                value={rut}
                onChangeText={setRut}
                autoCapitalize="none"
            />
            
            <TextInput
                style={styles.input}
                placeholder="Contraseña temporal"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            
            <TouchableOpacity style={styles.button} onPress={iniciarSesion}>
                <Text style={styles.buttonText}>Ingresar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.registerButton} 
                onPress={() => navigation.navigate('Register')}
            >
                <Text style={styles.registerButtonText}>¿No tienes cuenta? Solicitar registro</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 15, marginBottom: 15, borderRadius: 8 },
    button: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    registerButton: { marginTop: 20, alignItems: 'center', padding: 10 },
    registerButtonText: { color: '#007BFF', fontSize: 16, fontWeight: '500' }
>>>>>>> 86de9de564b188a1b476e9f6e00a6cb85d613fb0
});