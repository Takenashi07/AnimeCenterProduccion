import { supabase } from './supabaseClient.js';

const sectionEl = document.querySelector('#home-carousel-section');
const trackEl = document.querySelector('#home-carousel-track');
const prevBtn = document.querySelector('#slider-prev');
const nextBtn = document.querySelector('#slider-next');
const dotsEl = document.querySelector('#slider-dots');

const SLIDE_MS = 5000; // tiempo entre transiciones automáticas

async function fetchSlots() {
    return supabase
        .from('home_carousel_slots')
        .select('position, image_url, anime:anime_id(slug, title, description, type)')
        .order('position', { ascending: true });
}

async function initCarousel() {
    if (!sectionEl || !trackEl) return;

    const { data, error } = await fetchSlots();

    if (error) {
        sectionEl.hidden = true;
        return;
    }

    const slides = (data || []).filter((row) => row.image_url);

    if (slides.length === 0) {
        sectionEl.hidden = true;
        return;
    }

    const N = slides.length;

    function slideHTML(slide) {
        const anime = slide.anime || {};
        const img = `<img src="${slide.image_url}" alt="${anime.title || ''}">`;
        const hasInfo = Boolean(anime.title);

        const info = hasInfo
            ? `
                <div class="slide-overlay"></div>
                <div class="slide-info">
                    <span class="slide-badge">${anime.type === 'movie' ? 'Película' : 'Serie'}</span>
                    <h2 class="slide-title">${anime.title}</h2>
                    ${anime.description ? `<p class="slide-desc">${anime.description}</p>` : ''}
                    <div class="slide-actions">
                        ${anime.slug ? `<a href="Anime.html?slug=${anime.slug}" class="slide-btn slide-btn--primary">▶ Ver ahora</a>` : ''}
                    </div>
                </div>
            `
            : '';

        return `<li>${img}${info}</li>`;
    }

    // Clones al inicio y al final para permitir bucle infinito
    // tanto hacia adelante como hacia atrás.
    const htmlSlides = slides.map(slideHTML);
    trackEl.innerHTML = [
        slideHTML(slides[N - 1]), // clon del último, al inicio
        ...htmlSlides,
        slideHTML(slides[0]),     // clon del primero, al final
    ].join('');

    const totalSlots = N + 2;
    trackEl.querySelectorAll('li').forEach((li) => {
        li.style.width = `${100 / totalSlots}%`;
    });
    trackEl.style.width = `${totalSlots * 100}%`;

    // Los slides reales viven en el índice 1..N; 0 y N+1 son clones.
    let currentIndex = 1;
    let autoplayId = null;

    function renderDots() {
        if (!dotsEl) return;
        dotsEl.innerHTML = slides
            .map((_, i) => `<button type="button" class="slider-dot" data-index="${i}" aria-label="Ir al slide ${i + 1}"></button>`)
            .join('');
    }

    function updateDots() {
        if (!dotsEl) return;
        const realIndex = ((currentIndex - 1) + N) % N;
        dotsEl.querySelectorAll('.slider-dot').forEach((dot, i) => {
            dot.classList.toggle('is-active', i === realIndex);
        });
    }

    function goTo(index, { animate = true } = {}) {
        trackEl.style.transition = animate ? 'transform 0.8s ease' : 'none';
        trackEl.style.transform = `translateX(-${(index * 100) / totalSlots}%)`;
        currentIndex = index;
        updateDots();
    }

    function next() {
        goTo(currentIndex + 1);
    }

    function prev() {
        goTo(currentIndex - 1);
    }

    trackEl.addEventListener('transitionend', () => {
        if (currentIndex === totalSlots - 1) {
            // Estamos en el clon del primero: saltamos al original real.
            goTo(1, { animate: false });
        } else if (currentIndex === 0) {
            // Estamos en el clon del último: saltamos al original real.
            goTo(N, { animate: false });
        }
    });

    function startAutoplay() {
        if (N <= 1) return;
        stopAutoplay();
        autoplayId = setInterval(next, SLIDE_MS);
    }

    function stopAutoplay() {
        if (autoplayId) clearInterval(autoplayId);
        autoplayId = null;
    }

    nextBtn?.addEventListener('click', () => {
        next();
        startAutoplay(); // reinicia el timer al navegar manualmente
    });

    prevBtn?.addEventListener('click', () => {
        prev();
        startAutoplay();
    });

    dotsEl?.addEventListener('click', (e) => {
        const dot = e.target.closest('.slider-dot');
        if (!dot) return;
        goTo(Number(dot.dataset.index) + 1);
        startAutoplay();
    });

    sectionEl.addEventListener('mouseenter', stopAutoplay);
    sectionEl.addEventListener('mouseleave', startAutoplay);

    const hasControls = N > 1;
    if (prevBtn) prevBtn.hidden = !hasControls;
    if (nextBtn) nextBtn.hidden = !hasControls;
    if (dotsEl) dotsEl.hidden = !hasControls;

    renderDots();
    goTo(1, { animate: false });
    startAutoplay();
}

initCarousel();