// static/js/MapaAnatomico.jsx

const MapaAnatomico = () => {
    // Función que se ejecuta al hacer clic en un músculo
    const handleMusculoClick = (zonaCuerpo) => {
        console.log(`Filtrando por: ${zonaCuerpo}`);
        
        // Opción A: Redirigir a tu vista Django con el filtro en la URL
        window.location.href = `?zona=${zonaCuerpo}`;
        
        // Opción B (Avanzada): Hacer fetch a tu EjercicioViewSet aquí mismo
        // fetch(`/api/v1/ejercicios/?zona_cuerpo=${zonaCuerpo}`)...
    };

    return (
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <p>Selecciona un grupo muscular:</p>
            
            {/* SVG Base (Ejemplo simplificado) 
                Aquí pegarás un SVG real del cuerpo humano.
                Lo clave es agregar el evento onClick y el estilo cursor: 'pointer' a los <path>
            */}
            <svg viewBox="0 0 100 200" style={{ width: '100%', height: 'auto' }}>
                {/* Cabeza (solo referencia visual) */}
                <circle cx="50" cy="20" r="15" fill="#e0e0e0" />
                
                {/* Pectorales */}
                <path 
                    d="M 35 40 L 65 40 L 65 60 L 35 60 Z" 
                    fill="#b3d4ff" 
                    stroke="#0056b3"
                    style={{ cursor: 'pointer', transition: 'fill 0.3s' }}
                    onMouseEnter={(e) => e.target.style.fill = '#0056b3'}
                    onMouseLeave={(e) => e.target.style.fill = '#b3d4ff'}
                    onClick={() => handleMusculoClick('PECTORAL')}
                >
                    <title>Pectorales</title>
                </path>

                {/* Cuádriceps Izquierdo */}
                <path 
                    d="M 35 110 L 48 110 L 48 160 L 35 160 Z" 
                    fill="#b3d4ff" 
                    stroke="#0056b3"
                    style={{ cursor: 'pointer', transition: 'fill 0.3s' }}
                    onMouseEnter={(e) => e.target.style.fill = '#0056b3'}
                    onMouseLeave={(e) => e.target.style.fill = '#b3d4ff'}
                    onClick={() => handleMusculoClick('CUADRICEPS')}
                >
                    <title>Cuádriceps Izquierdo</title>
                </path>
                
                {/* Cuádriceps Derecho */}
                <path 
                    d="M 52 110 L 65 110 L 65 160 L 52 160 Z" 
                    fill="#b3d4ff" 
                    stroke="#0056b3"
                    style={{ cursor: 'pointer', transition: 'fill 0.3s' }}
                    onMouseEnter={(e) => e.target.style.fill = '#0056b3'}
                    onMouseLeave={(e) => e.target.style.fill = '#b3d4ff'}
                    onClick={() => handleMusculoClick('CUADRICEPS')}
                >
                    <title>Cuádriceps Derecho</title>
                </path>
            </svg>
        </div>
    );
};

// Montar el componente en el div que creaste en Django
const domContainer = document.querySelector('#mapa-react-root');
const root = ReactDOM.createRoot(domContainer);
root.render(<MapaAnatomico />);