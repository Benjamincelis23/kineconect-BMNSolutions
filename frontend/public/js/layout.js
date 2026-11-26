// Aplicar tema de inmediato para evitar parpadeos visuales al cargar la página
(function () {
    const savedTheme = localStorage.getItem('KineConnect_theme') || 'dark';
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
    const path = window.location.pathname;

    const isInicio = path.endsWith('/inicio.html') || path.endsWith('/') || path.endsWith('/frontend/');
    const isCrearPauta = path.includes('crear_pauta');
    const isEjercicios = path.includes('ejercicios');
    const isMensajes = path.includes('mensajes');
    const isPautas = path.includes('pautas');
    const isPacientes = path.includes('pacientes');

    let tituloPagina = 'Panel Clínico';
    if (isInicio) tituloPagina = 'Resumen Clínico';
    else if (isCrearPauta) tituloPagina = 'Prescripción Biomecánica';
    else if (isEjercicios) tituloPagina = 'Catálogo de Ejercicios';
    else if (isMensajes) tituloPagina = 'Bandeja de Reportes';
    else if (isPautas) tituloPagina = 'Pautas y Plantillas';
    else if (isPacientes) tituloPagina = 'Gestión de Pacientes';

    const sidebarHTML = `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-brand-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px 18px; margin: 0 12px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                <a href="inicio.html" style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; text-decoration: none; background: transparent;">
                    <svg width="36" height="36" viewBox="3 3 58 58" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0; display: block;" aria-hidden="true">
                        <defs>
                            <linearGradient id="waveCyanSidebar" x1="14" y1="14" x2="46" y2="38" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#7DD3FC" />
                                <stop offset="100%" stop-color="#38BDF8" />
                            </linearGradient>
                            <linearGradient id="waveWhiteSidebar" x1="50" y1="50" x2="18" y2="26" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#FFFFFF" />
                                <stop offset="100%" stop-color="#BAE6FD" />
                            </linearGradient>
                        </defs>
                        <circle cx="32" cy="32" r="28" fill="#FFFFFF" fill-opacity="0.07" stroke="#38BDF8" stroke-opacity="0.32" stroke-width="1.5" />
                        <path d="M16 36C16 20 26 14 46 20C36 21 27 27 24 38C20.5 38.5 17.5 37.5 16 36Z" fill="url(#waveCyanSidebar)" />
                        <path d="M48 28C48 44 38 50 18 44C28 43 37 37 40 26C43.5 25.5 46.5 26.5 48 28Z" fill="url(#waveWhiteSidebar)" />
                        <circle cx="32" cy="32" r="7.5" fill="#38BDF8" fill-opacity="0.24" />
                        <circle cx="32" cy="32" r="4.3" fill="#38BDF8" />
                    </svg>
                    <div class="brand" style="margin: 0; padding: 0; width: auto; border: none; text-align: left; font-size: 1.38rem; line-height: 1; display: inline-flex; align-items: center; transform: translateY(1px);">Kine<span>Connect</span></div>
                </a>
                <button type="button" id="btn-close-sidebar" class="btn-close-sidebar-mobile" title="Cerrar Menú" aria-label="Cerrar Menú">
                    <i class='bx bx-x'></i>
                </button>
            </div>
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
                <a href="mensajes.html" class="${isMensajes ? 'active' : ''}">
                    <i class='bx bx-message-square-detail'></i> Bandeja de Reportes
                </a>
                <a href="pautas.html" class="${isPautas ? 'active' : ''}">
                    <i class='bx bx-clipboard'></i> Pautas y Plantillas
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

    const topbarHTML = `
        <header class="topbar">
            <div class="topbar-left" style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                <button id="btn-toggle-sidebar" class="btn btn-secondary btn-sm" title="Ocultar/Mostrar Menú" aria-label="Menú">
                    <i class='bx bx-menu' style="font-size: 1.2rem;"></i>
                </button>
                <h1 class="topbar-title" style="margin: 0; font-size: 1.35rem; font-weight: 700; color: var(--azul-900);">${tituloPagina}</h1>
            </div>
            <div class="topbar-right" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <button id="btn-toggle-theme" class="btn btn-secondary btn-sm" title="Cambiar Tema" aria-label="Cambiar Tema">
                    <i class='bx bx-moon' style="font-size: 1.15rem;"></i>
                </button>
                <div class="user-tag" id="user-display">
                    <i class='bx bx-user-circle'></i> <span>Cargando...</span>
                </div>
            </div>
        </header>
    `;

    const appShell = document.querySelector('.app-shell');
    const main = document.querySelector('.main');

    if (appShell && !document.getElementById('sidebar')) {
        appShell.insertAdjacentHTML('afterbegin', sidebarHTML);
    }

    if (main && !document.querySelector('.topbar')) {
        main.insertAdjacentHTML('afterbegin', topbarHTML);
    }

    const btnSidebar = document.getElementById('btn-toggle-sidebar');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const sidebar = document.getElementById('sidebar');

    if (btnSidebar && sidebar) {
        btnSidebar.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('is-open');
            } else {
                sidebar.classList.toggle('is-collapsed');
                if (main) {
                    main.classList.toggle('sidebar-collapsed');
                }
            }
        });
    }

    if (btnCloseSidebar && sidebar) {
        btnCloseSidebar.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.remove('is-open');
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && sidebar) {
            sidebar.classList.remove('is-open');
        }
    });

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    actualizarBotonTema(currentTheme);

    const btnTheme = document.getElementById('btn-toggle-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('KineConnect_theme', nextTheme);
            actualizarBotonTema(nextTheme);
        });
    }

    window.addEventListener('storage', (e) => {
        if ((e.key === 'KineConnect_theme' || e.key === 'kineconnect_theme') && e.newValue) {
            document.documentElement.setAttribute('data-theme', e.newValue);
            actualizarBotonTema(e.newValue);
        }
    });

    if (typeof api !== 'undefined' && api.getUser) {
        const user = api.getUser();
        const userTag = document.getElementById('user-display');
        if (user && userTag) {
            const nombreMostrar = user.nombre_completo || user.username || 'Kinesiólogo';
            userTag.innerHTML = `<i class='bx bx-user-circle'></i> <span>${nombreMostrar}</span>`;
        }
    }
});