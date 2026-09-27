import { supabase } from './supabaseClient.js';
import './img-fallback.js';
import { escapeHTML } from './html.js';

const params = new URLSearchParams(window.location.search);
const query = params.get('q')?.trim() || '';

const summaryEl = document.querySelector('#search-summary');
const resultsEl = document.querySelector('#search-results');
const searchInput = document.querySelector('#nav-search-input');
const catalogSection = document.querySelector('.catalog');
const emptyStateEl = document.querySelector('#search-empty');
const recentBlockEl = document.querySelector('#recent-searches-block');
const recentListEl = document.querySelector('#recent-searches-list');
const suggestedListEl = document.querySelector('#suggested-searches-list');

if (searchInput) searchInput.value = query;

// --- Búsquedas recientes (por navegador, guardadas en localStorage) ---

const RECENT_KEY = 'ac_recent_searches';
const RECENT_MAX = 5;

function getRecentSearches() {
    try {
        const stored = JSON.parse(localStorage.getItem(RECENT_KEY));
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
}

function saveRecentSearch(term) {
    try {
        const current = getRecentSearches().filter((item) => item.toLowerCase() !== term.toLowerCase());
        current.unshift(term);
        localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, RECENT_MAX)));
    } catch {
        // localStorage no disponible (modo privado, etc.) — no es crítico, se ignora.
    }
}

// Las búsquedas recientes vienen de la URL (?q=...): se escapan con
// escapeHTML para que un link manipulado no pueda guardar HTML con código
// en localStorage y ejecutarlo la siguiente vez que abrieras Buscar.

function searchChipHTML(term) {
    return `<a href="/FrontEnd/Buscar.html?q=${encodeURIComponent(term)}" class="search-chip">${escapeHTML(term)}</a>`;
}

// Términos sugeridos fijos, para cuando alguien llega sin haber
// buscado nada todavía (y no tiene búsquedas recientes que mostrar).
const SUGGESTED_SEARCHES = ['Shonen', 'Isekai', 'Seinen', 'Romance', 'Películas'];

function renderEmptyState() {
    if (!emptyStateEl) return;

    const recent = getRecentSearches();
    if (recent.length && recentBlockEl && recentListEl) {
        recentListEl.innerHTML = recent.map(searchChipHTML).join('');
        recentBlockEl.hidden = false;
    }

    if (suggestedListEl) {
        suggestedListEl.innerHTML = SUGGESTED_SEARCHES.map(searchChipHTML).join('');
    }

    emptyStateEl.hidden = false;
    if (catalogSection) catalogSection.hidden = true;
}

function cardHTML(anime) {
    const tag = anime.type === 'movie' ? 'Película' : 'Serie';
    const thumb = anime.cover_url
        ? `<img class="card-thumb" src="${escapeHTML(anime.cover_url)}" alt="Portada de ${escapeHTML(anime.title)}" loading="lazy"
                data-fallback="card-thumb card-thumb--empty">`
        : `<div class="card-thumb card-thumb--empty"></div>`;

    return `
        <a class="anime-card-link" href="/FrontEnd/Anime.html?slug=${encodeURIComponent(anime.slug)}">
            <article class="anime-card">
                ${thumb}
                <div class="card-body">
                    <span class="card-tag">${tag}</span>
                    <h3>${escapeHTML(anime.title)}</h3>
                    <p>${escapeHTML(anime.description)}</p>
                </div>
            </article>
        </a>
    `;
}

async function runSearch() {
    if (!query) {
        summaryEl.textContent = 'Escribe algo en la barra de búsqueda para empezar.';
        renderEmptyState();
        return;
    }

    saveRecentSearch(query);

    let queryBuilder = supabase
        .from('anime')
        .select('title, slug, description, type, cover_url')
        .eq('is_adult', false); // el +18 solo se lista en Adultos.html

    // Cada palabra escrita debe aparecer en el título o la descripción
    // (no hace falta que estén juntas ni en el mismo orden).
    // Se quitan los caracteres que usa la sintaxis de filtros de Supabase
    // (coma, paréntesis, comodines) para que el texto no pueda alterar el filtro.
    const words = query
        .split(/\s+/)
        .map((word) => word.replace(/[,()*%\\"]/g, ''))
        .filter(Boolean);
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
        : `
            <div class="search-no-results">
                <img src="/Assets/Imgs/Icon-sin-resultados.png" alt="" class="search-no-results-sticker" loading="lazy">
                <p class="search-no-results-text">Prueba con otro término de búsqueda.</p>
            </div>
        `;
}

runSearch();