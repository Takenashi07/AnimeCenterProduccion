import { supabase } from './supabaseClient.js';

const form = document.querySelector('#feedback-form');

if (form) {
    const errorBox = document.querySelector('#feedback-error');
    const successBox = document.querySelector('#feedback-success');
    const submitBtn = document.querySelector('#feedback-submit-btn');
    const emailField = document.querySelector('#feedback-email-field');
    const emailInput = document.querySelector('#feedback-email');
    const messageInput = document.querySelector('#feedback-message');
    const messageCount = document.querySelector('#feedback-count');

    messageInput.addEventListener('input', () => {
        messageCount.textContent = messageInput.value.length;
    });

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

    // Si el usuario tiene sesión, ya sabemos su correo — no hace falta pedirlo.
    let loggedInUserId = null;

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loggedInUserId = session.user.id;
        emailField.hidden = true;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorBox.hidden = true;
        successBox.hidden = true;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando…';

        const payload = {
            user_id: loggedInUserId,
            type: form.type.value,
            message: messageInput.value.trim(),
            email: loggedInUserId ? null : (emailInput.value.trim() || null),
        };

        const { error } = await supabase.from('feedback').insert(payload);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar';

        if (error) {
            showError('No se pudo enviar tu mensaje: ' + error.message);
            return;
        }

        showSuccess('¡Gracias! Tu mensaje se envió correctamente.');
        form.reset();
        messageCount.textContent = '0';
    });
}