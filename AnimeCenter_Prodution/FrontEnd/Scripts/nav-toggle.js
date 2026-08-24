// Controla el botón hamburguesa del navbar en móvil. No depende de
// Supabase ni de sesión — es puramente de interfaz, así que se puede
// cargar en cualquier página que tenga el navbar estándar.

document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('#nav-hamburger');
    const navCenter = document.querySelector('.nav-center');

    if (!hamburger || !navCenter) return;

    function closeMenu() {
        navCenter.classList.remove('is-open');
        hamburger.classList.remove('is-active');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    function toggleMenu() {
        const isOpen = navCenter.classList.toggle('is-open');
        hamburger.classList.toggle('is-active', isOpen);
        hamburger.setAttribute('aria-expanded', String(isOpen));
        // Evita que el fondo haga scroll mientras el panel está abierto.
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    hamburger.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMenu();
    });

    // Cierra al elegir un link o dar clic en "Guardados", para no
    // dejarlo abierto tapando la página a la que acabas de navegar.
    navCenter.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
    });

    // Cierra si el usuario envía el buscador desde dentro del panel.
    navCenter.querySelector('.nav-search')?.addEventListener('submit', closeMenu);

    // Cierra con la tecla Escape.
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && navCenter.classList.contains('is-open')) {
            closeMenu();
        }
    });

    // Si la ventana vuelve a un ancho de escritorio (ej. al girar una
    // tablet o rotar el estado de las DevTools), se asegura de resetear
    // el estado para que no se quede "abierto" fuera del breakpoint móvil.
    window.addEventListener('resize', () => {
        if (window.innerWidth > 800) closeMenu();
    });
});