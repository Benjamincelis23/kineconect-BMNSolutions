import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Contextos globales (Autenticación, Tema y Accesibilidad)
import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { AuthContext, AuthProvider } from './src/context/AuthContext';
import { AppThemeProvider } from './src/context/ThemeContext';

// Modal global de Accesibilidad y Comodidad
import AccessibilityModal from './src/components/AccessibilityModal';

// Pantallas y navegadores
import MainTabNavigator from './src/navigation/MainTabNavigator';
import LoginScreen from './src/screens/LoginScreen';

const Stack = createNativeStackNavigator();

// RootNavigator: Decide qué mostrar dependiendo de si el usuario está logueado
function RootNavigator() {
  const { userToken, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0284C7" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userToken ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

// App: Envuelve todo con los proveedores de estado, tema y accesibilidad
export default function App() {
  return (
    <AuthProvider>
      <AccessibilityProvider>
        <AppThemeProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <AccessibilityModal />
        </AppThemeProvider>
      </AccessibilityProvider>
    </AuthProvider>
  );
}