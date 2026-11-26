let todosLosEjercicios = [];
let ejerciciosFiltrados = [];
let todasLasPautas = [];
let todasLasPlantillas = [];
let carrito = [];
let zonaSeleccionadaActual = '';
let areaClinicaActual = 'todos';
let soloConVideoPauta = false;
let vistaActual = 'frontal';

const ORDEN_ZONAS_CLINICAS = [
    'Cuello',
    'Hombro',
    'Brazos / Muñeca',
    'Pecho',
    'Espalda',
    'Core / Lumbar',
    'Cadera / Glúteos',
    'Piernas / Rodilla',
    'Tobillo / Pie',
    'Otras Zonas',
];

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

function normalizarTexto(txt) {
    return String(txt ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_]+/g, ' ')
        .trim();
}

function inferirUnidadEjercicio(ejercicio, unidadExplicita = null) {
    if (unidadExplicita) {
        const u = String(unidadExplicita).toUpperCase();
        if (u === 'SEG' || u === 'REPS') return u;
    }
    const nombre = normalizarTexto(ejercicio?.nombre || ejercicio?.titulo);
    if (
        nombre.includes('isometric') ||
        nombre.includes('plancha') ||
        nombre.includes('estiramiento') ||
        nombre.includes('elongacion') ||
        nombre.includes('equilibrio') ||
        nombre.includes('sosten')
    ) {
        return 'SEG';
    }
    return 'REPS';
}

function asegurarContenedorToast() {
    let cont = document.getElementById('kc-toast-container');
    if (!cont && document.body) {
        cont = document.createElement('div');
        cont.id = 'kc-toast-container';
        cont.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; max-width: 380px; pointer-events: none;';
        document.body.appendChild(cont);
    }
    return cont;
}

