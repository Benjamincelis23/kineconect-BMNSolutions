// Aplicar tema de inmediato para evitar parpadeos visuales al cargar la página
(function () {
    const savedTheme = localStorage.getItem('KineConnect_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

function actualizarBotonTema(theme) {
    const btnTheme = document.getElementById('btn-toggle-theme');
    if (!btnTheme) return;
    if (theme === 'dark') {
        btnTheme.innerHTML = "<i class='bx bx-sun' style='font-size: 1.15rem; color: #fbbf24;'></i>";
        btnTheme.setAttribute('title', 'Cambiar a Modo Claro');
    } else {
        btnTheme.innerHTML = "<i class='bx bx-moon' style='font-size: 1.15rem;'></i>";
        btnTheme.setAttribute('title', 'Cambiar a Modo Oscuro');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Detectar la URL actual para iluminar el menú y fijar el título
    const path = window.location.pathname;

    const isInicio = path.endsWith('/inicio.html') || path.endsWith('/') || path.endsWith('/frontend/');
    const isCrearPauta = path.includes('crear_pauta');
    const isEjercicios = path.includes('ejercicios');
    const isPautas = path.includes('pautas');
    const isPacientes = path.includes('pacientes');

    let tituloPagina = 'Panel de Control';
    if (isInicio) tituloPagina = 'Panel Principal';
    else if (isCrearPauta) tituloPagina = 'Prescripción Biomecánica';
    else if (isEjercicios) tituloPagina = 'Catálogo de Ejercicios';
    else if (isPautas) tituloPagina = 'Monitoreo de Dolor y Rutinas';
    else if (isPacientes) tituloPagina = 'Gestión de Pacientes';

    // Construir el Menú Lateral (Sidebar) con rutas relativas directas
    const sidebarHTML = `
        <aside class="sidebar" id="sidebar">
            <div class="brand">Kine<span>Connect</span></div>
            <nav>
                <a href="inicio.html" class="${isInicio ? 'active' : ''}">
                    <i class='bx bx-home-alt'></i> Inicio
                </a>
                <a href="crear_pauta.html" class="${isCrearPauta ? 'active' : ''}">
                    <i class='bx bx-body'></i> Mapa Anatómico
                </a>
                <a href="ejercicios.html" class="${isEjercicios ? 'active' : ''}">
                    <i class='bx bx-dumbbell'></i> Catálogo Ejercicios
                </a>
                <a href="pautas.html" class="${isPautas ? 'active' : ''}">
                    <i class='bx bx-clipboard'></i> Pautas y Dolor
                </a>
                <a href="pacientes.html" class="${isPacientes ? 'active' : ''}">
                    <i class='bx bx-group'></i> Gestión Pacientes
                </a>
            </nav>
            <div class="sidebar-footer">
                <button type="button" class="btn-logout" onclick="api.logout()">
                    <i class='bx bx-log-out'></i> Cerrar Sesión
                </button>
            </div>
        </aside>
    `;

    // Construir la Barra Superior (Topbar) con los botones de Tema y Menú
    const topbarHTML = `
        <header class="topbar">
            <div class="topbar-left" style="display: flex; align-items: center; gap: 12px;">
                <button id="btn-toggle-sidebar" class="btn btn-secondary btn-sm" title="Ocultar/Mostrar Menú">
                    <i class='bx bx-menu' style="font-size: 1.2rem;"></i>
                </button>
                <h1 style="margin: 0; font-size: 1.35rem; font-weight: 700; color: var(--azul-900);">${tituloPagina}</h1>
            </div>
            <div class="topbar-right" style="display: flex; align-items: center; gap: 12px;">
                <button id="btn-toggle-theme" class="btn btn-secondary btn-sm" title="Cambiar Tema">
                    <i class='bx bx-moon' style="font-size: 1.15rem;"></i>
                </button>
                <div class="user-tag" id="user-display">
                    <i class='bx bx-user-circle'></i> Cargando...
                </div>
            </div>
        </header>
    `;

    // Inyectar ambos bloques sólo si no existen previamente en el DOM
    const appShell = document.querySelector('.app-shell');
    const main = document.querySelector('.main');

    if (appShell && !document.getElementById('sidebar')) {
        appShell.insertAdjacentHTML('afterbegin', sidebarHTML);
    }

    if (main && !document.querySelector('.topbar')) {
        main.insertAdjacentHTML('afterbegin', topbarHTML);
    }

    // Lógica del Menú Retráctil
    const btnSidebar = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    if (btnSidebar && sidebar) {
        btnSidebar.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.toggle('is-collapsed');
            if (main) {
                main.classList.toggle('sidebar-collapsed');
            }
        });
    }

    // Lógica del Modo Oscuro
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    actualizarBotonTema(currentTheme);

    const btnTheme = document.getElementById('btn-toggle-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('KineConnect_theme', nextTheme);
            actualizarBotonTema(nextTheme);
        });
    }

    // Sincronizar cambio de tema entre distintas pestañas en tiempo real
    window.addEventListener('storage', (e) => {
        if (e.key === 'kineconnect_theme' && e.newValue) {
            document.documentElement.setAttribute('data-theme', e.newValue);
            actualizarBotonTema(e.newValue);
        }
    });

    //  Mostrar el usuario conectado desde la API
    if (typeof api !== 'undefined' && api.getUser) {
        const user = api.getUser();
        const userTag = document.getElementById('user-display');
        if (user && userTag) {
            userTag.innerHTML = `<i class='bx bx-user-circle'></i> ${user.nombre_completo || user.username || 'Kinesiólogo'}`;
        }
    }
});
