import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';

export default function RegisterScreen({ navigation }) {
    const [f, setF] = useState({ rut: '', nombre: '', apellido: '', email: '', telefono: '' });
    
    const set = (k) => (v) => setF({ ...f, [k]: v });
    
    const enviar = async () => {
        try {
            // Usamos directamente tu IP local y la ruta de la API, sin depender de un archivo config
            const r = await fetch('http://192.168.1.9:8000/api/v1/registro/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(f),
            });
            
            if (!r.ok) {
                const errorData = await r.json();
                throw new Error(JSON.stringify(errorData));
            }
            
            Alert.alert('Listo', 'Tu solicitud fue enviada. Recibirás tus credenciales por correo cuando el kinesiólogo te apruebe.');
            navigation.goBack();
        } catch (e) { 
            Alert.alert('Error', "Hubo un problema al enviar la solicitud."); 
            console.log(e);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Solicitar Acceso</Text>
            
            <TextInput style={styles.input} placeholder="RUT (ej: 12345678-9)" value={f.rut} onChangeText={set('rut')} />
            <TextInput style={styles.input} placeholder="Nombre" value={f.nombre} onChangeText={set('nombre')} />
            <TextInput style={styles.input} placeholder="Apellido" value={f.apellido} onChangeText={set('apellido')} />
            <TextInput style={styles.input} placeholder="Correo" keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={set('email')} />
            <TextInput style={styles.input} placeholder="Teléfono" keyboardType="phone-pad" value={f.telefono} onChangeText={set('telefono')} />
            
            <TouchableOpacity style={styles.button} onPress={enviar}>
                <Text style={styles.buttonText}>Enviar Solicitud</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>Volver al Login</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 15, marginBottom: 15, borderRadius: 8 },
    button: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    backButton: { padding: 15, alignItems: 'center' },
    backButtonText: { color: '#007BFF', fontSize: 16 }
});