import { useContext, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// IMPORTAMOS AuthContext DIRECTAMENTE EN LUGAR DE useAuth
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
    const [rut, setRut] = useState('');
    const [password, setPassword] = useState('');
    
    // Usamos useContext nativo para sacar la función login
    const { login } = useContext(AuthContext);

   const iniciarSesion = async () => {
        if (!rut || !password) {
            Alert.alert("Error", "Por favor ingresa tu RUT y contraseña");
            return;
        }

        try {
            // Asegúrate de que esta IP sea la correcta de tu ipconfig actual
            const response = await fetch('http://192.168.1.9:8000/api/v1/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: rut, password: password })
            });

            // PRIMERO verificamos si la respuesta fue exitosa antes de convertir a JSON
            if (response.ok) {
                const data = await response.json();
                await login(data.access, data.refresh);
            } else {
                // Si Django arroja un error (404 o 500), lo leemos como texto para evitar el crasheo del "<"
                const errorTexto = await response.text();
                console.error("Error exacto del servidor:", errorTexto);
                Alert.alert("Acceso denegado", "El RUT o la clave son incorrectos, o la ruta de Django falló.");
            }
        } catch (error) {
            console.error("Error de red:", error);
            Alert.alert("Error", "No se pudo conectar con el servidor.");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bienvenido a Kineconect</Text>
            
            <TextInput
                style={styles.input}
                placeholder="RUT (ej: 12345678-9)"
                value={rut}
                onChangeText={setRut}
                autoCapitalize="none"
            />
            
            <TextInput
                style={styles.input}
                placeholder="Contraseña temporal"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            
            <TouchableOpacity style={styles.button} onPress={iniciarSesion}>
                <Text style={styles.buttonText}>Ingresar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.registerButton} 
                onPress={() => navigation.navigate('Register')}
            >
                <Text style={styles.registerButtonText}>¿No tienes cuenta? Solicitar registro</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 15, marginBottom: 15, borderRadius: 8 },
    button: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    registerButton: { marginTop: 20, alignItems: 'center', padding: 10 },
    registerButtonText: { color: '#007BFF', fontSize: 16, fontWeight: '500' }
});