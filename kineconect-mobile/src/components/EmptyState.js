import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

export default function EmptyState({ 
  icon = 'folder-open-outline', 
  title = 'No hay elementos', 
  subtitle = 'Todo está limpio por aquí.', 
  onRetry 
}) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Aquí aplicamos el theme.colors.outline que pedía la instrucción */}
      <MaterialCommunityIcons name={icon} size={64} color={theme.colors.outline} />
      
      <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
      
      <Text variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
        {subtitle}
      </Text>
      
      {onRetry && (
        <Button mode="contained-tonal" onPress={onRetry} style={styles.button}>
          Reintentar
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    opacity: 0.8,
  },
  button: {
    marginTop: 8,
  },
});