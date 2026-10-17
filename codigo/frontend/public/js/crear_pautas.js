// Variables de estado
let todosLosEjercicios = [];
let ejerciciosMostrados = [];
let carrito = [];
let zonaSeleccionadaActual = '';
let grupoBiomecanicoActual = '';
let vistaActual = 'anterior';

// 1. Vistas Anatómicas
function cambiarVista(vista) { /* ... código de cambiarVista ... */ }

// 2. Mapa Interactivo
function inicializarEventosMapa() { /* ... código de inicializarEventosMapa ... */ }

// 3. Patrones Biomecánicos
function seleccionarGrupoBiomecanico(grupo) { /* ... código ... */ }
function limpiarFiltroZona() { /* ... código ... */ }
function actualizarBadgesSuperiores(nombre, grupo, sub) { /* ... código ... */ }
function sincronizarResaltados() { /* ... código ... */ }

// 4. Catálogo de Ejercicios
async function inicializarCatalogo() { /* ... código ... */ }
function filtrarYRenderizarEjercicios() { /* ... código ... */ }

// 5. Gestión del Carrito
function agregarAlCarrito(id) { /* ... código ... */ }
function eliminarDelCarrito(index) { /* ... código ... */ }
function renderizarCarrito() { /* ... código ... */ }

// 6. Carga de Pacientes
async function cargarSelectorPacientes() { /* ... código ... */ }

// 7. Prescripción de Pauta
async function confirmarPauta() { /* ... código ... */ }

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    inicializarEventosMapa();
    inicializarCatalogo();
    cargarSelectorPacientes();
});