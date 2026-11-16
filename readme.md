# KineConnect — Plataforma Integral de Gestión y Seguimiento de Rehabilitación Kinésica

**Proyecto Capstone — Ingeniería en Informática | Duoc UC**  
**Equipo de Desarrollo:** BMN Solutions (Grupo 7)

KineConnect es una solución multiplataforma (Web + Móvil) diseñada para digitalizar la prescripción de ejercicios terapéuticos, reemplazar las pautas estáticas en papel y brindar seguimiento clínico trazable en tiempo real mediante reportes de dolor (Escala EVA 0–10), alertas tempranas y control de adherencia semanal.

---

## Arquitectura y Estructura del Repositorio

El proyecto opera bajo una arquitectura desacoplada cliente-servidor organizada en los siguientes directorios principales:

```text
kineconect-BMNSolutions/
├── backend/              # API RESTful desarrollada en Django REST Framework
├── frontend/             # Portal Web Clínico (HTML5, CSS3, Vanilla JS + Mapa Anatómico SVG)
├── kineconect-mobile/    # Aplicación Móvil para Pacientes (React Native / Expo)
├── Fase 1/               # Documentación inicial y levantamiento de requerimientos
├── Fase 2/               # Diseño arquitectónico y modelamiento UML
├── Fase 3/               # Evidencias de pruebas, control de avance y cierre
└── README.md
```

---

## Stack Tecnológico

* **Backend & API:** Python, Django, Django REST Framework, SimpleJWT (autenticación con Access/Refresh Tokens), drf-spectacular (OpenAPI / Swagger).
* **Base de Datos & Cloud:** PostgreSQL (Neon Cloud con SSL en producción) y despliegue continuo en Render.
* **Notificaciones:** Resend API para envío asíncrono de credenciales temporales y alertas clínicas por correo electrónico.
* **Portal Web (Rol Kinesiólogo):** HTML5, CSS3, JavaScript (Vanilla JS), Vite y mapas anatómicos interactivos en SVG.
* **Aplicación Móvil (Rol Paciente):** React Native, Expo (`expo-video`, `expo-haptics`), `AsyncStorage` y cola local de sincronización *Offline-First*.

---

## Funcionalidades Principales

### 1. Portal Web Clínico (Rol Kinesiólogo)
* **Gestión de Pacientes por RUT:** Registro con normalización de RUT chileno y generación automática de contraseña temporal enviada por correo electrónico.
* **Prescripción Biomecánica Interactiva:** Explorador de 36 ejercicios terapéuticos categorizados por zona anatómica (mapa SVG frontal/posterior) y 7 áreas clínicas (*Rehabilitación General, Traumatología, Inmunología, Neurorehabilitación, Post-Operatorio, Cardiorrespiratorio y Adulto Mayor*).
* **Plantillas Maestras y Edición Dinámica:** Creación de rutinas reutilizables con parametrización de series, repeticiones y descansos, permitiendo editar pautas en curso sin perder el progreso semanal del paciente.
* **Monitoreo Clínico y Reportes PDF:** Panel de evolución de dolor, detección automática de inactividad superior a 3 días y exportación de fichas clínicas en formato PDF por RUT.

### 2. Aplicación Móvil (Rol Paciente)
* **Ejecución Guiada:** Visualización de pautas activas con videos demostrativos, instrucciones posturales paso a paso y temporizador interactivo de descanso con retroalimentación háptica.
* **Evaluación Post-Sesión (Escala EVA 0–10):** Registro obligatorio del nivel de dolor al finalizar la sesión o ante detención anticipada por molestia aguda.
* **Alertas Clínicas Preventivas:** Notificación automática al kinesiólogo vía panel y correo electrónico cuando el paciente reporta `EVA ≥ 6`.
* **Control de Ciclos Semanales (*Modo Solo Consulta*):** Al completar la meta semanal prescrita (ej. 3/3 sesiones), la pauta pasa automáticamente a *Modo Solo Consulta* para permitir el repaso técnico sin sobreentrenamiento.
* **Operación Offline-First:** Almacenamiento local de rutinas y cola de sincronización automática al recuperar conexión a internet.

---

## Instalación y Ejecución Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/Benjamincelis23/kineconect-BMNSolutions.git
cd kineconect-BMNSolutions
```

### 2. Levantar el Backend (Django REST Framework)
```bash
cd backend/src
python -m venv venv
# En Windows PowerShell:
.\venv\Scripts\Activate.ps1
# En Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
```

Configurar las variables de entorno en `backend/src/.env`:
```env
SECRET_KEY=tu_clave_secreta
DEBUG=True
DATABASE_URL=postgres://usuario:password@host:5432/nombre_db
RESEND_API_KEY=tu_api_key_de_resend
```

Ejecutar migraciones, poblar el catálogo inicial de ejercicios y levantar el servidor:
```bash
python manage.py migrate
python manage.py poblar_datos
python manage.py runserver
```
*API disponible en:* `http://127.0.0.1:8000/api/`

### 3. Levantar el Portal Web (Frontend)
En una nueva terminal desde la raíz del proyecto:
```bash
cd frontend
npm install
npm run dev
```

### 4. Levantar la Aplicación Móvil (Expo)
En una nueva terminal desde la raíz del proyecto:
```bash
cd kineconect-mobile
npm install
npx expo start
```
*(Escanear el código QR con Expo Go o presionar `a` para ejecutar en emulador Android).*

---

## Equipo de Desarrollo — BMN Solutions

| Integrante | Rol en el Proyecto | Responsabilidades Principales |
| :--- | :--- | :--- |
| **Benjamín Celis** | Product Owner / Backend & Cloud | Arquitectura API REST, seguridad JWT, base de datos PostgreSQL, integración Resend y despliegue productivo. |
| **Nicolás Mella** | Frontend Developer & UI/UX | Diseño de interfaces responsivas, mapa anatómico SVG interactivo, portal clínico y generación de reportes PDF. |
| **Matías Sáez** | Mobile Developer & QA | Desarrollo multiplataforma en React Native/Expo, reproducción multimedia, cola offline y validación E2E. |
