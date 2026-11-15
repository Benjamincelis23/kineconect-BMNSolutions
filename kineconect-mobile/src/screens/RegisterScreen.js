import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View, SafeAreaView, ScrollView, StyleSheet } from 'react-native';

export default function RegisterScreen({ navigation }) {
    const [rut, setRut] = useState('');
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [correo, setCorreo] = useState('');

    const enviarSolicitud = async () => {
        if (!rut || !nombre || !apellido || !correo) {
            Alert.alert("Campos incompletos", "Por favor completa todos los campos para enviar tu solicitud.");
            return;
        }

        try {
            const response = await fetch('https://kineconect-bmnsolutions.onrender.com';, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rut: rut,
                    nombre: nombre,
                    apellido: apellido,
                    email: correo
                })
            });

            if (response.ok) {
                Alert.alert("Solicitud enviada", "Tu cuenta ha sido registrada con éxito. Ya puedes iniciar sesión.");
                navigation.goBack();
            } else {
                Alert.alert("Error", "No se pudo procesar el registro. Revisa los datos e intenta nuevamente.");
            }
        } catch (error) {
            console.error("Error de red:", error);
            Alert.alert("Error de conexión", "No se pudo conectar con el servidor.");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.headerContainer}>
                    <Text style={styles.title}>Solicitar Acceso</Text>
                    <Text style={styles.subtitle}>Completa tus datos para registrarte en KineConnect</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>RUT</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: 12345678-9"
                            placeholderTextColor="#94a3b8"
                            value={rut}
                            onChangeText={setRut}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nombre</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Tu nombre"
                            placeholderTextColor="#94a3b8"
                            value={nombre}
                            onChangeText={setNombre}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Apellido</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Tu apellido"
                            placeholderTextColor="#94a3b8"
                            value={apellido}
                            onChangeText={setApellido}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Correo Electrónico</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="correo@ejemplo.com"
                            placeholderTextColor="#94a3b8"
                            value={correo}
                            onChangeText={setCorreo}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    {/* Botón principal azul */}
                    <TouchableOpacity
                        style={{
                            backgroundColor: '#0284c7',
                            paddingVertical: 14,
                            borderRadius: 10,
                            alignItems: 'center',
                            marginTop: 10,
                        }}
                        activeOpacity={0.8}
                        onPress={enviarSolicitud}
                    >
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Enviar Solicitud</Text>
                    </TouchableOpacity>

                    {/* Botón para volver al login */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>← Volver al Login</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    scrollContent: {
        padding: 24,
        justifyContent: 'center',
        flexGrow: 1,
        maxWidth: 420,
        width: '100%',
        alignSelf: 'center',
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    card: {
        backgroundColor: '#ffffff',
        padding: 24,
        borderRadius: 16,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    inputGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#475569',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        fontSize: 16,
    },
    backButton: {
        marginTop: 16,
        alignItems: 'center',
        padding: 8,
    },
    backButtonText: {
        color: '#0284c7',
        fontSize: 14,
        fontWeight: '600',
    }
});