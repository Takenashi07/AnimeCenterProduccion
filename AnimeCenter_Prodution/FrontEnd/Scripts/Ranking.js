import { supabase } from './supabaseClient.js';
import './img-fallback.js';
import { escapeHTML } from './html.js';

const GENRE_LABELS = {
    shonen: 'Shōnen',
    shojo: 'Shōjo',
    seinen: 'Seinen',
    josei: 'Josei',
    kodomo: 'Kodomo',
};

const TOP_N = 4;

// El ranking es por temporada de anime (ene–mar, abr–jun, jul–sep, oct–dic):
// solo cuentan los votos dados o cambiados desde que empezó la temporada
// actual, así que cada 3 meses arranca de cero. Los votos no se borran: cada
// usuario conserva su calificación en la página del anime.
function currentSeasonStart() {
    const now = new Date();
    return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
}

function itemHTML(anime, average, votes, index) {
    const thumb = anime.cover_url
        ? `<img class="ranking-thumb" src="${escapeHTML(anime.cover_url)}" alt="Portada de ${escapeHTML(anime.title)}" loading="lazy"
                data-fallback="ranking-thumb">`
        : `<div class="ranking-thumb"></div>`;

    const position = index + 1;
    const positionClass = position <= 3 ? ' ranking-position--top' : '';
    const genreLabel = GENRE_LABELS[anime.genre] || 'Sin clasificar';

    return `
        <a href="/FrontEnd/Anime.html?slug=${encodeURIComponent(anime.slug)}" class="ranking-item">
            <span class="ranking-position${positionClass}">${position}</span>
            ${thumb}
            <div class="ranking-info">
                <h3>${escapeHTML(anime.title)}</h3>
                <span class="ranking-genre">${genreLabel}</span>
            </div>
            <div class="ranking-score">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 2l2.9 6.9 7.5.6-5.7 4.9 1.8 7.3-6.5-4-6.5 4 1.8-7.3-5.7-4.9 7.5-.6z"/>
                </svg>
                ${average.toFixed(1)} · ${votes} ${votes === 1 ? 'voto' : 'votos'}
            </div>
        </a>
    `;
}

async function loadRanking() {
    const listEl = document.querySelector('#ranking-list');
    if (!listEl) return;

    // Trae las calificaciones de la temporada junto con los datos del anime
    // al que pertenecen — el catálogo es pequeño, así que agregar en el
    // cliente es más simple que mantener una vista/RPC en Supabase.
    const { data, error } = await supabase
        .from('ratings')
        .select('score, anime:anime_id(slug, title, genre, cover_url, is_adult)')
        .gte('updated_at', currentSeasonStart().toISOString());

    if (error) {
        listEl.innerHTML = `<p class="catalog-empty">No se pudo cargar el ranking.</p>`;
        return;
    }

    const byAnime = new Map();

    (data || []).forEach((row) => {
        if (!row.anime || row.anime.is_adult) return;
        const key = row.anime.slug;
        if (!byAnime.has(key)) {
            byAnime.set(key, { anime: row.anime, total: 0, count: 0 });
        }
        const entry = byAnime.get(key);
        entry.total += row.score;
        entry.count += 1;
    });

    // Primero el más votado; si empatan en votos, el de mejor promedio.
    const ranked = [...byAnime.values()]
        .map((entry) => ({ anime: entry.anime, votes: entry.count, average: entry.total / entry.count }))
        .sort((a, b) => b.votes - a.votes || b.average - a.average)
        .slice(0, TOP_N);

    listEl.innerHTML = ranked.length
        ? ranked.map((entry, index) => itemHTML(entry.anime, entry.average, entry.votes, index)).join('')
        : `<p class="catalog-empty">La temporada acaba de empezar: todavía no hay votos. ¡Califica tus animes favoritos!</p>`;
}

loadRanking();