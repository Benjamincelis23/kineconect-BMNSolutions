let todosLosEjercicios = [];
let ejerciciosFiltrados = [];
let todasLasPlantillas = []; // Almacena los protocolos maestros disponibles
let carrito = [];
let zonaSeleccionadaActual = '';
let patronBiomecanicoActual = 'todos';
let vistaActual = 'frontal';

// 1. Alternancia de Vistas Anatómicas (Frontal / Dorsal)
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

// 2. Mapa Anatómico SVG
function inicializarEventosMapa() {
    const zonas = document.querySelectorAll('.anatomia-zona');
    const tooltip = document.getElementById('tooltip-anatomico');

    zonas.forEach(zona => {
        zona.addEventListener('click', () => {
            const idZona = zona.getAttribute('data-zona') || '';
            if (zonaSeleccionadaActual === idZona) {
                resetFiltroZona();
            } else {
                zonaSeleccionadaActual = idZona;
                actualizarResaltadoZonas();
                const labelTxt = document.getElementById('txt-zona-seleccionada');
                if (labelTxt) {
                    labelTxt.textContent = idZona.charAt(0).toUpperCase() + idZona.slice(1);
                }
                filtrarYRenderizarEjercicios();
            }
        });

        zona.addEventListener('mousemove', (e) => {
            if (!tooltip) return;
            const nombreZona = zona.getAttribute('data-zona') || 'Músculo';
            const patron = zona.getAttribute('data-patron') || 'General';

            tooltip.style.display = 'block';
            tooltip.style.left = `${e.offsetX + 10}px`;
            tooltip.style.top = `${e.offsetY - 10}px`;
            tooltip.innerHTML = `<strong>${nombreZona.toUpperCase()}</strong><span>Patrón: ${patron}</span>`;
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
        const idZona = zona.getAttribute('data-zona');
        if (idZona === zonaSeleccionadaActual) {
            zona.classList.add('active');
        } else {
            zona.classList.remove('active');
        }
    });
}

// 3. Filtros Biomecánicos
function inicializarFiltrosBiomecanicos() {
    const pills = document.querySelectorAll('.filtro-biomecanico-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.className = 'filtro-biomecanico-pill');
            const patron = pill.getAttribute('data-patron');
            patronBiomecanicoActual = patron;

            if (patron === 'todos') pill.classList.add('activo-todos');
            if (patron === 'empuje') pill.classList.add('activo-empuje');
            if (patron === 'traccion') pill.classList.add('activo-traccion');
            if (patron === 'core') pill.classList.add('activo-core');
            if (patron === 'piernas') pill.classList.add('activo-piernas');

            resaltarZonasPorPatron(patron);
            filtrarYRenderizarEjercicios();
        });
    });
}

function resaltarZonasPorPatron(patron) {
    document.querySelectorAll('.anatomia-zona').forEach(zona => {
        const patronZona = zona.getAttribute('data-patron');
        if (patron !== 'todos' && patronZona === patron) {
            zona.classList.add('active-grupo');
        } else {
            zona.classList.remove('active-grupo');
        }
    });
}

