import { supabase } from './supabaseClient.js';

async function renderNav() {
    const loginLink = document.querySelector('#nav-login');
    const registerLink = document.querySelector('#nav-register');
    const profileMenu = document.querySelector('#profile-menu');
    const heroCta = document.querySelector('#hero-cta');
    const adminItem = document.querySelector('#nav-admin-item');

    // Esta página no tiene navbar (por ejemplo Login/Register) — no hacer nada.
    if (!loginLink || !registerLink || !profileMenu) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        const username = session.user.user_metadata?.username
            || session.user.email.split('@')[0];

        loginLink.hidden = true;
        registerLink.hidden = true;
        profileMenu.hidden = false;
        if (heroCta) heroCta.hidden = true;

        document.querySelector('#profile-username').textContent = username;

        const triggerNameEl = document.querySelector('#profile-trigger-name');
        if (triggerNameEl) triggerNameEl.textContent = username;

        const avatarEl = document.querySelector('#profile-avatar');
        const avatarUrl = session.user.user_metadata?.avatar_url;

        if (avatarUrl) {
            avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Tu foto de perfil">`;
        } else {
            avatarEl.textContent = username.charAt(0).toUpperCase();
        }

        // El link "Admin" solo se muestra a usuarios con is_admin = true.
        if (adminItem) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();

            adminItem.hidden = !profile?.is_admin;
        }
    } else {
        loginLink.hidden = false;
        registerLink.hidden = false;
        profileMenu.hidden = true;
        if (heroCta) heroCta.hidden = false;
        if (adminItem) adminItem.hidden = true;
    }
}

renderNav();

// Si el usuario inicia/cierra sesión en otra pestaña, esta navbar se actualiza sola.
supabase.auth.onAuthStateChange(() => renderNav());

// ---------- Dropdown del perfil ----------

const trigger = document.querySelector('#profile-trigger');
const dropdown = document.querySelector('#profile-dropdown');

if (trigger && dropdown) {
    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!isOpen));
        dropdown.hidden = isOpen;
    });

    document.addEventListener('click', (event) => {
        if (!trigger.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
}

// ---------- Cerrar sesión ----------

const logoutBtn = document.querySelector('#logout-btn');

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
}