(function () {
    const STORAGE_KEY = 'kc_a11y_prefs_v1';

    const DEFAULTS = {
        tamanoTexto: 'normal', // 'normal' | 'grande' | 'xl'
        altoContraste: false,
        botonesGrandes: false,
        reducirMovimiento: false,
        guiaMultimedia: true,
    };

    function cargarPrefs() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
        } catch {
            return { ...DEFAULTS };
        }
    }

    function guardarPrefs(prefs) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch {
            // Ignora si el almacenamiento está restringido
        }
    }

    function aplicarPrefsAlDocumento(prefs) {
        const root = document.documentElement;
        root.setAttribute('data-a11y-text', prefs.tamanoTexto || 'normal');
        root.setAttribute('data-a11y-contrast', prefs.altoContraste ? 'true' : 'false');
        root.setAttribute('data-a11y-targets', prefs.botonesGrandes ? 'true' : 'false');
        root.setAttribute('data-a11y-motion', prefs.reducirMovimiento ? 'true' : 'false');
        root.setAttribute('data-a11y-captions', prefs.guiaMultimedia ? 'true' : 'false');
    }

    function mejorarSemanticaDOM() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
        });

        document.querySelectorAll('.messages').forEach(box => {
            box.setAttribute('role', 'alert');
            box.setAttribute('aria-live', 'polite');
        });

        const mapIconos = {
            'bx-edit': 'Editar registro',
            'bx-trash': 'Eliminar o archivar',
            'bx-x': 'Cerrar ventana',
            'bx-refresh': 'Actualizar datos',
        };

        const etiquetarIconos = () => {
            document.querySelectorAll('button, a.btn').forEach(el => {
                if (el.getAttribute('aria-label')) return;
                if (el.textContent.trim().length > 0) return;
                const icon = el.querySelector('i');
                if (!icon) return;
                const match = Object.keys(mapIconos).find(cls => icon.classList.contains(cls));
                el.setAttribute('aria-label', el.getAttribute('title') || (match ? mapIconos[match] : 'Acción'));
            });
        };

        etiquetarIconos();
        const observer = new MutationObserver(etiquetarIconos);
        observer.observe(document.body, { childList: true, subtree: true });

        // Soporte teclado (Tab + Enter/Espacio) en Mapa Anatómico SVG
        document.querySelectorAll('.anatomia-zona').forEach(zona => {
            const titulo = zona.getAttribute('data-titulo') || zona.getAttribute('data-zona') || 'Región muscular';
            zona.setAttribute('tabindex', '0');
            zona.setAttribute('role', 'button');
            zona.setAttribute('aria-label', `Filtrar ejercicios de ${titulo}`);

            zona.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    zona.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
            });
        });
    }

    function crearModalAccesibilidad() {
        if (document.getElementById('modal-accesibilidad-kc')) return;

        const modal = document.createElement('div');
        modal.id = 'modal-accesibilidad-kc';
        modal.className = 'modal-overlay';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'titulo-modal-a11y');
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-card" style="max-width: 560px; width: 94%; padding: 22px 24px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--gris-200);">
                    <div>
                        <h3 id="titulo-modal-a11y" style="margin: 0; font-size: 1.15rem; color: var(--azul-900); display: flex; align-items: center; gap: 8px;">
                            <i class='bx bx-universal-access' style="font-size: 1.35rem; color: #0284c7;"></i>
                            Centro de Accesibilidad y Comodidad
                        </h3>
                        <p style="margin: 3px 0 0; font-size: 0.82rem; color: var(--gris-600);">
                            Personaliza la lectura, el contraste y el tamaño de los controles en toda la plataforma.
                        </p>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-cerrar-a11y" aria-label="Cerrar panel de accesibilidad">
                        <i class='bx bx-x' style="font-size: 1.35rem;"></i>
                    </button>
                </div>

                <!-- Perfiles rápidos de 1 clic -->
                <div style="margin-bottom: 16px;">
                    <span style="display: block; font-size: 0.76rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gris-600); margin-bottom: 8px;">
                        Perfiles rápidos (un clic)
                    </span>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 8px;">
                        <button type="button" class="btn btn-secondary btn-sm a11y-preset-btn" data-preset="adulto_mayor"
                            style="justify-content: flex-start; padding: 9px 11px; text-align: left;">
                            <i class='bx bx-glasses' style="font-size: 1.1rem; color: #0284c7;"></i>
                            <span>Baja Visión / Mayor</span>
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm a11y-preset-btn" data-preset="motricidad"
                            style="justify-content: flex-start; padding: 9px 11px; text-align: left;">
                            <i class='bx bx-pointer' style="font-size: 1.1rem; color: #10b981;"></i>
                            <span>Motricidad / Teclado</span>
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm a11y-preset-btn" data-preset="auditivo"
                            style="justify-content: flex-start; padding: 9px 11px; text-align: left;">
                            <i class='bx bx-captions' style="font-size: 1.1rem; color: #f59e0b;"></i>
                            <span>Apoyo Auditivo</span>
                        </button>
                    </div>
                </div>

                <!-- Tamaño de letra -->
                <div style="padding: 12px 14px; border-radius: 11px; border: 1px solid var(--gris-200); background: var(--gris-50); margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <strong style="display: block; font-size: 0.88rem; color: var(--azul-900);">Tamaño de Texto</strong>
                            <span style="font-size: 0.77rem; color: var(--gris-600);">Escala tipográfica en tablas, fichas y formularios</span>
                        </div>
                        <div style="display: flex; gap: 6px;" id="grupo-tamano-texto-a11y">
                            <button type="button" class="btn btn-secondary btn-sm" data-size="normal">Normal</button>
                            <button type="button" class="btn btn-secondary btn-sm" data-size="grande">Grande (A+)</button>
                            <button type="button" class="btn btn-secondary btn-sm" data-size="xl">Extra (A++)</button>
                        </div>
                    </div>
                </div>

                <!-- Interruptores individuales -->
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;">
                    <label style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 11px; border: 1px solid var(--gris-200); cursor: pointer;">
                        <div>
                            <strong style="display: block; font-size: 0.88rem; color: var(--azul-900);">Alto Contraste y Foco Reforzado</strong>
                            <span style="font-size: 0.77rem; color: var(--gris-600);">Bordes más nítidos y anillo de foco visible al tabular</span>
                        </div>
                        <input type="checkbox" id="chk-a11y-contraste">
                    </label>

                    <label style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 11px; border: 1px solid var(--gris-200); cursor: pointer;">
                        <div>
                            <strong style="display: block; font-size: 0.88rem; color: var(--azul-900);">Botones y Áreas Táctiles Amplias</strong>
                            <span style="font-size: 0.77rem; color: var(--gris-600);">Aumenta el espaciado y altura de botones para facilitar el clic</span>
                        </div>
                        <input type="checkbox" id="chk-a11y-targets">
                    </label>

                    <label style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 11px; border: 1px solid var(--gris-200); cursor: pointer;">
                        <div>
                            <strong style="display: block; font-size: 0.88rem; color: var(--azul-900);">Reducir Animaciones</strong>
                            <span style="font-size: 0.77rem; color: var(--gris-600);">Evita transiciones y desplazamientos automáticos</span>
                        </div>
                        <input type="checkbox" id="chk-a11y-motion">
                    </label>

                    <label style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 11px; border: 1px solid var(--gris-200); cursor: pointer;">
                        <div>
                            <strong style="display: block; font-size: 0.88rem; color: var(--azul-900);">Apoyo Escrito y Alertas Visuales</strong>
                            <span style="font-size: 0.77rem; color: var(--gris-600);">Refuerza etiquetas textuales junto a íconos y videos</span>
                        </div>
                        <input type="checkbox" id="chk-a11y-captions">
                    </label>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding-top: 12px; border-top: 1px solid var(--gris-200);">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-reset-a11y">
                        <i class='bx bx-reset'></i> Restablecer
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" id="btn-listo-a11y">
                        <i class='bx bx-check'></i> Listo
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const sincronizarUI = () => {
            const prefs = cargarPrefs();
            document.getElementById('chk-a11y-contraste').checked = prefs.altoContraste;
            document.getElementById('chk-a11y-targets').checked = prefs.botonesGrandes;
            document.getElementById('chk-a11y-motion').checked = prefs.reducirMovimiento;
            document.getElementById('chk-a11y-captions').checked = prefs.guiaMultimedia;

            document.querySelectorAll('#grupo-tamano-texto-a11y button').forEach(btn => {
                const activo = btn.getAttribute('data-size') === prefs.tamanoTexto;
                btn.className = activo ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
            });
        };

        const actualizar = (parcial) => {
            const nuevas = { ...cargarPrefs(), ...parcial };
            guardarPrefs(nuevas);
            aplicarPrefsAlDocumento(nuevas);
            sincronizarUI();
        };

        document.querySelectorAll('#grupo-tamano-texto-a11y button').forEach(btn => {
            btn.addEventListener('click', () => actualizar({ tamanoTexto: btn.getAttribute('data-size') }));
        });

        document.getElementById('chk-a11y-contraste').addEventListener('change', (e) => actualizar({ altoContraste: e.target.checked }));
        document.getElementById('chk-a11y-targets').addEventListener('change', (e) => actualizar({ botonesGrandes: e.target.checked }));
        document.getElementById('chk-a11y-motion').addEventListener('change', (e) => actualizar({ reducirMovimiento: e.target.checked }));
        document.getElementById('chk-a11y-captions').addEventListener('change', (e) => actualizar({ guiaMultimedia: e.target.checked }));

        document.querySelectorAll('.a11y-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                if (preset === 'adulto_mayor') {
                    actualizar({ tamanoTexto: 'grande', altoContraste: true, botonesGrandes: true, reducirMovimiento: false, guiaMultimedia: true });
                } else if (preset === 'motricidad') {
                    actualizar({ tamanoTexto: 'normal', altoContraste: true, botonesGrandes: true, reducirMovimiento: true, guiaMultimedia: true });
                } else if (preset === 'auditivo') {
                    actualizar({ tamanoTexto: 'grande', altoContraste: false, botonesGrandes: false, reducirMovimiento: false, guiaMultimedia: true });
                }
            });
        });

        document.getElementById('btn-reset-a11y').addEventListener('click', () => {
            guardarPrefs(DEFAULTS);
            aplicarPrefsAlDocumento(DEFAULTS);
            sincronizarUI();
        });

        const cerrar = () => { modal.style.display = 'none'; };
        document.getElementById('btn-cerrar-a11y').addEventListener('click', cerrar);
        document.getElementById('btn-listo-a11y').addEventListener('click', cerrar);
        modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });

        window.abrirCentroAccesibilidad = () => {
            sincronizarUI();
            modal.style.display = 'flex';
        };
    }

    function insertarBotonAccesoDirecto() {
        if (document.getElementById('btn-abrir-a11y-global')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-abrir-a11y-global';
        btn.className = 'btn btn-secondary btn-sm';
        btn.setAttribute('aria-label', 'Abrir Centro de Accesibilidad y Comodidad (Alt + A)');
        btn.setAttribute('title', 'Accesibilidad y Comodidad (Alt + A)');
        btn.innerHTML = `<i class='bx bx-universal-access' style="font-size: 1.15rem; color: #0284c7;"></i> <span>Accesibilidad</span>`;
        btn.addEventListener('click', () => window.abrirCentroAccesibilidad && window.abrirCentroAccesibilidad());

        const topbar = document.querySelector('.topbar');
        if (topbar) {
            const userTag = topbar.querySelector('.user-tag');
            if (userTag && userTag.parentElement) {
                userTag.parentElement.insertBefore(btn, userTag);
                return;
            }
            topbar.appendChild(btn);
            return;
        }

        // Fallback en pantalla de Login (index.html)
        btn.style.cssText = 'position: fixed; top: 16px; right: 16px; z-index: 900;';
        document.body.appendChild(btn);
    }

    // Aplicar de inmediato antes del render completo
    aplicarPrefsAlDocumento(cargarPrefs());

    document.addEventListener('DOMContentLoaded', () => {
        crearModalAccesibilidad();
        insertarBotonAccesoDirecto();
        mejorarSemanticaDOM();
    });

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            window.abrirCentroAccesibilidad && window.abrirCentroAccesibilidad();
        }
        if (e.key === 'Escape') {
            const m = document.getElementById('modal-accesibilidad-kc');
            if (m && m.style.display === 'flex') m.style.display = 'none';
        }
    });
})();