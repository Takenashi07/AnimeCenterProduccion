import { supabase, SUPABASE_URL } from './supabaseClient.js';
import { getBirthDate, ageFromBirthDate } from './adult-gate.js';

const errorBox = document.querySelector('#form-error');
const planButtons = document.querySelectorAll('.premium-plan-btn');

function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
}

// Los admins ya tienen acceso completo sin costo: los botones de pago se
// desactivan (la Edge Function además rechaza cobrarles).
async function disablePlansForAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_admin) return;

    planButtons.forEach((button) => {
        button.disabled = true;
        button.textContent = 'Incluido (admin)';
    });
}

disablePlansForAdmin();

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

        // El plan adulto solo se vende a cuentas con 18+ años registrados.
        // (Aunque alguien se lo saltara, has_adult_access() en la base de
        // datos tampoco le daría acceso sin esa fecha.)
        if (tier === 'adult') {
            const birthDate = await getBirthDate(session.user.id);

            if (birthDate === undefined) {
                showError('No se pudo verificar tu edad. Intenta de nuevo.');
                return;
            }

            if (!birthDate) {
                // Adultos.html pide la fecha y luego regresa a los planes.
                window.location.href = '/FrontEnd/Adultos.html';
                return;
            }

            if (ageFromBirthDate(birthDate) < 18) {
                showError('El plan con contenido adulto solo está disponible para mayores de 18 años.');
                return;
            }
        }
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
