import { supabase, SUPABASE_URL } from './supabaseClient.js';
import { getActiveTier, TIER_LABELS } from './entitlements.js';

const avatarEl = document.querySelector('#profile-page-avatar');
const avatarInput = document.querySelector('#avatar-input');
const usernameInput = document.querySelector('#username');
const emailInput = document.querySelector('#email');
const form = document.querySelector('#profile-form');
const saveBtn = document.querySelector('#profile-save-btn');
const errorBox = document.querySelector('#form-error');
const successBox = document.querySelector('#form-success');

const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB

function showError(message) {
    successBox.hidden = true;
    errorBox.textContent = message;
    errorBox.hidden = false;
}

function showSuccess(message) {
    errorBox.hidden = true;
    successBox.textContent = message;
    successBox.hidden = false;
}

function hideMessages() {
    errorBox.hidden = true;
    successBox.hidden = true;
}

function renderAvatar(avatarUrl, fallbackInitial) {
    if (avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Tu foto de perfil">`;
    } else {
        avatarEl.textContent = fallbackInitial;
    }
}

// --- Proteger la página: sin sesión, no hay nada que mostrar ---

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
    window.location.href = '/FrontEnd/Login.html';
} else {
    const user = session.user;
    const currentUsername = user.user_metadata?.username || user.email.split('@')[0];
    let avatarUrl = user.user_metadata?.avatar_url || null;

    usernameInput.value = currentUsername;
    emailInput.value = user.email;
    renderAvatar(avatarUrl, currentUsername.charAt(0).toUpperCase());

    renderMembership();
    setupDeleteAccount();

    avatarInput.addEventListener('change', async () => {
        const file = avatarInput.files[0];
        if (!file) return;

        hideMessages();

        if (file.size > MAX_AVATAR_BYTES) {
            showError('La imagen pesa demasiado (máximo 2 MB).');
            avatarInput.value = '';
            return;
        }

        const extension = file.name.split('.').pop();
        const path = `${user.id}/avatar.${extension}`;

        const { error: uploadError } = await supabase
            .storage
            .from('avatars')
            .upload(path, file, { upsert: true });

        if (uploadError) {
            showError('No se pudo subir la imagen: ' + uploadError.message);
            avatarInput.value = '';
            return;
        }

        // Le agregamos un parámetro con la hora actual para evitar que el
        // navegador muestre una versión vieja cacheada de la misma URL.
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
        const freshAvatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

        const { error: authError } = await supabase.auth.updateUser({
            data: { avatar_url: freshAvatarUrl }
        });

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ avatar_url: freshAvatarUrl })
            .eq('id', user.id);

        if (authError || profileError) {
            showError('La imagen se subió, pero no se pudo guardar en tu perfil.');
            return;
        }

        avatarUrl = freshAvatarUrl;
        renderAvatar(avatarUrl, currentUsername.charAt(0).toUpperCase());
        showSuccess('Tu foto de perfil se actualizó.');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideMessages();

        const newUsername = usernameInput.value.trim();

        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando…';

        // Actualiza el username en dos lugares: los metadatos de auth
        // (que usa session.js para el navbar) y la tabla profiles
        // (la fuente pública de username para el resto del sitio).
        const { error: authError } = await supabase.auth.updateUser({
            data: { username: newUsername }
        });

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ username: newUsername })
            .eq('id', user.id);

        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar cambios';

        if (authError || profileError) {
            const message = (authError || profileError).message;
            showError(
                message.includes('duplicate') || message.includes('unique')
                    ? 'Ese nombre de usuario ya está en uso.'
                    : message
            );
            return;
        }

        renderAvatar(avatarUrl, newUsername.charAt(0).toUpperCase());
        showSuccess('Tus cambios se guardaron correctamente.');
    });

    async function renderMembership() {
        const statusEl = document.querySelector('#membership-status');
        const ctaEl = document.querySelector('#membership-cta');
        const cancelBtn = document.querySelector('#membership-cancel-btn');
        const membershipErrorEl = document.querySelector('#membership-error');
        if (!statusEl) return;

        const { data: profileRow } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        const tier = await getActiveTier();

        if (profileRow?.is_admin) {
            statusEl.textContent = 'Acceso de administrador (sin costo).';
            ctaEl.hidden = true;
            cancelBtn.hidden = true;
        } else if (tier === 'free') {
            statusEl.textContent = 'No tienes una membresía activa.';
            ctaEl.hidden = false;
            ctaEl.textContent = 'Ver planes';
            cancelBtn.hidden = true;
        } else {
            statusEl.textContent = `Plan activo: ${TIER_LABELS[tier]}.`;
            ctaEl.hidden = false;
            ctaEl.textContent = tier === 'adult' ? 'Ver planes' : 'Mejorar plan';
            cancelBtn.hidden = false;
        }

        cancelBtn.onclick = async () => {
            membershipErrorEl.hidden = true;

            const confirmed = window.confirm('¿Seguro que quieres cancelar tu suscripción? Perderás el acceso al contenido premium.');
            if (!confirmed) return;

            cancelBtn.disabled = true;
            cancelBtn.textContent = 'Cancelando…';

            try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/mp-cancel-subscription`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });

                const data = await response.json();

                if (!response.ok) {
                    membershipErrorEl.textContent = data.error || 'No se pudo cancelar tu suscripción.';
                    membershipErrorEl.hidden = false;
                    return;
                }

                await renderMembership();
            } finally {
                cancelBtn.disabled = false;
                cancelBtn.textContent = 'Cancelar suscripción';
            }
        };
    }

    function setupDeleteAccount() {
        const openBtn = document.querySelector('#delete-account-open-btn');
        const confirmPanel = document.querySelector('#delete-account-confirm');
        const checkbox = document.querySelector('#delete-account-checkbox');
        const usernameHint = document.querySelector('#delete-account-username-hint');
        const input = document.querySelector('#delete-account-input');
        const cancelBtn = document.querySelector('#delete-account-cancel-btn');
        const confirmBtn = document.querySelector('#delete-account-confirm-btn');
        const deleteErrorEl = document.querySelector('#delete-account-error');

        if (!openBtn) return;

        usernameHint.textContent = currentUsername;

        function resetPanel() {
            confirmPanel.hidden = true;
            openBtn.hidden = false;
            checkbox.checked = false;
            input.value = '';
            deleteErrorEl.hidden = true;
            confirmBtn.disabled = true;
        }

        function updateConfirmState() {
            // Compara contra el username actual en el campo (no uno viejo en
            // memoria), por si lo acaba de cambiar en el formulario de arriba.
            confirmBtn.disabled = !(checkbox.checked && input.value.trim() === usernameInput.value.trim());
        }

        openBtn.addEventListener('click', () => {
            openBtn.hidden = true;
            confirmPanel.hidden = false;
            usernameHint.textContent = usernameInput.value.trim();
        });

        cancelBtn.addEventListener('click', resetPanel);

        checkbox.addEventListener('change', updateConfirmState);
        input.addEventListener('input', updateConfirmState);

        confirmBtn.addEventListener('click', async () => {
            deleteErrorEl.hidden = true;
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Eliminando…';

            try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });

                const data = await response.json();

                if (!response.ok) {
                    deleteErrorEl.textContent = data.error || 'No se pudo eliminar tu cuenta.';
                    deleteErrorEl.hidden = false;
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Eliminar cuenta definitivamente';
                    return;
                }

                await supabase.auth.signOut();
                window.location.href = '/index.html';
            } catch (err) {
                deleteErrorEl.textContent = 'No se pudo conectar con el servidor.';
                deleteErrorEl.hidden = false;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Eliminar cuenta definitivamente';
            }
        });
    }
}