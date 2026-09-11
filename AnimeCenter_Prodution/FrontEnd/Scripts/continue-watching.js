import { supabase } from './supabaseClient.js';

const gridEl = document.querySelector('#continue-watching-grid');
const prevBtn = document.querySelector('#continue-watching-prev');
const nextBtn = document.querySelector('#continue-watching-next');

// Los botones ‹ › solo sirven en desktop (en móvil/touch el CSS ya los
// oculta y se navega deslizando). Se activan/desactivan solos según si
// hay más contenido hacia ese lado.
function updateArrowState() {
    if (!gridEl || !prevBtn || !nextBtn) return;
    const maxScroll = gridEl.scrollWidth - gridEl.clientWidth;
    prevBtn.disabled = gridEl.scrollLeft <= 4;
    nextBtn.disabled = maxScroll <= 4 || gridEl.scrollLeft >= maxScroll - 4;
}

function scrollByDirection(direction) {
    if (!gridEl) return;
    const card = gridEl.querySelector('.progress-card');
    const step = card ? card.getBoundingClientRect().width + 24 : gridEl.clientWidth * 0.8;
    gridEl.scrollBy({ left: direction * step, behavior: 'smooth' });
}

if (gridEl && prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => scrollByDirection(-1));
    nextBtn.addEventListener('click', () => scrollByDirection(1));
    gridEl.addEventListener('scroll', updateArrowState);
    window.addEventListener('resize', updateArrowState);
}

function renderGrid(html) {
    gridEl.innerHTML = html;
    // Esperamos un frame para que el navegador ya haya calculado el
    // nuevo scrollWidth antes de decidir si hay algo hacia dónde mover.
    requestAnimationFrame(updateArrowState);
}

async function loadContinueWatching() {
    if (!gridEl) return;

    const { data: { session } } = await supabase.auth.getSession();

    // Si no hay usuario logueado, mostrar mensaje
    if (!session) {
        renderGrid(`<p class="catalog-empty">Inicia sesión para ver tus animes en progreso.</p>`);
        return;
    }

    // Obtener los animes en progreso del usuario — máximo 10, siempre los
    // más recientes (por updated_at). Así la lista se actualiza sola: en
    // cuanto el usuario ve un anime nuevo, ese sube al frente y el que
    // llevaba más tiempo sin verse se cae de los 10 automáticamente.
    const CONTINUE_WATCHING_LIMIT = 10;

    const { data: progressList, error: progressError } = await supabase
        .from('watch_progress')
        .select('anime_id, current_episode, progress_seconds')
        .eq('user_id', session.user.id)
        .in('status', ['watching', 'plan_to_watch'])
        .order('updated_at', { ascending: false })
        .limit(CONTINUE_WATCHING_LIMIT);

    if (progressError) {
        console.error('[continue-watching] Error al consultar watch_progress:', progressError);
        renderGrid(`<p class="catalog-empty">No se pudo cargar tu progreso: ${progressError.message}</p>`);
        return;
    }

    if (!progressList || progressList.length === 0) {
        renderGrid(`<p class="catalog-empty">Aún no has comenzado a ver ningún anime.</p>`);
        return;
    }

    // Obtener los datos de los animes
    const animeIds = progressList.map(p => p.anime_id);
    const { data: animes, error: animeError } = await supabase
        .from('anime')
        .select('id, slug, title, cover_url')
        .in('id', animeIds);

    if (animeError || !animes) {
        console.error('[continue-watching] Error al consultar anime:', animeError);
        renderGrid(`<p class="catalog-empty">Error al cargar tus animes: ${animeError?.message || 'sin datos'}</p>`);
        return;
    }

    // Obtener información de episodios para calcular progreso
    const { data: episodes, error: episodeError } = await supabase
        .from('episodes')
        .select('anime_id, episode_number')
        .in('anime_id', animeIds);

    if (episodeError) {
        console.error('[continue-watching] Error al consultar episodes:', episodeError);
        renderGrid(`<p class="catalog-empty">Error al cargar los episodios: ${episodeError.message}</p>`);
        return;
    }

    // Construir mapa de episodios por anime
    const episodesByAnime = {};
    (episodes || []).forEach(ep => {
        if (!episodesByAnime[ep.anime_id]) {
            episodesByAnime[ep.anime_id] = [];
        }
        episodesByAnime[ep.anime_id].push(ep.episode_number);
    });

    // Renderizar tarjetas
    const html = progressList
        .filter(progress => animes.find(a => a.id === progress.anime_id))
        .map(progress => {
            const anime = animes.find(a => a.id === progress.anime_id);
            const episodeList = episodesByAnime[progress.anime_id] || [];
            const totalEpisodes = Math.max(...episodeList, progress.current_episode);
            const progressPercent = totalEpisodes > 0 
                ? Math.round((progress.current_episode / totalEpisodes) * 100)
                : 0;

            const thumb = anime.cover_url
                ? `<img src="${anime.cover_url}" alt="Portada de ${anime.title}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;"
                        onerror="this.onerror=null; this.replaceWith(Object.assign(document.createElement('div'), {className: 'progress-card-thumb', style: 'background: var(--field-bg);'}));">`
                : `<div style="width: 100%; height: 100%; background: var(--field-bg);"></div>`;

            return `
                <a href="/FrontEnd/Capitulo.html?slug=${anime.slug}&ep=${progress.current_episode}" class="progress-card">
                    <div class="progress-card-thumb">
                        ${thumb}
                        <div class="progress-card-play">
                            <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="progress-card-body">
                        <h3>${anime.title}</h3>
                        <p class="progress-card-episode">Episodio ${progress.current_episode} de ${totalEpisodes}</p>
                        <div class="progress-card-track">
                            <div class="progress-card-fill" style="width: ${progressPercent}%;"></div>
                        </div>
                        <span class="progress-card-percent">${progressPercent}% visto</span>
                    </div>
                </a>
            `;
        })
        .join('');

    if (html) {
        renderGrid(html);
    } else {
        renderGrid(`<p class="catalog-empty">Aún no has comenzado a ver ningún anime.</p>`);
    }
}

// Cargar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', loadContinueWatching);

// También cargar inmediatamente por si el DOM ya está listo
loadContinueWatching();
