function toggleFormulario() {
    const sec = document.getElementById('seccion-registro');
    if (sec) {
        sec.style.display = (sec.style.display === 'none' || sec.style.display === '') ? 'block' : 'none';
    }
}

// Generador de badge estilo semáforo
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

    loading.style.display = 'block';
    tabla.style.display = 'none';
    noData.style.display = 'none';
    tbody.innerHTML = '';

    try {
        // 1. LLAMADA FETCH AL NUEVO ENDPOINT DE CHURN RATE / ABANDONO
        const data = await api.getAlertasAbandono();
        const pacientes = data.pacientes || [];

        loading.style.display = 'none';

        if (!pacientes || pacientes.length === 0) {
            noData.style.display = 'block';
            if (bannerAlerta) bannerAlerta.style.display = 'none';
            return;
        }

        // 2. Banner contador de pacientes en riesgo
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

        tabla.style.display = 'table';

        // 3. RENDERIZADO DE FILAS CON SEMÁFORO
        pacientes.forEach(p => {
            const tr = document.createElement('tr');

            // Fila con fondo rojo muy tenue si está en riesgo crítico
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
                    <a href="/ejercicios/?paciente=${p.paciente_id}" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;">
                        Ver Pautas
                    </a>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        loading.style.display = 'none';
        noData.style.display = 'block';
        noData.innerHTML = `<p style="color: var(--rojo-500, #ef4444);">Error al cargar pacientes: ${err.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarPacientes();

    // ENVÍO DEL FORMULARIO CON FETCH (POST)
    const formRegistro = document.getElementById('form-registrar-paciente');
    if (formRegistro) {
        formRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('first_name').value.trim();
            const lastName = document.getElementById('last_name').value.trim();
            const rut = document.getElementById('rut').value.trim();
            const email = document.getElementById('email').value.trim();

            const btnSubmit = document.getElementById('btn-guardar-paciente');
            const msgBox = document.getElementById('registro-messages');
            const msgItem = document.getElementById('registro-msg-item');

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Registrando...';
            msgBox.style.display = 'none';

            try {
                const res = await api.registrarPaciente({ firstName, lastName, rut, email });

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