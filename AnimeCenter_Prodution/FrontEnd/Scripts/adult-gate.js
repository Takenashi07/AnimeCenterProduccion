import { supabase } from './supabaseClient.js';

// Confirmación de "soy mayor de edad" para el contenido +18.
// Se guarda solo en sessionStorage (no en el perfil ni en la base de
// datos): se vuelve a pedir en cada sesión nueva del navegador. La
// restricción real de quién puede ver el contenido la impone la base de
// datos (RLS con has_adult_access()) — esto es solo la fricción extra que
// pide el usuario, no el mecanismo de seguridad.
const KEY = 'ac_adult_confirmed';

// Bucket privado de Supabase donde viven portadas y videos +18 (solo lo
// pueden leer cuentas con has_adult_access()). Las URLs firmadas caducan solas.
export const ADULT_BUCKET = 'adult-media';
const SIGNED_URL_SECONDS = 60 * 60 * 4;

export function isAdultConfirmed() {
    try {
        return sessionStorage.getItem(KEY) === '1';
    } catch {
        return false;
    }
}

export function confirmAdultAccess() {
    try {
        sessionStorage.setItem(KEY, '1');
    } catch {
        // sessionStorage no disponible (modo privado, etc.) — no es crítico.
    }
}

// Pregunta a la base de datos (la misma función que usan las políticas
// RLS), así el frontend nunca decide por su cuenta quién tiene acceso.
export async function hasAdultAccess() {
    const { data, error } = await supabase.rpc('has_adult_access');
    return !error && data === true;
}

export function ageFromBirthDate(birthDate) {
    const birth = new Date(`${birthDate}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const hadBirthday = today.getMonth() > birth.getMonth()
        || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
    if (!hadBirthday) age -= 1;
    return age;
}

// Para contenido +18, cover_url / video_url guardan la ruta dentro del
// bucket privado (no una URL pública) y aquí se convierte en URL firmada.
export async function resolveAdultMediaUrl(pathOrUrl) {
    if (!pathOrUrl) return null;
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;

    const { data, error } = await supabase
        .storage
        .from(ADULT_BUCKET)
        .createSignedUrl(pathOrUrl, SIGNED_URL_SECONDS);

    return error ? null : data.signedUrl;
}

export function ageGateHTML() {
    return `
        <div class="login-gate login-gate--plain">
            <div class="login-gate-text">
                <h2>Contenido para mayores de edad</h2>
                <p>Esta sección incluye series y películas con temática para adultos (+18). Al continuar, confirmas que tienes 18 años o más.</p>
            </div>
            <div class="player-gate-actions">
                <button type="button" class="btn-gradient" id="age-gate-confirm-btn">Sí, soy mayor de 18 años</button>
                <a href="/index.html" class="btn-outline">No, salir</a>
            </div>
        </div>
    `;
}

export function birthDateGateHTML() {
    const today = new Date().toISOString().slice(0, 10);

    return `
        <div class="login-gate login-gate--plain">
            <div class="login-gate-text">
                <h2>Verificación de edad</h2>
                <p>Para acceder al contenido +18 necesitamos tu fecha de nacimiento. Una vez guardada <strong>no se puede cambiar</strong>, así que ingrésala con cuidado.</p>
            </div>
            <form class="age-gate-form" id="birth-date-form">
                <label for="birth-date-input">Fecha de nacimiento</label>
                <input type="date" id="birth-date-input" name="birth_date" required min="1900-01-01" max="${today}">
                <p class="form-error" id="birth-date-error" hidden></p>
                <div class="player-gate-actions">
                    <button type="submit" class="btn-gradient">Guardar</button>
                    <a href="/index.html" class="btn-outline">Salir</a>
                </div>
            </form>
        </div>
    `;
}

export function underageGateHTML() {
    return `
        <div class="login-gate login-gate--plain">
            <div class="login-gate-text">
                <h2>Esta sección no está disponible para ti</h2>
                <p>El contenido para adultos solo está disponible para personas de 18 años o más.</p>
            </div>
            <div class="player-gate-actions">
                <a href="/index.html" class="btn-gradient">Volver al inicio</a>
            </div>
        </div>
    `;
}

export function adultPaywallHTML() {
    return `
        <div class="login-gate login-gate--plain">
            <div class="login-gate-text">
                <h2>Necesitas el plan "Series + contenido adulto"</h2>
                <p>El contenido +18 está incluido solo en ese plan.</p>
            </div>
            <div class="player-gate-actions">
                <a href="/FrontEnd/Premium.html" class="btn-gradient">Ver planes</a>
            </div>
        </div>
    `;
}

// Lee la fecha de nacimiento del perfil. Devuelve undefined si hubo error.
export async function getBirthDate(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('birth_date')
        .eq('id', userId)
        .single();

    return error ? undefined : data?.birth_date ?? null;
}

// Monta el formulario de fecha de nacimiento dentro de `container` y
// resuelve con la fecha guardada. La base de datos bloquea cambiarla
// después (trigger guard_birth_date).
export function askBirthDate(container, userId) {
    container.innerHTML = birthDateGateHTML();

    const form = container.querySelector('#birth-date-form');
    const input = container.querySelector('#birth-date-input');
    const errorEl = container.querySelector('#birth-date-error');

    return new Promise((resolve) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorEl.hidden = true;

            const value = input.value;
            if (!value) return;

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;

            const { error } = await supabase
                .from('profiles')
                .update({ birth_date: value })
                .eq('id', userId);

            submitBtn.disabled = false;

            if (error) {
                errorEl.textContent = 'No se pudo guardar la fecha: ' + error.message;
                errorEl.hidden = false;
                return;
            }

            resolve(value);
        });
    });
}

// Muestra la confirmación de sesión dentro de `container` y resuelve
// cuando el usuario acepta. Si ya confirmó en esta sesión, resuelve directo.
export function requireAdultConfirmation(container) {
    if (isAdultConfirmed()) return Promise.resolve();

    container.hidden = false;
    container.innerHTML = ageGateHTML();

    return new Promise((resolve) => {
        container.querySelector('#age-gate-confirm-btn').addEventListener('click', () => {
            confirmAdultAccess();
            resolve();
        });
    });
}
