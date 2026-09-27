import { supabase } from './supabaseClient.js';
import './img-fallback.js';
import { escapeHTML } from './html.js';
import {
    hasAdultAccess,
    getBirthDate,
    askBirthDate,
    ageFromBirthDate,
    underageGateHTML,
    adultPaywallHTML,
    requireAdultConfirmation,
    resolveAdultMediaUrl,
} from './adult-gate.js';

const gate = document.querySelector('#adult-gate');
const grid = document.querySelector('#adult-grid');

// Orden de las verificaciones (todas antes de pedir un solo título +18):
//   1. Sesión iniciada
//   2. Fecha de nacimiento registrada y 18+ años
//   3. Plan "adult" activo (lo decide has_adult_access() en la base de datos)
//   4. Confirmación "soy mayor de edad" en esta sesión del navegador
async function init() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        showLoginGate();
        return;
    }

    let birthDate = await getBirthDate(session.user.id);

    if (birthDate === undefined) {
        gate.textContent = 'No se pudo cargar tu perfil. Intenta más tarde.';
        return;
    }

    if (!birthDate) {
        birthDate = await askBirthDate(gate, session.user.id);
    }

    if (ageFromBirthDate(birthDate) < 18) {
        gate.innerHTML = underageGateHTML();
        return;
    }

    if (!(await hasAdultAccess())) {
        gate.innerHTML = adultPaywallHTML();
        return;
    }

    await requireAdultConfirmation(gate);

    gate.textContent = 'Cargando…';
    await loadAdultCatalog();
}

function showLoginGate() {
    const redirectTo = encodeURIComponent(window.location.pathname);

    gate.innerHTML = `
        <div class="login-gate">
            <img
                src="/Assets/Imgs/Icon-inicia-sesion.png"
                alt=""
                class="login-gate-sticker"
                loading="lazy">
            <div class="login-gate-text">
                <h2>Inicia sesión para continuar</h2>
                <p>Esta sección requiere una cuenta verificada como mayor de edad.</p>
            </div>
            <div class="player-gate-actions">
                <a href="/FrontEnd/Login.html?redirect=${redirectTo}" class="btn-gradient">Iniciar sesión</a>
                <a href="/FrontEnd/Register.html" class="btn-outline">Crear cuenta</a>
            </div>
        </div>
    `;
}

function cardHTML(anime, coverUrl) {
    const tag = anime.type === 'movie' ? 'Película' : 'Serie';

    const thumb = coverUrl
        ? `<img class="card-thumb" src="${escapeHTML(coverUrl)}" alt="Portada de ${escapeHTML(anime.title)}" loading="lazy"
                data-fallback="card-thumb card-thumb--empty">`
        : `<div class="card-thumb card-thumb--empty"></div>`;

    return `
        <a class="anime-card-link" href="/FrontEnd/Anime.html?slug=${encodeURIComponent(anime.slug)}">
            <article class="anime-card">
                ${thumb}
                <div class="card-body">
                    <span class="card-tag">${tag} · +18</span>
                    <h3>${escapeHTML(anime.title)}</h3>
                    <p>${escapeHTML(anime.description)}</p>
                </div>
            </article>
        </a>
    `;
}

async function loadAdultCatalog() {
    const { data, error } = await supabase
        .from('anime')
        .select('title, slug, description, type, cover_url')
        .eq('is_adult', true)
        .order('created_at', { ascending: false });

    if (error) {
        gate.textContent = 'No se pudo cargar el catálogo. Intenta más tarde.';
        return;
    }

    const covers = await Promise.all(data.map((anime) => resolveAdultMediaUrl(anime.cover_url)));

    gate.hidden = true;
    grid.hidden = false;
    grid.innerHTML = data.length
        ? data.map((anime, i) => cardHTML(anime, covers[i])).join('')
        : '<p class="catalog-empty">Todavía no hay contenido en esta sección.</p>';
}

init();
