import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, List, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext'; // Eliminado PALETAS
import api from '../services/api';
import { cacheGet, cacheSet } from '../services/offline';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { mode, setMode } = useAppTheme(); // Solo dejamos mode y setMode
  
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [me, setMe] = useState(null);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [saving, setSaving] = useState(false);

  // Sincronización con el endpoint real /api/me/ y caché offline
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

  // Función operativa para cambiar contraseña vinculada al backend
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

  // Nombres seguros por si el perfil aún está cargando
  const nombreCompleto = me ? `${me.nombre || ''} ${me.apellido || ''}`.trim() : 'Cargando perfil...';
  const rutPaciente = me?.rut ? `RUT: ${me.rut}` : '';

  return (
    <ScrollView 
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      {/* Tarjeta de Encabezado con Datos Reales */}
      <Card style={styles.card}>
        <View style={styles.headerContent}>
          <Avatar.Image 
            size={80} 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} 
            style={styles.avatar}
          />
          <Text variant="titleLarge" style={styles.name}>{nombreCompleto}</Text>
          <Text variant="bodyMedium" style={[styles.rut, { color: theme.colors.onSurfaceVariant }]}>{rutPaciente}</Text>
          <Text variant="bodySmall" style={[styles.email, { color: theme.colors.onSurfaceVariant }]}>{me?.email}</Text>
        </View>
        {me?.kinesiologo && (
          <Card.Content style={[styles.kineBox, { borderTopColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              <Text style={{ fontWeight: 'bold' }}>Kinesiólogo:</Text> {me.kinesiologo.nombre} ({me.kinesiologo.email})
            </Text>
          </Card.Content>
        )}
      </Card>

      {/* Selector de Apariencia (Ahora solo Modo de Pantalla) */}
      <Card style={styles.card}>
        <Card.Title title="Apariencia" subtitle="Personaliza el estilo visual de la app" />
        <Card.Content style={{ gap: 14 }}>
          <Text variant="bodySmall" style={[styles.sectionLabel, { color: theme.colors.primary }]}>Modo de Pantalla</Text>
          <SegmentedButtons 
            value={mode} 
            onValueChange={setMode}
            buttons={[
              { value: 'light', label: 'Claro' }, 
              { value: 'dark', label: 'Oscuro' }, 
              { value: 'system', label: 'Auto' }
            ]} 
          />
        </Card.Content>
      </Card>

      {/* Sección de Cambio de Contraseña Operativo */}
      <Card style={styles.card}>
        <Card.Title title="Cambiar Contraseña" />
        <Card.Content style={{ gap: 12 }}>
          <TextInput 
            mode="outlined" 
            label="Contraseña actual" 
            secureTextEntry 
            value={actual} 
            onChangeText={setActual} 
          />
          <TextInput 
            mode="outlined" 
            label="Nueva contraseña" 
            secureTextEntry 
            value={nueva} 
            onChangeText={setNueva} 
          />
          <Button 
            mode="contained" 
            onPress={cambiar} 
            loading={saving} 
            disabled={saving || !actual || !nueva}
            style={styles.primaryButton}
          >
            Actualizar Contraseña
          </Button>
        </Card.Content>
      </Card>

      {/* Opciones de Soporte */}
      <Card style={styles.card}>
        <List.Item
          title="Centro de Ayuda y Soporte"
          description="Contacto con tu centro kinesiológico"
          left={props => <List.Icon {...props} icon="help-circle-outline" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={handleSupport}
        />
      </Card>

      {/* Botón de Cerrar Sesión */}
      <Button 
        mode="outlined" 
        icon="logout" 
        onPress={logout} 
        textColor={theme.colors.error} 
        style={[styles.logoutButton, { borderColor: theme.colors.error }]}
      >
        Cerrar sesión
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 16, 
    gap: 12, 
    paddingBottom: 40 
  },
  card: { 
    borderRadius: 16, 
    elevation: 2 
  },
  headerContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    backgroundColor: '#208AEF',
    marginBottom: 10,
  },
  name: {
    fontWeight: 'bold',
  },
  rut: {
    marginTop: 2,
  },
  email: {
    marginTop: 2,
  },
  kineBox: {
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  sectionLabel: {
    fontWeight: '600',
    marginBottom: -6,
  },
  primaryButton: {
    marginTop: 4,
  },
  logoutButton: {
    borderWidth: 1,
    marginTop: 8,
  },
});