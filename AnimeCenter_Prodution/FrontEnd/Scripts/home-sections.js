import { supabase } from './supabaseClient.js';

// Secciones de la home que el admin arma manualmente desde "Imágenes para
// Secciones" (Admin.html), eligiendo un anime + una imagen para cada slot.
// Antes, esos datos se guardaban en Supabase pero nada en la página los
// leía — esto es lo que los conecta con lo que ve el usuario.

const SECTIONS = [
    { key: 'estrenos', rowsSelector: '#estrenos-rows', showBadge: false },
    { key: 'tendencias', rowsSelector: '#tendencias-rows', showBadge: true },
    { key: 'recomendados', rowsSelector: '#recomendados-rows', showBadge: false },
];

function cardHTML(slot, index, showBadge) {
    const anime = slot.anime || {};
    const tag = anime.type === 'movie' ? 'Película' : 'Serie';
    const badge = showBadge
        ? `<span class="trend-badge${index < 3 ? ' trend-badge--top' : ''}">${index + 1}</span>`
        : '';

    const thumb = showBadge
        ? `
            <div class="card-thumb-wrap">
                <img class="card-thumb" src="${slot.image_url}" alt="" loading="lazy">
                ${badge}
            </div>
        `
        : `<img class="card-thumb" src="${slot.image_url}" alt="" loading="lazy">`;

    return `
        <a href="/FrontEnd/Anime.html?slug=${anime.slug}" class="anime-card-link">
            <article class="anime-card">
                ${thumb}
                <div class="card-body">
                    <span class="card-tag">${tag}</span>
                    <h3>${anime.title || ''}</h3>
                    <p>${anime.description ?? ''}</p>
                </div>
            </article>
        </a>
    `;
}

// Misma lógica de "una fila con flechas" que Continuar viendo: las
// flechas se activan/desactivan solas y en touch el CSS ya las oculta.
function wireRowScroll(trackEl, prevBtn, nextBtn) {
    function updateArrows() {
        const maxScroll = trackEl.scrollWidth - trackEl.clientWidth;
        prevBtn.disabled = trackEl.scrollLeft <= 4;
        nextBtn.disabled = maxScroll <= 4 || trackEl.scrollLeft >= maxScroll - 4;
    }

    function scrollByDirection(direction) {
        const card = trackEl.querySelector('.anime-card-link');
        const step = card ? card.getBoundingClientRect().width + 20 : trackEl.clientWidth * 0.8;
        trackEl.scrollBy({ left: direction * step, behavior: 'smooth' });
    }

    prevBtn.addEventListener('click', () => scrollByDirection(-1));
    nextBtn.addEventListener('click', () => scrollByDirection(1));
    trackEl.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);

    requestAnimationFrame(updateArrows);
}

async function loadSection({ key, rowsSelector, showBadge }) {
    const sectionEl = document.querySelector(rowsSelector)?.closest('section');
    const rowsEl = document.querySelector(rowsSelector);
    if (!sectionEl || !rowsEl) return;

    const { data, error } = await supabase
        .from('home_section_slots')
        .select('position, image_url, anime:anime_id(slug, title, description, type)')
        .eq('section', key)
        .order('position', { ascending: true });

    if (error) {
        console.error(`[home-sections] Error al consultar "${key}":`, error);
        sectionEl.hidden = true;
        return;
    }

    const slots = (data || []).filter((row) => row.image_url && row.anime);

    if (slots.length === 0) {
        sectionEl.hidden = true;
        return;
    }

    sectionEl.hidden = false;

    const cardsHTML = slots.map((slot, index) => cardHTML(slot, index, showBadge)).join('');

    rowsEl.innerHTML = `
        <div class="anime-row">
            <div class="row-track-wrap">
                <button type="button" class="row-arrow" id="${key}-prev" aria-label="Anterior" disabled>‹</button>

                <div class="row-track" id="${key}-track">
                    ${cardsHTML}
                </div>

                <button type="button" class="row-arrow" id="${key}-next" aria-label="Siguiente" disabled>›</button>
            </div>
        </div>
    `;

    const trackEl = document.querySelector(`#${key}-track`);
    const prevBtn = document.querySelector(`#${key}-prev`);
    const nextBtn = document.querySelector(`#${key}-next`);
    if (trackEl && prevBtn && nextBtn) {
        wireRowScroll(trackEl, prevBtn, nextBtn);
    }
}

SECTIONS.forEach(loadSection);