// 4. Catálogo de Ejercicios
async function inicializarCatalogo() {
    const loading = document.getElementById('loading-ejercicios');
    const container = document.getElementById('lista-ejercicios-disponibles');
    const noData = document.getElementById('no-ejercicios');

    if (loading) loading.style.display = 'block';
    if (container) container.style.display = 'none';
    if (noData) noData.style.display = 'none';

    try {
        todosLosEjercicios = await api.getEjercicios();
        if (todosLosEjercicios && todosLosEjercicios.results) {
            todosLosEjercicios = todosLosEjercicios.results;
        } else if (!Array.isArray(todosLosEjercicios)) {
            todosLosEjercicios = [];
        }
        filtrarYRenderizarEjercicios();
    } catch (error) {
        console.error('Error cargando ejercicios:', error);
        if (noData) {
            noData.style.display = 'block';
            noData.querySelector('p').textContent = `Error al cargar catálogo: ${error.message}`;
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function filtrarYRenderizarEjercicios() {
    const inputBuscar = document.getElementById('input-buscar-ejercicio');
    const termino = inputBuscar ? inputBuscar.value.trim().toLowerCase() : '';
    const container = document.getElementById('lista-ejercicios-disponibles');
    const noData = document.getElementById('no-ejercicios');

    ejerciciosFiltrados = todosLosEjercicios.filter(item => {
        const nombre = (item.nombre || item.titulo || '').toLowerCase();
        const grupo = (item.zona_corporal || item.zona_cuerpo || item.grupo_muscular || '').toLowerCase();
        const patron = (item.patron_biomecanico || item.patron_movimiento || item.patron || '').toLowerCase();

        const coincideTexto = !termino || nombre.includes(termino) || grupo.includes(termino);
        const coincideZona = !zonaSeleccionadaActual || grupo.includes(zonaSeleccionadaActual.toLowerCase());
        const coincidePatron = patronBiomecanicoActual === 'todos' || patron.includes(patronBiomecanicoActual);

        return coincideTexto && coincideZona && coincidePatron;
    });

    if (!container || !noData) return;

    if (ejerciciosFiltrados.length === 0) {
        container.style.display = 'none';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';
    container.style.display = 'flex';
    container.innerHTML = '';

    ejerciciosFiltrados.forEach(ej => {
        const div = document.createElement('div');
        div.className = 'ejercicio-item-card';

        const nombre = ej.nombre || ej.titulo || 'Ejercicio';
        const zona = ej.zona_corporal || ej.zona_cuerpo || ej.grupo_muscular || 'General';
        const mediaUrl = ej.url_multimedia || ej.video_url || ej.gif_url || ej.imagen || '';

        const esImagen = mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
        const miniaturaHtml = esImagen
            ? `<img src="${mediaUrl}" alt="${nombre}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover; margin-right: 10px;">`
            : '';

        div.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                ${miniaturaHtml}
                <div style="overflow: hidden;">
                    <strong style="color: var(--azul-900); font-size: 0.92rem; display: block; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${nombre}</strong>
                    <div style="font-size: 0.78rem; color: var(--gris-600); margin-top: 3px;">
                        <span class="badge badge-neutro">${zona}</span>
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; margin-left: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" 
                    onclick="verMultimedia('${encodeURIComponent(nombre)}', '${encodeURIComponent(mediaUrl)}')" 
                    ${!mediaUrl ? 'disabled style="opacity: 0.5; cursor: not-allowed;" title="Sin demostración"' : 'title="Ver demostración"'}>
                    <i class='bx bx-video'></i>
                </button>
                <button type="button" class="btn btn-primary btn-sm" onclick="agregarAlCarrito(${ej.id})" title="Añadir a la pauta">
                    <i class='bx bx-plus'></i> Añadir
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

// 5. Modal de Previsualización Multimedia
window.verMultimedia = function (nombreEnc, urlEnc) {
    const nombre = decodeURIComponent(nombreEnc);
    const url = decodeURIComponent(urlEnc);

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
            <iframe width="100%" height="340" src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen style="display: block; border: 0;"></iframe>`;
    } else if (url.match(/\.(mp4|webm)($|\?)/i)) {
        contenedor.innerHTML = `
            <video width="100%" height="340" controls autoplay style="display: block; max-height: 400px; background: #000;">
                <source src="${url}" type="video/mp4">
                Tu navegador no soporta la reproducción de video.
            </video>`;
    } else {
        contenedor.innerHTML = `
            <img src="${url}" alt="${nombre}" style="max-width: 100%; max-height: 380px; object-fit: contain; padding: 10px;">`;
    }

    modal.style.display = 'flex';
};

window.cerrarModalMultimedia = function () {
    const modal = document.getElementById('modal-multimedia');
    const contenedor = document.getElementById('modal-multimedia-contenedor');
    if (contenedor) contenedor.innerHTML = '';
    if (modal) modal.style.display = 'none';
};

// 6. Carrito de Prescripción
window.agregarAlCarrito = function (idEjercicio, dosificacionPersonalizada = null) {
    const ejercicio = todosLosEjercicios.find(e => e.id === idEjercicio);
    if (!ejercicio) return;

    const existente = carrito.find(item => item.ejercicio.id === idEjercicio);
    if (existente) {
        if (dosificacionPersonalizada) {
            existente.series = dosificacionPersonalizada.series || existente.series;
            existente.repeticiones = dosificacionPersonalizada.repeticiones || existente.repeticiones;
            existente.descanso = dosificacionPersonalizada.descanso || existente.descanso;
        } else {
            existente.series += 1;
        }
    } else {
        carrito.push({
            ejercicio: ejercicio,
            series: dosificacionPersonalizada ? dosificacionPersonalizada.series : 3,
            repeticiones: dosificacionPersonalizada ? dosificacionPersonalizada.repeticiones : 12,
            descanso: dosificacionPersonalizada ? dosificacionPersonalizada.descanso : 60
        });
    }

    renderizarCarrito();
};

window.eliminarDelCarrito = function (index) {
    carrito.splice(index, 1);
    renderizarCarrito();
};

window.actualizarDosificacion = function (index, campo, valor) {
    if (carrito[index]) {
        carrito[index][campo] = parseInt(valor, 10) || 0;
    }
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
                <strong style="font-size: 0.85rem; color: var(--azul-900);">${nombre}</strong>
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

// 7. Cargar Selector de Protocolos / Plantillas Rápidas
async function cargarSelectorPlantillas() {
    const select = document.getElementById('select-plantilla-predefinida');
    if (!select) return;

    try {
        let pautas = [];
        if (typeof api.getPautas === 'function') {
            pautas = await api.getPautas();
        }
        const lista = Array.isArray(pautas) ? pautas : (pautas?.results || []);

        // Filtramos solo las que son plantillas maestras
        todasLasPlantillas = lista.filter(p => p.es_plantilla === true);

        select.innerHTML = '<option value="">-- Sin plantilla (Prescripción manual) --</option>';

        todasLasPlantillas.forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl.id;
            opt.textContent = `📋 ${pl.titulo}`;
            select.appendChild(opt);
        });

        // Evento: Al seleccionar una plantilla, cargamos sus ejercicios al carrito
        select.addEventListener('change', (e) => {
            const plantillaId = parseInt(e.target.value, 10);
            if (!plantillaId) return;

            const seleccionada = todasLasPlantillas.find(p => p.id === plantillaId);
            if (!seleccionada) return;

            // Rellenar título sugerido
            const inputNombre = document.getElementById('pauta-nombre');
            if (inputNombre) {
                // Quitamos "[Protocolo]" si viene en el texto para que quede limpio
                inputNombre.value = seleccionada.titulo.replace(/\[Protocolo\]\s*/i, '').trim();
            }

            // Vaciar y poblar el carrito con los ejercicios de la plantilla
            carrito = [];
            if (seleccionada.ejercicios_detalle && seleccionada.ejercicios_detalle.length > 0) {
                seleccionada.ejercicios_detalle.forEach(detalle => {
                    const idEj = detalle.ejercicio_id || detalle.ejercicio;
                    agregarAlCarrito(idEj, {
                        series: detalle.series,
                        repeticiones: detalle.repeticiones,
                        descanso: detalle.tiempo_descanso_segundos
                    });
                });
            } else {
                renderizarCarrito();
            }
        });

    } catch (error) {
        console.error('Error al cargar plantillas predefinidas:', error);
    }
}

// 8. Selector de Pacientes y Detección de Parámetro URL (?paciente=ID)
async function cargarSelectorPacientes() {
    const select = document.getElementById('select-paciente-pauta');
    if (!select) return;

    try {
        let pacientes = await api.getMisPacientes();
        if (pacientes && pacientes.results) pacientes = pacientes.results;
        if (!Array.isArray(pacientes)) pacientes = pacientes ? [pacientes] : [];

        select.innerHTML = '<option value="">-- Seleccionar Paciente --</option>';

        const params = new URLSearchParams(window.location.search);
        const pacienteUrlParam = params.get('paciente');

        pacientes.forEach(p => {
            const opt = document.createElement('option');
            const userId = p.user_id || ((p.user && typeof p.user === 'object') ? p.user.id : (p.user || p.id));
            opt.value = userId;

            const nombre = p.nombre_completo || (p.user && typeof p.user === 'object' ? `${p.user.first_name} ${p.user.last_name}`.trim() : '') || 'Paciente';
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
        const esSoloPlantilla = checkSoloPlantilla ? checkSoloPlantilla.checked : false;
        const pacienteId = selectPaciente ? selectPaciente.value : '';
        const titulo = inputNombre ? inputNombre.value.trim() : '';

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

// Inicialización global
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof api !== 'undefined' && !api.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    inicializarEventosMapa();
    inicializarFiltrosBiomecanicos();
    await inicializarCatalogo(); // Aseguramos carga de ejercicios primero
    cargarSelectorPlantillas(); // Cargamos protocolos predefinidos
    cargarSelectorPacientes();
    inicializarFormularioPauta();

    const inputBuscar = document.getElementById('input-buscar-ejercicio');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', filtrarYRenderizarEjercicios);
    }
});