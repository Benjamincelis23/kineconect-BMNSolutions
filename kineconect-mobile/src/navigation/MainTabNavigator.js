import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import PautaDetailScreen from '../screens/PautaDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProgresoScreen from '../screens/ProgresoScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const icon = (name) => ({ color, size }) => (
  <MaterialCommunityIcons name={name} color={color} size={size + 2} />
);

function Tabs() {
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();

  const colors = {
    bg: isDark ? '#0F172A' : '#F8FAFC',
    tabBg: isDark ? '#1E293B' : '#FFFFFF',
    tabBorder: isDark ? '#334155' : '#E2E8F0',
    activeTint: isDark ? '#38BDF8' : '#0284C7',
    inactiveTint: isDark ? '#94A3B8' : '#64748B',
  };

  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        sceneStyle: {
          backgroundColor: colors.bg,
        },
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopColor: colors.tabBorder,
          borderTopWidth: 1,
          elevation: 8,
          height: 64 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
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
        name="Progreso"
        component={ProgresoScreen}
        options={{ tabBarIcon: icon('chart-line') }}
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