function mostrarToast(mensaje, tipo = 'info', duracion = 3500) {
    const cont = asegurarContenedorToast();
    if (!cont) return;

    const estilos = {
        success: { bg: '#065f46', border: '#10b981', icon: 'bx-check-circle' },
        error: { bg: '#7f1d1d', border: '#ef4444', icon: 'bx-error-circle' },
        warning: { bg: '#78350f', border: '#f59e0b', icon: 'bx-error' },
        info: { bg: '#0c4a6e', border: '#0ea5e9', icon: 'bx-info-circle' }
    };
    const cfg = estilos[tipo] || estilos.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
        pointer-events: auto;
        background: ${cfg.bg};
        color: #ffffff;
        border-left: 4px solid ${cfg.border};
        border-radius: 10px;
        padding: 12px 14px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.88rem;
        font-weight: 500;
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 0.2s ease, transform 0.2s ease;
    `;
    toast.innerHTML = `
        <i class='bx ${cfg.icon}' style="font-size: 1.25rem; flex-shrink: 0;"></i>
        <span style="flex: 1; line-height: 1.35;">${esc(mensaje)}</span>
    `;

    cont.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        setTimeout(() => toast.remove(), 220);
    }, duracion);
}

function obtenerGrupoZona(item) {
    const z = normalizarTexto(item.zona_corporal || item.zona_cuerpo || item.grupo_muscular);
    if (z.includes('cuello') || z.includes('cervical')) return 'Cuello';
    if (z.includes('hombro') || z.includes('escapul')) return 'Hombro';
    if (z.includes('brazo') || z.includes('muneca') || z.includes('mano') || z.includes('antebrazo') || z.includes('biceps')) return 'Brazos / Muñeca';
    if (z.includes('pecho') || z.includes('pectoral') || z.includes('torax') || z.includes('costal')) return 'Pecho';
    if (z.includes('espalda') || z.includes('dorsal') || z.includes('toracic')) return 'Espalda';
    if (z.includes('core') || z.includes('lumbar') || z.includes('pelv')) return 'Core / Lumbar';
    if (z.includes('cadera') || z.includes('gluteo')) return 'Cadera / Glúteos';
    if (z.includes('pierna') || z.includes('rodilla') || z.includes('cuadriceps')) return 'Piernas / Rodilla';
    if (z.includes('tobillo') || z.includes('pie')) return 'Tobillo / Pie';
    return 'Otras Zonas';
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

function ordenarListaEjercicios(lista) {
    return [...lista].sort((a, b) => {
        const va = resolverUrlMedia(a) ? 1 : 0;
        const vb = resolverUrlMedia(b) ? 1 : 0;
        if (vb !== va) return vb - va;
        return (a.nombre || a.titulo || '').localeCompare(b.nombre || b.titulo || '', 'es');
    });
}

function formatearDescripcionClinica(texto) {
    let html = esc(texto || 'Sin descripción disponible para este ejercicio terapéutico.');
    const secciones = [
        'Posición inicial:',
        'Ejecución:',
        'Ritmo y respiración:',
        'Precaución postural:'
    ];
    secciones.forEach((titulo, idx) => {
        const salto = idx === 0 ? '' : '<br><br>';
        html = html.replace(
            titulo,
            `${salto}<strong style="color: var(--azul-900);">${titulo}</strong>`
        );
    });
    return html;
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

function inicializarBarraControlCatalogo() {
    const inputBuscar = document.getElementById('input-buscar-ejercicio');
    if (!inputBuscar || document.getElementById('barra-control-catalogo-pauta')) return;

    const barra = document.createElement('div');
    barra.id = 'barra-control-catalogo-pauta';
    barra.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 8px 0 12px 0; flex-wrap: wrap;';
    barra.innerHTML = `
        <span id="contador-ejercicios-pauta" style="font-size: 0.78rem; font-weight: 600; color: var(--gris-600);">
            Cargando...
        </span>
        <button type="button" id="btn-solo-video-pauta" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 4px 10px;">
            <i class='bx bx-video'></i> Solo con video
        </button>
    `;

    inputBuscar.insertAdjacentElement('afterend', barra);

    const btnVideo = document.getElementById('btn-solo-video-pauta');
    if (btnVideo) {
        btnVideo.addEventListener('click', () => {
            soloConVideoPauta = !soloConVideoPauta;
            btnVideo.className = soloConVideoPauta ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
            filtrarYRenderizarEjercicios();
        });
    }
}

// ---------- 4. Catálogo de ejercicios ----------
async function inicializarCatalogo() {
    const loading = document.getElementById('loading-ejercicios');
    const container = document.getElementById('lista-ejercicios-disponibles');
    const noData = document.getElementById('no-ejercicios');

    inicializarBarraControlCatalogo();

    if (loading) loading.style.display = 'flex';
    if (container) container.style.display = 'none';
    if (noData) noData.style.display = 'none';

    try {
        const resp = await api.getEjercicios();
        let acumulados = [];

        if (Array.isArray(resp)) {
            acumulados = resp;
        } else if (resp && Array.isArray(resp.results)) {
            acumulados = [...resp.results];
            let siguienteUrl = resp.next;
            let guard = 0;

            while (siguienteUrl && guard < 10) {
                guard++;
                try {
                    const urlSegura = siguienteUrl.replace(/^http:\/\//i, 'https://');
                    const urlObj = new URL(urlSegura, BACKEND_ORIGIN);
                    const endpointRelativo = urlObj.pathname.replace(/^\/api\/v1/, '') + urlObj.search;
                    const paginaSig = typeof api.request === 'function'
                        ? await api.request(endpointRelativo)
                        : null;

                    if (paginaSig && Array.isArray(paginaSig.results)) {
                        acumulados.push(...paginaSig.results);
                        siguienteUrl = paginaSig.next;
                    } else {
                        break;
                    }
                } catch (errPag) {
                    console.warn('No se pudo cargar página adicional:', errPag);
                    break;
                }
            }
        } else if (resp) {
            acumulados = [resp];
        }

        todosLosEjercicios = acumulados;
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
        } else if (accion === 'info') {
            const ej = todosLosEjercicios.find(x => x.id === Number(btn.dataset.id));
            if (ej) verInfoEjercicio(ej);
        } else if (accion === 'areas') {
            const extra = btn.nextElementSibling;
            if (!extra) return;
            const oculto = extra.style.display === 'none';
            extra.style.display = oculto ? 'contents' : 'none';
            btn.textContent = oculto ? 'Ver menos' : btn.dataset.label;
        }
    });
}

function crearItemTarjetaCatalogo(ej, areaClave) {
    const estiloBadgeArea = 'font-size: 0.7rem; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 999px; font-weight: 600;';

    const div = document.createElement('div');
    div.className = 'ejercicio-item-card';
    div.style.cssText = 'display: flex; flex-direction: column; align-items: stretch; gap: 10px; padding: 13px 14px; text-align: left;';

    const nombre = ej.nombre || ej.titulo || 'Ejercicio';
    const zona = ej.zona_corporal || ej.zona_cuerpo || ej.grupo_muscular || 'General';
    const tieneMedia = !!resolverUrlMedia(ej);
    const yaEnCarrito = carrito.some(c => c.ejercicio.id === ej.id);

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
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; width: 100%;">
            <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; min-width: 0; flex: 1; gap: 5px;">
                <strong style="color: var(--azul-900); font-size: 0.92rem; line-height: 1.3; word-break: break-word;">
                    ${esc(nombre)}
                </strong>
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 5px;">
                    <span class="badge badge-neutro" style="font-size: 0.68rem;">${esc(zona)}</span>
                    ${tieneMedia ? `<span class="badge badge-ok" style="font-size: 0.66rem; white-space: nowrap;">Con Video</span>` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 5px; align-items: center; justify-content: flex-end; flex-shrink: 0;">
                <button type="button" class="btn btn-secondary btn-sm" data-accion="info" data-id="${ej.id}" title="Ver ficha clínica">
                    <i class='bx bx-info-circle'></i>
                </button>
                ${tieneMedia ? `
                    <button type="button" class="btn btn-secondary btn-sm" data-accion="media" data-id="${ej.id}" title="Ver video demostrativo">
                        <i class='bx bx-video'></i>
                    </button>
                ` : ''}
                <button type="button" class="btn ${yaEnCarrito ? 'btn-secondary' : 'btn-primary'} btn-sm" data-accion="agregar" data-id="${ej.id}"
                    title="${yaEnCarrito ? 'Ya está en el carrito' : 'Añadir a la pauta'}" style="white-space: nowrap;">
                    <i class='bx ${yaEnCarrito ? 'bx-check' : 'bx-plus'}'></i> ${yaEnCarrito ? 'Añadido' : 'Añadir'}
                </button>
            </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 5px; width: 100%; padding-top: 8px; border-top: 1px solid var(--gris-100); text-align: left;">
            ${areasHtml}
        </div>
    `;
    return div;
}

