let todosLosEjercicios = [];
let ejerciciosFiltrados = [];
let todasLasPautas = [];      // todas las pautas (para "Usar en nueva prescripción")
let todasLasPlantillas = [];  // solo protocolos maestros
let carrito = [];
let zonaSeleccionadaActual = '';
let areaClinicaActual = 'todos';
let vistaActual = 'frontal';
const API_BASE_URL = 'https://kineconect-bmnsolutions.onrender.com/api/v1';

// ---------- Utilidades ----------
function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function aEntero(valor, defecto, minimo = 0) {
    const n = parseInt(valor, 10);
    return Number.isNaN(n) ? defecto : Math.max(minimo, n);
}

function resolverUrlMedia(ej) {
    let rawUrl =
        ej.video ||
        ej.archivo_video ||
        ej.video_file ||
        ej.video_mp4 ||
        ej.url_multimedia ||
        ej.video_url ||
        ej.gif_url ||
        ej.imagen ||
        '';

    if (!rawUrl && ej && typeof ej === 'object') {
        const rutaDetectada = Object.values(ej).find(
            v => typeof v === 'string' && /\.(mp4|webm|mov)($|\?)/i.test(v)
        );
        if (rutaDetectada) rawUrl = rutaDetectada;
    }

    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    return `${BACKEND_ORIGIN}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}

function obtenerTextareaNotas() {
    return document.getElementById('pauta-descripcion');
}

// ---------- 1. Alternancia de vistas anatómicas ----------
window.cambiarVistaAnatomica = function (vista) {
    vistaActual = vista;
    const gFrontal = document.getElementById('grupo-frontal');
    const gDorsal = document.getElementById('grupo-dorsal');
    const btnFrontal = document.getElementById('btn-vista-frontal');
    const btnDorsal = document.getElementById('btn-vista-dorsal');

    if (vista === 'frontal') {
        if (gFrontal) gFrontal.style.display = 'inline';
        if (gDorsal) gDorsal.style.display = 'none';
        if (btnFrontal) btnFrontal.className = 'btn-vista-toggle activo';
        if (btnDorsal) btnDorsal.className = 'btn-vista-toggle inactivo';
    } else {
        if (gFrontal) gFrontal.style.display = 'none';
        if (gDorsal) gDorsal.style.display = 'inline';
        if (btnFrontal) btnFrontal.className = 'btn-vista-toggle inactivo';
        if (btnDorsal) btnDorsal.className = 'btn-vista-toggle activo';
    }
};

// ---------- 2. Mapa anatómico SVG ----------
const ALIAS_ZONAS_ANATOMICAS = {
    cuello: ['cuello', 'cabeza', 'cervical', 'nuca'],
    hombros: ['hombro', 'hombros', 'deltoides', 'manguito'],
    pecho: ['pecho', 'pectoral', 'torax'],
    brazos: ['brazo', 'brazos', 'biceps', 'antebrazo'],
    triceps: ['triceps', 'brazo', 'brazos', 'antebrazo'],
    manos: ['mano', 'manos', 'muneca', 'munecas', 'dedos'],
    core: ['core', 'abdomen', 'abdominal', 'lumbar'],
    espalda: ['espalda', 'dorsal', 'trapecio', 'romboides'],
    lumbar: ['lumbar', 'core', 'espalda'],
    cadera: ['cadera', 'pelvis', 'gluteo', 'gluteos'],
    gluteos: ['gluteo', 'gluteos', 'cadera'],
    cuadriceps: ['cuadriceps', 'muslo', 'pierna', 'piernas', 'rodilla'],
    isquiotibiales: ['isquiotibiales', 'isquios', 'muslo', 'pierna', 'piernas', 'rodilla'],
    pantorrillas: ['pantorrilla', 'pantorrillas', 'gemelo', 'gemelos', 'tibial', 'pierna', 'piernas'],
    gemelos: ['gemelo', 'gemelos', 'pantorrilla', 'pantorrillas', 'soleo', 'pierna', 'piernas'],
    tobillo: ['tobillo', 'tobillos', 'pie', 'pies', 'plantar', 'aquiles']
};

function normalizarTexto(txt) {
    return String(txt ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_]+/g, ' ')
        .trim();
}

function obtenerAreasEjercicio(item) {
    if (Array.isArray(item.area_clinica) && item.area_clinica.length > 0) {
        return item.area_clinica.map(a => (typeof a === 'object' ? (a.nombre || '') : String(a)));
    }
    if (typeof item.area_clinica === 'string' && item.area_clinica.trim()) {
        return [item.area_clinica];
    }
    return ['Rehabilitación General'];
}

function inicializarEventosMapa() {
    const zonas = document.querySelectorAll('.anatomia-zona');
    const tooltip = document.getElementById('tooltip-anatomico');
    const wrapper = document.getElementById('svg-map-wrapper');

    zonas.forEach(zona => {
        zona.addEventListener('click', () => {
            const idZona = zona.getAttribute('data-zona') || '';
            const tituloZona = zona.getAttribute('data-titulo') || (idZona.charAt(0).toUpperCase() + idZona.slice(1));

            if (zonaSeleccionadaActual === idZona) {
                resetFiltroZona();
            } else {
                zonaSeleccionadaActual = idZona;
                actualizarResaltadoZonas();
                const labelTxt = document.getElementById('txt-zona-seleccionada');
                if (labelTxt) labelTxt.textContent = tituloZona;
                filtrarYRenderizarEjercicios();
            }
        });

        zona.addEventListener('mousemove', (e) => {
            if (!tooltip || !wrapper) return;
            const tituloZona = zona.getAttribute('data-titulo') || zona.getAttribute('data-zona') || 'Músculo';
            const detalleZona = zona.getAttribute('data-detalle') || '';
            const patron = zona.getAttribute('data-patron') || 'General';

            const rect = wrapper.getBoundingClientRect();
            const posX = e.clientX - rect.left + 12;
            const posY = e.clientY - rect.top - 12;

            tooltip.style.display = 'block';
            tooltip.style.left = `${Math.min(posX, rect.width - 175)}px`;
            tooltip.style.top = `${Math.max(posY, 8)}px`;
            tooltip.innerHTML = `
                <strong>${esc(tituloZona)}</strong>
                ${detalleZona ? `<span style="display:block; font-size:0.72rem; opacity:0.9; margin-top:2px;">${esc(detalleZona)}</span>` : ''}
                <span style="display:block; font-size:0.7rem; margin-top:3px; opacity:0.75;">Patrón: ${esc(patron)}</span>
            `;
        });

        zona.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.style.display = 'none';
        });
    });
}

window.resetFiltroZona = function () {
    zonaSeleccionadaActual = '';
    const labelTxt = document.getElementById('txt-zona-seleccionada');
    if (labelTxt) labelTxt.textContent = 'Cuerpo Completo';
    actualizarResaltadoZonas();
    filtrarYRenderizarEjercicios();
};

function actualizarResaltadoZonas() {
    document.querySelectorAll('.anatomia-zona').forEach(zona => {
        zona.classList.toggle('active', zona.getAttribute('data-zona') === zonaSeleccionadaActual);
    });
}

// ---------- 3. Filtros por condición / área clínica ----------
function inicializarFiltrosBiomecanicos() {
    const pills = document.querySelectorAll('.filtro-biomecanico-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.className = 'filtro-biomecanico-pill');
            pill.classList.add('activo-todos');
            areaClinicaActual = pill.getAttribute('data-area') || 'todos';
            filtrarYRenderizarEjercicios();
        });
    });
}

// ---------- 4. Catálogo de ejercicios ----------
async function inicializarCatalogo() {
    const loading = document.getElementById('loading-ejercicios');
    const container = document.getElementById('lista-ejercicios-disponibles');
    const noData = document.getElementById('no-ejercicios');

    if (loading) loading.style.display = 'block';
    if (container) container.style.display = 'none';
    if (noData) noData.style.display = 'none';

    try {
        const resp = await api.getEjercicios();
        todosLosEjercicios = Array.isArray(resp) ? resp : (resp?.results || []);
        filtrarYRenderizarEjercicios();
    } catch (error) {
        console.error('Error cargando ejercicios:', error);
        if (noData) {
            noData.style.display = 'block';
            const p = noData.querySelector('p');
            if (p) p.textContent = `Error al cargar catálogo: ${error.message}`;
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// Un solo listener para los botones de la lista (evita onclick inline con texto del usuario)
function inicializarAccionesCatalogo() {
    const container = document.getElementById('lista-ejercicios-disponibles');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        const accion = btn.dataset.accion;

        if (accion === 'agregar') {
            agregarAlCarrito(Number(btn.dataset.id));
        } else if (accion === 'media') {
            const ej = todosLosEjercicios.find(x => x.id === Number(btn.dataset.id));
            if (ej) verMultimedia(ej.nombre || ej.titulo || 'Ejercicio', resolverUrlMedia(ej));
        } else if (accion === 'areas') {
            const extra = btn.nextElementSibling;
            if (!extra) return;
            const oculto = extra.style.display === 'none';
            extra.style.display = oculto ? 'contents' : 'none';
            btn.textContent = oculto ? 'Ver menos' : btn.dataset.label;
        }
    });
}

function filtrarYRenderizarEjercicios() {
    const inputBuscar = document.getElementById('input-buscar-ejercicio');
    const termino = inputBuscar ? inputBuscar.value.trim() : '';
    const container = document.getElementById('lista-ejercicios-disponibles');
    const noData = document.getElementById('no-ejercicios');
    const terminoNorm = normalizarTexto(termino);
    const areaClave = normalizarTexto(areaClinicaActual);

    ejerciciosFiltrados = todosLosEjercicios
        .filter(item => {
            const nombre = normalizarTexto(item.nombre || item.titulo);
            const grupo = normalizarTexto(item.zona_corporal || item.zona_cuerpo || item.grupo_muscular);
            const listaAreasNorm = obtenerAreasEjercicio(item).map(a => normalizarTexto(a));

            const coincideTexto = !terminoNorm ||
                nombre.includes(terminoNorm) ||
                grupo.includes(terminoNorm) ||
                listaAreasNorm.some(a => a.includes(terminoNorm));

            let coincideZona = true;
            if (zonaSeleccionadaActual) {
                const claves = ALIAS_ZONAS_ANATOMICAS[zonaSeleccionadaActual] || [normalizarTexto(zonaSeleccionadaActual)];
                coincideZona = claves.some(clave => grupo.includes(clave) || nombre.includes(clave));
            }

            const coincideArea = areaClinicaActual === 'todos' || listaAreasNorm.some(a => a.includes(areaClave));

            return coincideTexto && coincideZona && coincideArea;
        })
        .sort((a, b) => (a.nombre || a.titulo || '').localeCompare(b.nombre || b.titulo || '', 'es'));

    if (!container || !noData) return;

    if (ejerciciosFiltrados.length === 0) {
        container.style.display = 'none';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';
    container.style.display = 'flex';
    container.innerHTML = '';

    const estiloBadgeArea = 'font-size: 0.7rem; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 999px; font-weight: 600;';

    ejerciciosFiltrados.forEach(ej => {
        const div = document.createElement('div');
        div.className = 'ejercicio-item-card';
        div.style.cssText = 'display: flex; flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 16px; text-align: left;';

        const nombre = ej.nombre || ej.titulo || 'Ejercicio';
        const zona = ej.zona_corporal || ej.zona_cuerpo || ej.grupo_muscular || 'General';
        const tieneMedia = !!resolverUrlMedia(ej);

        let areas = [...obtenerAreasEjercicio(ej)].sort((a, b) => a.localeCompare(b, 'es'));
        if (areaClinicaActual !== 'todos') {
            areas.sort((a, b) => (normalizarTexto(b).includes(areaClave) ? 1 : 0) - (normalizarTexto(a).includes(areaClave) ? 1 : 0));
        }

        const visibles = areas.slice(0, 2);
        const ocultas = areas.slice(2);

        let areasHtml = visibles.map(a => `<span style="${estiloBadgeArea}">${esc(a)}</span>`).join('');
        if (ocultas.length > 0) {
            const labelExtra = `+${ocultas.length} más`;
            areasHtml += `
                <button type="button" data-accion="areas" data-label="${esc(labelExtra)}" title="${esc(ocultas.join(', '))}"
                    style="font-size: 0.7rem; padding: 2px 8px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 999px; cursor: pointer; font-weight: 600;">
                    ${esc(labelExtra)}
                </button>
                <span style="display: none;">
                    ${ocultas.map(a => `<span style="${estiloBadgeArea}">${esc(a)}</span>`).join('')}
                </span>
            `;
        }

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 100%;">
                <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; min-width: 0; flex: 1; gap: 4px;">
                    <strong style="color: var(--azul-900); font-size: 0.95rem; line-height: 1.25; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${esc(nombre)}
                    </strong>
                    <span class="badge badge-neutro" style="font-size: 0.7rem;">${esc(zona)}</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-shrink: 0;">
                    <button type="button" class="btn btn-secondary btn-sm" data-accion="media" data-id="${ej.id}"
                        ${!tieneMedia ? 'disabled style="opacity: 0.5; cursor: not-allowed;" title="Sin demostración"' : 'title="Ver demostración"'}>
                        <i class='bx bx-video'></i>
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" data-accion="agregar" data-id="${ej.id}" title="Añadir a la pauta">
                        <i class='bx bx-plus'></i> Añadir
                    </button>
                </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 5px; width: 100%; padding-top: 8px; border-top: 1px solid var(--gris-100); text-align: left;">
                ${areasHtml}
            </div>
        `;
        container.appendChild(div);
    });
}

