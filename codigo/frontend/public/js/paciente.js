function toggleFormulario() {
    const sec = document.getElementById('seccion-registro');
    sec.style.display = (sec.style.display === 'none') ? 'block' : 'none';
}

async function cargarPacientes() {
    const loading = document.getElementById('loading-pacientes');
    const tabla = document.getElementById('tabla-pacientes');
    const tbody = document.getElementById('tbody-pacientes');
    const noData = document.getElementById('no-pacientes');

    loading.style.display = 'block';
    tabla.style.display = 'none';
    noData.style.display = 'none';
    tbody.innerHTML = '';

    try {
        // 1. LLAMADA FETCH: Obtener mis pacientes desde Django
        const pacientes = await api.getMisPacientes();

        loading.style.display = 'none';

        if (!pacientes || pacientes.length === 0) {
            noData.style.display = 'block';
            return;
        }

        tabla.style.display = 'table';

        // 2. RENDERIZADO DE FILAS EN LA TABLA
        pacientes.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
      <td><strong>${p.nombre_completo || 'Sin nombre'}</strong></td>
      <td>${p.rut || 'N/A'}</td>
      <td>${p.email || 'Sin correo'}</td>
      <td><span class="badge badge-ok">${p.rol}</span></td>
      <td>
        <a href="/ejercicios/" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;">
          Ver Pautas
        </a>
      </td>
    `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        loading.style.display = 'none';
        noData.style.display = 'block';
        noData.innerHTML = `<p style="color: var(--rojo-500);">Error al cargar pacientes: ${err.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarPacientes();

    // 3. ENVÍO DEL FORMULARIO CON FETCH (POST)
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

                // Mensaje de éxito
                msgBox.style.display = 'block';
                msgItem.className = 'success';
                msgItem.textContent = res.mensaje || '¡Paciente registrado con éxito!';

                formRegistro.reset();

                // Recargar lista automáticamente tras 1 segundo y cerrar formulario
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