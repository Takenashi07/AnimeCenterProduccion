import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
const episodeNumber = parseInt(params.get('ep') || '1', 10);

const gate = document.querySelector('#player-gate');
const page = document.querySelector('#player-page');

const video = document.querySelector('#video-player');
const playPauseBtn = document.querySelector('#play-pause-btn');
const playIcon = document.querySelector('#play-icon');
const pauseIcon = document.querySelector('#pause-icon');
const skipBackBtn = document.querySelector('#skip-back-btn');
const skipForwardBtn = document.querySelector('#skip-forward-btn');
const seekBar = document.querySelector('#player-seek');
const timeLabel = document.querySelector('#player-time');

const animeTitleEl = document.querySelector('#anime-title');
const episodeLabelEl = document.querySelector('#episode-label');
const descriptionEl = document.querySelector('#anime-description');
const prevLink = document.querySelector('#prev-episode-link');
const nextLink = document.querySelector('#next-episode-link');

const likeBtn = document.querySelector('#like-btn');
const saveBtn = document.querySelector('#save-btn');

const ratingStarsEl = document.querySelector('#rating-stars');
const ratingSummaryEl = document.querySelector('#rating-summary');
const ratingStarButtons = ratingStarsEl ? [...ratingStarsEl.querySelectorAll('.rating-star')] : [];

function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

if (!slug) {
    gate.textContent = 'No se especificó ningún anime.';
} else {
    init();
}

async function init() {
    // Restricción: sin sesión no se carga nada del capítulo (ni el anime,
    // ni el episodio, ni el video) — solo se muestra la puerta de login.
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        showLoginGate();
        return;
    }

    const { data: anime, error: animeError } = await supabase
        .from('anime')
        .select('*')
        .eq('slug', slug)
        .single();

    if (animeError || !anime) {
        gate.textContent = 'No se encontró ese anime.';
        return;
    }

    const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select('*')
        .eq('anime_id', anime.id)
        .eq('episode_number', episodeNumber)
        .single();

    if (episodeError || !episode) {
        gate.textContent = 'Ese capítulo todavía no está disponible.';
        return;
    }

    const { data: allEpisodes } = await supabase
        .from('episodes')
        .select('episode_number')
        .eq('anime_id', anime.id)
        .order('episode_number', { ascending: true });

    gate.hidden = true;
    page.hidden = false;

    animeTitleEl.textContent = anime.title;
    episodeLabelEl.textContent = episode.title
        ? `Capítulo ${episode.episode_number} · ${episode.title}`
        : `Capítulo ${episode.episode_number}`;
    descriptionEl.textContent = anime.description || '';

    video.src = episode.video_url;

    setupEpisodeNav(anime.slug, episodeNumber, allEpisodes?.map((e) => e.episode_number) || []);
    setupPlayerControls();
    setupLikeAndSave(session.user.id, anime.id, episode.id, episodeNumber);
    setupWatchProgress(session.user.id, anime.id, episodeNumber);
    setupRating(session.user.id, anime.id);
}

function showLoginGate() {
    const redirectTo = encodeURIComponent(window.location.pathname + window.location.search);

    gate.innerHTML = `
        <div class="login-gate">
            <img
                src="/Assets/Imgs/Icon-inicia-sesion.png"
                alt=""
                class="login-gate-sticker"
                loading="lazy">
            <div class="login-gate-text">
                <h2>Inicia sesión para ver esta serie</h2>
                <p>Debes iniciar sesión en Anime Center para desbloquear este contenido.</p>
            </div>
            <div class="player-gate-actions">
                <a href="/FrontEnd/Login.html?redirect=${redirectTo}" class="btn-gradient">Iniciar sesión</a>
                <a href="/FrontEnd/Register.html" class="btn-outline">Crear cuenta</a>
            </div>
        </div>
    `;
}

function setupEpisodeNav(animeSlug, currentEp, episodeNumbers) {
    const hasPrev = episodeNumbers.includes(currentEp - 1);
    const hasNext = episodeNumbers.includes(currentEp + 1);

    if (hasPrev) {
        prevLink.href = `/FrontEnd/Capitulo.html?slug=${animeSlug}&ep=${currentEp - 1}`;
    } else {
        prevLink.setAttribute('aria-disabled', 'true');
        prevLink.classList.add('is-disabled');
        prevLink.removeAttribute('href');
    }

    if (hasNext) {
        nextLink.href = `/FrontEnd/Capitulo.html?slug=${animeSlug}&ep=${currentEp + 1}`;
    } else {
        nextLink.setAttribute('aria-disabled', 'true');
        nextLink.classList.add('is-disabled');
        nextLink.removeAttribute('href');
    }
}

