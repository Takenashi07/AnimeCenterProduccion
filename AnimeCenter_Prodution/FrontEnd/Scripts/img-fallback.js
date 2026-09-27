// Reemplaza las imágenes que no cargan (portada rota, foto que no existe)
// por un recuadro. Cada <img> dice con qué reemplazarse:
//   data-fallback="clases del recuadro"
//   data-fallback-text="texto dentro del recuadro"   (opcional)
//   data-fallback-style="estilos del recuadro"       (opcional)
//
// Antes esto era un onerror="..." pegado en cada <img>; la
// Content-Security-Policy bloquea ese código, así que ahora un solo
// vigilante escucha los errores de todas las imágenes.

function replaceWithFallback(img) {
    const box = document.createElement('div');
    box.className = img.dataset.fallback;
    if (img.dataset.fallbackText) box.textContent = img.dataset.fallbackText;
    if (img.dataset.fallbackStyle) box.style.cssText = img.dataset.fallbackStyle;
    img.replaceWith(box);
}

// Los errores de imagen no "suben" por el documento: hay que escucharlos
// en fase de captura (el `true` del final).
document.addEventListener('error', (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.dataset.fallback) {
        replaceWithFallback(img);
    }
}, true);

// Imágenes que ya fallaron antes de que este archivo cargara (las que
// vienen escritas en el HTML, como en Nosotros).
document.querySelectorAll('img[data-fallback]').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) replaceWithFallback(img);
});