function filtrarYRenderizarEjercicios() {
    const inputBuscar = document.getElementById('input-buscar-ejercicio');
    const termino = inputBuscar ? inputBuscar.value.trim() : '';
    const container = document.getElementById('lista-ejercicios-disponibles');
    const noData = document.getElementById('no-ejercicios');
    const contadorEl = document.getElementById('contador-ejercicios-pauta');
    const terminoNorm = normalizarTexto(termino);
    const areaClave = normalizarTexto(areaClinicaActual);

    ejerciciosFiltrados = todosLosEjercicios.filter(item => {
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
        const coincideVideo = !soloConVideoPauta || Boolean(resolverUrlMedia(item));

        return coincideTexto && coincideZona && coincideArea && coincideVideo;
    });

    if (contadorEl) {
        contadorEl.textContent = `${ejerciciosFiltrados.length} de ${todosLosEjercicios.length} ejercicios`;
    }

    if (!container || !noData) return;

    if (ejerciciosFiltrados.length === 0) {
        container.style.display = 'none';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';
    container.style.display = 'flex';
    container.innerHTML = '';

    if (!zonaSeleccionadaActual && !terminoNorm) {
        const grupos = {};
        ORDEN_ZONAS_CLINICAS.forEach(z => { grupos[z] = []; });

        ejerciciosFiltrados.forEach(ej => {
            const g = obtenerGrupoZona(ej);
            if (!grupos[g]) grupos[g] = [];
            grupos[g].push(ej);
        });

        ORDEN_ZONAS_CLINICAS.forEach((nombreZona, idx) => {
            const listaZona = grupos[nombreZona];
            if (!listaZona || listaZona.length === 0) return;

            const cabecera = document.createElement('div');
            cabecera.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                margin-top: ${idx === 0 ? '2px' : '12px'};
                margin-bottom: 4px;
                background: #f1f5f9;
                border-left: 3px solid var(--azul-900);
                border-radius: 6px;
            `;
            cabecera.innerHTML = `
                <span style="font-size: 0.78rem; font-weight: 700; color: var(--azul-900); text-transform: uppercase; letter-spacing: 0.03em;">
                    ${esc(nombreZona)}
                </span>
                <span style="font-size: 0.72rem; font-weight: 600; color: var(--gris-600);">
                    ${listaZona.length}
                </span>
            `;
            container.appendChild(cabecera);

            ordenarListaEjercicios(listaZona).forEach(ej => {
                container.appendChild(crearItemTarjetaCatalogo(ej, areaClave));
            });
        });
        return;
    }

    ordenarListaEjercicios(ejerciciosFiltrados).forEach(ej => {
        container.appendChild(crearItemTarjetaCatalogo(ej, areaClave));
    });
}

// ---------- 5. Modal multimedia e información clínica ----------
window.verInfoEjercicio = function (ej) {
    const modal = document.getElementById('modal-multimedia');
    const contenedor = document.getElementById('modal-multimedia-contenedor');
    const titulo = document.getElementById('modal-multimedia-titulo');
    if (!modal || !contenedor) return;

    const nombre = ej.nombre || ej.titulo || 'Ficha Clínica';
    const zona = ej.zona_corporal || ej.zona_cuerpo || ej.grupo_muscular || 'General';
    const areas = obtenerAreasEjercicio(ej);

    if (titulo) titulo.textContent = nombre;
    contenedor.innerHTML = `
        <div style="padding: 18px 20px; text-align: left; background: #fff; width: 100%; max-height: 70vh; overflow-y: auto;">
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--gris-100);">
                <span class="badge badge-neutro"><i class='bx bx-body'></i> ${esc(zona)}</span>
                ${areas.map(a => `<span class="badge" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;"><i class='bx bx-plus-medical'></i> ${esc(a)}</span>`).join('')}
            </div>
            <div style="font-size: 0.9rem; color: var(--gris-700); line-height: 1.6;">
                ${formatearDescripcionClinica(ej.descripcion)}
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

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

// ---------- 6. Paso 1: Carrito Lateral Limpio + Paso 2: Modal Amplio de Dosificación ----------
window.agregarAlCarrito = function (idEjercicio, dosificacion = null, silencioso = false) {
    const ejercicio = todosLosEjercicios.find(e => e.id === idEjercicio);
    if (!ejercicio) return;

    const unidadInferida = inferirUnidadEjercicio(ejercicio, dosificacion?.unidad_medida);
    const existente = carrito.find(item => item.ejercicio.id === idEjercicio);

    if (existente) {
        if (dosificacion) {
            existente.series = dosificacion.series ?? existente.series;
            existente.repeticiones = dosificacion.repeticiones ?? existente.repeticiones;
            existente.unidad_medida = unidadInferida;
            existente.descanso = dosificacion.descanso ?? existente.descanso;
        } else if (!silencioso) {
            mostrarToast('Este ejercicio ya está en tu lista. Podrás ajustar sus series al continuar.', 'info', 2200);
        }
    } else {
        carrito.push({
            ejercicio,
            series: dosificacion?.series ?? 3,
            repeticiones: dosificacion?.repeticiones ?? (unidadInferida === 'SEG' ? 30 : 12),
            unidad_medida: unidadInferida,
            descanso: dosificacion?.descanso ?? 60
        });
        if (!silencioso) {
            mostrarToast(`"${ejercicio.nombre || ejercicio.titulo}" añadido al carrito.`, 'success', 1800);
        }
    }

    renderizarCarrito();
    filtrarYRenderizarEjercicios();
};

window.eliminarDelCarrito = function (index) {
    carrito.splice(index, 1);
    renderizarCarrito();
    filtrarYRenderizarEjercicios();
    if (document.getElementById('modal-dosificacion-pauta')?.style.display === 'flex') {
        if (carrito.length === 0) {
            cerrarModalDosificacion();
        } else {
            renderizarListaModalDosificacion();
        }
    }
};

window.actualizarDosificacion = function (index, campo, valor) {
    if (!carrito[index]) return;
    if (campo === 'unidad_medida') {
        carrito[index].unidad_medida = valor === 'SEG' ? 'SEG' : 'REPS';
        renderizarListaModalDosificacion();
        renderizarCarrito();
        return;
    }
    const minimo = campo === 'descanso' ? 0 : 1;
    carrito[index][campo] = aEntero(valor, minimo, minimo);
    renderizarCarrito();
};

function renderizarCarrito() {
    const contenedor = document.getElementById('carrito-items-container');
    const badgeTotal = document.getElementById('badge-total-items');
    const btnSubmit = document.getElementById('btn-confirmar-pauta');

    if (badgeTotal) {
        badgeTotal.textContent = `${carrito.length} ${carrito.length === 1 ? 'Ejercicio' : 'Ejercicios'}`;
    }
    if (btnSubmit) {
        btnSubmit.disabled = (carrito.length === 0);
        btnSubmit.innerHTML = `<i class='bx bx-sliders-alt'></i> Continuar y Configurar (${carrito.length})`;
    }
    if (!contenedor) return;

    if (carrito.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state" id="carrito-vacio-msg" style="padding: 16px;">
                <p style="margin: 0; font-size: 0.85rem;">El carrito está vacío. Selecciona ejercicios de la lista central.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = carrito.map((item, index) => {
        const nombre = item.ejercicio.nombre || item.ejercicio.titulo || 'Ejercicio';
        const zona = item.ejercicio.zona_corporal || item.ejercicio.zona_cuerpo || 'General';
        const sufijo = item.unidad_medida === 'SEG' ? 'seg' : 'reps';

        return `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 11px; border-radius: 10px; border: 1px solid var(--gris-200); background: var(--gris-50, #f8fafc);">
                <div style="min-width: 0; flex: 1;">
                    <strong style="display: block; font-size: 0.84rem; color: var(--azul-900); line-height: 1.25;">
                        ${index + 1}. ${esc(nombre)}
                    </strong>
                    <span style="font-size: 0.73rem; color: var(--gris-600);">
                        ${esc(zona)} • ${item.series}×${item.repeticiones} ${sufijo} • Desc. ${item.descanso}s
                    </span>
                </div>
                <button type="button" onclick="eliminarDelCarrito(${index})"
                    style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; flex-shrink: 0;" title="Quitar">
                    <i class='bx bx-trash' style="font-size: 1rem;"></i>
                </button>
            </div>
        `;
    }).join('');
}

function asegurarModalDosificacion() {
    let modal = document.getElementById('modal-dosificacion-pauta');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'modal-dosificacion-pauta';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.72); z-index: 9998; align-items: center; justify-content: center; padding: 16px;';
    modal.innerHTML = `
        <div class="card" style="width: 100%; max-width: 860px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 16px;">
            <div style="padding: 18px 22px; border-bottom: 1px solid var(--gris-200); display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div>
                    <h3 style="margin: 0; font-size: 1.15rem; color: var(--azul-900); display: flex; align-items: center; gap: 8px;">
                        <i class='bx bx-sliders-alt' style="color: #0284c7;"></i> Configurar Dosificación y Confirmar Pauta
                    </h3>
                    <p id="modal-dosif-subtitulo" style="margin: 4px 0 0; font-size: 0.83rem; color: var(--gris-600);"></p>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="cerrarModalDosificacion()">
                    <i class='bx bx-arrow-back'></i> Volver a elegir
                </button>
            </div>

            <div style="padding: 18px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px;">
                <!-- Resumen editable de cabecera -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; padding: 14px; border-radius: 12px; border: 1px solid var(--gris-200); background: var(--gris-50, #f8fafc);">
                    <div class="field" style="margin: 0;">
                        <label style="font-size: 0.76rem; font-weight: 700;">Nombre de la Pauta *</label>
                        <input type="text" id="modal-dosif-titulo" style="width: 100%; padding: 7px 10px; font-size: 0.86rem;">
                    </div>
                    <div class="field" style="margin: 0;">
                        <label style="font-size: 0.76rem; font-weight: 700;">Frecuencia Semanal *</label>
                        <select id="modal-dosif-frecuencia" style="width: 100%; padding: 7px 10px; font-size: 0.86rem; border-radius: 8px;">
                            <option value="1">1 vez por semana (cada 7 días)</option>
                            <option value="2">2 veces por semana (cada 3–4 días)</option>
                            <option value="3">3 veces por semana (Estándar - día por medio)</option>
                            <option value="4">4 veces por semana</option>
                            <option value="5">5 veces por semana (Lunes a Viernes)</option>
                            <option value="6">6 veces por semana</option>
                            <option value="7">7 veces por semana (Todos los días)</option>
                        </select>
                    </div>
                    <div class="field" style="margin: 0; grid-column: 1 / -1;">
                        <label style="font-size: 0.76rem; font-weight: 700;">Objetivo / Instrucciones para el Paciente</label>
                        <input type="text" id="modal-dosif-notas" placeholder="Indicaciones clínicas..." style="width: 100%; padding: 7px 10px; font-size: 0.86rem;">
                    </div>
                </div>

                <!-- Lista amplia de ejercicios con sus 4 parámetros cómodos -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 0.9rem; color: var(--azul-900);">Detalle de Ejercicios Seleccionados</strong>
                        <span id="modal-dosif-contador" class="badge badge-ok">0 Ejercicios</span>
                    </div>
                    <div id="modal-dosif-lista" style="display: flex; flex-direction: column; gap: 10px;"></div>
                </div>
            </div>

            <div style="padding: 14px 22px; border-top: 1px solid var(--gris-200); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <button type="button" class="btn btn-secondary" onclick="cerrarModalDosificacion()">
                    <i class='bx bx-plus'></i> Seguir añadiendo ejercicios
                </button>
                <button type="button" id="btn-finalizar-prescripcion" class="btn btn-primary" onclick="confirmarGuardadoFinal()">
                    <i class='bx bx-check-circle'></i> Confirmar y Asignar Pauta
                </button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModalDosificacion();
    });
    document.body.appendChild(modal);
    return modal;
}

function renderizarListaModalDosificacion() {
    const lista = document.getElementById('modal-dosif-lista');
    const contador = document.getElementById('modal-dosif-contador');
    if (contador) {
        contador.textContent = `${carrito.length} ${carrito.length === 1 ? 'Ejercicio' : 'Ejercicios'}`;
    }
    if (!lista) return;

    lista.innerHTML = carrito.map((item, idx) => {
        const nombre = item.ejercicio.nombre || item.ejercicio.titulo || 'Ejercicio';
        const zona = item.ejercicio.zona_corporal || item.ejercicio.zona_cuerpo || 'General';
        const esTiempo = item.unidad_medida === 'SEG';

        return `
            <div style="padding: 14px 16px; border-radius: 12px; border: 1px solid var(--gris-200); background: var(--blanco, #fff); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong style="font-size: 0.95rem; color: var(--azul-900);">${idx + 1}. ${esc(nombre)}</strong>
                        <span class="badge badge-neutro" style="font-size: 0.7rem;">${esc(zona)}</span>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" style="color: #ef4444;" onclick="eliminarDelCarrito(${idx})" title="Quitar ejercicio">
                        <i class='bx bx-trash'></i> Quitar
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
                    <div class="field" style="margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 700; display: block; margin-bottom: 4px;">Series</label>
                        <input type="number" min="1" max="20" value="${item.series}"
                            onchange="actualizarDosificacion(${idx}, 'series', this.value)"
                            style="width: 100%; padding: 7px 10px; font-size: 0.88rem;">
                    </div>

                    <div class="field" style="margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 700; display: block; margin-bottom: 4px;">Modalidad</label>
                        <select onchange="actualizarDosificacion(${idx}, 'unidad_medida', this.value)"
                            style="width: 100%; padding: 7px 10px; font-size: 0.86rem; border-radius: 8px;">
                            <option value="REPS" ${!esTiempo ? 'selected' : ''}>Repeticiones</option>
                            <option value="SEG" ${esTiempo ? 'selected' : ''}>Tiempo (segundos)</option>
                        </select>
                    </div>

                    <div class="field" style="margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 700; display: block; margin-bottom: 4px;">
                            ${esTiempo ? 'Duración (seg)' : 'Repeticiones'}
                        </label>
                        <input type="number" min="1" max="300" value="${item.repeticiones}"
                            onchange="actualizarDosificacion(${idx}, 'repeticiones', this.value)"
                            style="width: 100%; padding: 7px 10px; font-size: 0.88rem;">
                    </div>

                    <div class="field" style="margin: 0;">
                        <label style="font-size: 0.75rem; font-weight: 700; display: block; margin-bottom: 4px;">Descanso (seg)</label>
                        <input type="number" min="0" max="300" step="5" value="${item.descanso}"
                            onchange="actualizarDosificacion(${idx}, 'descanso', this.value)"
                            style="width: 100%; padding: 7px 10px; font-size: 0.88rem;">
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.abrirModalDosificacion = function () {
    const checkSoloPlantilla = document.getElementById('check-solo-plantilla');
    const selectPaciente = document.getElementById('select-paciente-pauta');
    const inputNombre = document.getElementById('pauta-nombre');
    const inputDescripcion = document.getElementById('pauta-descripcion');
    const selectFrecuencia = document.getElementById('pauta-frecuencia');

    const esSoloPlantilla = checkSoloPlantilla ? checkSoloPlantilla.checked : false;
    const pacienteId = selectPaciente ? selectPaciente.value : '';
    const titulo = inputNombre ? inputNombre.value.trim() : '';

    if (!esSoloPlantilla && !pacienteId) {
        mostrarToast('Selecciona un paciente en el menú superior o marca "Guardar como Plantilla Maestra".', 'warning');
        if (selectPaciente) selectPaciente.focus();
        return;
    }

    if (!titulo) {
        mostrarToast('Ingresa un nombre para la pauta antes de continuar.', 'warning');
        if (inputNombre) inputNombre.focus();
        return;
    }

    if (carrito.length === 0) {
        mostrarToast('Selecciona al menos un ejercicio en el catálogo.', 'warning');
        return;
    }

    const modal = asegurarModalDosificacion();
    const pacTexto = esSoloPlantilla
        ? 'Plantilla Maestra Reutilizable'
        : (selectPaciente?.options[selectPaciente.selectedIndex]?.text || 'Paciente seleccionado');

    document.getElementById('modal-dosif-subtitulo').textContent = `Destinatario: ${pacTexto}`;
    document.getElementById('modal-dosif-titulo').value = titulo;
    document.getElementById('modal-dosif-notas').value = inputDescripcion ? inputDescripcion.value.trim() : '';
    document.getElementById('modal-dosif-frecuencia').value = selectFrecuencia ? selectFrecuencia.value : '3';

    const btnFinal = document.getElementById('btn-finalizar-prescripcion');
    if (btnFinal) {
        btnFinal.disabled = false;
        btnFinal.innerHTML = esSoloPlantilla
            ? "<i class='bx bx-bookmark-alt'></i> Confirmar y Guardar Plantilla"
            : "<i class='bx bx-check-circle'></i> Confirmar y Asignar Pauta";
    }

    renderizarListaModalDosificacion();
    modal.style.display = 'flex';
};

window.cerrarModalDosificacion = function () {
    const modal = document.getElementById('modal-dosificacion-pauta');
    if (modal) modal.style.display = 'none';
};

window.confirmarGuardadoFinal = async function () {
    const checkSoloPlantilla = document.getElementById('check-solo-plantilla');
    const selectPaciente = document.getElementById('select-paciente-pauta');
    const esSoloPlantilla = checkSoloPlantilla ? checkSoloPlantilla.checked : false;
    const pacienteId = selectPaciente ? selectPaciente.value : '';

    const titulo = (document.getElementById('modal-dosif-titulo')?.value || '').trim();
    const textoNotas = (document.getElementById('modal-dosif-notas')?.value || '').trim();
    const frecuenciaSemanal = aEntero(document.getElementById('modal-dosif-frecuencia')?.value, 3, 1);

    if (!titulo) {
        mostrarToast('El nombre de la pauta no puede quedar vacío.', 'warning');
        return;
    }

    const btnFinal = document.getElementById('btn-finalizar-prescripcion');
    if (btnFinal) {
        btnFinal.disabled = true;
        btnFinal.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Guardando...";
    }

    const payload = {
        paciente: esSoloPlantilla ? null : parseInt(pacienteId, 10),
        titulo: esSoloPlantilla && !titulo.toLowerCase().includes('protocolo') ? `[Protocolo] ${titulo}` : titulo,
        notas: textoNotas,
        frecuencia_semanal: frecuenciaSemanal,
        es_plantilla: esSoloPlantilla,
        guardar_como_plantilla: false,
        ejercicios_detalle: carrito.map(item => ({
            ejercicio: item.ejercicio.id,
            series: parseInt(item.series, 10) || 3,
            repeticiones: parseInt(item.repeticiones, 10) || 10,
            unidad_medida: item.unidad_medida || 'REPS',
            tiempo_descanso_segundos: parseInt(item.descanso, 10) || 60
        }))
    };

    try {
        await api.crearPauta(payload);
        cerrarModalDosificacion();
        mostrarToast(
            esSoloPlantilla
                ? '¡Protocolo maestro guardado con éxito!'
                : '¡Pauta clínica creada y asignada con éxito!',
            'success',
            1600
        );
        setTimeout(() => {
            window.location.href = 'pautas.html';
        }, 900);
    } catch (error) {
        console.error('Error al guardar pauta:', error);
        mostrarToast(`Error al guardar: ${error.message || 'Comprueba los datos ingresados.'}`, 'error', 4500);
        if (btnFinal) {
            btnFinal.disabled = false;
            btnFinal.innerHTML = esSoloPlantilla
                ? "<i class='bx bx-bookmark-alt'></i> Confirmar y Guardar Plantilla"
                : "<i class='bx bx-check-circle'></i> Confirmar y Asignar Pauta";
        }
    }
};

// ---------- 7. Plantillas / protocolos rápidos ----------
function aplicarPautaAlFormulario(pauta) {
    const inputNombre = document.getElementById('pauta-nombre');
    if (inputNombre) {
        inputNombre.value = (pauta.titulo || '').replace(/\[Protocolo\]\s*/i, '').trim();
    }

    const textarea = obtenerTextareaNotas();
    if (textarea) textarea.value = pauta.notas || '';

    const selectFrec = document.getElementById('pauta-frecuencia');
    if (selectFrec && pauta.frecuencia_semanal) {
        selectFrec.value = String(pauta.frecuencia_semanal);
    }

    carrito = [];
    const detalles = Array.isArray(pauta.ejercicios_detalle) ? pauta.ejercicios_detalle : [];
    detalles.forEach(d => {
        const idEj = Number(
            d.ejercicio_id ?? (d.ejercicio && typeof d.ejercicio === 'object' ? d.ejercicio.id : d.ejercicio)
        );
        agregarAlCarrito(idEj, {
            series: aEntero(d.series, 3, 1),
            repeticiones: aEntero(d.repeticiones, 12, 1),
            unidad_medida: d.unidad_medida || 'REPS',
            descanso: aEntero(d.tiempo_descanso_segundos ?? d.descanso_seg, 60, 0)
        }, true);
    });
    renderizarCarrito();
    filtrarYRenderizarEjercicios();
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

        select.addEventListener('change', (e) => {
            const id = parseInt(e.target.value, 10);
            if (!id) return;
            const pauta = todasLasPautas.find(p => p.id === id);
            if (pauta) aplicarPautaAlFormulario(pauta);
        });

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
            opt.textContent = `${nombre} (${p.rut || 'Sin RUT'})`;

            if (pacienteUrlParam && (String(userId) === String(pacienteUrlParam) || String(p.id) === String(pacienteUrlParam))) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error al cargar selector de pacientes:', error);
    }
}

// ---------- 9. Inicialización del formulario (abre Paso 2: Modal de Dosificación) ----------
function inicializarFormularioPauta() {
    const form = document.getElementById('form-guardar-pauta');
    const checkSoloPlantilla = document.getElementById('check-solo-plantilla');
    const selectPaciente = document.getElementById('select-paciente-pauta');

    if (!form) return;

    if (checkSoloPlantilla && selectPaciente) {
        checkSoloPlantilla.addEventListener('change', () => {
            if (checkSoloPlantilla.checked) {
                selectPaciente.value = '';
                selectPaciente.disabled = true;
                selectPaciente.style.opacity = '0.5';
            } else {
                selectPaciente.disabled = false;
                selectPaciente.style.opacity = '1';
            }
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        abrirModalDosificacion();
    });
}

// ---------- Inicialización global ----------
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof api !== 'undefined' && !api.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    asegurarContenedorToast();
    inicializarEventosMapa();
    inicializarFiltrosBiomecanicos();
    inicializarAccionesCatalogo();
    inicializarFormularioPauta();
    await inicializarCatalogo();
    await cargarSelectorPacientes();
    await cargarSelectorPlantillas();

    const inputBuscar = document.getElementById('input-buscar-ejercicio');
    if (inputBuscar) inputBuscar.addEventListener('input', filtrarYRenderizarEjercicios);
});