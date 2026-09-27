// Escapa texto antes de meterlo en HTML con innerHTML. Todo lo que viene
// de la base de datos (títulos, descripciones, URLs de imágenes) pasa por
// aquí: si alguien lograra guardar un título con código, se mostraría como
// texto en vez de ejecutarse en el navegador de los usuarios.
export function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
