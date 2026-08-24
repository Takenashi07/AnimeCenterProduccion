import { supabase } from './supabaseClient.js';

const GENRE_LABELS = {
    shonen: 'Shōnen',
    shojo: 'Shōjo',
    seinen: 'Seinen',
    josei: 'Josei',
    kodomo: 'Kodomo',
};

const TOP_N = 4;

function itemHTML(anime, average, index) {
    const thumb = anime.cover_url
        ? `<img class="ranking-thumb" src="${anime.cover_url}" alt="Portada de ${anime.title}" loading="lazy"
                onerror="this.onerror=null; this.replaceWith(Object.assign(document.createElement('div'), {className: 'ranking-thumb'}));">`
        : `<div class="ranking-thumb"></div>`;

    const position = index + 1;
    const positionClass = position <= 3 ? ' ranking-position--top' : '';
    const genreLabel = GENRE_LABELS[anime.genre] || 'Sin clasificar';

    return `
        <a href="/FrontEnd/Anime.html?slug=${anime.slug}" class="ranking-item">
            <span class="ranking-position${positionClass}">${position}</span>
            ${thumb}
            <div class="ranking-info">
                <h3>${anime.title}</h3>
                <span class="ranking-genre">${genreLabel}</span>
            </div>
            <div class="ranking-score">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 2l2.9 6.9 7.5.6-5.7 4.9 1.8 7.3-6.5-4-6.5 4 1.8-7.3-5.7-4.9 7.5-.6z"/>
                </svg>
                ${average.toFixed(1)}
            </div>
        </a>
    `;
}

async function loadRanking() {
    const listEl = document.querySelector('#ranking-list');
    if (!listEl) return;

    // Trae todas las calificaciones junto con los datos del anime al que
    // pertenecen — el catálogo es pequeño, así que agregar el promedio
    // en el cliente es más simple que mantener una vista/RPC en Supabase.
    const { data, error } = await supabase
        .from('ratings')
        .select('score, anime:anime_id(slug, title, genre, cover_url)');

    if (error) {
        listEl.innerHTML = `<p class="catalog-empty">No se pudo cargar el ranking.</p>`;
        return;
    }

    const byAnime = new Map();

    (data || []).forEach((row) => {
        if (!row.anime) return;
        const key = row.anime.slug;
        if (!byAnime.has(key)) {
            byAnime.set(key, { anime: row.anime, total: 0, count: 0 });
        }
        const entry = byAnime.get(key);
        entry.total += row.score;
        entry.count += 1;
    });

    const ranked = [...byAnime.values()]
        .map((entry) => ({ anime: entry.anime, average: entry.total / entry.count }))
        .sort((a, b) => b.average - a.average)
        .slice(0, TOP_N);

    listEl.innerHTML = ranked.length
        ? ranked.map((entry, index) => itemHTML(entry.anime, entry.average, index)).join('')
        : `<p class="catalog-empty">Todavía no hay calificaciones suficientes para armar un ranking.</p>`;
}

loadRanking();