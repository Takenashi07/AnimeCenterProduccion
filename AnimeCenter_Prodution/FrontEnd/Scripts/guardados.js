import { supabase } from './supabaseClient.js';

// ============================================================
// Guardados.js — Mis Guardados / Mis Favoritos
// ============================================================
//
// Este archivo maneja:
// 1. El filtrado de tabs (Todo / Series / Películas)
// 2. El orden del <select> (Más recientes / Más antiguos / A-Z)
// 3. La carga real desde Supabase:
//    - cargarGuardados()  -> llena #saved-grid   (tabla watch_progress + anime)
//    - cargarFavoritos()  -> llena #favorites-grid (tabla favorites + episodes + anime)
//
// Cada tarjeta de #saved-grid tiene el atributo
// data-type="serie" o data-type="pelicula" para que el
// filtrado de tabs funcione correctamente.

document.addEventListener('DOMContentLoaded', () => {
    cargarGuardados();
    cargarFavoritos();
    inicializarTabs();
    inicializarOrden();
    inicializarToggleVista();
    inicializarAccionesGuardados();
    inicializarAccionesFavoritos();
});

// ------------------------------------------------------------
// 0. Toggle Mis Guardados / Mis Favoritos
// ------------------------------------------------------------

const VIEW_COPY = {
    guardados: {
        title: 'Mis Guardados',
        subtitle: 'Todos los animes que guardaste para ver después.',
    },
    favoritos: {
        title: 'Mis Favoritos',
        subtitle: 'Los capítulos que marcaste con me gusta.',
    },
};

function inicializarToggleVista() {
    const toggle = document.getElementById('view-toggle');
    const savedView = document.getElementById('saved-view');
    const favoritesView = document.getElementById('favorites-view');
    const titleEl = document.getElementById('saved-view-title');
    const subtitleEl = document.getElementById('saved-view-subtitle');

    if (!toggle || !savedView || !favoritesView) return;

    const botones = toggle.querySelectorAll('.view-toggle-btn');

    toggle.addEventListener('click', (event) => {
        const btn = event.target.closest('.view-toggle-btn');
        if (!btn) return;

        const vista = btn.dataset.view; // "guardados" | "favoritos"

        botones.forEach((b) => {
            const activo = b === btn;
            b.classList.toggle('is-active', activo);
            b.setAttribute('aria-selected', String(activo));
        });

        savedView.hidden = vista !== 'guardados';
        favoritesView.hidden = vista !== 'favoritos';

        const copy = VIEW_COPY[vista];
        if (copy && titleEl && subtitleEl) {
            titleEl.textContent = copy.title;
            subtitleEl.textContent = copy.subtitle;
        }
    });
}

// ------------------------------------------------------------
// 1. Filtrado de tabs
// ------------------------------------------------------------

function inicializarTabs() {
    const tabs = document.querySelectorAll('.saved-tab');
    const grid = document.getElementById('saved-grid');

    if (!tabs.length || !grid) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('is-active'));
            tab.classList.add('is-active');
            aplicarFiltro(grid, tab.dataset.filter);
        });
    });
}

function aplicarFiltro(grid, filtro) {
    const cards = grid.querySelectorAll('.saved-card');

    cards.forEach(card => {
        const tipo = card.dataset.type; // "serie" | "pelicula"
        const coincide =
            filtro === 'todo' ||
            (filtro === 'series' && tipo === 'serie') ||
            (filtro === 'peliculas' && tipo === 'pelicula');

        card.style.display = coincide ? '' : 'none';
    });
}

// ------------------------------------------------------------
// 2. Orden (Más recientes / Más antiguos / A-Z)
// ------------------------------------------------------------

function inicializarOrden() {
    const select = document.getElementById('saved-sort-select');
    const grid = document.getElementById('saved-grid');

    if (!select || !grid) return;

    select.addEventListener('change', () => {
        const cards = Array.from(grid.querySelectorAll('.saved-card'));

        cards.sort((a, b) => {
            if (select.value === 'az') {
                const nombreA = a.querySelector('h3')?.textContent.trim() ?? '';
                const nombreB = b.querySelector('h3')?.textContent.trim() ?? '';
                return nombreA.localeCompare(nombreB);
            }

            // "recientes" / "antiguos" dependen de cuándo se guardó cada anime.
            // Usa un atributo real, ej. data-guardado-en="2026-08-01", en vez
            // de este placeholder de 0.
            const fechaA = Number(a.dataset.guardadoEn ?? 0);
            const fechaB = Number(b.dataset.guardadoEn ?? 0);

            return select.value === 'antiguos' ? fechaA - fechaB : fechaB - fechaA;
        });

        cards.forEach(card => grid.appendChild(card));
    });
}

