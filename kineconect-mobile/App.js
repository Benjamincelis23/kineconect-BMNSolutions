import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Importamos los Contextos (Autenticación y Tema)
import { AuthContext, AuthProvider } from './src/context/AuthContext';
import { AppThemeProvider } from './src/context/ThemeContext';

// Importamos tus pantallas y navegadores
import MainTabNavigator from './src/navigation/MainTabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';

const Stack = createNativeStackNavigator();

// RootNavigator: Decide qué mostrar dependiendo de si el usuario está logueado
function RootNavigator() {
  const { userToken, isLoading } = useContext(AuthContext);

  // Muestra un cargando mientras verifica si hay sesión guardada
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userToken ? (
        // Usuario CON sesión: va al menú principal
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        // Usuario SIN sesión: va al login/registro
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// App: Envuelve todo con los proveedores de estado y estilos
export default function App() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AppThemeProvider>
    </AuthProvider>
  );
}