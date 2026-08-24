import { supabase } from './supabaseClient.js';

const GENRES = ['shonen', 'shojo', 'seinen', 'josei', 'kodomo'];

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

function renderRows(containerEl, items, emptyMessage, groupSize) {
    if (items.length === 0) {
        containerEl.innerHTML = `<p class="catalog-empty">${emptyMessage}</p>`;
        return;
    }

    const groups = [];
    for (let i = 0; i < items.length; i += groupSize) {
        groups.push(items.slice(i, i + groupSize));
    }

    containerEl.innerHTML = groups.map((group) => `
        <div class="anime-row">
            <div class="row-track-wrap">
                <button type="button" class="row-arrow row-arrow--left" aria-label="Desplazar a la izquierda">‹</button>
                <div class="row-track">
                    ${group.map(cardHTML).join('')}
                </div>
                <button type="button" class="row-arrow row-arrow--right" aria-label="Desplazar a la derecha">›</button>
            </div>
        </div>
    `).join('');

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

async function loadSeriesByGenre() {
    const { data, error } = await supabase
        .from('anime')
        .select('title, slug, description, type, cover_url, genre')
        .eq('type', 'series')
        .order('created_at', { ascending: false });

    if (error) {
        [...GENRES, 'sin-clasificar'].forEach((genre) => {
            const container = document.querySelector(`#${genre}-rows`);
            if (container) container.innerHTML = `<p class="catalog-empty">Error cargando el catálogo.</p>`;
        });
        return;
    }

    GENRES.forEach((genre) => {
        const container = document.querySelector(`#${genre}-rows`);
        if (!container) return;

        const items = data.filter((a) => a.genre === genre);
        renderRows(container, items, 'Todavía no hay series clasificadas aquí.', 4);
    });

    const unclassifiedContainer = document.querySelector('#sin-clasificar-rows');
    if (unclassifiedContainer) {
        const unclassified = data.filter((a) => !a.genre);
        renderRows(unclassifiedContainer, unclassified, '¡Todo clasificado!', 4);
    }
}

loadSeriesByGenre();