// ------------------------------------------------------------
// 3. Hooks de datos — conecta aquí tu backend
// ------------------------------------------------------------

async function cargarGuardados() {
    const grid = document.getElementById('saved-grid');
    if (!grid) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        grid.innerHTML = `<p class="catalog-empty">Inicia sesión para ver tus animes guardados.</p>`;
        actualizarContadores(0, 0, 0);
        return;
    }

    const { data, error } = await supabase
        .from('watch_progress')
        .select('status, current_episode, updated_at, anime:anime_id(id, slug, title, type, season, cover_url, total_episodes)')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false });

    if (error) {
        grid.innerHTML = `<p class="catalog-empty">No se pudieron cargar tus guardados.</p>`;
        return;
    }

    // La portada que se muestra aquí es siempre la portada general del
    // anime (anime.cover_url), sin importar en qué capítulo vas.
    const guardados = (data || [])
        .filter((row) => row.anime)
        .map((row) => ({
            id: row.anime.id,
            slug: row.anime.slug,
            nombre: row.anime.title,
            imagen: row.anime.cover_url,
            tipo: row.anime.type === 'movie' ? 'pelicula' : 'serie',
            temporada: row.anime.season ? `Temporada ${row.anime.season}` : '',
            completada: row.status === 'completed',
            episodiosVistos: row.current_episode,
            episodiosTotal: row.anime.total_episodes,
            guardadoEn: new Date(row.updated_at).getTime(),
        }));

    if (guardados.length === 0) {
        grid.innerHTML = `<p class="catalog-empty">Aún no has guardado ningún anime.</p>`;
        actualizarContadores(0, 0, 0);
        return;
    }

    grid.innerHTML = guardados.map(crearTarjetaGuardado).join('');

    const totalSeries = guardados.filter(a => a.tipo === 'serie').length;
    const totalPeliculas = guardados.filter(a => a.tipo === 'pelicula').length;
    actualizarContadores(guardados.length, totalSeries, totalPeliculas);

    // Respeta el tab activo si el usuario ya lo había cambiado.
    const tabActivo = document.querySelector('.saved-tab.is-active');
    if (tabActivo) aplicarFiltro(grid, tabActivo.dataset.filter);
}

async function cargarFavoritos() {
    const grid = document.getElementById('favorites-grid');
    if (!grid) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        grid.innerHTML = `<p class="catalog-empty">Inicia sesión para ver tus favoritos.</p>`;
        return;
    }

    const { data, error } = await supabase
        .from('favorites')
        .select('episode_id, created_at, episode:episode_id(episode_number, title), anime:anime_id(slug, title, cover_url)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        grid.innerHTML = `<p class="catalog-empty">No se pudieron cargar tus favoritos.</p>`;
        return;
    }

    const favoritos = (data || [])
        .filter((row) => row.episode && row.anime)
        .map((row) => ({
            id: row.episode_id,
            animeNombre: row.anime.title,
            capituloNombre: row.episode.title,
            numero: row.episode.episode_number,
            imagen: row.anime.cover_url,
            // Favoritos son "me gusta" de un capítulo puntual: siguen
            // apuntando directo a ese capítulo, no a la ficha del anime.
            url: `Capitulo.html?slug=${row.anime.slug}&ep=${row.episode.episode_number}`,
        }));

    grid.innerHTML = favoritos.length
        ? favoritos.map(crearTarjetaFavorito).join('')
        : `<p class="catalog-empty">Aún no le has dado "me gusta" a ningún capítulo.</p>`;
}

// ------------------------------------------------------------
// 3b. Quitar guardado / quitar favorito (botones de las tarjetas)
// ------------------------------------------------------------

function inicializarAccionesGuardados() {
    const grid = document.getElementById('saved-grid');
    if (!grid) return;

    grid.addEventListener('click', async (event) => {
        const btn = event.target.closest('.saved-card-remove, .saved-card-bookmark');
        if (!btn) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const animeId = btn.dataset.id;
        btn.disabled = true;

        await supabase
            .from('watch_progress')
            .delete()
            .eq('user_id', session.user.id)
            .eq('anime_id', animeId);

        cargarGuardados();
    });
}

