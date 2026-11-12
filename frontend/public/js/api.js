const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const api = {
    // ==========================================
    // GESTIÓN DE TOKENS Y SESIÓN
    // ==========================================
    getToken() {
        return localStorage.getItem('KineConnect_access_token');
    },

    getRefreshToken() {
        return localStorage.getItem('KineConnect_refresh_token');
    },

    setTokens(access, refresh) {
        if (access) localStorage.setItem('KineConnect_access_token', access);
        if (refresh) localStorage.setItem('KineConnect_refresh_token', refresh);
    },

    clearTokens() {
        localStorage.removeItem('KineConnect_access_token');
        localStorage.removeItem('KineConnect_refresh_token');
        localStorage.removeItem('KineConnect_user');
    },

    setUser(user) {
        localStorage.setItem('KineConnect_user', JSON.stringify(user));
    },

    getUser() {
        const u = localStorage.getItem('KineConnect_user');
        try {
            return u ? JSON.parse(u) : null;
        } catch {
            return null;
        }
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    logout() {
        this.clearTokens();
        window.location.href = 'index.html';
    },

    // ==========================================
    // AUTENTICACIÓN JWT (Rutas exactas de urls.py)
    // ==========================================
    async login(username, password) {
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await resp.json().catch(() => null);

            if (!resp.ok) {
                const errorMsg = data?.detail || data?.error || 'Credenciales incorrectas o usuario no encontrado.';
                throw new Error(errorMsg);
            }

            this.setTokens(data.access, data.refresh);

            const userData = {
                username: username,
                nombre_completo: data.nombre_completo || username,
                rol: data.rol || 'kinesiologo'
            };
            this.setUser(userData);

            return data;
        } catch (err) {
            console.error('[API Login Error]:', err);
            throw err;
        }
    },

    async refreshToken() {
        const refresh = this.getRefreshToken();
        if (!refresh) return null;

        try {
            const resp = await fetch(`${API_BASE_URL}/auth/refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh })
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data.access) {
                    this.setTokens(data.access, data.refresh || refresh);
                    return data.access;
                }
            }
        } catch {
            // Error en refresh
        }

        this.clearTokens();
        return null;
    },

    // ==========================================
    // INTERCEPTOR HTTP CON BEARER TOKEN
    // ==========================================
    async request(endpoint, options = {}) {
        let token = this.getToken();

        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        };

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        if (options.body) {
            config.body = options.body;
        }

        let resp = await fetch(`${API_BASE_URL}${endpoint}`, config);

        // Si el token expiró (401), renovar con /auth/refresh/
        if (resp.status === 401 && this.getRefreshToken()) {
            token = await this.refreshToken();
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
                resp = await fetch(`${API_BASE_URL}${endpoint}`, config);
            } else {
                this.logout();
                throw new Error('Sesión expirada. Inicia sesión nuevamente.');
            }
        }

        if (resp.status === 204) return null;

        const data = await resp.json().catch(() => null);

        if (!resp.ok) {
            let errorMsg = `Error HTTP: ${resp.status}`;
            if (data) {
                if (typeof data === 'string') errorMsg = data;
                else if (data.detail) errorMsg = data.detail;
                else {
                    const errores = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`);
                    errorMsg = errores.join(' | ');
                }
            }
            throw new Error(errorMsg);
        }

        return data;
    },

    // ==========================================
    // RECURSOS REST (RUTAS DEL ROUTER)
    // ==========================================
    async getMisPacientes() {
        return this.request('/perfiles/mis-pacientes/');
    },
    async getAlertasAbandono() {
        return await this.request('/perfiles/alertas-abandono/');
    },
    async registrarPaciente(datos) {
        return this.request('/perfiles/registrar-paciente/', {
            method: 'POST',
            body: JSON.stringify(datos)
        });
    },
    async crearPauta(datos) {
        return this.request('/pautas/', {
            method: 'POST',
            body: JSON.stringify(datos)
        });
    },

    async getPautas() {
        return this.request('/pautas/');
    },

    async getEjercicios() {
        return this.request('/ejercicios/');
    },

    async getReportesDolor() {
        // Feedback registrado en el router
        return this.request('/feedback/');
    }
};