function setupPlayerControls() {
    playPauseBtn.addEventListener('click', () => {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    });

    video.addEventListener('play', () => {
        playIcon.hidden = true;
        pauseIcon.hidden = false;
    });

    video.addEventListener('pause', () => {
        playIcon.hidden = false;
        pauseIcon.hidden = true;
    });

    skipBackBtn.addEventListener('click', () => {
        video.currentTime = Math.max(0, video.currentTime - 10);
    });

    skipForwardBtn.addEventListener('click', () => {
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    });

    video.addEventListener('loadedmetadata', () => {
        seekBar.max = video.duration;
        timeLabel.textContent = `${formatTime(0)} / ${formatTime(video.duration)}`;
    });

    video.addEventListener('timeupdate', () => {
        seekBar.value = video.currentTime;
        timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    });

    seekBar.addEventListener('input', () => {
        video.currentTime = seekBar.value;
    });

    document.addEventListener('keydown', (event) => {
        if (event.target.tagName === 'INPUT') return;

        if (event.code === 'Space') {
            event.preventDefault();
            playPauseBtn.click();
        }
        if (event.code === 'ArrowRight') {
            skipForwardBtn.click();
        }
        if (event.code === 'ArrowLeft') {
            skipBackBtn.click();
        }
    });
}

async function setupLikeAndSave(userId, animeId, episodeId, epNumber) {
    const { data: favorite } = await supabase
        .from('favorites')
        .select('user_id')
        .eq('user_id', userId)
        .eq('episode_id', episodeId)
        .maybeSingle();

    let isLiked = !!favorite;
    setLikeState(isLiked);

    const { data: progress } = await supabase
        .from('watch_progress')
        .select('status')
        .eq('user_id', userId)
        .eq('anime_id', animeId)
        .maybeSingle();

    let isSaved = progress?.status === 'plan_to_watch';
    setSaveState(isSaved);

    likeBtn.addEventListener('click', async () => {
        likeBtn.disabled = true;

        if (isLiked) {
            await supabase.from('favorites').delete().eq('user_id', userId).eq('episode_id', episodeId);
            isLiked = false;
        } else {
            await supabase.from('favorites').insert({ user_id: userId, anime_id: animeId, episode_id: episodeId });
            isLiked = true;
        }

        setLikeState(isLiked);
        likeBtn.disabled = false;
    });

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;

        if (isSaved) {
            await supabase.from('watch_progress').delete().eq('user_id', userId).eq('anime_id', animeId);
            isSaved = false;
        } else {
            await supabase.from('watch_progress').upsert({
                user_id: userId,
                anime_id: animeId,
                status: 'plan_to_watch',
                current_episode: epNumber,
                updated_at: new Date().toISOString(),
            });
            isSaved = true;
        }

        setSaveState(isSaved);
        saveBtn.disabled = false;
    });
}

function setLikeState(isLiked) {
    likeBtn.classList.toggle('player-action-btn--active', isLiked);
    likeBtn.setAttribute('aria-pressed', String(isLiked));
    likeBtn.querySelector('svg').setAttribute('fill', isLiked ? 'currentColor' : 'none');
}

function setSaveState(isSaved) {
    saveBtn.classList.toggle('player-action-btn--active', isSaved);
    saveBtn.setAttribute('aria-pressed', String(isSaved));
    saveBtn.querySelector('svg').setAttribute('fill', isSaved ? 'currentColor' : 'none');
}

// ---------- Calificación (ratings) ----------
// La calificación es por anime completo, no por capítulo — todos los
// capítulos de un mismo anime comparten el mismo promedio y la misma
// calificación del usuario.

async function setupRating(userId, animeId) {
    if (!ratingStarsEl) return;

    let userScore = null;
    let baseFill = 0; // a qué se vuelve al quitar el mouse: la calificación propia, o el promedio

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
                window.location.href = '/FrontEnd/Login.html';
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

// ---------- Progreso de reproducción ----------
// Guarda automáticamente el tiempo actual del video y el episodio actual
async function setupWatchProgress(userId, animeId, currentEpisode) {
    let lastSavedTime = 0;
    let isSavingProgress = false;

    // Cargar el tiempo guardado cuando se carga el video
    video.addEventListener('loadedmetadata', async () => {
        const { data: progress } = await supabase
            .from('watch_progress')
            .select('current_time')
            .eq('user_id', userId)
            .eq('anime_id', animeId)
            .maybeSingle();

        if (progress && progress.current_time !== null && progress.current_time > 0) {
            // Solo restaurar si el tiempo es válido y menor que la duración
            if (progress.current_time < video.duration) {
                video.currentTime = progress.current_time;
                lastSavedTime = progress.current_time;
            }
        }
    });

    // Guardar el progreso periódicamente (cada 5 segundos)
    setInterval(async () => {
        if (isSavingProgress || Math.abs(video.currentTime - lastSavedTime) < 1) {
            return; // No guardar si es muy poco cambio o ya está guardando
        }

        isSavingProgress = true;
        lastSavedTime = video.currentTime;

        const { error } = await supabase.from('watch_progress').upsert({
            user_id: userId,
            anime_id: animeId,
            status: 'watching',
            current_episode: currentEpisode,
            current_time: Math.round(video.currentTime),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,anime_id' });

        isSavingProgress = false;

        if (error) {
            console.error('Error al guardar progreso:', error);
        }
    }, 5000);
}