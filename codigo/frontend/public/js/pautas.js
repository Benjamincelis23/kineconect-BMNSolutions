// 1. CARGAR Y EVALUAR FEEDBACKS DE DOLOR DESDE LA API
async function cargarFeedbacks() {
    const loading = document.getElementById('loading-feedback');
    const tabla = document.getElementById('tabla-feedback');
    const tbody = document.getElementById('tbody-feedback');
    const sinDatos = document.getElementById('sin-feedback');
    const alertasCont = document.getElementById('contenedor-alertas-criticas');

    loading.style.display = 'block';
    tabla.style.display = 'none';
    sinDatos.style.display = 'none';
    alertasCont.style.display = 'none';
    alertasCont.innerHTML = '';
    tbody.innerHTML = '';

    try {
        const data = await api.getFeedbacks();
        loading.style.display = 'none';

        if (!data || data.length === 0) {
            sinDatos.style.display = 'block';
            return;
        }

        tabla.style.display = 'table';
        let alertasAltas = [];

        data.forEach(item => {
            const nivel = item.escala_dolor;
            let badgeClass = 'badge-ok';
            let nivelTexto = `Nivel ${nivel} - Leve`;

            if (nivel >= 7) {
                badgeClass = 'badge-alerta';
                nivelTexto = `⚠️ Nivel ${nivel} - Severo`;
                alertasAltas.push(item);
            } else if (nivel >= 4) {
                badgeClass = 'badge-neutro';
                nivelTexto = `Nivel ${nivel} - Moderado`;
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
            tbody.appendChild(tr);
        });

        // Mostrar banner de alerta si hay dolores severos
        if (alertasAltas.length > 0) {
            alertasCont.style.display = 'block';
            alertasCont.innerHTML = `
      <div class="alert-banner">
        ⚠️ <strong>Atención Clínica:</strong> Se detectaron ${alertasAltas.length} reporte(s) con dolor severo (Escala EVA ≥ 7) enviados desde la app móvil. Evalúa si es necesario contactar al paciente o reprogramar la carga de ejercicios.
      </div>
    `;
        }

    } catch (err) {
        loading.style.display = 'none';
        sinDatos.style.display = 'block';
        sinDatos.innerHTML = `<p style="color: var(--rojo-500);">Error al consultar feedbacks: ${err.message}</p>`;
    }
}

// 2. CARGAR PAUTAS PRESCRITAS
async function cargarPautas() {
    const loading = document.getElementById('loading-pautas');
    const container = document.getElementById('lista-pautas');
    const noPautas = document.getElementById('no-pautas');

    loading.style.display = 'block';
    container.innerHTML = '';
    noPautas.style.display = 'none';

    try {
        const data = await api.getPautas();
        loading.style.display = 'none';

        if (!data || data.length === 0) {
            noPautas.style.display = 'block';
            return;
        }

        data.forEach(pauta => {
            const card = document.createElement('div');
            card.className = 'card';

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

            card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; border-bottom: 1px solid var(--gris-300); padding-bottom: 10px;">
        <div>
          <h3 style="margin: 0; color: var(--azul-900); font-size: 1.15rem;">${pauta.titulo || 'Rutina de Ejercicios'}</h3>
          <div style="font-size: 0.85rem; color: var(--gris-600); margin-top: 4px;">
            Paciente Asignado: <strong>${pauta.paciente_nombre || 'Paciente'}</strong> | Creador: ${pauta.kinesiologo_nombre || 'Kinesiólogo'} | Fecha: ${fecha}
          </div>
        </div>
        <div>
          <span class="badge ${pauta.activo ? 'badge-ok' : 'badge-neutro'}">${pauta.activo ? 'Rutina Activa' : 'Finalizada'}</span>
        </div>
      </div>

      <div>
        <h4 style="margin: 0 0 8px; font-size: 0.9rem; color: var(--gris-900);">Ejercicios Prescritos en esta pauta:</h4>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${ejerciciosHtml}
        </div>
      </div>
    `;

            container.appendChild(card);
        });

    } catch (err) {
        loading.style.display = 'none';
        noPautas.style.display = 'block';
        noPautas.innerHTML = `<p style="color: var(--rojo-500);">${err.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarFeedbacks();
    cargarPautas();
});