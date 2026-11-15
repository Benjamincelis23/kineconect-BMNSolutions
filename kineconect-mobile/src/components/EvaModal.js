import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, TextInput, TouchableRipple, useTheme } from 'react-native-paper';

export default function EvaModal({ visible, onDismiss, onSubmit, sending }) {
  const theme = useTheme();
  const [dolor, setDolor] = useState(0);
  const [comentario, setComentario] = useState('');

  // Escala EVA simplificada con descripciones visuales
  const niveles = [
    { valor: 0, label: '0', color: '#4CAF50', desc: 'Sin dolor' },
    { valor: 2, label: '2', color: '#8BC34A', desc: 'Leve' },
    { valor: 4, label: '4', color: '#FFEB3B', desc: 'Molesto' },
    { valor: 6, label: '6', color: '#FF9800', desc: 'Fuerte' },
    { valor: 8, label: '8', color: '#FF5722', desc: 'Muy fuerte' },
    { valor: 10, label: '10', color: '#F44336', desc: 'Insoportable' },
  ];

  const handleEnviar = () => {
    onSubmit(dolor, comentario);
    // Limpiamos tras enviar
    setDolor(0);
    setComentario('');
  };

  return (
    <Portal>
      <Modal 
        visible={visible} 
        onDismiss={onDismiss} 
        contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
          ¿Cómo te sentiste hoy?
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Selecciona tu nivel de dolor al finalizar esta rutina (Escala EVA).
        </Text>

        {/* Selector de Nivel de Dolor */}
        <View style={styles.escalaContainer}>
          {niveles.map((item) => {
            const isSelected = dolor === item.valor;
            return (
              <TouchableRipple
                key={item.valor}
                onPress={() => setDolor(item.valor)}
                style={[
                  styles.circuloDolor,
                  { 
                    backgroundColor: isSelected ? item.color : theme.colors.surfaceVariant,
                    borderColor: isSelected ? theme.colors.onSurface : 'transparent',
                    borderWidth: isSelected ? 2 : 0,
                  }
                ]}
              >
                <Text style={{ 
                  color: isSelected ? '#000' : theme.colors.onSurfaceVariant, 
                  fontWeight: isSelected ? 'bold' : 'normal' 
                }}>
                  {item.label}
                </Text>
              </TouchableRipple>
            );
          })}
        </View>
        <Text style={[styles.dolorDesc, { color: theme.colors.primary }]}>
          {niveles.find(n => n.valor === dolor)?.desc}
        </Text>

        {/* Comentario Opcional */}
        <TextInput
          mode="outlined"
          label="Comentario (opcional)"
          placeholder="Ej: Me costó la flexión de rodilla..."
          value={comentario}
          onChangeText={setComentario}
          multiline
          numberOfLines={3}
          style={styles.input}
          outlineColor={theme.colors.outline}
          activeOutlineColor={theme.colors.primary}
        />

        {/* Botones de Acción */}
        <View style={styles.actions}>
          <Button mode="text" onPress={onDismiss} disabled={sending} textColor={theme.colors.onSurfaceVariant}>
            Cancelar
          </Button>
          <Button 
            mode="contained" 
            onPress={handleEnviar} 
            loading={sending} 
            disabled={sending}
            buttonColor={theme.colors.primary}
          >
            Enviar Feedback
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    elevation: 5,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  escalaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  circuloDolor: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dolorDesc: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 20,
    fontSize: 16,
  },
  input: {
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  }
});