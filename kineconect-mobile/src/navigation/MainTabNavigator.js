import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper'; // Importar useTheme
import HomeScreen from '../screens/HomeScreen';
import PautaDetailScreen from '../screens/PautaDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const icon = (name) => ({ color, size }) => (
  <MaterialCommunityIcons name={name} color={color} size={size} />
);

function Tabs() {
  const theme = useTheme(); // Obtenemos el tema actual de PaperProvider

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // Forzamos los colores de la barra usando los valores del tema actual
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant || '#ddd', // Usamos un fallback si no existe outlineVariant
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant || '#888',
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{ tabBarIcon: icon('home-outline') }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ tabBarIcon: icon('account-outline') }}
      />
    </Tab.Navigator>
  );
}

export default function MainTabNavigator() {
  const theme = useTheme(); // Opcional: También aplicar tema al Stack de detalles

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={Tabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PautaDetail"
        component={PautaDetailScreen}
        options={{ title: 'Sesión' }}
      />
    </Stack.Navigator>
  );
}