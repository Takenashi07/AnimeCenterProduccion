import { supabase } from './supabaseClient.js';

function cardHTML(anime) {
    const tag = anime.type === 'movie' ? 'Película' : 'Serie';

    const thumb = anime.cover_url
        ? `<img class="card-thumb" src="${anime.cover_url}" alt="Portada de ${anime.title}" loading="lazy"
                onerror="this.onerror=null; this.replaceWith(Object.assign(document.createElement('div'), {className: 'card-thumb card-thumb--empty'}));">`
        : `<div class="card-thumb card-thumb--empty"></div>`;

    return `
        <a class="anime-card-link" href="/FrontEnd/Anime.html?slug=${anime.slug}">
            <article class="anime-card">
                ${thumb}
                <div class="card-body">
                    <span class="card-tag">${tag}</span>
                    <h3>${anime.title}</h3>
                    <p>${anime.description ?? ''}</p>
                </div>
            </article>
        </a>
    `;
}

function toCarouselItem(anime) {
    return {
        id: anime.slug,
        title: anime.title,
        image: anime.cover_url || '',
        href: `/FrontEnd/Anime.html?slug=${anime.slug}`,
    };
}

function renderStaticGrid(gridEl, items, emptyMessage, limit) {
    const visibleItems = limit ? items.slice(0, limit) : items;

    if (visibleItems.length === 0) {
        gridEl.innerHTML = `<p class="catalog-empty">${emptyMessage}</p>`;
        return;
    }

    gridEl.innerHTML = visibleItems.map(cardHTML).join('');
}

// Estilo Netflix: divide `items` en filas de `groupSize`, todas visibles
// a la vez, cada una con sus propias flechas para desplazarse horizontalmente.
function renderRows(containerEl, items, emptyMessage, groupSize) {
    if (items.length === 0) {
        containerEl.innerHTML = `<p class="catalog-empty">${emptyMessage}</p>`;
        return;
    }

    const groups = [];
    for (let i = 0; i < items.length; i += groupSize) {
        groups.push(items.slice(i, i + groupSize));
    }

    containerEl.innerHTML = groups.map((group) => {
        return `
            <div class="anime-row">
                <div class="row-track-wrap">
                    <button type="button" class="row-arrow row-arrow--left" aria-label="Desplazar a la izquierda">‹</button>
                    <div class="row-track">
                        ${group.map(cardHTML).join('')}
                    </div>
                    <button type="button" class="row-arrow row-arrow--right" aria-label="Desplazar a la derecha">›</button>
                </div>
            </div>
        `;
    }).join('');

    containerEl.querySelectorAll('.anime-row').forEach((row) => {
        const track = row.querySelector('.row-track');
        const leftBtn = row.querySelector('.row-arrow--left');
        const rightBtn = row.querySelector('.row-arrow--right');

        function updateArrows() {
            leftBtn.disabled = track.scrollLeft <= 0;
            rightBtn.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
        }

        leftBtn.addEventListener('click', () => {
            track.scrollBy({ left: -track.clientWidth * 0.9, behavior: 'smooth' });
        });

        rightBtn.addEventListener('click', () => {
            track.scrollBy({ left: track.clientWidth * 0.9, behavior: 'smooth' });
        });

        track.addEventListener('scroll', updateArrows);
        updateArrows();
    });
}

function renderGrid(gridEl, items, emptyMessage) {
    if (!gridEl) return;

    const section = gridEl.closest('section');
    const limit = section?.dataset.limit ? parseInt(section.dataset.limit, 10) : null;
    renderStaticGrid(gridEl, items, emptyMessage, limit);
}

function setupSeriesLoadMore(series) {
    const section = document.querySelector('#series');
    const gridEl = section?.querySelector('.card-grid');
    const loadMoreBtn = document.getElementById('series-load-more');
    const loadLessBtn = document.getElementById('series-load-less');

    if (!section || !gridEl || !loadMoreBtn || !loadLessBtn) return;

    const SERIES_BATCH_SIZE = 4;
    const MAX_VISIBLE_SERIES = 12;
    const initialLimit = Math.min(Number(section.dataset.limit || SERIES_BATCH_SIZE), MAX_VISIBLE_SERIES);
    const maxAllowed = Math.min(series.length, MAX_VISIBLE_SERIES);
    let visibleLimit = initialLimit;

    const renderVisibleSeries = () => {
        const visibleItems = series.slice(0, visibleLimit);
        renderStaticGrid(gridEl, visibleItems, 'Todavía no hay series cargadas.', visibleLimit);

        const reachedMax = visibleLimit >= maxAllowed;
        loadMoreBtn.hidden = reachedMax;
        loadMoreBtn.disabled = reachedMax;

        loadLessBtn.hidden = visibleLimit <= initialLimit;
    };

    loadMoreBtn.addEventListener('click', () => {
        if (visibleLimit >= maxAllowed) return;
        visibleLimit = Math.min(visibleLimit + SERIES_BATCH_SIZE, maxAllowed);
        renderVisibleSeries();
    });

    loadLessBtn.addEventListener('click', () => {
        visibleLimit = initialLimit;
        renderVisibleSeries();
    });

    renderVisibleSeries();
}

async function loadCatalog() {
    const featuredGrid = document.querySelector('#catalogo .card-grid');
    const seriesGrid = document.querySelector('#series .card-grid');
    const seriesRows = document.querySelector('#series .rows-container');
    const moviesGrid = document.querySelector('#peliculas .card-grid');
    const carouselTrack = document.getElementById('carrusel-principal-track');

    if (!featuredGrid && !seriesGrid && !seriesRows && !moviesGrid && !carouselTrack) return;

    const { data, error } = await supabase
        .from('anime')
        .select('title, slug, description, type, cover_url, is_featured')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error cargando el catálogo:', error.message);
        const message = '<p class="catalog-empty">No se pudo cargar el catálogo. Intenta más tarde.</p>';
        if (featuredGrid) featuredGrid.innerHTML = message;
        if (seriesGrid) seriesGrid.innerHTML = message;
        if (seriesRows) seriesRows.innerHTML = message;
        if (moviesGrid) moviesGrid.innerHTML = message;
        window.AnimeCarousels?.renderCards('carrusel-principal-track', [], {
            emptyMessage: 'No se pudo cargar el catálogo. Intenta más tarde.',
        });
        return;
    }

    const featured = data.filter((a) => a.is_featured);
    const series = data.filter((a) => a.type === 'series');
    const movies = data.filter((a) => a.type === 'movie');

    renderGrid(featuredGrid, featured, 'Aún no hay destacados marcados en el catálogo.');

    if (seriesRows) {
        renderRows(seriesRows, series, 'Todavía no hay series cargadas.', 4);
    } else {
        setupSeriesLoadMore(series);
    }

    renderGrid(moviesGrid, movies, 'Todavía no hay películas cargadas.');

    // Carrusel principal: reutiliza los mismos destacados de arriba.
    window.AnimeCarousels?.renderCards(
        'carrusel-principal-track',
        featured.map(toCarouselItem),
        { emptyMessage: 'Aún no hay destacados marcados en el catálogo.' }
    );
}

loadCatalog();