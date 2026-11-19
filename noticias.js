/*
 * Página de noticias - NarrArte Arévalo
 *
 * PARA AÑADIR UNA NOTICIA: copia una línea de ejemplo dentro de NOTICIAS,
 * quita las barras // del principio y rellena los cuatro datos.
 *   medio:  nombre del medio de comunicación
 *   fecha:  AAAA-MM-DD (por ejemplo 2026-11-13)
 *   titulo: titular de la noticia
 *   url:    enlace completo a la noticia (empieza por https://)
 * Las noticias se ordenan solas, de la más reciente a la más antigua.
 */
const NOTICIAS = [
    { medio: 'Ávilared', fecha: '2026-10-21', titulo: 'Alumnos y profesores del IES Adaja convierten historia, literatura y música de Arévalo en ruta turística', url: 'https://avilared.com/art/95156/narrarte-arevalo-ruta-cultural-historia-literatura-musica-ies-adaja' },
    { medio: 'Tribuna de Ávila', fecha: '2026-10-21', titulo: 'El IES Adaja crea una ruta para descubrir el patrimonio de Arévalo', url: 'https://www.tribunaavila.com/noticias/463447/el-ies-adaja-crea-una-ruta-para-descubrir-el-patrimonio-de-arevalo' },
    { medio: 'Diario de Ávila', fecha: '2026-10-21', titulo: 'Alumnos del IES Adaja promocionan en Arévalo el turismo local', url: 'https://www.diariodeavila.es/noticia/z8a05f2e8-f043-495a-aeebf43d3f7371f6/202610/alumnos-del-ies-adaja-promocionan-en-arevalo-el-turismo-local' },
    { medio: 'Onda Cero Ávila', fecha: '2026-11-11', titulo: 'Presentamos una nueva ruta artístico- literaria por #Arévalo con @IESADAJA', url: 'https://www.ondaceroavila.es/PodcastAvila?c=xbvqzqe&p=avilaonda' },
];

(function () {
    'use strict';

    let currentLang = 'es';

    function parseDate(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    }

    function render() {
        const list = document.getElementById('news-list');
        const empty = document.getElementById('news-empty');
        list.innerHTML = '';

        const items = NOTICIAS
            .filter(n => n && n.url && n.titulo)
            .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

        empty.classList.toggle('hidden', items.length > 0);

        items.forEach(n => {
            const li = document.createElement('li');
            li.className = 'news-item';

            const a = document.createElement('a');
            a.href = n.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = n.titulo;
            li.appendChild(a);

            const date = parseDate(n.fecha);
            const meta = [
                n.medio || '',
                date ? new Intl.DateTimeFormat(currentLang, { dateStyle: 'long' }).format(date) : ''
            ].filter(Boolean).join(' · ');
            if (meta) {
                const span = document.createElement('span');
                span.className = 'news-meta';
                span.textContent = meta;
                li.appendChild(span);
            }
            list.appendChild(li);
        });
    }

    function changeLanguage(lang) {
        currentLang = lang;
        document.body.className = lang;
        document.documentElement.lang = lang;
        ['es', 'en', 'fr'].forEach(l => {
            const b = document.getElementById('lang-' + l);
            b.classList.toggle('active', l === lang);
            b.setAttribute('aria-pressed', String(l === lang));
        });
        try { localStorage.setItem('preferredLanguage', lang); } catch (e) { /* sin almacenamiento */ }
        render();
    }

    ['es', 'en', 'fr'].forEach(l =>
        document.getElementById('lang-' + l).addEventListener('click', () => changeLanguage(l)));

    let saved = 'es';
    try { saved = localStorage.getItem('preferredLanguage') || 'es'; } catch (e) { /* sin almacenamiento */ }
    changeLanguage(['es', 'en', 'fr'].includes(saved) ? saved : 'es');
})();