// ---------- 5. Modal multimedia ----------
window.verMultimedia = function (nombre, url) {
    if (!url) return;

    const modal = document.getElementById('modal-multimedia');
    const contenedor = document.getElementById('modal-multimedia-contenedor');
    const titulo = document.getElementById('modal-multimedia-titulo');
    if (!modal || !contenedor) return;

    if (titulo) titulo.textContent = nombre;
    contenedor.innerHTML = '';

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('watch?v=')) {
            videoId = url.split('watch?v=')[1].split('&')[0];
        }
        contenedor.innerHTML = `
            <iframe width="100%" height="340" src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1"
                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen style="display: block; border: 0;"></iframe>`;
    } else if (/\.(mp4|webm|mov)($|\?)/i.test(url)) {
        contenedor.innerHTML = `
            <video src="${esc(url)}" width="100%" controls autoplay playsinline
                style="display: block; max-height: 420px; background: #000;">
                Tu navegador no soporta la reproducción de video.
            </video>`;
    } else {
        contenedor.innerHTML = `
            <img src="${esc(url)}" alt="${esc(nombre)}" style="max-width: 100%; max-height: 380px; object-fit: contain; padding: 10px;">`;
    }

    modal.style.display = 'flex';
};

window.cerrarModalMultimedia = function () {
    const modal = document.getElementById('modal-multimedia');
    const contenedor = document.getElementById('modal-multimedia-contenedor');
    if (contenedor) {
        const videoEl = contenedor.querySelector('video');
        if (videoEl) {
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
        }
        contenedor.innerHTML = '';
    }
    if (modal) modal.style.display = 'none';
};

