// Backend según dónde corre la web: local -> runserver, cualquier otro host -> Render.
const BACKEND_ORIGIN = (() => {
    const host = window.location.hostname;
    const esLocal = host === 'localhost' || host === '127.0.0.1' || host === '';  // '' = file://
    return esLocal ? 'http://127.0.0.1:8000' : 'https://kineconect-bmnsolutions.onrender.com';
})();
const API_BASE_URL = `${BACKEND_ORIGIN}/api/v1`;

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
    // AUTENTICACIÓN JWT
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
                username: data.user?.username || username,
                nombre_completo: data.user?.nombre_completo || username,
                rol: data.user?.rol || 'KINE'
            };
            this.setUser(userData);

            return data;
        } catch (err) {
            console.error('[API Login Error]:', err);
            throw err;
        }
    },

    // H-47: single-flight. N peticiones concurrentes con 401 comparten un único POST de refresh.
    _refreshEnCurso: null,

    refreshToken() {
        if (!this._refreshEnCurso) {
            this._refreshEnCurso = this._pedirNuevoAccess().finally(() => {
                this._refreshEnCurso = null;
            });
        }
        return this._refreshEnCurso;
    },

    async _pedirNuevoAccess() {
        const refresh = this.getRefreshToken();
        if (!refresh) return null;

        try {
            // H-01: SimpleJWT expone el refresh fuera de /api/v1 (config/urls.py: api/token/refresh/)
            const resp = await fetch(`${BACKEND_ORIGIN}/api/token/refresh/`, {
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
    // H-47: único punto que adjunta el Bearer y renueva el token ante un 401.
    // 'ruta' es relativa a BACKEND_ORIGIN (ej. '/api/v1/pautas/' o '/api/pautas/').
    // Devuelve el Response crudo; request() lo usa y las páginas con fetch propio también.
    async fetchConSesion(ruta, options = {}) {
        const config = {
            method: options.method || 'GET',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        };
        if (options.body) config.body = options.body;

        const token = this.getToken();
        if (token) config.headers['Authorization'] = `Bearer ${token}`;

        let resp = await fetch(`${BACKEND_ORIGIN}${ruta}`, config);

        if (resp.status === 401 && this.getRefreshToken()) {
            const nuevo = await this.refreshToken();
            if (!nuevo) {
                this.logout();
                throw new Error('Sesión expirada. Inicia sesión nuevamente.');
            }
            config.headers['Authorization'] = `Bearer ${nuevo}`;
            resp = await fetch(`${BACKEND_ORIGIN}${ruta}`, config);
        }
        return resp;
    },

    async request(endpoint, options = {}) {
        const resp = await this.fetchConSesion(`/api/v1${endpoint}`, options);

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
    // RECURSOS REST
    // ==========================================
    async getMisPacientes() {
        return this.request('/perfiles/mis-pacientes/');
    },

    async getAlertasAbandono() {
        return this.request('/perfiles/alertas-abandono/');
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

    async getResumenClinico() {
        return this.request('/pautas/resumen-clinico/');
    },

    async getEjercicios() {
        return this.request('/ejercicios/');
    },

    async getReportesDolor() {
        return this.request('/feedback/');
    },
    async responderFeedback(feedbackId, respuestaTexto) {
        if (!feedbackId) {
            throw new Error('Falta el identificador del reporte clínico.');
        }

        const textoLimpio = typeof respuestaTexto === 'string' ? respuestaTexto.trim() : '';
        if (!textoLimpio) {
            throw new Error('Debes escribir una indicación o retroalimentación antes de enviar.');
        }

        return this.request(`/feedback/${encodeURIComponent(feedbackId)}/responder/`, {
            method: 'PATCH',
            body: JSON.stringify({
                respuesta_kinesiologo: textoLimpio,
            }),
        });
    }
};