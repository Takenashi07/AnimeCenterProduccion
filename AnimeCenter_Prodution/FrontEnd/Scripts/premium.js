import { supabase, SUPABASE_URL } from './supabaseClient.js';

const errorBox = document.querySelector('#form-error');
const planButtons = document.querySelectorAll('.premium-plan-btn');

function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
}

planButtons.forEach((button) => {
    button.addEventListener('click', async () => {
        errorBox.hidden = true;

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            const redirectTo = encodeURIComponent('/FrontEnd/Premium.html');
            window.location.href = `/FrontEnd/Login.html?redirect=${redirectTo}`;
            return;
        }

        const tier = button.dataset.tier;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Un momento…';

        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ tier, origin: window.location.origin }),
            });

            const data = await response.json();

            if (!response.ok) {
                showError(data.error || 'No se pudo iniciar el pago. Intenta de nuevo.');
                return;
            }

            window.location.href = data.init_point;
        } catch (err) {
            showError('No se pudo conectar con el servidor de pagos.');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
});
