import { MaterialCommunityIcons } from '@expo/vector-icons';
 import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
 import { createNativeStackNavigator } from '@react-navigation/native-stack';

 // Eliminamos la importación de useTheme, ¡ahora mandan nuestros colores!

 import HomeScreen from '../screens/HomeScreen';
 import PautaDetailScreen from '../screens/PautaDetailScreen';
 import ProfileScreen from '../screens/ProfileScreen';

 const Tab = createBottomTabNavigator();
 const Stack = createNativeStackNavigator();

 const icon = (name) => ({ color, size }) => (
   <MaterialCommunityIcons name={name} color={color} size={size + 2} />
 );

 function Tabs() {
   return (
     <Tab.Navigator
       screenOptions={{
         headerShown: false,
         // Forzamos los colores de la barra al nuevo estilo limpio
         tabBarStyle: {
           backgroundColor: '#FFFFFF',
           borderTopColor: '#F1F5F9',
           borderTopWidth: 1,
           elevation: 12,
           shadowColor: '#0F172A',
           shadowOpacity: 0.06,
           shadowOffset: { width: 0, height: -4 },
           shadowRadius: 16,
           height: 64,
           paddingBottom: 10,
           paddingTop: 8,
         },
         tabBarActiveTintColor: '#0284C7', // Azul corporativo activo
         tabBarInactiveTintColor: '#94A3B8', // Gris pizarra inactivo
         tabBarLabelStyle: {
           fontSize: 12,
           fontWeight: '600',
         }
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
   return (
     <Stack.Navigator
       screenOptions={{
         // Forzamos el color claro también en la vista de detalle de Pautas
         headerStyle: { backgroundColor: '#FFFFFF' },
         headerTintColor: '#0F172A',
         headerTitleStyle: { fontWeight: '700' },
         headerShadowVisible: false, // Quita la fea línea negra divisoria nativa
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
   );
 }