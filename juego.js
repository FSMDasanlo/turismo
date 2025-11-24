document.addEventListener('DOMContentLoaded', async () => {
    // Elementos del DOM
    const contenedorJuego = document.getElementById('contenedor-juego');
    const imagenCiudad = document.getElementById('imagen-ciudad');
    const opcionesContainer = document.getElementById('opciones-container');
    const radiosDificultad = document.querySelectorAll('input[name="dificultad"]');
    const btnMostrarCiudad = document.getElementById('btn-mostrar-ciudad');
    const listaPuntuacionesEl = document.getElementById('lista-puntuaciones');
    const solucionContainer = document.getElementById('solucion-anterior');

    // Estado del juego
    let ciudades = [];
    let ciudadActual = null;
    let ciudadesMostradas = [];
    let jugadores = [];
    let jugadorActualIndex = 0;
    let rondasRestantes = 5; // 2. El número de rondas empieza en 5

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
        // Limpiar el contenedor de la solución anterior
        solucionContainer.classList.remove('correcto', 'incorrecto');
        solucionContainer.textContent = ''; // 4. Limpiar la solución anterior
        
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

        // --- LÓGICA MEJORADA PARA LAS OPCIONES ---
        // 1. Crear un "pool" de opciones incorrectas de la MISMA dificultad.
        const poolOpcionesIncorrectas = ciudades.filter(c => 
            c.dificultad === dificultadSeleccionada && c.nombre !== ciudadActual.nombre
        );

        // 2. Comprobar si hay suficientes ciudades en esa dificultad para crear el juego.
        if (poolOpcionesIncorrectas.length < 2) {
            alert(`No hay suficientes ciudades en la dificultad "${dificultadSeleccionada}" para generar un juego justo. Se necesitan al menos 3. Por favor, añade más ciudades o elige otra dificultad.`);
            prepararRonda(); // Volver a la preparación de ronda
            return;
        }

        // 3. Elegir las opciones incorrectas de ese "pool".
        const opciones = [ciudadActual];
        while (opciones.length < 3) {
            const opcionAleatoria = poolOpcionesIncorrectas[Math.floor(Math.random() * poolOpcionesIncorrectas.length)];
            if (!opciones.some(opt => opt.nombre === opcionAleatoria.nombre)) { // Evitar duplicados
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
        solucionContainer.classList.remove('correcto', 'incorrecto'); // Limpiar clases de color previas

        if (esCorrecta) {
            jugadores[jugadorActualIndex].puntuacion += puntos;
            solucionContainer.textContent = `${ciudadActual.nombre} (${ciudadActual.pais}) +${puntos}`;
            solucionContainer.classList.add('correcto');
        } else {
            solucionContainer.textContent = `${ciudadActual.nombre} (${ciudadActual.pais})`;
            solucionContainer.classList.add('incorrecto');
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
        // 1. Ordenar jugadores por puntuación (de mayor a menor)
        jugadores.sort((a, b) => b.puntuacion - a.puntuacion);

        // 2. Determinar el/los ganador(es)
        const puntuacionMaxima = jugadores[0].puntuacion;
        const ganadores = jugadores.filter(j => j.puntuacion === puntuacionMaxima);

        // 3. Preparar el contenido de la pantalla final
        const pantallaFin = document.getElementById('pantalla-fin-juego');
        const ganadorTexto = document.getElementById('ganador-texto');
        const listaPuntuacionesFinales = document.getElementById('lista-puntuaciones-finales');

        if (ganadores.length > 1) {
            // Hay un empate
            const nombresGanadores = ganadores.map(g => g.nombre).join(' y ');
            ganadorTexto.textContent = `¡Es un empate entre ${nombresGanadores}!`;
        } else {
            // Hay un solo ganador
            ganadorTexto.textContent = `¡El ganador es ${ganadores[0].nombre}!`;
        }

        // Rellenar la lista de puntuaciones finales
        listaPuntuacionesFinales.innerHTML = '';
        jugadores.forEach(jugador => {
            listaPuntuacionesFinales.innerHTML += `<li>${jugador.nombre}: ${jugador.puntuacion} puntos</li>`;
        });

        // 4. Mostrar la pantalla final
        pantallaFin.style.display = 'flex';
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
            li.textContent = `${jugador.nombre}: ${jugador.puntuacion}`; // 3. Quitar "pts."
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
        // 1. Pasa al siguiente jugador
        siguienteTurno();

        // 2. Comprobar si el juego ha terminado DESPUÉS de actualizar el contador de rondas.
        // Si las rondas restantes llegan a 0, el juego termina.
        if (rondasRestantes <= 0) {
            finDelJuego();
            return; // Detenemos la ejecución para no preparar una nueva ronda.
        }

        // 2. Prepara la ronda para el nuevo jugador
        prepararRonda();
        // 3. Actualiza el display para resaltar al nuevo jugador
        actualizarDisplayPuntuaciones();
    }

    // --- EVENT LISTENERS ---

    btnMostrarCiudad.onclick = mostrarPregunta;

});
