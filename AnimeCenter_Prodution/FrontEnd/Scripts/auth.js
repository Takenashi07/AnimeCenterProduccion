import { supabase } from './supabaseClient.js';

function showError(box, message) {
    box.textContent = message;
    box.hidden = false;
}

function hideError(box) {
    box.hidden = true;
    box.textContent = '';
}

function setLoading(button, isLoading, idleText) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Un momento…' : idleText;
}

// ---------- LOGIN ----------

const loginForm = document.querySelector('#login-form');

if (loginForm) {
    const errorBox = document.querySelector('#form-error');
    const submitBtn = loginForm.querySelector('.btn-submit');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError(errorBox);

        const email = loginForm.querySelector('#email').value.trim();
        const password = loginForm.querySelector('#password').value;

        setLoading(submitBtn, true, 'Iniciar sesión');

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        setLoading(submitBtn, false, 'Iniciar sesión');

        if (error) {
            showError(errorBox, 'Correo o contraseña incorrectos.');
            return;
        }

        // Si venías de una página protegida (ej. un capítulo), te regresa ahí.
        // Si no, te manda al Home como antes.
        const params = new URLSearchParams(window.location.search);
        const redirectTo = params.get('redirect');
        window.location.href = redirectTo ? decodeURIComponent(redirectTo) : '/index.html';
    });
}

// ---------- REGISTRO ----------

const registerForm = document.querySelector('#register-form');

if (registerForm) {
    const errorBox = document.querySelector('#form-error');
    const submitBtn = registerForm.querySelector('.btn-submit');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError(errorBox);

        const username = registerForm.querySelector('#username').value.trim();
        const email = registerForm.querySelector('#email').value.trim();
        const password = registerForm.querySelector('#password').value;
        const confirmPassword = registerForm.querySelector('#confirm-password').value;

        if (password !== confirmPassword) {
            showError(errorBox, 'Las contraseñas no coinciden.');
            return;
        }

        setLoading(submitBtn, true, 'Crear cuenta');

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });

        setLoading(submitBtn, false, 'Crear cuenta');

        if (error) {
            // Supabase ya trae mensajes razonables en inglés; los más comunes
            // se traducen aquí para mantener la app en español.
            const message = error.message.includes('already registered')
                ? 'Ese correo ya tiene una cuenta.'
                : error.message.includes('Password should be')
                ? 'La contraseña debe tener al menos 8 caracteres.'
                : error.message;
            showError(errorBox, message);
            return;
        }

        window.location.href = '/FrontEnd/Login.html';
    });
}

// ---------- OLVIDÉ MI CONTRASEÑA ----------

const forgotForm = document.querySelector('#forgot-password-form');

if (forgotForm) {
    const errorBox = document.querySelector('#form-error');
    const successBox = document.querySelector('#form-success');
    const submitBtn = document.querySelector('#forgot-submit-btn');

    forgotForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError(errorBox);
        successBox.hidden = true;

        const email = forgotForm.querySelector('#email').value.trim();

        setLoading(submitBtn, true, 'Enviar enlace');

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/FrontEnd/RestablecerContrasena.html`,
        });

        setLoading(submitBtn, false, 'Enviar enlace');

        if (error) {
            showError(errorBox, 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.');
            return;
        }

        // No confirmamos ni negamos si el correo existe en la base —
        // evita que alguien use este formulario para verificar cuentas registradas.
        successBox.textContent = 'Si ese correo tiene una cuenta, te enviamos un enlace para restablecer tu contraseña.';
        successBox.hidden = false;
        forgotForm.reset();
    });
}

// ---------- RESTABLECER CONTRASEÑA (después de hacer clic en el correo) ----------

const resetForm = document.querySelector('#reset-password-form');

if (resetForm) {
    const gate = document.querySelector('#link-gate');
    const errorBox = document.querySelector('#form-error');
    const successBox = document.querySelector('#form-success');
    const submitBtn = document.querySelector('#reset-submit-btn');

    let recoveryReady = false;

    // Supabase procesa el token del enlace de forma asíncrona al cargar la
    // página y dispara este evento cuando la sesión de recuperación queda lista.
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
            recoveryReady = true;
            gate.hidden = true;
            resetForm.hidden = false;
        }
    });

    // Si el enlace ya expiró o es inválido, ese evento nunca llega —
    // avisamos en vez de dejar la pantalla en "Verificando…" para siempre.
    setTimeout(() => {
        if (!recoveryReady) {
            gate.textContent = 'Este enlace no es válido o ya expiró. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".';
        }
    }, 4000);

    resetForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError(errorBox);
        successBox.hidden = true;

        const password = resetForm.querySelector('#password').value;
        const confirmPassword = resetForm.querySelector('#confirm-password').value;

        if (password !== confirmPassword) {
            showError(errorBox, 'Las contraseñas no coinciden.');
            return;
        }

        setLoading(submitBtn, true, 'Guardar nueva contraseña');

        const { error } = await supabase.auth.updateUser({ password });

        setLoading(submitBtn, false, 'Guardar nueva contraseña');

        if (error) {
            showError(
                errorBox,
                error.message.includes('Password should be')
                    ? 'La contraseña debe tener al menos 8 caracteres.'
                    : 'No se pudo actualizar tu contraseña.'
            );
            return;
        }

        successBox.textContent = 'Tu contraseña se actualizó. Redirigiendo al inicio de sesión…';
        successBox.hidden = false;
        resetForm.hidden = true;

        setTimeout(() => { window.location.href = '/FrontEnd/Login.html'; }, 2000);
    });
}