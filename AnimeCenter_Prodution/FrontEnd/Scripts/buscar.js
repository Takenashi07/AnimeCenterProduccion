import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const query = params.get('q')?.trim() || '';

const summaryEl = document.querySelector('#search-summary');
const resultsEl = document.querySelector('#search-results');
const searchInput = document.querySelector('#nav-search-input');

if (searchInput) searchInput.value = query;

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

async function runSearch() {
    if (!query) {
        summaryEl.textContent = 'Escribe algo en la barra de búsqueda para empezar.';
        resultsEl.innerHTML = '';
        return;
    }

    let queryBuilder = supabase
        .from('anime')
        .select('title, slug, description, type, cover_url');

    // Cada palabra escrita debe aparecer en el título o la descripción
    // (no hace falta que estén juntas ni en el mismo orden).
    const words = query.split(/\s+/).filter(Boolean);
    words.forEach((word) => {
        queryBuilder = queryBuilder.or(`title.ilike.%${word}%,description.ilike.%${word}%`);
    });

    const { data, error } = await queryBuilder.order('title', { ascending: true });

    if (error) {
        summaryEl.textContent = 'Ocurrió un error al buscar.';
        resultsEl.innerHTML = '';
        return;
    }

    summaryEl.textContent = data.length
        ? `${data.length} resultado${data.length === 1 ? '' : 's'} para "${query}"`
        : `Sin resultados para "${query}"`;

    resultsEl.innerHTML = data.length
        ? data.map(cardHTML).join('')
        : '<p class="catalog-empty">Prueba con otro título.</p>';
}

runSearch();