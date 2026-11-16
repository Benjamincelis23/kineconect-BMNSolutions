import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from 'react-native-paper';

import HomeScreen from '../screens/HomeScreen';
import PautaDetailScreen from '../screens/PautaDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const icon = (name) => ({ color, size }) => (
  <MaterialCommunityIcons name={name} color={color} size={size + 2} />
);

function Tabs() {
  const theme = useTheme();
  const isDark = theme.dark;

  const colors = {
    tabBg: isDark ? '#1E293B' : '#FFFFFF',
    tabBorder: isDark ? '#334155' : '#E2E8F0',
    activeTint: isDark ? '#38BDF8' : '#0284C7',
    inactiveTint: isDark ? '#94A3B8' : '#64748B',
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopColor: colors.tabBorder,
          borderTopWidth: 1,
          elevation: 12,
          shadowColor: '#000000',
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 16,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.activeTint,
        tabBarInactiveTintColor: colors.inactiveTint,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
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
  const theme = useTheme();
  const isDark = theme.dark;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          },
          headerTintColor: isDark ? '#F8FAFC' : '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
          },
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
          options={{ title: 'Sesión de Rehabilitación' }}
        />
      </Stack.Navigator>
    </>
  );
}