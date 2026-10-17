const BASE_URL = 'http://127.0.0.1:8000/api/v1';

const api = {
    // 1. GESTIÓN DE AUTENTICACIÓN (JWT)
    login: async (username, password) => {
        const response = await fetch(`${BASE_URL}/auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            throw new Error('Credenciales inválidas');
        }

        const data = await response.json();
        // Guardar tokens en el almacenamiento local del navegador
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);

        // Novedad: Guardamos el nombre de usuario para mostrarlo en la barra superior
        localStorage.setItem('user_data', JSON.stringify({ username: username }));

        return data;
    },

    logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        window.location.href = '/index.html'; // Cambiado para apuntar al login de Vite
    },

    // --- NUEVAS FUNCIONES PARA VALIDAR SESIÓN ---
    isAuthenticated: () => {
        // Verifica si existe un token de acceso guardado
        return localStorage.getItem('access_token') !== null;
    },

    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('user_data'));
        } catch (e) {
            return null;
        }
    },
    // --------------------------------------------

    // 2. INTERCEPTOR BASE PARA PETICIONES AUTENTICADAS
    fetchAuth: async (endpoint, options = {}) => {
        const token = localStorage.getItem('access_token');

        if (!token) {
            console.error("No hay token JWT. Redirigiendo al login...");
            api.logout();
            return;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };

        const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

        if (response.status === 401) {
            // El token expiró o es inválido.
            console.error("Token expirado o inválido (401).");
            api.logout();
            throw new Error('Sesión expirada');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Error HTTP: ${response.status}`);
        }

        // Manejo para respuestas vacías (ej. un DELETE)
        if (response.status === 204) return null;

        return response.json();
    },

    // 3. MÉTODOS CRUD DEL NEGOCIO (KineConect)

    getEjercicios: async (parametrosURL = '') => {
        const data = await api.fetchAuth(`/ejercicios/${parametrosURL}`);
        return data.results || data;
    },

    getMisPacientes: async () => {
        const data = await api.fetchAuth('/perfiles/?rol=paciente');
        return data.results || data;
    },

    registrarPaciente: async (datosPaciente) => {
        return await api.fetchAuth('/perfiles/', {
            method: 'POST',
            body: JSON.stringify(datosPaciente)
        });
    },

    getPautas: async () => {
        const data = await api.fetchAuth('/pautas/');
        return data.results || data;
    },

    crearPauta: async (payloadPauta) => {
        return await api.fetchAuth('/pautas/', {
            method: 'POST',
            body: JSON.stringify(payloadPauta)
        });
    },

    getFeedbacks: async () => {
        const data = await api.fetchAuth('/feedback/');
        return data.results || data;
    }
};