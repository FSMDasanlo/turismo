// juego.js

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const contenedorJuego = document.getElementById('contenedor-juego');
    const btnIniciarJuego = document.getElementById('btn-iniciar-juego');
    const btnCerrarJuego = document.getElementById('btn-cerrar-juego');

    const puntuacionEl = document.getElementById('puntuacion');
    const imagenEl = document.getElementById('imagen-ciudad');
    const opcionesContainer = document.getElementById('opciones-container');
    const feedbackEl = document.getElementById('feedback');


    let ciudades = [];
    let ciudadCorrecta = null;
    let puntuacion = 0;

    // 1. Cargar los datos e iniciar el juego
    async function iniciarJuego() {
        const response = await fetch('ciudades.json');
        ciudades = await response.json();
        puntuacion = 0;
        actualizarPuntuacion(0);
        siguienteRonda();
    }

    // 2. Lógica de una ronda
    function siguienteRonda() {
        feedbackEl.textContent = '';
        feedbackEl.style.backgroundColor = 'transparent';

        opcionesContainer.innerHTML = ''; // Limpiar botones anteriores

        // Elige la ciudad correcta (simplificado, sin niveles aún)
        ciudadCorrecta = ciudades[Math.floor(Math.random() * ciudades.length)];

        // Genera opciones incorrectas
        const opciones = [ciudadCorrecta];
        while (opciones.length < 3) {
            const opcionFalsa = ciudades[Math.floor(Math.random() * ciudades.length)];
            if (!opciones.some(opt => opt.nombre === opcionFalsa.nombre)) {
                opciones.push(opcionFalsa);
            }
        }

        // Barajar las opciones
        opciones.sort(() => Math.random() - 0.5);

        // Mostrar imagen y botones
        imagenEl.src = ciudadCorrecta.imagen_url;
        opciones.forEach(opcion => {
            const boton = document.createElement('button');
            boton.textContent = opcion.nombre;
            boton.onclick = () => comprobarRespuesta(opcion);
            opcionesContainer.appendChild(boton);
        });
    }

    // 3. Comprobar la respuesta del usuario
    function comprobarRespuesta(opcionSeleccionada) {
        if (opcionSeleccionada.nombre === ciudadCorrecta.nombre) {
            feedbackEl.textContent = '¡Correcto!';
            feedbackEl.style.color = 'white';
            feedbackEl.style.backgroundColor = '#28a745'; // Verde éxito
            actualizarPuntuacion(10);
        } else {
            feedbackEl.textContent = `Incorrecto. La respuesta era ${ciudadCorrecta.nombre}.`;
            feedbackEl.style.color = 'white';
            feedbackEl.style.backgroundColor = '#dc3545'; // Rojo error
        }
        // Desactivar botones para evitar múltiples clics
        document.querySelectorAll('#opciones-container button').forEach(btn => btn.disabled = true);

        // Esperar un poco y pasar a la siguiente ronda
        setTimeout(siguienteRonda, 2000);
    }
    
    function actualizarPuntuacion(puntos) {
        puntuacion += puntos;
        puntuacionEl.textContent = `Puntuación: ${puntuacion}`;
    }

    // Configuración del botón de inicio
    btnIniciarJuego.addEventListener('click', () => {
        pantallaInicio.classList.add('hidden');
        contenedorJuego.classList.remove('hidden');
        iniciarJuego();
    });

    // Configuración del botón de cerrar
    btnCerrarJuego.addEventListener('click', () => {
        contenedorJuego.classList.add('hidden');
        pantallaInicio.classList.remove('hidden');
    });

});