// ---------- 6. Carrito de prescripción ----------
window.agregarAlCarrito = function (idEjercicio, dosificacion = null) {
    const ejercicio = todosLosEjercicios.find(e => e.id === idEjercicio);
    if (!ejercicio) return;

    const existente = carrito.find(item => item.ejercicio.id === idEjercicio);
    if (existente) {
        if (dosificacion) {
            existente.series = dosificacion.series ?? existente.series;
            existente.repeticiones = dosificacion.repeticiones ?? existente.repeticiones;
            existente.descanso = dosificacion.descanso ?? existente.descanso;
        } else {
            existente.series += 1;
        }
    } else {
        carrito.push({
            ejercicio,
            series: dosificacion?.series ?? 3,
            repeticiones: dosificacion?.repeticiones ?? 12,
            descanso: dosificacion?.descanso ?? 60
        });
    }
    renderizarCarrito();
};

window.eliminarDelCarrito = function (index) {
    carrito.splice(index, 1);
    renderizarCarrito();
};

window.actualizarDosificacion = function (index, campo, valor) {
    if (!carrito[index]) return;
    const minimo = campo === 'descanso' ? 0 : 1;
    carrito[index][campo] = aEntero(valor, minimo, minimo);
};

function renderizarCarrito() {
    const contenedor = document.getElementById('carrito-items-container');
    const badgeTotal = document.getElementById('badge-total-items');
    const btnSubmit = document.getElementById('btn-confirmar-pauta');

    if (badgeTotal) badgeTotal.textContent = `${carrito.length} Ejercicios`;
    if (btnSubmit) btnSubmit.disabled = (carrito.length === 0);
    if (!contenedor) return;

    if (carrito.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state" id="carrito-vacio-msg" style="padding: 16px;">
                <p style="margin: 0; font-size: 0.85rem;">El carrito está vacío. Haz clic en "Añadir" en los ejercicios que desees prescribir.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = '';
    carrito.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'carrito-item-card';
        const nombre = item.ejercicio.nombre || item.ejercicio.titulo || 'Ejercicio';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="font-size: 0.85rem; color: var(--azul-900);">${esc(nombre)}</strong>
                <button type="button" onclick="eliminarDelCarrito(${index})" style="background: none; border: none; color: var(--rojo-500); cursor: pointer;" title="Quitar">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
            <div class="carrito-item-inputs">
                <div class="field" style="margin: 0;">
                    <label style="font-size: 0.7rem;">Series</label>
                    <input type="number" min="1" value="${item.series}" onchange="actualizarDosificacion(${index}, 'series', this.value)" style="padding: 4px 6px; font-size: 0.8rem;">
                </div>
                <div class="field" style="margin: 0;">
                    <label style="font-size: 0.7rem;">Reps / Seg</label>
                    <input type="number" min="1" value="${item.repeticiones}" onchange="actualizarDosificacion(${index}, 'repeticiones', this.value)" style="padding: 4px 6px; font-size: 0.8rem;">
                </div>
                <div class="field" style="margin: 0;">
                    <label style="font-size: 0.7rem;">Descanso(s)</label>
                    <input type="number" min="0" step="5" value="${item.descanso}" onchange="actualizarDosificacion(${index}, 'descanso', this.value)" style="padding: 4px 6px; font-size: 0.8rem;">
                </div>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

// ---------- 7. Plantillas / protocolos rápidos ----------
// Carga una pauta (plantilla o pauta existente) en el formulario.
function aplicarPautaAlFormulario(pauta) {
    const inputNombre = document.getElementById('pauta-nombre');
    if (inputNombre) {
        inputNombre.value = (pauta.titulo || '').replace(/\[Protocolo\]\s*/i, '').trim();
    }

    const textarea = obtenerTextareaNotas();
    if (textarea) textarea.value = pauta.notas || '';

    carrito = [];
    const detalles = Array.isArray(pauta.ejercicios_detalle) ? pauta.ejercicios_detalle : [];
    detalles.forEach(d => {
        const idEj = Number(
            d.ejercicio_id ?? (d.ejercicio && typeof d.ejercicio === 'object' ? d.ejercicio.id : d.ejercicio)
        );
        agregarAlCarrito(idEj, {
            series: aEntero(d.series, 3, 1),
            repeticiones: aEntero(d.repeticiones, 12, 1),
            descanso: aEntero(d.tiempo_descanso_segundos ?? d.descanso_seg, 60, 0)
        });
    });
    renderizarCarrito();
}

async function cargarSelectorPlantillas() {
    const select = document.getElementById('select-plantilla-predefinida');
    if (!select) return;

    try {
        const resp = typeof api.getPautas === 'function' ? await api.getPautas() : [];
        todasLasPautas = Array.isArray(resp) ? resp : (resp?.results || []);
        todasLasPlantillas = todasLasPautas.filter(p => p.es_plantilla === true);

        select.innerHTML = '<option value="">-- Sin plantilla (Prescripción manual) --</option>';
        todasLasPlantillas.forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl.id;
            opt.textContent = `📋 ${pl.titulo}`;
            select.appendChild(opt);
        });

        // El listener se registra ANTES de usar el parámetro de la URL
        select.addEventListener('change', (e) => {
            const id = parseInt(e.target.value, 10);
            if (!id) return;
            const pauta = todasLasPautas.find(p => p.id === id);
            if (pauta) aplicarPautaAlFormulario(pauta);
        });

        // ?plantilla=ID puede apuntar a una plantilla O a una pauta normal
        const idUrl = parseInt(new URLSearchParams(window.location.search).get('plantilla'), 10);
        if (idUrl) {
            const pauta = todasLasPautas.find(p => p.id === idUrl);
            if (pauta) {
                if (pauta.es_plantilla) select.value = String(pauta.id);
                aplicarPautaAlFormulario(pauta);
            }
        }
    } catch (error) {
        console.error('Error al cargar plantillas predefinidas:', error);
    }
}

