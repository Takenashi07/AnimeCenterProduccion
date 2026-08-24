import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');

const gate = document.querySelector('#anime-gate');
const page = document.querySelector('#anime-page');

const coverWrap = document.querySelector('#anime-detail-cover');
const coverEmpty = document.querySelector('#anime-detail-cover-empty');
const tagEl = document.querySelector('#anime-detail-tag');
const titleEl = document.querySelector('#anime-detail-title');
const metaEl = document.querySelector('#anime-detail-meta');
const descriptionEl = document.querySelector('#anime-detail-description');
const continueBtn = document.querySelector('#continue-watching-btn');
const saveBtn = document.querySelector('#save-anime-btn');

const ratingStarsEl = document.querySelector('#anime-rating-stars');
const ratingSummaryEl = document.querySelector('#anime-rating-summary');
const ratingStarButtons = ratingStarsEl ? [...ratingStarsEl.querySelectorAll('.rating-star')] : [];

const episodeListEl = document.querySelector('#episode-list');
const episodeListSummaryEl = document.querySelector('#episode-list-summary');

const TYPE_LABELS = { series: 'Serie', movie: 'Película', ova: 'OVA', special: 'Especial' };
const STATUS_LABELS = { ongoing: 'En emisión', finished: 'Finalizado', upcoming: 'Próximo estreno' };

if (!slug) {
    gate.textContent = 'No se especificó ningún anime.';
} else {
    init();
}

async function init() {
    const { data: anime, error: animeError } = await supabase
        .from('anime')
        .select('*')
        .eq('slug', slug)
        .single();

    if (animeError || !anime) {
        gate.textContent = 'No se encontró ese anime.';
        return;
    }

    const { data: episodes, error: episodesError } = await supabase
        .from('episodes')
        .select('*')
        .eq('anime_id', anime.id)
        .order('episode_number', { ascending: true });

    const { data: { session } } = await supabase.auth.getSession();

    let progress = null;
    if (session) {
        const { data } = await supabase
            .from('watch_progress')
            .select('current_episode, status')
            .eq('user_id', session.user.id)
            .eq('anime_id', anime.id)
            .maybeSingle();
        progress = data;
    }

    gate.hidden = true;
    page.hidden = false;

    renderHeader(anime);
    renderContinueButton(anime, progress);
    setupSaveButton(session, anime, progress);
    setupRating(session?.user?.id, anime.id);
    renderEpisodeList(anime, episodesError ? [] : (episodes || []), progress);
}

function renderHeader(anime) {
    document.title = `Anime Center · ${anime.title}`;

    if (anime.cover_url) {
        coverWrap.innerHTML = `<img src="${anime.cover_url}" alt="Portada de ${anime.title}" loading="lazy"
            onerror="this.onerror=null; this.replaceWith(Object.assign(document.createElement('div'), {className: 'card-thumb card-thumb--empty'}));">`;
    } else {
        coverEmpty.hidden = false;
    }

    tagEl.textContent = TYPE_LABELS[anime.type] || anime.type;
    titleEl.textContent = anime.title;
    descriptionEl.textContent = anime.description || 'Todavía no hay sinopsis para este título.';

    const metaParts = [];
    if (anime.release_year) metaParts.push(anime.release_year);
    if (anime.status) metaParts.push(STATUS_LABELS[anime.status] || anime.status);
    if (anime.type === 'series' && anime.season) metaParts.push(`Temporada ${anime.season}`);
    if (anime.total_episodes) metaParts.push(`${anime.total_episodes} capítulos`);

    metaEl.textContent = metaParts.join(' · ');
}

function renderContinueButton(anime, progress) {
    const hasProgress = progress && progress.current_episode > 0;
    const targetEpisode = hasProgress ? progress.current_episode : 1;

    continueBtn.href = `/FrontEnd/Capitulo.html?slug=${anime.slug}&ep=${targetEpisode}`;
    continueBtn.textContent = hasProgress
        ? `▶ Continuar en el capítulo ${targetEpisode}`
        : '▶ Comenzar a ver';
}

