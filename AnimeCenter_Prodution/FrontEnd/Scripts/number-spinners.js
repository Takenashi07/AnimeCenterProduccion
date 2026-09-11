// Botones propios (+/-) para los input[type=number] del admin (Año,
// Episodios, Temporada, Número de capítulo). Las flechitas nativas del
// navegador se ocultaron por CSS porque no se pueden pintar con los
// colores del sitio (sobre todo en Firefox) — esto reemplaza su
// función: sumar/restar 1 (o el "step" del input) respetando min/max.

document.querySelectorAll('.input-wrap--number').forEach((wrap) => {
    const input = wrap.querySelector('input[type="number"]');
    const upBtn = wrap.querySelector('.number-spin-btn--up');
    const downBtn = wrap.querySelector('.number-spin-btn--down');
    if (!input || !upBtn || !downBtn) return;

    function applyStep(direction) {
        const stepValue = Number(input.step) || 1;
        const min = input.min !== '' ? Number(input.min) : -Infinity;
        const max = input.max !== '' ? Number(input.max) : Infinity;
        const current = Number(input.value) || 0;

        const next = Math.min(max, Math.max(min, current + direction * stepValue));

        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    upBtn.addEventListener('click', () => applyStep(1));
    downBtn.addEventListener('click', () => applyStep(-1));
});
