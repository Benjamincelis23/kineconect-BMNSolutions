import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function EmptyState({
  icon = 'folder-open-outline',
  title = 'No hay elementos',
  subtitle = 'Todo está limpio por aquí.',
  onRetry
}) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon} size={72} color="#94A3B8" />

      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>

      <Text variant="bodyMedium" style={styles.description}>
        {subtitle}
      </Text>

      {onRetry && (
        <Button
          mode="contained"
          onPress={onRetry}
          style={styles.button}
          buttonColor="#0284C7"
          textColor="#FFFFFF"
        >
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
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
    color: '#1E293B',
    fontSize: 18,
  },
  description: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    color: '#64748B',
    fontSize: 15,
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
});