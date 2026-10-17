const BASE_URL = 'http://127.0.0.1:8000/api/v1';

const api = {
    getToken() {
        return localStorage.getItem('token') || localStorage.getItem('access_token');
    },

    setToken(token) {
        localStorage.setItem('token', token);
    },

    getUser() {
        const userStr = localStorage.getItem('usuario');
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch {
            return null;
        }
    },

    setUser(user) {
        localStorage.setItem('usuario', JSON.stringify(user));
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('usuario');
        window.location.href = '/login/';
    },

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        try {
            const respuesta = await fetch(url, {
                ...options,
                headers
            });

            if (respuesta.status === 401 && !endpoint.includes('auth/login')) {
                this.logout();
                throw new Error('Sesión expirada. Por favor ingresa nuevamente.');
            }

            const data = await respuesta.json().catch(() => null);

            if (!respuesta.ok) {
                const mensaje = data?.detail || data?.message || data?.error || `Error ${respuesta.status}`;
                throw new Error(mensaje);
            }

            return data;
        } catch (error) {
            console.error(`Error en API [${endpoint}]:`, error);
            throw error;
        }
    },

    async login(username, password) {
        const data = await this.request('/auth/login/', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        const token = data.access || data.token || data.access_token;
        if (token) {
            this.setToken(token);
        }
        if (data.user || data.usuario) {
            this.setUser(data.user || data.usuario);
        } else {
            this.setUser({ username });
        }
        return data;
    },

    async getEjercicios(zona = '') {
        const query = zona ? `?zona=${encodeURIComponent(zona)}` : '';
        return this.request(`/ejercicios/${query}`);
    },

    async getMisPacientes() {
        return this.request('/pacientes/');
    },

    async registrarPaciente(datos) {
        return this.request('/pacientes/', {
            method: 'POST',
            body: JSON.stringify(datos)
        });
    },

    async crearPauta(payload) {
        return this.request('/pautas/', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async getPautas() {
        return this.request('/pautas/');
    },

    async getFeedbacks() {
        return this.request('/feedbacks/');
    }
};

window.api = api;
