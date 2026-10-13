# kineconect-BMNSolutions

Nombre del proyecto: KineConect

Descripción: Plataforma web orientada a la kinesiología para la gestión y prescripción de ejercicios mediante un mapa anatómico interactivo en SVG, selector de zonas corporales y carrito de ejercicios personalizados.

Tecnologías utilizadas: Python, Django, HTML5, CSS3, JavaScript (SVG interactivo), PostgreSQL, Git/GitHub.

Instrucciones para ejecutar el proyecto localmente:
1. Clonar el repositorio:
   git clone https://github.com/Benjamincelis23/kineconect-BMNSolutions.git
2. Entrar a la carpeta de código:
   cd src
3. Crear y activar el entorno virtual:
   python -m venv venv
   .\venv\Scripts\activate
4. Instalar las dependencias:
   pip install -r requirements.txt
5. Aplicar migraciones a la base de datos:
   python manage.py migrate
6. Iniciar el servidor local:
   python manage.py runserver
7. Abrir en el navegador: http://127.0.0.1:8000/

Integrantes del equipo con sus roles:
* Benjamin Celis - Product Owner / Full Stack Developer
* Nicolas Mella - Frontend Developer & UI/UX
* Matías Saez - Backend Developer & Data Lead

Metodología de trabajo del equipo:
* Metodología ágil: Scrum apoyado en el seguimiento de tareas e iteraciones por sprint.

Arquitectura de la solución:
* Arquitectura basada en el patrón MTV (Model-Template-View) provisto por Django, desacoplando la lógica de datos, plantillas HTML/JS interactivas y controladores de endpoints para el selector de ejercicios.
