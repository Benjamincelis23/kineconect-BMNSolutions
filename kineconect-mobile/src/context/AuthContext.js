import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState } from 'react';
import { setSessionExpiredHandler } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Función para cerrar sesión limpiando SecureStore
  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      setUserToken(null);
    } catch (error) {
      console.error('Error borrando tokens seguros:', error);
    }
  };

  // Registrar el manejador para que Axios dispare el logout automático si expira el refresh token
  useEffect(() => {
    setSessionExpiredHandler(() => logout());
  }, []);

  // 2. Revisa si ya hay un token guardado al abrir la app
  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (token) {
          setUserToken(token);
        }
      } catch (e) {
        console.log('Error leyendo el token seguro', e);
      } finally {
        setIsLoading(false);
      }
    };
    checkToken();
  }, []);

  // 3. Función de login guardando tokens
  const login = async (access, refresh) => {
    try {
      await SecureStore.setItemAsync('access_token', access);
      if (refresh) {
        await SecureStore.setItemAsync('refresh_token', refresh);
      }
      setUserToken(access);
    } catch (error) {
      console.error('Error guardando tokens de forma segura:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ login, logout, userToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para consumir el contexto fácilmente
export const useAuth = () => useContext(AuthContext);