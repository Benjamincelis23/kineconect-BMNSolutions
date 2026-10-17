# kineconect-BMNSolutions

Nombre del proyecto: KineConnect

Descripción: Plataforma web orientada a la kinesiología para la gestión y prescripción de ejercicios mediante un mapa anatómico interactivo en SVG, selector de zonas corporales y carrito de ejercicios personalizados.

Tecnologías utilizadas: Python, Django, HTML5, CSS3, JavaScript (SVG interactivo), PostgreSQL, Git/GitHub.

Instrucciones para ejecutar el proyecto localmente:

Configuración del Backend:

Clonar el repositorio: git clone https://github.com/Benjamincelis23/kineconect-BMNSolutions.git

Entrar a la carpeta de código del backend: cd kineconect-BMNSolutions/codigo/backend

Crear y activar el entorno virtual: python -m venv venv y luego .\venv\Scripts\activate

Instalar las dependencias: pip install -r requirements.txt

Aplicar migraciones a la base de datos: python manage.py migrate

Iniciar el servidor local: python manage.py runserver

Abrir en el navegador: http://127.0.0.1:8000/

Configuración del Frontend:

Abre una nueva terminal (puedes dejar el servidor del backend corriendo en la otra).

Entrar a la carpeta de código del frontend: cd kineconect-BMNSolutions/codigo/frontend

Abrir el archivo principal (por ejemplo, index.html) directamente en tu navegador o levantar la interfaz utilizando una extensión como Live Server en tu editor de código.

Integrantes del equipo con sus roles:

Benjamin Celis - Product Owner / Full Stack Developer

Nicolas Mella - Frontend Developer & UI/UX

Matías Saez - Backend Developer & Data Lead

Metodología de trabajo del equipo:

Metodología ágil: Scrum apoyado en el seguimiento de tareas e iteraciones por sprint.

Arquitectura de la solución:

Arquitectura basada en el patrón MTV (Model-Template-View) provisto por Django, desacoplando la lógica de datos, plantillas HTML/JS interactivas y controladores de endpoints para el selector de ejercicios.