function inicializarAccionesFavoritos() {
    const grid = document.getElementById('favorites-grid');
    if (!grid) return;

    grid.addEventListener('click', async (event) => {
        const btn = event.target.closest('.favorite-card-like');
        if (!btn) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const episodeId = btn.dataset.id;
        btn.disabled = true;

        await supabase
            .from('favorites')
            .delete()
            .eq('user_id', session.user.id)
            .eq('episode_id', episodeId);

        cargarFavoritos();
    });
}

function actualizarContadores(total, series, peliculas) {
    const elTodo = document.getElementById('saved-count-todo');
    const elSeries = document.getElementById('saved-count-series');
    const elPeliculas = document.getElementById('saved-count-peliculas');

    if (elTodo) elTodo.textContent = `(${total})`;
    if (elSeries) elSeries.textContent = `(${series})`;
    if (elPeliculas) elPeliculas.textContent = `(${peliculas})`;
}

// ------------------------------------------------------------
// 4. Plantillas de tarjetas
// ------------------------------------------------------------

// anime = { id, nombre, imagen, tipo: 'serie'|'pelicula', temporada,
//           completada, episodiosVistos, episodiosTotal, guardadoEn }
function crearTarjetaGuardado(anime) {
    const progreso = anime.episodiosTotal
        ? Math.round((anime.episodiosVistos / anime.episodiosTotal) * 100)
        : 0;

    const subInfo = anime.completada
        ? `<p class="saved-card-sub saved-card-sub--done">Completada</p>`
        : `<p class="saved-card-sub">${anime.temporada ?? ''}</p>`;

    const footer = anime.completada
        ? ''
        : `
        <div class="saved-card-footer">
            <span class="saved-card-progress-label">${anime.episodiosVistos}/${anime.episodiosTotal} episodios</span>
            <button type="button" class="saved-card-bookmark" aria-label="Quitar marcador" data-id="${anime.id}">🔖</button>
        </div>
        <div class="saved-progress-track">
            <div class="saved-progress-fill" style="width: ${progreso}%"></div>
        </div>`;

    // La tarjeta de Guardados lleva a la ficha del anime (donde se ve
    // la lista completa de capítulos), no directo al capítulo 1.
    const animeUrl = anime.slug ? `/FrontEnd/Anime.html?slug=${anime.slug}` : '#';

    return `
        <article class="saved-card" data-id="${anime.id}" data-type="${anime.tipo}" data-guardado-en="${anime.guardadoEn ?? 0}">
            <a class="saved-card-thumb" href="${animeUrl}" aria-label="Ir a ${anime.nombre}">
                <img src="${anime.imagen}" alt="${anime.nombre}">
            </a>
            <button type="button" class="saved-card-remove" aria-label="Quitar de guardados" data-id="${anime.id}">×</button>
            <div class="saved-card-body">
                <a href="${animeUrl}" class="saved-card-link">
                    <h3>${anime.nombre}</h3>
                </a>
                ${subInfo}
                ${footer}
            </div>
        </article>`;
}

// capitulo = { id, animeNombre, capituloNombre, numero, imagen, url }
function crearTarjetaFavorito(capitulo) {
    return `
        <article class="favorite-card" data-id="${capitulo.id}">
            <a class="favorite-card-thumb" href="${capitulo.url}">
                <img src="${capitulo.imagen}" alt="${capitulo.animeNombre}">
                <span class="favorite-card-badge">EP ${capitulo.numero}</span>
                <span class="favorite-card-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </span>
            </a>
            <div class="favorite-card-body">
                <div class="favorite-card-info">
                    <p class="favorite-card-anime">${capitulo.animeNombre}</p>
                    <h3 class="favorite-card-title">${capitulo.capituloNombre ?? `Episodio ${capitulo.numero}`}</h3>
                </div>
                <button type="button" class="favorite-card-like" aria-label="Quitar de favoritos" data-id="${capitulo.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M12 21s-6.72-4.35-9.33-8.11C1.02 10.58 1.5 7.4 4.12 5.9c2.2-1.26 4.9-.7 6.4 1.1.5.6.9 1.2 1.48 1.2s.98-.6 1.48-1.2c1.5-1.8 4.2-2.36 6.4-1.1 2.62 1.5 3.1 4.68 1.43 7-2.61 3.75-9.33 8.11-9.33 8.11z"/>
                    </svg>
                </button>
            </div>
        </article>`;
}