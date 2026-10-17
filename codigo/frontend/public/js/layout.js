document.addEventListener("DOMContentLoaded", () => {
    // 1. Detectar la URL actual para iluminar el menú correspondiente
    const path = window.location.pathname;

    // 2. Construir el Menú Lateral (Sidebar) con las rutas corregidas
    const sidebarHTML = `
        <aside class="sidebar" id="sidebar">
            <div class="brand">Kine<span>Conect</span></div>
            <nav>
                <a href="/inicio.html" class="${path.includes('inicio') ? 'active' : ''}">🏠 Inicio</a>
                <a href="/crear_pauta.html" class="${path.includes('crear_pauta') ? 'active' : ''}">🗺️ Mapa Anatómico</a>
                <a href="/ejercicios.html" class="${path.includes('ejercicios') ? 'active' : ''}">🏋️ Catálogo Ejercicios</a>
                <a href="/pautas.html" class="${path.includes('pautas') ? 'active' : ''}">📈 Pautas y Dolor</a>
                <a href="/pacientes.html" class="${path.includes('pacientes') ? 'active' : ''}">👥 Gestión Pacientes</a>
            </nav>
            <div class="sidebar-footer">
                <button type="button" class="btn-logout" onclick="api.logout()">🚪 Cerrar Sesión</button>
            </div>
        </aside>
    `;

    // 3. Construir la Barra Superior (Topbar) con los botones de Tema y Menú
    const topbarHTML = `
        <header class="topbar">
            <div class="topbar-left">
                <button id="btn-toggle-sidebar" class="icon-btn" title="Ocultar/Mostrar Menú">☰</button>
                <h1 style="margin: 0; font-size: 1.4rem;">Panel de Control</h1>
            </div>
            <div class="topbar-right">
                <button id="btn-toggle-theme" class="icon-btn" title="Cambiar Tema">🌙</button>
                <div class="user-tag" id="user-display">Cargando...</div>
            </div>
        </header>
    `;

    // 4. Inyectar ambos bloques en el HTML
    const appShell = document.querySelector('.app-shell');
    const main = document.querySelector('.main');

    if (appShell && main) {
        appShell.insertAdjacentHTML('afterbegin', sidebarHTML);
        main.insertAdjacentHTML('afterbegin', topbarHTML);
    }

    // 5. Lógica del Menú Retráctil
    const btnSidebar = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    if (btnSidebar && sidebar) {
        btnSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // 6. Lógica del Modo Oscuro
    const btnTheme = document.getElementById('btn-toggle-theme');
    const savedTheme = localStorage.getItem('kineconect_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    if (btnTheme) {
        btnTheme.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        btnTheme.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('kineconect_theme', newTheme);
            btnTheme.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        });
    }

    // 7. Mostrar el usuario conectado desde la API
    if (typeof api !== 'undefined' && api.getUser) {
        const user = api.getUser();
        const userTag = document.getElementById('user-display');
        if (user && userTag) {
            userTag.textContent = user.nombre_completo || user.username || 'Usuario';
        }
    }
});