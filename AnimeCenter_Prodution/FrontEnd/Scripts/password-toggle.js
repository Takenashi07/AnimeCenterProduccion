// Botón del ojito para mostrar/ocultar la contraseña (Login, Register y
// RestablecerContrasena). Antes vivía como <script> pegado en cada página;
// en archivo aparte funciona con la Content-Security-Policy, que bloquea el
// código pegado directo en el HTML.
document.querySelectorAll('.toggle-password').forEach((toggleBtn) => {
    const input = toggleBtn.closest('.input-wrap')?.querySelector('input');
    const eyeIcon = toggleBtn.querySelector('.eye-icon, #eye-icon');
    const eyeOffIcon = toggleBtn.querySelector('.eye-off-icon, #eye-off-icon');

    if (!input || !eyeIcon || !eyeOffIcon) return;

    toggleBtn.addEventListener('click', () => {
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        toggleBtn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
        // Los íconos son <svg>: en ellos la propiedad .hidden no existe, hay
        // que poner/quitar el atributo directamente.
        eyeIcon.toggleAttribute('hidden', isHidden);
        eyeOffIcon.toggleAttribute('hidden', !isHidden);
    });
});
