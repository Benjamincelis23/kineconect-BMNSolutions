// 1. CARGAR Y EVALUAR FEEDBACKS DE DOLOR DESDE LA API
async function cargarFeedbacks() {
  const loading = document.getElementById('loading-feedback');
  const tabla = document.getElementById('tabla-feedback');
  const tbody = document.getElementById('tbody-feedback');
  const sinDatos = document.getElementById('sin-feedback');
  const alertasCont = document.getElementById('contenedor-alertas-criticas');

  if (loading) loading.style.display = 'block';
  if (tabla) tabla.style.display = 'none';
  if (sinDatos) sinDatos.style.display = 'none';
  if (alertasCont) {
    alertasCont.style.display = 'none';
    alertasCont.innerHTML = '';
  }
  if (tbody) tbody.innerHTML = '';

  try {
    const data = await api.getFeedbacks();
    if (loading) loading.style.display = 'none';

    if (!data || data.length === 0) {
      if (sinDatos) sinDatos.style.display = 'block';
      return;
    }

    if (tabla) tabla.style.display = 'table';
    let alertasAltas = [];

    data.forEach(item => {
      const nivel = item.escala_dolor;
      let badgeClass = 'badge-ok';
      let nivelTexto = `Nivel ${nivel} Leve`;

      if (nivel >= 7) {
        badgeClass = 'badge-alerta';
        nivelTexto = `⚠️ Nivel ${nivel} Severo`;
        alertasAltas.push(item);
      } else if (nivel >= 4) {
        badgeClass = 'badge-neutro';
        nivelTexto = `Nivel ${nivel} Moderado`;
      }

      const fecha = item.fecha_ejecucion
        ? new Date(item.fecha_ejecucion).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
        : 'Reciente';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fecha}</td>
        <td><strong>Pauta #${item.pauta}</strong></td>
        <td><span class="badge ${badgeClass}">${nivelTexto}</span></td>
        <td>
          <span class="badge ${item.completado ? 'badge-ok' : 'badge-neutro'}">
            ${item.completado ? '✓ Completada' : 'Incompleta'}
          </span>
        </td>
        <td style="color: var(--gris-600); font-style: italic;">
          ${item.comentario ? `"${item.comentario}"` : 'Sin comentarios adicionales.'}
        </td>
      `;
      if (tbody) tbody.appendChild(tr);
    });

    // Mostrar banner de alerta si hay dolores severos
    if (alertasAltas.length > 0 && alertasCont) {
      alertasCont.style.display = 'block';
      alertasCont.innerHTML = `
        <div class="alert-banner">
          ⚠️ <strong>Atención Clínica:</strong> Se detectaron ${alertasAltas.length} reporte(s) con dolor severo (Escala EVA ≥ 7) enviados desde la app móvil. Evalúa si es necesario contactar al paciente o reprogramar la carga de ejercicios.
        </div>
      `;
    }

  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (sinDatos) {
      sinDatos.style.display = 'block';
      sinDatos.innerHTML = `<p style="color: var(--rojo-500);">Error al consultar feedbacks: ${err.message}</p>`;
    }
  }
}

// 2. CARGAR PAUTAS PRESCRITAS (Y PROTOCOLOS MAESTROS)
async function cargarPautas() {
  const loading = document.getElementById('loading-pautas');
  const container = document.getElementById('lista-pautas');
  const noPautas = document.getElementById('no-pautas');

  if (loading) loading.style.display = 'block';
  if (container) container.innerHTML = '';
  if (noPautas) noPautas.style.display = 'none';

  try {
    const data = await api.getPautas();
    if (loading) loading.style.display = 'none';

    if (!data || data.length === 0) {
      if (noPautas) noPautas.style.display = 'block';
      return;
    }

    data.forEach(pauta => {
      const card = document.createElement('div');
      card.className = 'card';

      const esPlantilla = pauta.es_plantilla === true;

      let ejerciciosHtml = '';
      if (pauta.ejercicios_detalle && pauta.ejercicios_detalle.length > 0) {
        ejerciciosHtml = pauta.ejercicios_detalle.map(item => `
          <div style="background: var(--gris-100); padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem;">
            <span><strong>${item.ejercicio_info ? item.ejercicio_info.nombre : `Ejercicio #${item.ejercicio}`}</strong></span>
            <span style="color: var(--gris-600); font-size: 0.82rem;">${item.series} series × ${item.repeticiones} reps (Descanso: ${item.tiempo_descanso_segundos}s)</span>
          </div>
        `).join('');
      } else {
        ejerciciosHtml = '<p style="color: var(--gris-600); font-size: 0.85rem;">Sin ejercicios detallados.</p>';
      }

      const fecha = pauta.creado_en ? new Date(pauta.creado_en).toLocaleDateString('es-CL') : 'Reciente';

      const tituloHtml = esPlantilla
        ? `<span style="color: #0284c7; display: inline-flex; align-items: center; gap: 6px;"><i class='bx bx-book-bookmark'></i> [Protocolo] ${pauta.titulo}</span>`
        : (pauta.titulo || 'Rutina de Ejercicios');

      const pacienteHtml = esPlantilla
        ? '<strong style="color: #0284c7;">Protocolo Reutilizable</strong>'
        : `<strong>${pauta.paciente_nombre || 'Paciente'}</strong>`;

      const badgeEstado = esPlantilla
        ? '<span class="badge" style="background-color: #e0f2fe; color: #0369a1; font-weight: 600;">Plantilla Maestra</span>'
        : `<span class="badge ${pauta.activo ? 'badge-ok' : 'badge-neutro'}">${pauta.activo ? 'Rutina Activa' : 'Finalizada'}</span>`;

      // Bloque para mostrar las instrucciones o descripción guardada
      const descripcionHtml = pauta.descripcion && pauta.descripcion.trim() !== ''
        ? `<div style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border-left: 3px solid #38bdf8; border-radius: 4px; font-size: 0.88rem; color: var(--gris-800);">
             <strong>Objetivo / Instrucciones:</strong> ${pauta.descripcion}
           </div>`
        : '';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; border-bottom: 1px solid var(--gris-300); padding-bottom: 10px;">
            <div>
                <h3 style="margin: 0; color: var(--azul-900); font-size: 1.15rem;">${tituloHtml}</h3>
                <div style="font-size: 0.85rem; color: var(--gris-600); margin-top: 4px;">
                    Destino: ${pacienteHtml} | Creador: ${pauta.kinesiologo_nombre || 'Kinesiólogo'} | Fecha: ${fecha}
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <a href="crear_pauta.html?plantilla=${pauta.id}" class="btn btn-secondary btn-sm" title="Usar como base">
                    <i class='bx bx-copy'></i> Reutilizar
                </a>
                ${badgeEstado}
            </div>
        </div>

        ${descripcionHtml}

        <div>
            <h4 style="margin: 0 0 8px; font-size: 0.9rem; color: var(--gris-900);">Ejercicios Prescritos en esta pauta:</h4>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${ejerciciosHtml}
            </div>
        </div>
      `;

      if (container) container.appendChild(card);
    });

  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (noPautas) {
      noPautas.style.display = 'block';
      noPautas.innerHTML = `<p style="color: var(--rojo-500);">${err.message}</p>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  cargarFeedbacks();
  cargarPautas();
});