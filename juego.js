document.addEventListener('DOMContentLoaded', async () => {
    // Elementos del DOM
    const contenedorJuego = document.getElementById('contenedor-juego');
    const imagenCiudad = document.getElementById('imagen-ciudad');
    const opcionesContainer = document.getElementById('opciones-container');
    const feedbackContainer = document.getElementById('feedback-container');
    const radiosDificultad = document.querySelectorAll('input[name="dificultad"]');
    const btnMostrarCiudad = document.getElementById('btn-mostrar-ciudad');
    const listaPuntuacionesEl = document.getElementById('lista-puntuaciones');

    // Estado del juego
    let ciudades = [];
    let ciudadActual = null;
    let ciudadesMostradas = [];
    let jugadores = [];
    let jugadorActualIndex = 0;
    let rondasRestantes = 10;

    // --- INICIALIZACIÓN ---
    
    // Carga los datos de las ciudades
    try {
        const response = await fetch('ciudades.json');
        ciudades = await response.json();
    } catch (error) {
        console.error('Error al cargar las ciudades:', error);
        alert('No se pudieron cargar los datos del juego. Inténtalo de nuevo.');
        return;
    }
    
    // Carga los jugadores y prepara la interfaz
    cargarJugadores();
    prepararRonda();

    // --- LÓGICA DEL JUEGO ---

    function cargarJugadores() {
        jugadores = JSON.parse(localStorage.getItem('jugadores')) || [];
        if (jugadores.length === 0) {
            alert('No se han encontrado jugadores. Por favor, añádelos para empezar.');
            window.location.href = 'index.html';
            return;
        }
        // ¡LA SOLUCIÓN CLAVE!
        // Reiniciamos las puntuaciones a 0 al comenzar una nueva partida.
        jugadores.forEach(jugador => {
            jugador.puntuacion = 0;
        });

        jugadorActualIndex = 0; // Empezamos con el primer jugador
        actualizarDisplayPuntuaciones();
    }

    function prepararRonda() {
        // Restablecer la interfaz para una nueva pregunta
        opcionesContainer.innerHTML = '';
        feedbackContainer.innerHTML = '';
        
        imagenCiudad.style.display = 'none'; // Ocultar imagen
        btnMostrarCiudad.style.display = 'block'; // Mostrar botón

        // Habilitar selección de dificultad
        radiosDificultad.forEach(radio => radio.disabled = false);
    }

    function mostrarPregunta() {
        // Filtrar ciudades por dificultad seleccionada
        const dificultadSeleccionada = document.querySelector('input[name="dificultad"]:checked').value;
        let ciudadesDisponibles = ciudades.filter(c => c.dificultad === dificultadSeleccionada && !ciudadesMostradas.includes(c.nombre));

        if (ciudadesDisponibles.length === 0) {
            ciudadesMostradas = ciudadesMostradas.filter(nombreCiudad => {
                const ciudad = ciudades.find(c => c.nombre === nombreCiudad);
                return ciudad && ciudad.dificultad !== dificultadSeleccionada;
            });
            ciudadesDisponibles = ciudades.filter(c => c.dificultad === dificultadSeleccionada);

             if (ciudadesDisponibles.length === 0) {
                alert(`No hay ciudades para el nivel "${dificultadSeleccionada}". Elige otro.`);
                prepararRonda();
                return;
             }
        }

        // Seleccionar ciudad y opciones
        ciudadActual = ciudadesDisponibles[Math.floor(Math.random() * ciudadesDisponibles.length)];
        ciudadesMostradas.push(ciudadActual.nombre);

        const opciones = [ciudadActual];
        while (opciones.length < 3) {
            const opcionAleatoria = ciudades[Math.floor(Math.random() * ciudades.length)];
            if (!opciones.some(opt => opt.nombre === opcionAleatoria.nombre)) {
                opciones.push(opcionAleatoria);
            }
        }

        opciones.sort(() => Math.random() - 0.5);

        // Mostrar elementos del juego
        imagenCiudad.src = ciudadActual.imagen_url;
        imagenCiudad.style.display = 'block';
        btnMostrarCiudad.style.display = 'none';
        radiosDificultad.forEach(radio => radio.disabled = true); // Bloquear dificultad

        opcionesContainer.innerHTML = '';
        opciones.forEach(opcion => {
            const boton = document.createElement('button');
            boton.textContent = opcion.nombre;
            boton.onclick = () => verificarRespuesta(opcion.nombre === ciudadActual.nombre);
            opcionesContainer.appendChild(boton);
        });
    }

    function verificarRespuesta(esCorrecta) {
        // Deshabilitar botones de opción
        document.querySelectorAll('#opciones-container button').forEach(btn => btn.disabled = true);

        const puntos = obtenerPuntosPorDificultad();
        if (esCorrecta) {
            feedbackContainer.innerHTML = `<p class="feedback correcto">¡Correcto! +${puntos} puntos.</p>`;
            jugadores[jugadorActualIndex].puntuacion += puntos;
        } else {
            feedbackContainer.innerHTML = `<p class="feedback incorrecto">¡Incorrecto! La respuesta era ${ciudadActual.nombre}.</p>`;
        }

        actualizarDisplayPuntuaciones();

        // Iniciar temporizador para pasar al siguiente jugador automáticamente
        setTimeout(pasarAlSiguiente, 2000); // Espera 2 segundos (2000 ms)
    }

    function siguienteTurno() {
        jugadorActualIndex = (jugadorActualIndex + 1) % jugadores.length;

        // Si el índice vuelve a 0, significa que todos han jugado una ronda.
        if (jugadorActualIndex === 0) {
            rondasRestantes--;
            actualizarContadorRonda();
        }
    }

    function finDelJuego() {
        // Por ahora, una simple alerta. Más adelante podemos hacer una pantalla de ganador.
        alert("¡Fin del juego!");
        // Deshabilitamos la interfaz para que no se pueda seguir jugando.
        opcionesContainer.innerHTML = '<h2>¡Juego Terminado!</h2>';
        feedbackContainer.innerHTML = '';
        btnMostrarCiudad.style.display = 'none';
        document.querySelector('.dificultad-container').style.display = 'none';
    }

    // --- FUNCIONES AUXILIARES ---

    function obtenerPuntosPorDificultad() {
        const dificultad = document.querySelector('input[name="dificultad"]:checked').value;
        switch (dificultad) {
            case 'facil': return 10;
            case 'medio': return 20;
            case 'dificil': return 50;
            default: return 10;
        }
    }

    function actualizarDisplayPuntuaciones() {
        listaPuntuacionesEl.innerHTML = '';
        jugadores.forEach((jugador, index) => {
            const li = document.createElement('li');
            li.textContent = `${jugador.nombre}: ${jugador.puntuacion} pts`;
            if (index === jugadorActualIndex) {
                li.classList.add('activo'); // Resaltar jugador actual
            }
            listaPuntuacionesEl.appendChild(li);
        });
    }

    function actualizarContadorRonda() {
        const numeroRondaEl = document.getElementById('numero-ronda');
        numeroRondaEl.textContent = rondasRestantes;
    }

    function pasarAlSiguiente() {
        // Comprobar si el juego ha terminado ANTES de pasar al siguiente turno
        if (jugadorActualIndex === jugadores.length - 1 && rondasRestantes <= 1) {
            finDelJuego();
            return;
        }

        // 1. Pasa al siguiente jugador
        siguienteTurno();
        // 2. Prepara la ronda para el nuevo jugador
        prepararRonda();
        // 3. Actualiza el display para resaltar al nuevo jugador
        actualizarDisplayPuntuaciones();
    }

    // --- EVENT LISTENERS ---

    btnMostrarCiudad.onclick = mostrarPregunta;

});
