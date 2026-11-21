function toggleFormulario() {
    const sec = document.getElementById('seccion-registro');
    if (sec) {
        sec.style.display = (sec.style.display === 'none' || sec.style.display === '') ? 'block' : 'none';
    }
}

function renderSemaforoAbandono(paciente) {
    if (paciente.estado_alerta === 'peligro') {
        return `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="background-color: #fee2e2; color: #dc2626; border: 1px solid #f87171; font-weight: 600; padding: 3px 8px; border-radius: 9999px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                    <span style="height: 8px; width: 8px; background-color: #dc2626; border-radius: 50%; display: inline-block;"></span>
                    Riesgo de Abandono
                </span>
                <small style="color: #6b7280; font-size: 0.72rem;">${paciente.dias_inactivo} días inactivo (${paciente.ultima_sesion})</small>
            </div>
        `;
    } else if (paciente.estado_alerta === 'advertencia') {
        return `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="background-color: #fef3c7; color: #b45309; border: 1px solid #fcd34d; font-weight: 600; padding: 3px 8px; border-radius: 9999px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                    <span style="height: 8px; width: 8px; background-color: #f59e0b; border-radius: 50%; display: inline-block;"></span>
                    Inactivo Reciente
                </span>
                <small style="color: #6b7280; font-size: 0.72rem;">${paciente.dias_inactivo} días (${paciente.ultima_sesion})</small>
            </div>
        `;
    } else {
        return `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 600; padding: 3px 8px; border-radius: 9999px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
                    <span style="height: 8px; width: 8px; background-color: #16a34a; border-radius: 50%; display: inline-block;"></span>
                    Al Día
                </span>
                <small style="color: #6b7280; font-size: 0.72rem;">Última sesión: ${paciente.ultima_sesion}</small>
            </div>
        `;
    }
}

async function cargarPacientes() {
    const loading = document.getElementById('loading-pacientes');
    const tabla = document.getElementById('tabla-pacientes');
    const tbody = document.getElementById('tbody-pacientes');
    const noData = document.getElementById('no-pacientes');
    const bannerAlerta = document.getElementById('banner-resumen-churn');

    if (loading) loading.style.display = 'block';
    if (tabla) tabla.style.display = 'none';
    if (noData) noData.style.display = 'none';
    if (tbody) tbody.innerHTML = '';

    try {
        const data = await api.getAlertasAbandono();
        const pacientes = data.pacientes || [];

        if (loading) loading.style.display = 'none';

        if (!pacientes || pacientes.length === 0) {
            if (noData) noData.style.display = 'block';
            if (bannerAlerta) bannerAlerta.style.display = 'none';
            return;
        }

        if (bannerAlerta) {
            if (data.pacientes_en_riesgo > 0) {
                bannerAlerta.style.display = 'block';
                bannerAlerta.innerHTML = `
                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin-bottom: 16px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #991b1b; font-size: 0.9rem; font-weight: 600;">
                            🚨 Atención: Tienes <strong>${data.pacientes_en_riesgo}</strong> paciente(s) con más de 3 días de inactividad clínica.
                        </span>
                    </div>
                `;
            } else {
                bannerAlerta.style.display = 'none';
            }
        }

        if (tabla) tabla.style.display = 'table';

        pacientes.forEach(p => {
            const tr = document.createElement('tr');
            if (p.en_riesgo_abandono) {
                tr.style.backgroundColor = '#fff5f5';
            }

            tr.innerHTML = `
                <td>
                    <strong>${p.nombre_completo || 'Sin nombre'}</strong>
                    ${p.en_riesgo_abandono ? '<span title="Riesgo de abandono" style="margin-left: 4px;">⚠️</span>' : ''}
                </td>
                <td>${p.rut || 'N/A'}</td>
                <td>${p.email || 'Sin correo'}</td>
                <td>${renderSemaforoAbandono(p)}</td>
                <td>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <a href="pautas.html?paciente=${p.paciente_id}" class="btn btn-secondary btn-sm">
                            <i class='bx bx-line-chart'></i> Evolución
                        </a>
                        <a href="crear_pauta.html?paciente=${p.paciente_id}" class="btn btn-primary btn-sm">
                            <i class='bx bx-plus-circle'></i> Prescribir
                        </a>
                    </div>
                </td>
            `;
            if (tbody) tbody.appendChild(tr);
        });

    } catch (err) {
        if (loading) loading.style.display = 'none';
        if (noData) {
            noData.style.display = 'block';
            noData.innerHTML = `<p style="color: var(--rojo-500, #ef4444);">Error al cargar pacientes: ${err.message}</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarPacientes();

    const formRegistro = document.getElementById('form-registrar-paciente');
    if (formRegistro) {
        formRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();

            const first_name = document.getElementById('first_name').value.trim();
            const last_name = document.getElementById('last_name').value.trim();
            const rut = document.getElementById('rut').value.trim();
            const email = document.getElementById('email').value.trim();

            const btnSubmit = document.getElementById('btn-guardar-paciente');
            const msgBox = document.getElementById('registro-messages');
            const msgItem = document.getElementById('registro-msg-item');

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Registrando...';
            msgBox.style.display = 'none';

            try {
                const res = await api.registrarPaciente({ first_name, last_name, rut, email });

                msgBox.style.display = 'block';
                msgItem.className = 'success';
                msgItem.textContent = res.mensaje || '¡Paciente registrado con éxito!';

                formRegistro.reset();

                setTimeout(() => {
                    toggleFormulario();
                    cargarPacientes();
                }, 1200);

            } catch (err) {
                msgBox.style.display = 'block';
                msgItem.className = 'error';
                msgItem.textContent = err.message || 'Error al registrar paciente. Verifica el RUT.';
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Guardar y Vincular Paciente';
            }
        });
    }
});