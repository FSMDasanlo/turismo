document.addEventListener('DOMContentLoaded', async () => {
    // Elementos del DOM
    const urlParams = new URLSearchParams(window.location.search);
    const contenedorJuego = document.getElementById('contenedor-juego');
    const btnSonido = document.getElementById('btn-sonido');
    const dificultadDisplay = document.getElementById('dificultad-display'); // 1. Nuevo elemento para mostrar la dificultad
    const dificultadRondaBarEl = document.getElementById('dificultad-ronda-bar'); // Nuevo elemento para la barra de dificultad/ronda
    const imagenCiudad = document.getElementById('imagen-ciudad');
    const opcionesContainer = document.getElementById('opciones-container');
    const listaPuntuacionesEl = document.getElementById('lista-puntuaciones');
    const contadorJuegoEl = document.getElementById('contador-juego');
    const seleccionDificultadContainer = document.getElementById('seleccion-dificultad'); // 1. Contenedor de los radios
    const solucionContainer = document.getElementById('solucion-anterior');
    const pantallaTransicionEl = document.getElementById('pantalla-transicion');
    const tituloTransicionEl = document.getElementById('titulo-transicion');
    const btnSiguienteJugador = document.getElementById('btn-siguiente-jugador');

    // Estado del juego
    const esModoContrarreloj = urlParams.get('modo') === 'contrarreloj';
    let ciudades = [];
    let ciudadActual = null;
    let ciudadesMostradas = [];
    let jugadores = [];
    let jugadorActualIndex = 0;
    let dificultadActualRonda = ''; // 1. Variable para la dificultad de la ronda
    // --- Variables de modo de juego ---
    let rondasRestantes = 5; 
    let tiempoRestante = 60; // Tiempo inicial para modo contrarreloj
    // Contadores para el resumen del modo contrarreloj
    let aciertosTurno = 0;
    let fallosTurno = 0;
    // Contadores para la progresión de dificultad en contrarreloj
    let preguntasFacilesHechas = 0;
    let preguntasMediasHechas = 0;
    let resumenContrarrelojData = []; // Para guardar los datos y ordenarlos al final

    let intervaloTimer;

    let sonidoActivado = true;
    let ciudadesFalladas = []; // Array para guardar las ciudades falladas

    // --- Sonidos del juego ---
    const sonidoCorrecto = new Audio('sonidos/correcto.mp3');
    const sonidoIncorrecto = new Audio('sonidos/incorrecto.mp3');

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
    inicializarSonido(); // Carga la preferencia de sonido del usuario

    btnSonido.onclick = toggleSonido; // Asignamos el evento al botón
    btnSiguienteJugador.onclick = iniciarTurnoContrarreloj;

    if (esModoContrarreloj) {
        iniciarModoContrarreloj();
    } else {
        iniciarModoClasico();
    }

    // --- LÓGICA DEL JUEGO ---


    function cargarJugadores() {
        const jugadoresGuardados = JSON.parse(localStorage.getItem('jugadores')) || [];
        // Filtramos para asegurar que cada jugador tiene un 'nombre' válido
        jugadores = jugadoresGuardados.filter(j => 
            typeof j === 'object' && j !== null && typeof j.nombre === 'string'
        );
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

        jugadorActualIndex = 0;

        // En modo contrarreloj, solo mostramos al jugador activo
        if (esModoContrarreloj) {
            actualizarDisplayJugadorActivo();
        } else {
            actualizarDisplayPuntuaciones();
        }
    }

    function iniciarModoClasico() {
        seleccionarDificultadAleatoria();
        mostrarPregunta();
    }

    function iniciarModoContrarreloj() {
        // Preparamos los contadores para el primer jugador
        preguntasFacilesHechas = 0;
        preguntasMediasHechas = 0;
        listaPuntuacionesEl.style.justifyContent = 'center'; // Centramos el único jugador visible
        actualizarDificultadContrarreloj(); // Establecemos la primera dificultad (fácil)
        mostrarPregunta();
        iniciarTimer();
    }

    function prepararRonda() {
        // Ocultar el selector de dificultad original
        if (seleccionDificultadContainer) {
            seleccionDificultadContainer.style.display = 'none';
        }
        // Restablecer la interfaz para una nueva pregunta
        opcionesContainer.innerHTML = '';
        // Limpiar el contenedor de la solución anterior
        solucionContainer.classList.remove('correcto', 'incorrecto');
        solucionContainer.textContent = ''; // 4. Limpiar la solución anterior
        
    }

    function mostrarPregunta() {
        // Filtrar ciudades por dificultad seleccionada
        let ciudadesDisponibles = ciudades.filter(c => c.dificultad === dificultadActualRonda && !ciudadesMostradas.includes(c.nombre));

        if (ciudadesDisponibles.length === 0) {
            ciudadesMostradas = ciudadesMostradas.filter(nombreCiudad => {
                const ciudad = ciudades.find(c => c.nombre === nombreCiudad);
                return ciudad && ciudad.dificultad !== dificultadActualRonda; // Corregido: usar dificultadActualRonda
            });
            ciudadesDisponibles = ciudades.filter(c => c.dificultad === dificultadActualRonda);

             if (ciudadesDisponibles.length === 0) {
                alert(`No hay ciudades para el nivel "${dificultadActualRonda}". Se intentará con otro nivel.`);
                seleccionarDificultadAleatoria(); // Cambiamos de nivel
                mostrarPregunta(); // E intentamos de nuevo
                return;
             }
        }

        // Seleccionar ciudad y opciones
        ciudadActual = ciudadesDisponibles[Math.floor(Math.random() * ciudadesDisponibles.length)];
        ciudadesMostradas.push(ciudadActual.nombre);

        // --- LÓGICA MEJORADA PARA LAS OPCIONES ---
        // 1. Crear un "pool" de opciones incorrectas de la MISMA dificultad.
        const poolOpcionesIncorrectas = ciudades.filter(c => 
            c.dificultad === dificultadActualRonda && c.nombre !== ciudadActual.nombre
        );

        // 2. Comprobar si hay suficientes ciudades en esa dificultad para crear el juego.
        if (poolOpcionesIncorrectas.length < 2) {
            alert(`No hay suficientes ciudades en la dificultad "${dificultadActualRonda}" para generar un juego justo. Se necesitan al menos 3. Se cambiará de nivel.`);
            seleccionarDificultadAleatoria(); // Cambiamos de nivel
            mostrarPregunta(); // E intentamos de nuevo
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
            if (sonidoActivado) sonidoCorrecto.play(); // ¡Suena el acierto!
            if (esModoContrarreloj) {
                aciertosTurno++;
            }
        } else {
            solucionContainer.textContent = `${ciudadActual.nombre} (${ciudadActual.pais})`;
            solucionContainer.classList.add('incorrecto');
            if (sonidoActivado) sonidoIncorrecto.play(); // ¡Suena el error!
            // Añadimos la ciudad a la lista de falladas para el dato curioso
            ciudadesFalladas.push(ciudadActual.nombre);
            if (esModoContrarreloj) {
                fallosTurno++;
            }
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
            seleccionarDificultadAleatoria(); // 1. Cambiar dificultad para la nueva ronda
        }
    }

    async function finDelJuego() {
        // 1. Ordenar jugadores por puntuación (de mayor a menor)
        jugadores.sort((a, b) => b.puntuacion - a.puntuacion);

        // 2. Determinar el/los ganador(es)
        const puntuacionMaxima = jugadores[0].puntuacion;
        const ganadores = jugadores.filter(j => j.puntuacion === puntuacionMaxima);

        // 3. Preparar el contenido de la pantalla final
        const pantallaFin = document.getElementById('pantalla-fin-juego'); // Asegúrate de que este ID existe
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

        // 4. Mostrar la pantalla final ANTES de cargar el mapa para que tenga tamaño
        pantallaFin.style.display = 'flex';

        // --- LÓGICA DEL DATO CURIOSO ---
        await mostrarDatoCurioso();
    }

    async function mostrarDatoCurioso() {
        const datoCuriosoContainer = document.getElementById('dato-curioso-container');
        const mapContainer = document.getElementById('map-container');

        // Si se ha fallado al menos una ciudad, elegimos una al azar
        if (ciudadesFalladas.length > 0) {
            // Usamos un Set para tener solo ciudades únicas y luego lo convertimos a array
            const ciudadesFalladasUnicas = [...new Set(ciudadesFalladas)];
            const ciudadParaDato = ciudadesFalladasUnicas[Math.floor(Math.random() * ciudadesFalladasUnicas.length)];

            datoCuriosoContainer.style.display = 'block'; // Mostrar el contenedor
            mapContainer.innerHTML = `<p style="text-align:center; padding-top: 20px;">Buscando datos sobre ${ciudadParaDato}...</p>`;

            try {
                // Llamada a la API de Wikipedia para obtener resumen Y COORDENADAS
                const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ciudadParaDato)}?redirect=true`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('No se encontró en Wikipedia.');
                
                const data = await response.json();
                const extracto = data.extract;
                const coordenadas = data.coordinates;

                if (extracto && coordenadas) {
                    // Limpiamos el contenedor del mapa por si tenía el mensaje de "cargando"
                    mapContainer.innerHTML = '';

                    // 1. Inicializar el mapa en el div 'map-container'
                    const map = L.map('map-container').setView([coordenadas.lat, coordenadas.lon], 13); // 13 es el nivel de zoom

                    // 2. Añadir la capa de mapa de OpenStreetMap
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(map);

                    // 3. Añadir un marcador y el popup con el dato curioso
                    L.marker([coordenadas.lat, coordenadas.lon]).addTo(map)
                        .bindPopup(`<b>${ciudadParaDato}</b><br>${extracto}`)
                        .openPopup();
                } else {
                    throw new Error('No hay resumen disponible.');
                }
            } catch (error) {
                mapContainer.innerHTML = `<p style="text-align:center;">No se pudo encontrar un dato curioso para ${ciudadParaDato}.</p>`;
                console.error("Error al obtener dato de Wikipedia:", error);
            }
        }
    }

    // --- FUNCIONES AUXILIARES ---

    function obtenerPuntosPorDificultad() {
        switch (dificultadActualRonda) {
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

    function actualizarDisplayJugadorActivo() {
        listaPuntuacionesEl.innerHTML = '';
        const jugador = jugadores[jugadorActualIndex];
        const li = document.createElement('li');
        li.textContent = `${jugador.nombre}: ${jugador.puntuacion}`;
        li.classList.add('activo'); // Siempre está activo
        listaPuntuacionesEl.appendChild(li);
    }

    function actualizarContadorRonda() {
        const numeroRondaEl = document.getElementById('numero-ronda');
        numeroRondaEl.textContent = rondasRestantes;
    }

    function seleccionarDificultadAleatoria() {
        const dificultades = ['facil', 'medio', 'dificil'];
        dificultadActualRonda = dificultades[Math.floor(Math.random() * dificultades.length)];

        if (dificultadDisplay) {
            // Primero, limpiamos las clases de color del contenedor principal
            dificultadRondaBarEl.classList.remove('facil', 'medio', 'dificil');
            
            // Luego, añadimos la clase de color correspondiente al contenedor principal
            // y actualizamos el texto de la dificultad
            let puntos = 0; // Definimos puntos aquí para usarlo en el texto
            switch (dificultadActualRonda) {
                case 'facil':
                    dificultadRondaBarEl.classList.add('facil');
                    puntos = 10; break;
                case 'medio':
                    dificultadRondaBarEl.classList.add('medio');
                    puntos = 20; break;
                case 'dificil':
                    dificultadRondaBarEl.classList.add('dificil');
                    puntos = 50; break;
            }
            // Formateamos el texto para que incluya los puntos
            dificultadDisplay.textContent = `${dificultadActualRonda.toUpperCase()} +${puntos}`; // Corregido: eliminado '}' extra
        }
    }

    function pasarAlSiguiente() {
        if (esModoContrarreloj) {
            prepararRonda();
            actualizarDificultadContrarreloj(); // Actualizamos la dificultad según la progresión
            mostrarPregunta();
            return;
        }
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
        // 4. Muestra la siguiente pregunta automáticamente
        mostrarPregunta();
    }

    // --- Lógica del modo Contrarreloj ---

    function iniciarTimer() {
        actualizarDisplayTimer(); // Muestra el tiempo inicial
        intervaloTimer = setInterval(() => {
            tiempoRestante--;
            actualizarDisplayTimer();
            if (tiempoRestante <= 0) {
                clearInterval(intervaloTimer);
                
                if (jugadorActualIndex < jugadores.length - 1) {
                    mostrarPantallaTransicion();
                } else {
                    // Era el último jugador, fin del juego
                    mostrarResumenFinalContrarreloj();
                }
            }
        }, 1000);
    }

    function actualizarDisplayTimer() {
        contadorJuegoEl.innerHTML = `Tiempo: <span id="numero-ronda">${tiempoRestante}</span>`;
        // Añadimos o quitamos la clase de peligro si quedan 10 segundos o menos
        if (tiempoRestante <= 10 && tiempoRestante > 0) {
            contadorJuegoEl.classList.add('timer-danger');
        } else {
            contadorJuegoEl.classList.remove('timer-danger');
        }
    }

    function mostrarPantallaTransicion() {
        const jugadorActual = jugadores[jugadorActualIndex];
        const textoSiguienteEl = document.getElementById('texto-siguiente-jugador');

        // Guardamos el resultado del jugador que acaba de terminar
        const totalPreguntas = aciertosTurno + fallosTurno;
        resumenContrarrelojData.push({
            nombre: jugadorActual.nombre,
            totalPreguntas: totalPreguntas,
            aciertos: aciertosTurno,
            fallos: fallosTurno,
            puntuacion: jugadorActual.puntuacion
        });

        // Actualizamos la tabla con los datos que tenemos hasta ahora
        actualizarTablaResumen(resumenContrarrelojData);

        // Preparamos el texto para el siguiente jugador
        const siguienteJugador = jugadores[jugadorActualIndex + 1];
        textoSiguienteEl.textContent = `Preparado, ${siguienteJugador.nombre}?`;

        // Mostramos la pantalla
        pantallaTransicionEl.style.display = 'flex';
    }

    function iniciarTurnoContrarreloj() {
        pantallaTransicionEl.style.display = 'none'; // Ocultamos la pantalla de transición
        jugadorActualIndex++;
        tiempoRestante = 60; // Reiniciamos el tiempo
        aciertosTurno = 0; // Reiniciamos contadores
        fallosTurno = 0;
        preguntasFacilesHechas = 0; // Reiniciamos progresión de dificultad
        preguntasMediasHechas = 0;
        actualizarDisplayJugadorActivo();
        actualizarDificultadContrarreloj(); // Es importante establecer la dificultad para el nuevo turno
        iniciarTimer();
    }

    function mostrarResumenFinalContrarreloj() {
        // Guardamos el resultado del último jugador
        const jugadorActual = jugadores[jugadorActualIndex];
        const totalPreguntas = aciertosTurno + fallosTurno;
        resumenContrarrelojData.push({
            nombre: jugadorActual.nombre,
            totalPreguntas: totalPreguntas,
            aciertos: aciertosTurno,
            fallos: fallosTurno,
            puntuacion: jugadorActual.puntuacion
        });

        // Ordenamos la tabla de resultados
        resumenContrarrelojData.sort((a, b) => {
            if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion; // Por puntos
            if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos; // Por aciertos
            return b.totalPreguntas - a.totalPreguntas; // Por total de preguntas
        });

        // Actualizamos la tabla con los datos finales y ordenados
        actualizarTablaResumen(resumenContrarrelojData);

        // Cambiamos el texto y el botón para el final
        tituloTransicionEl.textContent = "¡Resultados Finales!";
        document.getElementById('texto-siguiente-jugador').style.display = 'none';
        btnSiguienteJugador.textContent = "Ver Ganador y Dato Curioso";
        btnSiguienteJugador.onclick = () => {
            pantallaTransicionEl.style.display = 'none';
            finDelJuego();
        };

        // Mostramos la pantalla
        pantallaTransicionEl.style.display = 'flex';
    }

    function actualizarDificultadContrarreloj() {
        if (preguntasFacilesHechas < 4) {
            dificultadActualRonda = 'facil';
            preguntasFacilesHechas++;
        } else if (preguntasMediasHechas < 4) {
            dificultadActualRonda = 'medio';
            preguntasMediasHechas++;
        } else {
            dificultadActualRonda = 'dificil';
        }

        // Actualizamos la barra de color y texto
        const puntos = obtenerPuntosPorDificultad();
        dificultadRondaBarEl.classList.remove('facil', 'medio', 'dificil');
        dificultadRondaBarEl.classList.add(dificultadActualRonda);
        dificultadDisplay.textContent = `${dificultadActualRonda.toUpperCase()} +${puntos}`;
    }
    
    function actualizarTablaResumen(datos) {
        const tbodyResumenEl = document.getElementById('tbody-resumen-contrarreloj');
        tbodyResumenEl.innerHTML = ''; // Limpiamos la tabla antes de rellenarla
        datos.forEach(dato => {
            const filaHTML = `
                <tr>
                    <td>${dato.nombre}</td>
                    <td>${dato.totalPreguntas}</td>
                    <td>${dato.aciertos}</td>
                    <td>${dato.fallos}</td>
                    <td>${dato.puntuacion}</td>
                </tr>`;
            tbodyResumenEl.innerHTML += filaHTML;
        });
    }

    function toggleSonido() {
        sonidoActivado = !sonidoActivado; // Invierte el estado
        localStorage.setItem('sonidoActivado', sonidoActivado); // Guarda la preferencia
        actualizarIconoSonido();
    }

    function inicializarSonido() {
        const preferenciaGuardada = localStorage.getItem('sonidoActivado');
        // Si no hay nada guardado, se queda en 'true'. Si está guardado como 'false', se convierte a booleano.
        sonidoActivado = preferenciaGuardada !== 'false';
        actualizarIconoSonido();
    }

    function actualizarIconoSonido() {
        btnSonido.textContent = sonidoActivado ? '🔊' : '🔇';
    }

});
