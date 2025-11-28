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

    // --- API Keys ---
    // IMPORTANTE: Pega aquí tu API Key de OpenWeatherMap.
    const OPENWEATHER_API_KEY = '027a67e8eee987d305a58e66caa8f448'; 

    // Estado del juego
    const esModoContrarreloj = urlParams.get('modo') === 'contrarreloj';
    let ciudades = [];
    let ciudadActual = null;
    let ciudadesMostradas = []; // Guardará los objetos de ciudad completos para evitar repetición de imágenes.
    let userLocation = null; // Para guardar la ubicación del usuario
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
    let duracionInicialContrarreloj = 60; // Guardamos la duración inicial para calcular el % de la barra
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
    solicitarUbicacionUsuario(); // Pide la ubicación al usuario al iniciar

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
        let ciudadesDisponibles = ciudades.filter(c => c.dificultad === dificultadActualRonda && !ciudadesMostradas.includes(c));

        if (ciudadesDisponibles.length === 0) {
            if (ciudades.filter(c => c.dificultad === dificultadActualRonda).length > 0) {
                alert(`No hay ciudades para el nivel "${dificultadActualRonda}". Se intentará con otro nivel.`);
                seleccionarDificultadAleatoria(); // Cambiamos de nivel
                mostrarPregunta(); // E intentamos de nuevo
                return;
             }
        }

        // Seleccionar ciudad y opciones
        ciudadActual = ciudadesDisponibles[Math.floor(Math.random() * ciudadesDisponibles.length)];
        ciudadesMostradas.push(ciudadActual);

        // --- LÓGICA MEJORADA PARA LAS OPCIONES (País -> Continente -> Dificultad) ---
        const opciones = [ciudadActual];
        let poolOpcionesIncorrectas = [];

        // 1. Intentar encontrar opciones del MISMO PAÍS (sin importar dificultad)
        poolOpcionesIncorrectas = ciudades.filter(c => 
            c.pais === ciudadActual.pais && c.nombre !== ciudadActual.nombre
        );

        // 2. Si no hay suficientes, buscar en el MISMO CONTINENTE (sin importar dificultad)
        if (poolOpcionesIncorrectas.length < 2) {
            const opcionesContinente = ciudades.filter(c => 
                c.continente === ciudadActual.continente && c.nombre !== ciudadActual.nombre
            );
            // Usamos un Set para evitar duplicados si algunas ciudades ya estaban en el pool de país
            poolOpcionesIncorrectas = [...new Set([...poolOpcionesIncorrectas, ...opcionesContinente])];
        }

        // 3. Como último recurso, rellenar con la MISMA DIFICULTAD (lógica anterior)
        if (poolOpcionesIncorrectas.length < 2) {
            const opcionesDificultad = ciudades.filter(c => 
                c.dificultad === dificultadActualRonda && c.nombre !== ciudadActual.nombre
            );
            poolOpcionesIncorrectas = [...new Set([...poolOpcionesIncorrectas, ...opcionesDificultad])];
        }

        // Comprobar si, después de todo, tenemos suficientes opciones.
        if (poolOpcionesIncorrectas.length < 2) {
            alert(`No hay suficientes ciudades para generar opciones para "${ciudadActual.nombre}". Se intentará con otra ciudad.`);
            seleccionarDificultadAleatoria(); // Cambiamos de nivel
            mostrarPregunta(); // E intentamos de nuevo
            return;
        }

        // Elegir 2 opciones incorrectas del pool que hemos creado
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

    async function verificarRespuesta(esCorrecta) {
        // Deshabilitar botones de opción
        document.querySelectorAll('#opciones-container button').forEach(btn => btn.disabled = true);

        const puntos = obtenerPuntosPorDificultad();
        const [flagHtml, weatherData] = await Promise.all([
            fetchCountryFlag(ciudadActual.pais),
            fetchWeather(ciudadActual.nombre, ciudadActual.pais) // Pasamos también el país
        ]);

        let distanciaHtml = '';
        if (userLocation && weatherData.coords) {
            const distancia = calcularDistancia(userLocation.latitude, userLocation.longitude, weatherData.coords.lat, weatherData.coords.lon);
            distanciaHtml = `<span title="Distancia desde tu ubicación">📍 ${distancia.toLocaleString('es-ES', { maximumFractionDigits: 0 })} km</span>`;
        }

        solucionContainer.classList.remove('correcto', 'incorrecto'); // Limpiar clases de color previas

        if (esCorrecta) {
            jugadores[jugadorActualIndex].puntuacion += puntos;
            solucionContainer.innerHTML = `${ciudadActual.nombre} (${ciudadActual.pais}) ${flagHtml} ${weatherData.html} ${distanciaHtml}`;
            solucionContainer.classList.add('correcto');
            if (sonidoActivado) sonidoCorrecto.play(); // ¡Suena el acierto!
            if (esModoContrarreloj) {
                aciertosTurno++;
            }
        } else {
            solucionContainer.innerHTML = `${ciudadActual.nombre} (${ciudadActual.pais}) ${flagHtml} ${weatherData.html} ${distanciaHtml}`;
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

            // Actualizar el título del dato curioso con el nombre de la ciudad
            const tituloDatoCurioso = datoCuriosoContainer.querySelector('h3');
            if (tituloDatoCurioso) {
                // Usamos textContent para evitar problemas de seguridad (aunque aquí es seguro)
                tituloDatoCurioso.textContent = `Dato curioso sobre ${ciudadParaDato}, una de las ciudades que se te resistió`;
            }

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
                    const map = L.map('map-container').setView([coordenadas.lat, coordenadas.lon], 4); // Zoom 4 para ver continente

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
        const barraTiempoContainer = document.getElementById('contenedor-barra-tiempo');
        const barraTiempo = document.getElementById('barra-tiempo');

        // Hacemos visible y reiniciamos la barra
        barraTiempoContainer.style.display = 'block';
        barraTiempo.classList.remove('critico');
        
        // 1. Reseteamos la barra al 100% sin transición para que sea instantáneo
        barraTiempo.style.transition = 'none';
        barraTiempo.style.width = '100%';

        // 2. Forzamos un 'reflow' para que el navegador aplique el estilo del 100%
        // antes de aplicar la nueva transición. Es un pequeño truco de rendimiento.
        barraTiempo.offsetHeight; 

        // 3. Aplicamos la transición suave y le decimos que vaya a 0%
        barraTiempo.style.transition = `width ${duracionInicialContrarreloj}s linear`;
        barraTiempo.style.width = '0%';

        actualizarDisplayTimer(); // Muestra el tiempo inicial
        intervaloTimer = setInterval(() => {
            tiempoRestante--;
            actualizarDisplayTimer();
            if (tiempoRestante <= 0) {
                clearInterval(intervaloTimer);
                // Ocultamos la barra cuando el tiempo se acaba
                barraTiempoContainer.style.display = 'none';
                
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
        const barraTiempo = document.getElementById('barra-tiempo');
        contadorJuegoEl.innerHTML = `Tiempo: <span id="tiempo">${tiempoRestante}</span>`;

        // Lógica para el estado crítico (texto y barra)
        if (tiempoRestante <= 10 && tiempoRestante > 0) {
            contadorJuegoEl.classList.add('timer-danger');
            barraTiempo.classList.add('critico');
        } else {
            contadorJuegoEl.classList.remove('timer-danger');
            barraTiempo.classList.remove('critico');
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
        tiempoRestante = duracionInicialContrarreloj; // Reiniciamos el tiempo
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
    
    // Función para obtener la bandera del país
    async function fetchCountryFlag(countryNameSpanish) {
        const englishCountryName = getEnglishCountryName(countryNameSpanish);
        try {
            const response = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(englishCountryName)}?fields=flags`);
            if (response.ok) {
                const data = await response.json();
                // La API puede devolver múltiples resultados, tomamos el primero
                if (data && data.length > 0 && data[0].flags && data[0].flags.png) {
                    return `<img src="${data[0].flags.png}" alt="Bandera de ${countryNameSpanish}" class="flag-icon">`;
                }
            }
            // Si no se encuentra la bandera o hay un error, no devolvemos nada
            return '';
        } catch (error) {
            console.error(`Error al obtener la bandera para ${countryNameSpanish}:`, error);
            return '';
        }
    }

    // Función para mapear nombres de países en español a inglés para la API
    function getEnglishCountryName(spanishName) {
        const countryMap = {
            "España": "Spain",
            "Países Bajos": "Netherlands",
            "EE.UU.": "United States",
            "Estados Unidos": "United States",
            "Reino Unido": "United Kingdom",
            "República Checa": "Czech Republic",
            "Ciudad del Vaticano": "Vatican City",
            "Emiratos Árabes Unidos": "United Arab Emirates",
            "Marruecos": "Morocco",
            "Myanmar": "Myanmar",
            "Laos": "Laos",
            "Mali": "Mali",
            "Uzbekistán": "Uzbekistan",
            "Tanzania": "Tanzania",
            "Eslovenia": "Slovenia",
            "Hungría": "Hungary",
            "Rumanía": "Romania",
            "Dinamarca": "Denmark",
            "Croacia": "Croatia",
            "Finlandia": "Finland",
            "Suecia": "Sweden",
            "Noruega": "Norway",
            "Bélgica": "Belgium",
            "Alemania": "Germany",
            "Francia": "France" // Agrega más si encuentras problemas con otros nombres
        };
        return countryMap[spanishName] || spanishName; // Devuelve el nombre mapeado o el original si no se encuentra
    }

    // Función para obtener el código ISO de 2 letras del país
    function getCountryCode(spanishCountryName) {
        const codeMap = {
            "España": "ES", "Portugal": "PT", "Francia": "FR", "Italia": "IT",
            "Alemania": "DE", "Reino Unido": "GB", "EE.UU.": "US", "Estados Unidos": "US",
            "Bélgica": "BE", "Países Bajos": "NL", "Grecia": "GR", "Rumanía": "RO",
            "Hungría": "HU", "Argentina": "AR", "Sudáfrica": "ZA", "Dinamarca": "DK",
            "Croacia": "HR", "Egipto": "EG", "Turquía": "TR", "Suecia": "SE",
            "Finlandia": "FI", "Japón": "JP", "China": "CN", "Rusia": "RU",
            "Emiratos Árabes Unidos": "AE", "Perú": "PE", "Jordania": "JO",
            "República Checa": "CZ", "Ecuador": "EC", "Islandia": "IS", "Brasil": "BR",
            "Corea del Sur": "KR", "Australia": "AU", "Singapur": "SG", "Austria": "AT",
            "India": "IN", "México": "MX", "Irlanda": "IE", "Malta": "MT",
            "Noruega": "NO", "Camboya": "KH", "Myanmar": "MM", "Tailandia": "TH",
            "Nepal": "NP", "Laos": "LA", "Eslovenia": "SI", "Marruecos": "MA",
            "Uzbekistán": "UZ", "Tanzania": "TZ", "Mali": "ML", "Ciudad del Vaticano": "VA"
            // Añadir más si es necesario
        };
        return codeMap[spanishCountryName];
    }

    // Función para obtener el clima de la ciudad
    async function fetchWeather(cityName, countryName) {
        if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === 'TU_API_KEY_AQUI') {
            console.warn('Falta la API Key de OpenWeatherMap en juego.js');
            return { html: '', coords: null }; // Devolvemos un objeto vacío
        }
        const countryCode = getCountryCode(countryName);
        const query = countryCode ? `${cityName},${countryCode}` : cityName; // Usamos el código de país si lo tenemos

        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=es`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                const temp = Math.round(data.main.temp);
                const weatherHtml = `<span title="${data.weather[0].description}">🌡️ ${temp}°C</span>`;
                return { html: weatherHtml, coords: data.coord };
            }
            // Si la respuesta no es 'ok', lo registramos en la consola para depuración
            const errorData = await response.json();
            console.warn(`OpenWeatherMap no encontró la ciudad "${cityName}" o hubo un error:`, errorData.message);
            return { html: '', coords: null }; 

        } catch (error) {
            console.error(`Error al obtener el clima para ${cityName}:`, error);
            return { html: '', coords: null };
        }
    }

    // Función para solicitar la ubicación del usuario
    function solicitarUbicacionUsuario() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    console.log('Ubicación del usuario obtenida:', userLocation);
                },
                (error) => {
                    console.warn('El usuario no permitió el acceso a la ubicación:', error.message);
                    // No es un error crítico, el juego puede continuar sin esta función.
                }
            );
        } else {
            console.warn('La geolocalización no está disponible en este navegador.');
        }
    }

    // Función para calcular la distancia entre dos puntos (fórmula de Haversine)
    function calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distancia = R * c;
        return distancia;
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
