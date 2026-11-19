'use strict';

        // ====================================
        // UTILIDADES (v3.1)
        // ====================================

        /** Aviso en pantalla accesible (sustituye a alert) */
        function showNotice(message) {
            const old = document.querySelector('.toast');
            if (old) old.remove();
            const el = document.createElement('div');
            el.className = 'toast';
            el.setAttribute('role', 'alert');
            el.textContent = message;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 6000);
        }

        /** Mapa de Google que se carga automáticamente */
        function createMapEmbed(container, src, title) {
            container.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.className = 'map-iframe';
            iframe.title = title;
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer-when-downgrade';
            iframe.src = src;
            container.appendChild(iframe);
        }

        /** Delegación de clics: sustituye a los onclick en línea (data-click="funcion(args)") */
        document.addEventListener('click', (e) => {
            let el = e.target.closest('[data-click]');
            while (el) {
                const m = el.dataset.click.match(/^([\w.]+)\((.*)\)$/s);
                if (m) {
                    const args = m[2].trim() === '' ? [] : m[2].split(',').map(a => {
                        a = a.trim();
                        if (a === 'this') return el;
                        if (a === 'event') return e;
                        if (/^'.*'$/.test(a)) return a.slice(1, -1);
                        if (/^-?\d+$/.test(a)) return Number(a);
                        return a;
                    });
                    if (m[1] === 'location.reload') location.reload();
                    else if (typeof window[m[1]] === 'function') window[m[1]](...args);
                }
                el = el.parentElement ? el.parentElement.closest('[data-click]') : null;
            }
        });

        // ====================================
        // SISTEMA TRILINGÜE
        // ====================================

        let currentLanguage = 'es'; // Idioma por defecto

        /**
         * Cambia el idioma de la interfaz
         */
        window.changeLanguage = function(lang) {
            currentLanguage = lang;

            // Actualizar clase del body
            document.body.className = lang;
            document.documentElement.lang = lang;

            // Actualizar botones
            const langEs = document.getElementById('lang-es');
            const langEn = document.getElementById('lang-en');
            const langFr = document.getElementById('lang-fr');
            
            if (langEs) langEs.classList.toggle('active', lang === 'es');
            if (langEn) langEn.classList.toggle('active', lang === 'en');
            if (langFr) langFr.classList.toggle('active', lang === 'fr');
            [langEs, langEn, langFr].forEach(b => b && b.setAttribute('aria-pressed', String(b.classList.contains('active'))));

            // Guardar preferencia
            try { localStorage.setItem('preferredLanguage', lang); } catch (e) { /* almacenamiento no disponible */ }

            // Recargar ubicación actual si estamos en una ubicación
            const locationContainer = document.getElementById('location-container');
            if (currentLocation >= 0 && locationContainer && !locationContainer.classList.contains('hidden')) {
                showLocation(currentLocation);
            }
        };

        /**
         * Obtiene el texto traducido según el idioma actual
         */
        function getTranslated(textEs, textEn, textFr) {
            if (currentLanguage === 'en') return textEn || textEs;
            if (currentLanguage === 'fr') return textFr || textEs;
            return textEs;
        }

        /**
         * Helper para aria-labels trilingües
         */
        function getAriaLabel(es, en, fr) {
            return getTranslated(es, en, fr);
        }

        // Sistema trilingüe continúa...

        // Estado de la aplicación
        let currentLocation = 0;
        let mainMap = null;
        let locationMap = null;
        let isLoading = false;
        let currentAudio = null;

        // Datos de las ubicaciones (contenido completo del segundo archivo)

        /**
         * Funciones del reproductor de audio
         */

        /**
         * Detiene el audio actual si existe
         */
        function stopCurrentAudio() {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
            }
            // Resetear todos los botones de play
            document.querySelectorAll('.play-btn').forEach(btn => {
                btn.textContent = '▶';
                btn.setAttribute('aria-label', getAriaLabel('Reproducir música', 'Play music', 'Lire la musique'));
            });
        }

        /**
         * Alterna entre reproducir y pausar el audio
         */
        window.togglePlay = function(index) {
            const loc = locations[index];
            const playBtn = document.getElementById(`play-btn-${index}`);

            // Validar que exista la URL de audio
            if (!loc || !loc.audioUrl) {
                                return;
            }

            // Validar que el botón exista
            if (!playBtn) {
                console.error('Botón de reproducción no encontrado');
                return;
            }

            // Si hay audio reproduciéndose y es el mismo
            if (currentAudio && currentAudio.dataset.index == index) {
                if (currentAudio.paused) {
                    // Reanudar reproducción
                    currentAudio.play().catch(error => {
                        console.error('Error al reproducir audio:', error);
                        showNotice('No se pudo reproducir el audio. Por favor, verifica que el archivo existe.');
                    });
                    playBtn.textContent = '⏸';
                    playBtn.setAttribute('aria-label', getAriaLabel('Pausar música', 'Pause music', 'Mettre en pause'));
                } else {
                    // Pausar reproducción
                    currentAudio.pause();
                    playBtn.textContent = '▶';
                    playBtn.setAttribute('aria-label', getAriaLabel('Reproducir música', 'Play music', 'Lire la musique'));
                }
            } else {
                // Detener audio actual si existe
                stopCurrentAudio();

                // Crear nuevo elemento de audio
                currentAudio = new Audio(loc.audioUrl);
                currentAudio.dataset.index = index;

                // Establecer volumen inicial del slider
                const volumeSlider = document.getElementById(`volume-slider-${index}`);
                if (volumeSlider) {
                    currentAudio.volume = volumeSlider.value / 100;
                } else {
                    currentAudio.volume = 0.7; // Volumen por defecto 70%
                }

                // Evento: error al cargar el audio
                currentAudio.addEventListener('error', (e) => {
                    console.error('Error al cargar el audio:', e);
                    showNotice('No se pudo cargar el archivo de audio. Verifica que la ruta es correcta.');
                    stopCurrentAudio();
                });

                // Evento: actualizar barra de progreso mientras se reproduce
                currentAudio.addEventListener('timeupdate', () => {
                    updateProgress(index);
                });

                // Evento: cuando termina la reproducción
                currentAudio.addEventListener('ended', () => {
                    playBtn.textContent = '▶';
                    playBtn.setAttribute('aria-label', getAriaLabel('Reproducir música', 'Play music', 'Lire la musique'));
                    currentAudio = null;
                });

                // Iniciar reproducción
                currentAudio.play().catch(error => {
                    console.error('Error al reproducir audio:', error);
                    showNotice('No se pudo reproducir el audio. Por favor, verifica que el archivo existe en la carpeta Musica/');
                    stopCurrentAudio();
                });

                playBtn.textContent = '⏸';
                playBtn.setAttribute('aria-label', getAriaLabel('Pausar música', 'Pause music', 'Mettre en pause'));
            }
        }

        /**
         * Establece el volumen del audio
         * @param {number} index - Índice de la ubicación
         * @param {number} value - Valor del volumen (0-100)
         */
        function setVolume(index, value) {
            if (currentAudio && currentAudio.dataset.index == index) {
                // Convertir de 0-100 a 0-1
                currentAudio.volume = Math.max(0, Math.min(1, value / 100));
            }
        }

        /**
         * Actualiza la barra de progreso del audio
         */
        function updateProgress(index) {
            if (!currentAudio || currentAudio.dataset.index != index) return;

            const progressFill = document.getElementById(`progress-fill-${index}`);
            const timeDisplay = document.getElementById(`time-${index}`);

            // Validar que los elementos existen
            if (!progressFill || !timeDisplay) {
                                return;
            }

            // Validar que la duración es válida
            if (!isNaN(currentAudio.duration) && currentAudio.duration > 0) {
                const percentage = (currentAudio.currentTime / currentAudio.duration) * 100;
                progressFill.style.width = Math.min(100, Math.max(0, percentage)) + '%';

                const currentTime = formatTime(currentAudio.currentTime);
                const duration = formatTime(currentAudio.duration);
                timeDisplay.textContent = `${currentTime} / ${duration}`;
            }
        }

        /**
         * Busca una posición específica en el audio
         */
        window.seekAudio = function(event, index) {
            if (!currentAudio || currentAudio.dataset.index != index) return;

            const progressBar = document.getElementById(`progress-bar-${index}`);

            // Validar que la barra de progreso existe
            if (!progressBar) {
                console.error('Barra de progreso no encontrada');
                return;
            }

            // Validar que la duración del audio es válida
            if (isNaN(currentAudio.duration) || currentAudio.duration <= 0) {
                                return;
            }

            try {
                const rect = progressBar.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, clickX / rect.width));

                currentAudio.currentTime = percentage * currentAudio.duration;
            } catch (error) {
                console.error('Error al buscar en el audio:', error);
            }
        }

        /**
         * Formatea segundos a formato mm:ss
         */
        function formatTime(seconds) {
            if (isNaN(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        /**
         * Inicializa el mapa principal con todos los puntos de interés
         */
        function initMainMap() {
            if (mainMap || isLoading) return;

            try {
                isLoading = true;

                // Verificar que el contenedor del mapa existe
                const mapContainer = document.getElementById('main-map');
                if (!mapContainer) {
                    console.error('Contenedor del mapa no encontrado');
                    isLoading = false;
                    return;
                }

                // Crear iframe de Google Maps mostrando Arévalo
                createMapEmbed(mapContainer, `https://maps.google.com/maps?q=IES+Adaja+Arévalo&hl=es&z=14&t=k&output=embed`, 'Mapa general de la ruta NarrArte Arévalo');

                mainMap = mapContainer;

            } catch (error) {
                console.error('Error al inicializar el mapa:', error);
                showNotice('Hubo un error al cargar el mapa. Por favor, recarga la página.');
            } finally {
                isLoading = false;
            }
        }

        /**
         * Inicia el tour ocultando la pantalla de bienvenida
         */
        window.startTour = function() {
            const welcomeEl = document.getElementById('welcome');
            welcomeEl.classList.add('hidden');
            welcomeEl.setAttribute('aria-hidden', 'true');
            showLocation(0);
        };

        /**
         * Navega a la siguiente ubicación
         */
        window.nextLocation = function() {
            if (currentLocation < locations.length - 1) {
                currentLocation++;
                showLocation(currentLocation);
            }
        }

        /**
         * Navega a la ubicación anterior
         */
        window.previousLocation = function() {
            if (currentLocation > 0) {
                currentLocation--;
                showLocation(currentLocation);
            }
        }

        /**
         * Vuelve a la pantalla inicial de bienvenida
         */
        window.goBackToHome = function() {
            // Detener cualquier audio que esté reproduciéndose
            stopCurrentAudio();
            
            // Ocultar el contenedor de ubicaciones
            const locationContainer = document.getElementById('location-container');
            locationContainer.classList.add('hidden');
            locationContainer.setAttribute('aria-hidden', 'true');
            
            // Mostrar la pantalla de bienvenida
            const welcomeEl = document.getElementById('welcome');
            welcomeEl.classList.remove('hidden');
            welcomeEl.removeAttribute('aria-hidden');
            
            // Resetear la ubicación actual
            currentLocation = 0;
            
            // Hacer scroll al inicio
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        /**
         * Muestra una ubicación específica
         * @param {number} index - Índice de la ubicación a mostrar
         */
        function showLocation(index) {
            // Detener audio actual al cambiar de ubicación
            stopCurrentAudio();
            if (typeof stopAllTextAudio === 'function') stopAllTextAudio();

            // Validar índice
            if (index < 0 || index >= locations.length) {
                console.error('Índice de ubicación inválido:', index);
                return;
            }

            const container = document.getElementById('location-container');
            container.classList.remove('hidden');
            container.removeAttribute('aria-hidden');

            const loc = locations[index];

            // Seleccionar contenido según idioma
            const title = getTranslated(loc.title, loc.title_en, loc.title_fr);
            const subtitle = loc.subtitle ? getTranslated(loc.subtitle, loc.subtitle_en, loc.subtitle_fr) : '';
            const content = loc.content; // El contenido ya incluye todos los idiomas con clases CSS

            const prevDis = index === 0 ? 'disabled' : '';
            const nextDis = index === locations.length - 1 ? 'disabled' : '';

            // Generar HTML de videos con lazy loading
            let videos = '';
            if (loc.videos && loc.videos.length > 0) {
                videos = '<div class="video-container"><h3 class="video-title"><span class="lang-es-inline">🎥 Vídeos</span><span class="lang-en-inline">🎥 Videos</span><span class="lang-fr-inline">🎥 Vidéos</span></h3>';
                loc.videos.forEach((id, i) => {
                    videos += `
                        <div class="video-wrapper">
                            <iframe
                                src="https://www.youtube-nocookie.com/embed/${id}"
                                title="Vídeo ${i + 1} de ${title}"
                                allowfullscreen
                                loading="lazy"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                            </iframe>
                        </div>
                    `;
                });
                videos += '</div>';
            }

            // Escapar HTML para prevenir XSS
            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            container.innerHTML = `
                <article class="location-card">
                    <header class="location-header">
                        <h2 class="location-title">${escapeHtml(title)}
                       <img src="Imagenes/LogoAdaja.png" alt="IES Adaja" width="75" height="75" loading="lazy" class="float-right"/>
                       <img src="Imagenes/AyuntArevalo.png" alt="Ayuntamiento Arévalo" width="75" height="75" loading="lazy" class="float-right"/>
</h2>
                        ${subtitle ? `<p class="location-subtitle">${escapeHtml(subtitle)}</p>` : ''}


                   </header>

                    ${loc.music ? `
                        <div class="music-note" role="note">
                            <div class="music-header">
                                <span aria-hidden="true">🎵</span>
                                <span class="music-title">${escapeHtml(loc.music)}</span>
                            </div>
                            ${loc.audioUrl ? `
                                <div class="audio-player">
                                    <div class="audio-controls">
                                        <button class="play-btn" id="play-btn-${index}" data-click="togglePlay(${index})" aria-label="${getAriaLabel('Reproducir música', 'Play music', 'Lire la musique')}">
                                            ▶
                                        </button>
                                        <div class="volume-control">
                                            <span aria-hidden="true">🔊</span>
                                            <input
                                                type="range"
                                                class="volume-slider"
                                                id="volume-slider-${index}"
                                                min="0"
                                                max="100"
                                                value="70"
                                                oninput="setVolume(${index}, this.value)"
                                                aria-label="Volume control"
                                            />
                                        </div>
                                    </div>
                                    <div class="audio-progress">
                                        <div class="progress-bar" id="progress-bar-${index}" data-click="seekAudio(event, ${index})">
                                            <div class="progress-fill" id="progress-fill-${index}"></div>
                                        </div>
                                    </div>
                                    <div class="audio-time" id="time-${index}">0:00 / 0:00</div>
                                </div>

                            ` : ''}
                        </div>
                    ` : ''}

                    <div id="loc-map" class="map-container" role="region" aria-label="Map of ${escapeHtml(title)}"></div>

                    <div class="center-my-15">
                        <a
                            href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${loc.coords[0]},${loc.coords[1]}"
                            target="_blank"
                            class="btn link-btn"
                           
                            aria-label="${getAriaLabel('Ver en Street View', 'View on Street View', 'Voir sur Street View')}">
                            <span class="lang-es-inline">📍 Ver en Street View</span>
                            <span class="lang-en-inline">📍 View on Street View</span>
                            <span class="lang-fr-inline">📍 Voir sur Street View</span>
                        </a>
                    </div>

                    ${videos}

                    <section class="content-section">
                        ${content}
                    </section>

  <div class="progress" role="status" aria-live="polite">
    <span class="lang-es-inline">Parada ${loc.customNumber || (index + 1)} de ${locations.length}</span>
    <span class="lang-en-inline">Stop ${loc.customNumber || (index + 1)} of ${locations.length}</span>
    <span class="lang-fr-inline">Arrêt ${loc.customNumber || (index + 1)} de ${locations.length}</span>
</div>

                    <nav class="navigation" aria-label="Navegación entre ubicaciones">
                        <button
                            class="btn"
                            data-click="previousLocation()"
                            ${prevDis}
                            aria-label="Ir a la parada anterior">
                            <span class="lang-es-inline">← Anterior</span>
                            <span class="lang-en-inline">← Previous</span>
                    <span class="lang-fr-inline">← Précédent</span>
                        </button>
                        <button
                            class="btn btn-secondary"
                            data-click="nextLocation()"
                            ${nextDis}
                            aria-label="Ir a la siguiente parada">
                            <span class="lang-es-inline">Siguiente →</span>
                            <span class="lang-en-inline">Next →</span>
                    <span class="lang-fr-inline">Suivant →</span>
                        </button>
                    </nav>

                    <div class="center-mt-20">
                        <button class="btn" data-click="goBackToHome()">
                            🏠 <span class="lang-es-inline">Volver al inicio</span><span class="lang-en-inline">Back to start</span><span class="lang-fr-inline">Retour au début</span>
                        </button>
                    </div>

                    ${index < locations.length - 1 ? `
                        <div class="center-divider">
                            <a
                                href="https://www.google.com/maps/dir/?api=1&origin=${loc.coords[0]},${loc.coords[1]}&destination=${locations[index + 1].coords[0]},${locations[index + 1].coords[1]}&travelmode=walking"
                                target="_blank"
                                class="btn btn-secondary link-btn link-btn--wide"
                               
                                aria-label="Go to next location on Google Maps">
                                <span class="lang-es-inline">🚶 Ir a la siguiente parada en Google Maps</span>
                                <span class="lang-en-inline">🚶 Go to next stop on Google Maps</span>
                    <span class="lang-fr-inline">🚶 Aller à l'arrêt suivant sur Google Maps</span>
                            </a>
                        </div>
                    ` : ''}
                </article>
            `;

            // Inicializar mapa de la ubicación con timeout para asegurar que el DOM esté listo
            setTimeout(() => {
                try {
                    // Limpiar mapa anterior si existe
                    if (locationMap) {
                        locationMap = null;
                    }

                    // Verificar que el contenedor existe
                    const mapContainer = document.getElementById('loc-map');
                    if (!mapContainer) {
                        console.error('Contenedor del mapa de ubicación no encontrado');
                        return;
                    }

                    // Crear iframe de Google Maps
                    createMapEmbed(mapContainer, `https://maps.google.com/maps?q=${loc.coords[0]},${loc.coords[1]}&hl=es&z=17&t=k&output=embed`, 'Mapa: ' + loc.title);

                    locationMap = mapContainer;

                } catch (error) {
                    console.error('Error al crear el mapa de ubicación:', error);
                }
            }, 100);

            // Scroll suave al inicio
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        /**
         * Inicialización al cargar la página
         */
        window.addEventListener('load', () => {
            // Inicializar mapa principal con un pequeño delay
            setTimeout(initMainMap, 500);
        });

        // Manejo de errores global
        window.addEventListener('error', (event) => {
            console.error('Error global:', event.error);
        });

        /**
         * Lightbox: Ampliar imágenes al hacer clic
         */
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('location-image')) {
                const img = e.target;

                // Validar que la imagen tiene una URL válida
                if (!img.src) {
                    return;
                }

                // Crear overlay oscuro
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.95);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: zoom-out;
                    animation: fadeIn 0.3s ease;
                `;
                overlay.setAttribute('role', 'dialog');
                overlay.setAttribute('aria-modal', 'true');
                overlay.setAttribute('aria-label', 'Vista ampliada de imagen');

                // Crear imagen ampliada
                const bigImg = document.createElement('img');
                bigImg.src = img.src;
                bigImg.alt = img.alt || 'Imagen ampliada';
                bigImg.style.cssText = `
                    max-width: 95%;
                    max-height: 95%;
                    box-shadow: 0 0 50px rgba(0,0,0,0.8);
                    border-radius: 8px;
                    animation: zoomIn 0.3s ease;
                `;

                // Manejar error de carga de imagen
                bigImg.onerror = () => {
                    console.error('Error al cargar la imagen');
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                        document.body.style.overflow = '';
                    }
                };

                // Botón de cerrar
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '✕';
                closeBtn.style.cssText = `
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 2px solid white;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    font-size: 24px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                `;
                closeBtn.setAttribute('aria-label', 'Cerrar imagen ampliada');
                closeBtn.setAttribute('type', 'button');

                closeBtn.onmouseover = () => {
                    closeBtn.style.background = 'rgba(255,255,255,0.3)';
                    closeBtn.style.transform = 'scale(1.1)';
                };
                closeBtn.onmouseout = () => {
                    closeBtn.style.background = 'rgba(255,255,255,0.2)';
                    closeBtn.style.transform = 'scale(1)';
                };

                // Pie de foto en el lightbox
                if (img.nextElementSibling && img.nextElementSibling.classList.contains('image-caption')) {
                    const caption = document.createElement('div');
                    caption.textContent = img.nextElementSibling.textContent;
                    caption.style.cssText = `
                        position: absolute;
                        bottom: 30px;
                        left: 50%;
                        transform: translateX(-50%);
                        color: white;
                        background: rgba(0,0,0,0.7);
                        padding: 10px 20px;
                        border-radius: 20px;
                        font-size: 1em;
                        max-width: 80%;
                        text-align: center;
                    `;
                    overlay.appendChild(caption);
                }

                overlay.appendChild(bigImg);
                overlay.appendChild(closeBtn);
                document.body.appendChild(overlay);

                // Prevenir scroll del body
                document.body.style.overflow = 'hidden';

                // Enfocar el botón de cerrar para accesibilidad
                setTimeout(() => closeBtn.focus(), 100);

                // Cerrar al hacer clic en el overlay o botón
                const cerrarLightbox = () => {
                    overlay.style.animation = 'fadeOut 0.3s ease';
                    setTimeout(() => {
                        if (document.body.contains(overlay)) {
                            document.body.removeChild(overlay);
                            document.body.style.overflow = '';
                        }
                    }, 300);
                };

                overlay.addEventListener('click', function(e) {
                    if (e.target === overlay || e.target === closeBtn) {
                        cerrarLightbox();
                    }
                });

                // Cerrar con tecla ESC
                const escHandler = (event) => {
                    if (event.key === 'Escape') {
                        cerrarLightbox();
                        document.removeEventListener('keydown', escHandler);
                    }
                };
                document.addEventListener('keydown', escHandler);
            }
        });

        // ====================================
        // INICIALIZACIÓN DEL SISTEMA TRILINGÜE
        // ====================================

        // Cargar idioma preferido al iniciar la página
        window.addEventListener('DOMContentLoaded', () => {
            let savedLang = 'es';
            try { savedLang = localStorage.getItem('preferredLanguage') || 'es'; } catch (e) { /* sin almacenamiento */ }
            if (!['es', 'en', 'fr'].includes(savedLang)) savedLang = 'es';
            if (typeof window.changeLanguage === 'function') {
                window.changeLanguage(savedLang);
            }
            
            // Generar botones de ubicaciones
            generateLocationButtons();
        });
        
        /**
         * Genera los botones numerados para cada ubicación
         */
        function generateLocationButtons() {
            const grid = document.getElementById('locations-grid');
            if (!grid || !locations) return;
            
            locations.forEach((location, index) => {
                const button = document.createElement('button');
                button.className = 'btn';
                button.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 12px;
                    padding: 15px 20px;
                    text-align: left;
                    background: linear-gradient(135deg, var(--brand-blue), var(--brand-blue-dark));
                    color: white;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    font-size: 14px;
                    width: 100%;
                `;
                
                // Número del botón
                const number = document.createElement('span');
                number.style.cssText = `
                    background: white;
                    color: var(--primary-color);
                    width: 35px;
                    height: 35px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 16px;
                    flex-shrink: 0;
                `;
 number.textContent = location.customNumber || (index + 1);
                
// Texto del botón (trilingüe con subtítulo)
const textContainer = document.createElement('span');
textContainer.style.cssText = `
    flex: 1;
    overflow: hidden;
    line-height: 1.4;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

// Contenedor del título
const titleContainer = document.createElement('div');
titleContainer.style.cssText = `
    font-weight: bold;
    font-size: 15px;
`;

const textEs = document.createElement('span');
textEs.className = 'lang-es-inline';
textEs.textContent = location.title;

const textEn = document.createElement('span');
textEn.className = 'lang-en-inline';
textEn.textContent = location.title_en || location.title;

const textFr = document.createElement('span');
textFr.className = 'lang-fr-inline';
textFr.textContent = location.title_fr || location.title;

titleContainer.appendChild(textEs);
titleContainer.appendChild(textEn);
titleContainer.appendChild(textFr);

// Contenedor del subtítulo (si existe)
let subtitleContainer = null;
if (location.subtitle) {
    subtitleContainer = document.createElement('div');
    subtitleContainer.style.cssText = `
        font-size: 12px;
        opacity: 0.9;
        font-weight: normal;
        font-style: italic;
    `;
    
    const subEs = document.createElement('span');
    subEs.className = 'lang-es-inline';
    subEs.textContent = location.subtitle;
    
    const subEn = document.createElement('span');
    subEn.className = 'lang-en-inline';
    subEn.textContent = location.subtitle_en || location.subtitle;
    
    const subFr = document.createElement('span');
    subFr.className = 'lang-fr-inline';
    subFr.textContent = location.subtitle_fr || location.subtitle;
    
    subtitleContainer.appendChild(subEs);
    subtitleContainer.appendChild(subEn);
    subtitleContainer.appendChild(subFr);
}

// Añadir título y subtítulo al contenedor
textContainer.appendChild(titleContainer);
if (subtitleContainer) {
    textContainer.appendChild(subtitleContainer);
}                
                button.appendChild(number);
                button.appendChild(textContainer);
                
                // Evento click para ir a la ubicación
                button.onclick = () => {
                    // Ocultar pantalla de bienvenida
                    const welcomeEl = document.getElementById('welcome');
                    welcomeEl.classList.add('hidden');
                    welcomeEl.setAttribute('aria-hidden', 'true');
                    
                    // Ir a la ubicación
                    currentLocation = index;
                    showLocation(index);
                };
                
                // Efectos hover
                button.onmouseenter = () => {
                    button.style.transform = 'translateY(-3px)';
                    button.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
                };
                button.onmouseleave = () => {
                    button.style.transform = 'translateY(0)';
                    button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                };
                
                grid.appendChild(button);
            });
        }
    
// ====================================
// SISTEMA DE AUDIO PARA TEXTOS - VERSIÓN CORREGIDA
// ====================================

let currentTextAudio = null;

/**
 * Reproduce/pausa audio de un texto - VERSIÓN CORREGIDA
 */
window.toggleTextAudio = function(button) {
    const container = button.closest('.audio-text-player');
    const audioUrl = container.dataset.audio;
    const progressFill = container.querySelector('.audio-text-progress-fill');
    const timeDisplay = container.querySelector('.audio-text-time');
    
    // Si hay audio reproduciéndose y es el mismo
    if (currentTextAudio && currentTextAudio.audio.dataset.source === audioUrl) {
        if (currentTextAudio.audio.paused) {
            // Reanudar reproducción
            currentTextAudio.audio.play();
            button.classList.add('playing');
            updateButtonText(button, 'Pausar', 'Pause', 'Pause');
        } else {
            // Pausar reproducción
            currentTextAudio.audio.pause();
            button.classList.remove('playing');
            updateButtonText(button, 'Escuchar', 'Listen', 'Écouter');
        }
    } else {
        // Detener audio anterior
        stopAllTextAudio();
        
        // Crear nuevo audio
        const audio = new Audio(audioUrl);
        audio.dataset.source = audioUrl;
        
        currentTextAudio = {
            audio: audio,
            button: button,
            progressFill: progressFill,
            timeDisplay: timeDisplay,
            container: container
        };
        
        // Eventos
        audio.addEventListener('timeupdate', () => {
            if (currentTextAudio && currentTextAudio.audio === audio) {
                const percentage = (audio.currentTime / audio.duration) * 100;
                progressFill.style.width = percentage + '%';
                timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
            }
        });
        
        audio.addEventListener('ended', () => {
            button.classList.remove('playing');
            updateButtonText(button, 'Escuchar', 'Listen', 'Écouter');
            progressFill.style.width = '0%';
        });
        
        audio.addEventListener('error', (e) => {
            console.error('Error al cargar audio:', e);
            showNotice('No se pudo cargar el archivo de audio. Verifica la ruta: ' + audioUrl);
            stopAllTextAudio();
        });
        
        audio.play();
        button.classList.add('playing');
        updateButtonText(button, 'Pausar', 'Pause', 'Pause');
    }
};

/**
 * Busca una posición en el audio de texto
 */
window.seekTextAudio = function(event, progressBar) {
    if (!currentTextAudio) return;
    
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    currentTextAudio.audio.currentTime = percentage * currentTextAudio.audio.duration;
};

/**
 * Reproduce audio inline (para poemas/citas)
 */
window.playInlineAudio = function(button) {
    const audioUrl = button.dataset.audio;
    
    // Si ya está reproduciéndose este audio, pausarlo
    if (currentTextAudio && currentTextAudio.audio.dataset.source === audioUrl) {
        if (!currentTextAudio.audio.paused) {
            currentTextAudio.audio.pause();
            button.classList.remove('playing');
            updateInlineButtonText(button, 'Escuchar', 'Listen', 'Écouter');
            return;
        } else {
            currentTextAudio.audio.play();
            button.classList.add('playing');
            updateInlineButtonText(button, 'Pausar', 'Pause', 'Pause');
            return;
        }
    }
    
    // Detener audio anterior
    stopAllTextAudio();
    
    // Crear y reproducir nuevo audio
    const audio = new Audio(audioUrl);
    audio.dataset.source = audioUrl;
    
    currentTextAudio = {
        audio: audio,
        button: button
    };
    
    audio.addEventListener('ended', () => {
        button.classList.remove('playing');
        updateInlineButtonText(button, 'Escuchar', 'Listen', 'Écouter');
    });
    
    audio.addEventListener('error', (e) => {
        console.error('Error al cargar audio:', e);
        showNotice('No se pudo cargar el archivo de audio. Verifica la ruta: ' + audioUrl);
        button.classList.remove('playing');
        updateInlineButtonText(button, 'Escuchar', 'Listen', 'Écouter');
    });
    
    audio.play();
    button.classList.add('playing');
    updateInlineButtonText(button, 'Pausar', 'Pause', 'Pause');
};

/**
 * Detiene todos los audios de texto
 */
function stopAllTextAudio() {
    if (currentTextAudio) {
        currentTextAudio.audio.pause();
        currentTextAudio.audio.currentTime = 0;
        
        if (currentTextAudio.button) {
            currentTextAudio.button.classList.remove('playing');
            
            if (currentTextAudio.button.classList.contains('audio-text-btn')) {
                updateButtonText(
                    currentTextAudio.button, 
                    'Escuchar', 
                    'Listen', 
                    'Écouter'
                );
            } else if (currentTextAudio.button.classList.contains('audio-inline-btn')) {
                updateInlineButtonText(
                    currentTextAudio.button,
                    'Escuchar',
                    'Listen',
                    'Écouter'
                );
            }
        }
        
        if (currentTextAudio.progressFill) {
            currentTextAudio.progressFill.style.width = '0%';
        }
        
        currentTextAudio = null;
    }
}

/**
 * Actualiza el texto de un botón según el idioma (para botones completos)
 */
function updateButtonText(button, es, en, fr) {
    const spans = button.querySelectorAll('span');
    if (spans.length > 0) {
        // Si tiene spans (versión trilingüe)
        spans.forEach(span => {
            if (span.classList.contains('lang-es-inline')) {
                span.textContent = es;
            } else if (span.classList.contains('lang-en-inline')) {
                span.textContent = en;
            } else if (span.classList.contains('lang-fr-inline')) {
                span.textContent = fr;
            }
        });
    } else {
        // Si no tiene spans (versión simple)
        button.innerHTML = `🔊 ${es}`;
    }
}

/**
 * Actualiza el texto de botones inline según el idioma
 */
function updateInlineButtonText(button, es, en, fr) {
    const spans = button.querySelectorAll('span');
    if (spans.length > 0) {
        // Si tiene spans (versión trilingüe)
        spans.forEach(span => {
            if (span.classList.contains('lang-es-inline')) {
                span.textContent = es;
            } else if (span.classList.contains('lang-en-inline')) {
                span.textContent = en;
            } else if (span.classList.contains('lang-fr-inline')) {
                span.textContent = fr;
            }
        });
    } else {
        // Si no tiene spans (versión simple)
        button.innerHTML = `🎧 ${es}`;
    }
}

// ====================================
// SISTEMA DE CÓDIGOS QR - DEEP LINKING
// ====================================

/**
 * Detecta si hay un parámetro location en la URL 
 * y va directamente a esa ubicación
 * 
 * Ejemplo de uso:
 * https://narrarte-arevalo.github.io/?location=0  → Va a la primera ubicación
 * https://narrarte-arevalo.github.io/?location=5  → Va a la sexta ubicación
 */
function checkDeepLink() {
    // Obtener parámetros de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const locationParam = urlParams.get('location');
    
    // Si hay parámetro location
    if (locationParam !== null) {
        const locationIndex = parseInt(locationParam, 10);
        
        // Validar que el índice sea válido
        if (!isNaN(locationIndex) && locationIndex >= 0 && locationIndex < locations.length) {
            
            // Ocultar pantalla de bienvenida
            const welcomeEl = document.getElementById('welcome');
            if (welcomeEl) {
                welcomeEl.classList.add('hidden');
                welcomeEl.setAttribute('aria-hidden', 'true');
            }
            
            // Pequeño delay para asegurar que todo está cargado
            setTimeout(() => {
                currentLocation = locationIndex;
                showLocation(locationIndex);
                
                // Hacer scroll al inicio
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 300);
        } else {
            console.warn(`⚠️ Índice de ubicación inválido: ${locationParam}`);
        }
    }
}

// Ejecutar cuando el DOM esté completamente cargado
// IMPORTANTE: Este listener debe ejecutarse DESPUÉS de que 
// se haya definido el array locations
window.addEventListener('DOMContentLoaded', () => {
    // Esperar un momento para asegurar que locations está definido
    setTimeout(checkDeepLink, 100);
});