// ---------- 8. Selector de pacientes (?paciente=ID) ----------
async function cargarSelectorPacientes() {
    const select = document.getElementById('select-paciente-pauta');
    if (!select) return;

    try {
        let pacientes = await api.getMisPacientes();
        if (pacientes && pacientes.results) pacientes = pacientes.results;
        if (!Array.isArray(pacientes)) pacientes = pacientes ? [pacientes] : [];

        select.innerHTML = '<option value="">-- Seleccionar Paciente --</option>';
        const pacienteUrlParam = new URLSearchParams(window.location.search).get('paciente');

        pacientes.forEach(p => {
            const opt = document.createElement('option');
            const userId = p.user_id || ((p.user && typeof p.user === 'object') ? p.user.id : (p.user || p.id));
            opt.value = userId;

            const nombre = p.nombre_completo ||
                (p.user && typeof p.user === 'object' ? `${p.user.first_name} ${p.user.last_name}`.trim() : '') ||
                'Paciente';
            opt.textContent = `${nombre} (${p.rut || 'Sin RUT'})`; // textContent: seguro

            if (pacienteUrlParam && (String(userId) === String(pacienteUrlParam) || String(p.id) === String(pacienteUrlParam))) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error al cargar selector de pacientes:', error);
    }
}

// 9. Envío y Creación de la Pauta / Plantilla Maestra
function inicializarFormularioPauta() {
    const form = document.getElementById('form-guardar-pauta');
    const checkSoloPlantilla = document.getElementById('check-solo-plantilla');
    const selectPaciente = document.getElementById('select-paciente-pauta');
    const btnSubmit = document.getElementById('btn-confirmar-pauta');

    if (!form) return;

    // Si marca "Guardar exclusivamente como Plantilla Maestra", liberamos y deshabilitamos el selector de paciente
    if (checkSoloPlantilla && selectPaciente) {
        checkSoloPlantilla.addEventListener('change', () => {
            if (checkSoloPlantilla.checked) {
                selectPaciente.value = '';
                selectPaciente.disabled = true;
                selectPaciente.style.opacity = '0.5';
                if (btnSubmit) {
                    btnSubmit.innerHTML = "<i class='bx bx-bookmark-alt'></i> Guardar Plantilla Maestra";
                }
            } else {
                selectPaciente.disabled = false;
                selectPaciente.style.opacity = '1';
                if (btnSubmit) {
                    btnSubmit.innerHTML = "<i class='bx bx-save'></i> Guardar y Asignar Pauta";
                }
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const inputNombre = document.getElementById('pauta-nombre');
        const inputDescripcion = document.getElementById('pauta-descripcion') || document.querySelector('textarea');
        const esSoloPlantilla = checkSoloPlantilla ? checkSoloPlantilla.checked : false;
        const pacienteId = selectPaciente ? selectPaciente.value : '';
        const titulo = inputNombre ? inputNombre.value.trim() : '';
        const textoNotas = inputDescripcion ? inputDescripcion.value.trim() : '';

        // Solo exigimos paciente si NO es plantilla maestra
        if (!esSoloPlantilla && !pacienteId) {
            alert('Por favor, selecciona un paciente en el menú superior o marca la casilla para guardar como Plantilla.');
            if (selectPaciente) selectPaciente.focus();
            return;
        }

        if (!titulo) {
            alert('Por favor, ingresa un nombre o título para el protocolo.');
            if (inputNombre) inputNombre.focus();
            return;
        }

        if (carrito.length === 0) {
            alert('Debes añadir al menos un ejercicio a la pauta.');
            return;
        }

        const payload = {
            paciente: esSoloPlantilla ? null : parseInt(pacienteId, 10),
            titulo: esSoloPlantilla && !titulo.toLowerCase().includes('protocolo') ? `[Protocolo] ${titulo}` : titulo,
            notas: textoNotas,
            es_plantilla: esSoloPlantilla,
            guardar_como_plantilla: false,
            ejercicios_detalle: carrito.map(item => ({
                ejercicio: item.ejercicio.id,
                series: parseInt(item.series, 10) || 3,
                repeticiones: parseInt(item.repeticiones, 10) || 10,
                tiempo_descanso_segundos: parseInt(item.descanso, 10) || 60
            }))
        };

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Guardando...";

        try {
            await api.crearPauta(payload);
            if (esSoloPlantilla) {
                alert('¡Protocolo maestro guardado con éxito! Ya puedes reutilizarlo en cualquier paciente.');
            } else {
                alert('¡Pauta clínica creada y asignada con éxito!');
            }
            window.location.href = 'pautas.html';
        } catch (error) {
            console.error('Error al guardar pauta:', error);
            alert(`Error al guardar: ${error.message || 'Comprueba los datos ingresados.'}`);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = esSoloPlantilla
                ? "<i class='bx bx-bookmark-alt'></i> Guardar Plantilla Maestra"
                : "<i class='bx bx-save'></i> Guardar y Asignar Pauta";
        }
    });
}

// ---------- Inicialización global ----------
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof api !== 'undefined' && !api.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    inicializarEventosMapa();
    inicializarFiltrosBiomecanicos();
    inicializarAccionesCatalogo();
    inicializarFormularioPauta();
    await inicializarCatalogo();
    await cargarSelectorPacientes();
    await cargarSelectorPlantillas(); // el catálogo ya está cargado: se puede rellenar el carrito

    const inputBuscar = document.getElementById('input-buscar-ejercicio');
    if (inputBuscar) inputBuscar.addEventListener('input', filtrarYRenderizarEjercicios);
});