async function setupSaveButton(session, anime, progress) {
    let isSaved = progress?.status === 'plan_to_watch';
    setSaveState(isSaved);

    saveBtn.addEventListener('click', async () => {
        if (!session) {
            window.location.href = `/FrontEnd/Login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            return;
        }

        saveBtn.disabled = true;

        if (isSaved) {
            await supabase.from('watch_progress').delete().eq('user_id', session.user.id).eq('anime_id', anime.id);
            isSaved = false;
        } else {
            await supabase.from('watch_progress').upsert({
                user_id: session.user.id,
                anime_id: anime.id,
                status: 'plan_to_watch',
                current_episode: progress?.current_episode || 1,
                updated_at: new Date().toISOString(),
            });
            isSaved = true;
        }

        setSaveState(isSaved);
        saveBtn.disabled = false;
    });
}

function setSaveState(isSaved) {
    saveBtn.classList.toggle('player-action-btn--active', isSaved);
    saveBtn.setAttribute('aria-pressed', String(isSaved));
    saveBtn.querySelector('svg').setAttribute('fill', isSaved ? 'currentColor' : 'none');
    saveBtn.lastChild.textContent = isSaved ? ' Guardado' : ' Guardar';
}

// ---------- Calificación (idéntico criterio que en capitulo.js: por anime, no por capítulo) ----------

async function setupRating(userId, animeId) {
    if (!ratingStarsEl) return;

    let userScore = null;
    let baseFill = 0;

    async function loadAndRender() {
        const { data: scores, error } = await supabase
            .from('ratings')
            .select('user_id, score')
            .eq('anime_id', animeId);

        if (error) {
            ratingSummaryEl.textContent = 'No se pudo cargar la calificación.';
            return;
        }

        const count = scores.length;
        const average = count
            ? scores.reduce((sum, r) => sum + r.score, 0) / count
            : 0;

        userScore = userId ? (scores.find((r) => r.user_id === userId)?.score ?? null) : null;
        baseFill = userScore ?? Math.round(average);

        renderStars(baseFill);
        ratingStarsEl.classList.toggle('rating-stars--own', userScore !== null);

        ratingSummaryEl.textContent = count
            ? `${average.toFixed(1)} · ${count} calificación${count === 1 ? '' : 'es'}${userScore ? ` · Tu calificación: ${userScore}` : ''}`
            : 'Sé el primero en calificar este anime.';
    }

    function renderStars(filledUpTo) {
        ratingStarButtons.forEach((btn) => {
            const value = Number(btn.dataset.value);
            btn.classList.toggle('is-filled', value <= filledUpTo);
        });
    }

    ratingStarButtons.forEach((btn) => {
        const value = Number(btn.dataset.value);

        btn.addEventListener('mouseenter', () => renderStars(value));
        btn.addEventListener('mouseleave', () => renderStars(baseFill));

        btn.addEventListener('click', async () => {
            if (!userId) {
                window.location.href = `/FrontEnd/Login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
                return;
            }

            ratingStarButtons.forEach((b) => { b.disabled = true; });

            const { error } = await supabase.from('ratings').upsert({
                user_id: userId,
                anime_id: animeId,
                score: value,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,anime_id' });

            ratingStarButtons.forEach((b) => { b.disabled = false; });

            if (error) {
                ratingSummaryEl.textContent = 'No se pudo guardar tu calificación.';
                return;
            }

            await loadAndRender();
        });
    });

    await loadAndRender();
}

// ---------- Lista de capítulos ----------

function episodeItemHTML(anime, episode, progress) {
    const currentEp = progress?.current_episode ?? 0;
    const isWatched = episode.episode_number < currentEp;
    const isCurrent = episode.episode_number === currentEp && progress?.status === 'watching';

    const statusHTML = isCurrent
        ? `<span class="episode-item-status episode-item-status--current">Viendo</span>`
        : isWatched
        ? `<span class="episode-item-status episode-item-status--watched">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>
                Visto
           </span>`
        : '';

    return `
        <a class="episode-item${isCurrent ? ' episode-item--current' : ''}" href="/FrontEnd/Capitulo.html?slug=${anime.slug}&ep=${episode.episode_number}">
            <span class="episode-item-number">${episode.episode_number}</span>
            <span class="episode-item-body">
                <span class="episode-item-title">${episode.title ? episode.title : `Capítulo ${episode.episode_number}`}</span>
            </span>
            ${statusHTML}
            <svg class="episode-item-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z"/>
            </svg>
        </a>
    `;
}

function renderEpisodeList(anime, episodes, progress) {
    if (episodes.length === 0) {
        episodeListEl.innerHTML = '<p class="catalog-empty">Este anime todavía no tiene capítulos disponibles.</p>';
        episodeListSummaryEl.textContent = '';
        return;
    }

    episodeListSummaryEl.textContent = `${episodes.length} capítulo${episodes.length === 1 ? '' : 's'} disponible${episodes.length === 1 ? '' : 's'}`;
    episodeListEl.innerHTML = episodes.map((ep) => episodeItemHTML(anime, ep, progress)).join('');
}