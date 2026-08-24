import { supabase } from './supabaseClient.js';

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
}