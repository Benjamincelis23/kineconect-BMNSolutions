import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';

const LIGHT = {
  primary: '#1F7A5C',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E6F4EE',
  onPrimaryContainer: '#0B3D2E',
  secondary: '#2EAD7F',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E6F4EE',
  onSecondaryContainer: '#0B3D2E',
  background: '#F3F8F5',
  onBackground: '#0F2A22',
  surface: '#FFFFFF',
  onSurface: '#0F2A22',
  surfaceVariant: '#E6F4EE',
  onSurfaceVariant: '#4A6358',
  outline: '#8FB0A1',
  outlineVariant: '#CFE3DA',
  elevation: { level0: 'transparent', level1: '#FFFFFF', level2: '#FFFFFF', level3: '#FFFFFF', level4: '#FFFFFF', level5: '#FFFFFF' },
};

const DARK = {
  primary: '#2EAD7F',         // Tu verde principal para botones e íconos activos
  onPrimary: '#000000',
  primaryContainer: '#0B3D2E',
  onPrimaryContainer: '#E6F4EE',
  secondary: '#5FD4A5',
  onSecondary: '#000000',
  
  // FONDOS NEUTROS (El secreto de un buen modo oscuro)
  background: '#121212',      // Gris casi negro (Estándar de Material Design)
  onBackground: '#F0F0F0',    // Texto principal claro
  surface: '#1E1E1E',         // Gris un tono más claro para las tarjetas (Cards)
  onSurface: '#F0F0F0',       // Texto en tarjetas
  surfaceVariant: '#2A2A2A',  // Para inputs o áreas destacadas
  onSurfaceVariant: '#BDBDBD',// Texto secundario o íconos inactivos
  
  outline: '#444444',
  outlineVariant: '#222222',
  elevation: { level0: 'transparent', level1: '#1E1E1E', level2: '#222222', level3: '#242424', level4: '#272727', level5: '#2C2C2C' },
};

const Ctx = createContext(null);

export function AppThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setMode] = useState('system'); // 'light' | 'dark' | 'system'

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((v) => { if (v) setMode(v); }).catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.setItem('theme_mode', mode).catch(() => {});
  }, [mode]);

  const isDark = (mode === 'system' ? system : mode) === 'dark';

  const paperTheme = useMemo(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    const c = isDark ? DARK : LIGHT;
    return { ...base, roundness: 4, colors: { ...base.colors, ...c } };
  }, [isDark]);

  return (
    <Ctx.Provider value={{ mode, setMode, isDark, paperTheme }}>
      <PaperProvider theme={paperTheme}>{children}</PaperProvider>
    </Ctx.Provider>
  );
}

export const useAppTheme = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppTheme debe usarse dentro de <AppThemeProvider>');
  return ctx;
};