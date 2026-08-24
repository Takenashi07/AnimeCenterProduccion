import { supabase } from './supabaseClient.js';

const gate = document.querySelector('#admin-gate');
const panel = document.querySelector('#admin-panel');
const form = document.querySelector('#anime-form');
const formTitle = document.querySelector('#form-title');
const cancelEditBtn = document.querySelector('#cancel-edit-btn');
const saveBtn = document.querySelector('#anime-save-btn');
const errorBox = document.querySelector('#form-error');
const successBox = document.querySelector('#form-success');
const catalogTabsEl = document.querySelector('#catalog-tabs');
const catalogSearchInput = document.querySelector('#catalog-search');
const filterStatusEl = document.querySelector('#filter-status');
const filterGenreEl = document.querySelector('#filter-genre');
const filterYearEl = document.querySelector('#filter-year');
const filterSortEl = document.querySelector('#filter-sort');
const catalogAddBtn = document.querySelector('#catalog-add-btn');
const catalogTableBody = document.querySelector('#catalog-table-body');
const catalogPaginationInfo = document.querySelector('#catalog-pagination-info');
const catalogPaginationControls = document.querySelector('#catalog-pagination-controls');
const descriptionInput = document.querySelector('#description');
const descriptionCount = document.querySelector('#description-count');

const MAX_COVER_BYTES = 4 * 1024 * 1024; // 4 MB

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

function slugify(text) {
    return text
        .toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
    window.location.href = '/FrontEnd/Login.html';
} else {
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile?.is_admin) {
        window.location.href = '/index.html';
    } else {
        gate.hidden = true;
        panel.hidden = false;
        initAdminPanel();
        initEpisodeManager();
        initHomeMediaManager();
    }
}

function initAdminPanel() {
    let editingId = null;
    let allAnime = [];

    let slugTouchedManually = false;
    form.slug.addEventListener('input', () => { slugTouchedManually = true; });
    form.title.addEventListener('input', () => {
        if (!slugTouchedManually) {
            form.slug.value = slugify(form.title.value);
        }
    });

    descriptionInput.addEventListener('input', () => {
        descriptionCount.textContent = descriptionInput.value.length;
    });

    function resetForm() {
        form.reset();
        editingId = null;
        slugTouchedManually = false;
        form.slug.disabled = false;
        descriptionCount.textContent = '0';
        formTitle.textContent = 'Agregar nuevo anime';
        saveBtn.textContent = 'Agregar';
        cancelEditBtn.hidden = true;
    }

    function fillFormForEdit(anime) {
        editingId = anime.id;
        slugTouchedManually = true;
        form.title.value = anime.title;
        form.slug.value = anime.slug;
        form.slug.disabled = true;
        form.description.value = anime.description || '';
        descriptionCount.textContent = (anime.description || '').length;
        form.type.value = anime.type;
        form.status.value = anime.status;
        form.release_year.value = anime.release_year || '';
        form.total_episodes.value = anime.total_episodes || '';
        form.season.value = anime.season || '';
        form.genre.value = anime.genre || '';
        form.is_featured.checked = anime.is_featured;
        form.cover.value = '';
        formTitle.textContent = `Editando: ${anime.title}`;
        saveBtn.textContent = 'Guardar cambios';
        cancelEditBtn.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const TYPE_LABELS = { series: 'Serie', movie: 'Película', ova: 'OVA', special: 'Especial' };
    const STATUS_LABELS = { ongoing: 'En emisión', finished: 'Finalizado', upcoming: 'Próximo estreno' };
    const STATUS_BADGE_CLASS = { ongoing: 'catalog-badge--ongoing', finished: 'catalog-badge--finished', upcoming: 'catalog-badge--upcoming' };
    const PAGE_SIZE = 10;

    let currentTab = 'series';
    let currentPage = 1;

    function populateYearFilter() {
        const years = [...new Set(allAnime.map((a) => a.release_year).filter(Boolean))].sort((a, b) => b - a);
        filterYearEl.innerHTML = '<option value="">Todos</option>' + years.map((y) => `<option value="${y}">${y}</option>`).join('');
    }

    function getFilteredAnime() {
        const query = catalogSearchInput.value.trim().toLowerCase();
        const status = filterStatusEl.value;
        const genre = filterGenreEl.value;
        const year = filterYearEl.value;
        const sort = filterSortEl.value;

        let result = allAnime.filter((a) => a.type === currentTab);

        if (query) result = result.filter((a) => a.title.toLowerCase().includes(query));
        if (status) result = result.filter((a) => a.status === status);
        if (genre) result = result.filter((a) => a.genre === genre);
        if (year) result = result.filter((a) => String(a.release_year) === year);

        if (sort === 'title') {
            result = [...result].sort((a, b) => a.title.localeCompare(b.title));
        } else if (sort === 'year') {
            result = [...result].sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
        }
        // 'recent' ya viene ordenado desde la consulta (created_at desc)

        return result;
    }

    function episodiosCellText(anime) {
        if (anime.type === 'series' && anime.season) {
            return `T${anime.season} - ${anime.total_episodes ?? '—'}`;
        }
        return anime.total_episodes ?? '—';
    }

    function rowHTML(anime, index) {
        const cover = anime.cover_url
            ? `<img src="${anime.cover_url}" alt="" class="catalog-table-thumb">`
            : `<div class="catalog-table-thumb--empty"></div>`;

        const statusBadge = anime.status
            ? `<span class="catalog-badge ${STATUS_BADGE_CLASS[anime.status] || ''}">${STATUS_LABELS[anime.status] || anime.status}</span>`
            : '—';

        return `
            <tr data-id="${anime.id}">
                <td>${index}</td>
                <td>${cover}</td>
                <td class="catalog-title-cell" title="${anime.title}">${anime.title}</td>
                <td>${TYPE_LABELS[anime.type] || anime.type}</td>
                <td>${statusBadge}</td>
                <td>${anime.release_year ?? '—'}</td>
                <td>${episodiosCellText(anime)}</td>
                <td>
                    <div class="catalog-actions-cell">
                        <button type="button" class="catalog-icon-btn catalog-icon-btn--edit" data-action="edit" title="Editar">
                            <i class='bx bx-pencil'></i>
                        </button>
                        <button type="button" class="catalog-icon-btn catalog-icon-btn--delete" data-action="delete" title="Borrar">
                            <i class='bx bx-trash'></i>
                        </button>
                        <button type="button" class="catalog-icon-btn catalog-icon-btn--star${anime.is_featured ? ' is-featured' : ''}" data-action="star" title="${anime.is_featured ? 'Quitar de Destacados' : 'Marcar como Destacado'}">
                            <i class='bx ${anime.is_featured ? 'bxs-star' : 'bx-star'}'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderPagination(totalItems, totalPages) {
        if (totalItems === 0) {
            catalogPaginationInfo.textContent = 'Mostrando 0 resultados';
            catalogPaginationControls.innerHTML = '';
            return;
        }

        const start = (currentPage - 1) * PAGE_SIZE + 1;
        const end = Math.min(currentPage * PAGE_SIZE, totalItems);
        catalogPaginationInfo.textContent = `Mostrando ${start} a ${end} de ${totalItems} resultados`;

        const buttons = [];
        buttons.push(`<button type="button" class="catalog-page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class='bx bx-chevron-left'></i></button>`);

        for (let page = 1; page <= totalPages; page++) {
            buttons.push(`<button type="button" class="catalog-page-btn${page === currentPage ? ' is-active' : ''}" data-page="${page}">${page}</button>`);
        }

        buttons.push(`<button type="button" class="catalog-page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><i class='bx bx-chevron-right'></i></button>`);

        catalogPaginationControls.innerHTML = buttons.join('');
    }

    function renderTable() {
        const filtered = getFilteredAnime();
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        currentPage = Math.min(currentPage, totalPages);

        if (filtered.length === 0) {
            catalogTableBody.innerHTML = `<tr class="catalog-empty-row"><td colspan="8">No hay resultados con estos filtros.</td></tr>`;
            renderPagination(0, totalPages);
            return;
        }

        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

        catalogTableBody.innerHTML = pageItems.map((anime, i) => rowHTML(anime, startIndex + i + 1)).join('');
        renderPagination(filtered.length, totalPages);
    }

    async function loadList() {
        catalogTableBody.innerHTML = `<tr class="catalog-empty-row"><td colspan="8">Cargando…</td></tr>`;

        const { data, error } = await supabase
            .from('anime')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            catalogTableBody.innerHTML = `<tr class="catalog-empty-row"><td colspan="8">Error cargando el catálogo: ${error.message}</td></tr>`;
            return;
        }

        allAnime = data;
        populateYearFilter();
        renderTable();
    }

    async function handleTableClick(event) {
        const btn = event.target.closest('.catalog-icon-btn');
        if (!btn) return;

        const row = btn.closest('tr');
        const id = row.dataset.id;
        const anime = allAnime.find((a) => a.id === id);

        if (btn.dataset.action === 'edit') {
            fillFormForEdit(anime);
        }

        if (btn.dataset.action === 'delete') {
            const confirmed = confirm(`¿Seguro que quieres borrar "${anime.title}"? Esto no se puede deshacer.`);
            if (!confirmed) return;

            const { error } = await supabase.from('anime').delete().eq('id', id);
            if (error) {
                showError('No se pudo borrar: ' + error.message);
                return;
            }

            showSuccess(`"${anime.title}" se borró.`);
            loadList();
        }

        if (btn.dataset.action === 'star') {
            const newValue = !anime.is_featured;
            const { error } = await supabase.from('anime').update({ is_featured: newValue }).eq('id', id);
            if (error) {
                showError('No se pudo actualizar: ' + error.message);
                return;
            }
            anime.is_featured = newValue;
            renderTable();
        }
    }

    catalogTableBody.addEventListener('click', handleTableClick);

    catalogTabsEl.addEventListener('click', (event) => {
        const tabBtn = event.target.closest('.catalog-tab');
        if (!tabBtn) return;

        catalogTabsEl.querySelectorAll('.catalog-tab').forEach((t) => t.classList.remove('is-active'));
        tabBtn.classList.add('is-active');
        currentTab = tabBtn.dataset.type;
        currentPage = 1;
        renderTable();
    });

    catalogSearchInput.addEventListener('input', () => {
        currentPage = 1;
        renderTable();
    });

    [filterStatusEl, filterGenreEl, filterYearEl, filterSortEl].forEach((el) => {
        el.addEventListener('change', () => {
            currentPage = 1;
            renderTable();
        });
    });

    catalogPaginationControls.addEventListener('click', (event) => {
        const btn = event.target.closest('.catalog-page-btn');
        if (!btn || btn.disabled) return;
        currentPage = parseInt(btn.dataset.page, 10);
        renderTable();
    });

    catalogAddBtn.addEventListener('click', () => {
        resetForm();
        hideMessages();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    cancelEditBtn.addEventListener('click', () => {
        resetForm();
        hideMessages();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideMessages();

        const coverFile = form.cover.files[0];

        if (coverFile && coverFile.size > MAX_COVER_BYTES) {
            showError('La portada pesa demasiado (máximo 4 MB).');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = editingId ? 'Guardando…' : 'Agregando…';

        const payload = {
            title: form.title.value.trim(),
            slug: form.slug.value.trim(),
            description: form.description.value.trim() || null,
            type: form.type.value,
            status: form.status.value,
            release_year: form.release_year.value ? parseInt(form.release_year.value, 10) : null,
            total_episodes: form.total_episodes.value ? parseInt(form.total_episodes.value, 10) : null,
            season: form.season.value ? parseInt(form.season.value, 10) : null,
            genre: form.genre.value || null,
            is_featured: form.is_featured.checked,
        };

        if (coverFile) {
            const extension = coverFile.name.split('.').pop();
            const path = `${payload.slug}-${Date.now()}.${extension}`;

            const { error: uploadError } = await supabase
                .storage
                .from('covers')
                .upload(path, coverFile);

            if (uploadError) {
                saveBtn.disabled = false;
                saveBtn.textContent = editingId ? 'Guardar cambios' : 'Agregar';
                showError('No se pudo subir la portada: ' + uploadError.message);
                return;
            }

            const { data: publicUrlData } = supabase.storage.from('covers').getPublicUrl(path);
            payload.cover_url = publicUrlData.publicUrl;
        }

        const { error } = editingId
            ? await supabase.from('anime').update(payload).eq('id', editingId)
            : await supabase.from('anime').insert(payload);

        saveBtn.disabled = false;
        saveBtn.textContent = editingId ? 'Guardar cambios' : 'Agregar';

        if (error) {
            showError(
                error.message.includes('duplicate') || error.message.includes('unique')
                    ? 'Ya existe un anime con ese slug.'
                    : error.message
            );
            return;
        }

        showSuccess(editingId ? 'Cambios guardados.' : `"${payload.title}" se agregó al catálogo.`);
        resetForm();
        loadList();
    });

    loadList();
}

// ============================================================
// Episodios
// ============================================================

async function initEpisodeManager() {
    const searchInput = document.querySelector('#episode-anime-search');
    const resultsEl = document.querySelector('#episode-anime-results');
    const managerEl = document.querySelector('#episode-manager');
    const episodeForm = document.querySelector('#episode-form');
    const episodeFormTitle = document.querySelector('#episode-form-title');
    const episodeCancelBtn = document.querySelector('#episode-cancel-btn');
    const episodeSaveBtn = document.querySelector('#episode-save-btn');
    const episodeErrorBox = document.querySelector('#episode-form-error');
    const episodeSuccessBox = document.querySelector('#episode-form-success');
    const episodeListEl = document.querySelector('#episode-list');

    const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

    let animeList = [];
    let currentAnimeId = null;
    let currentAnimeSlug = null;
    let editingEpisodeId = null;
    let episodes = [];

    function showEpisodeError(message) {
        episodeSuccessBox.hidden = true;
        episodeErrorBox.textContent = message;
        episodeErrorBox.hidden = false;
    }

    function showEpisodeSuccess(message) {
        episodeErrorBox.hidden = true;
        episodeSuccessBox.textContent = message;
        episodeSuccessBox.hidden = false;
    }

    function resetEpisodeForm() {
        episodeForm.reset();
        editingEpisodeId = null;
        episodeFormTitle.textContent = 'Agregar capítulo';
        episodeSaveBtn.textContent = 'Agregar capítulo';
        episodeCancelBtn.hidden = true;
    }

    // --- Carga la lista de animes una sola vez ---
    const { data: animeData, error: animeListError } = await supabase
        .from('anime')
        .select('id, slug, title')
        .order('title', { ascending: true });

    if (animeListError) {
        showEpisodeError('No se pudo cargar la lista de animes: ' + animeListError.message);
    }
    animeList = animeData || [];

    // --- Buscador tipo autocompletar ---

    function renderResults(items) {
        if (items.length === 0) {
            resultsEl.innerHTML = '<p class="admin-combobox-empty">Sin resultados.</p>';
            resultsEl.hidden = false;
            return;
        }

        resultsEl.innerHTML = items.map((anime) => `
            <button type="button" class="admin-combobox-item" data-id="${anime.id}" data-slug="${anime.slug}" data-title="${anime.title}">
                ${anime.title}
            </button>
        `).join('');
        resultsEl.hidden = false;
    }

    function selectAnime(anime) {
        currentAnimeId = anime.id;
        currentAnimeSlug = anime.slug;
        searchInput.value = anime.title;
        resultsEl.hidden = true;

        resetEpisodeForm();
        managerEl.hidden = false;
        loadEpisodes();
    }

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();

        // Si borran el texto, se deselecciona el anime actual.
        if (!query) {
            currentAnimeId = null;
            currentAnimeSlug = null;
            managerEl.hidden = true;
            resultsEl.hidden = true;
            return;
        }

        const matches = animeList.filter((a) => a.title.toLowerCase().includes(query));
        renderResults(matches);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });

    resultsEl.addEventListener('click', (event) => {
        const item = event.target.closest('.admin-combobox-item');
        if (!item) return;

        selectAnime({
            id: item.dataset.id,
            slug: item.dataset.slug,
            title: item.dataset.title,
        });
    });

    document.addEventListener('click', (event) => {
        if (!searchInput.contains(event.target) && !resultsEl.contains(event.target)) {
            resultsEl.hidden = true;
        }
    });

    // --- Episodios del anime seleccionado ---

    function episodeRowHTML(ep) {
        return `
            <div class="admin-row" data-id="${ep.id}">
                <div class="admin-row-info">
                    <strong>Capítulo ${ep.episode_number}${ep.title ? ' · ' + ep.title : ''}</strong>
                    <span>${ep.video_url ? 'Video cargado' : 'Sin video'}</span>
                </div>
                <div class="admin-row-actions">
                    <button type="button" class="admin-row-btn" data-action="edit">Editar</button>
                    <button type="button" class="admin-row-btn admin-row-btn--danger" data-action="delete">Borrar</button>
                </div>
            </div>
        `;
    }

    async function loadEpisodes() {
        episodeListEl.innerHTML = '<p class="catalog-empty">Cargando episodios…</p>';

        const { data, error } = await supabase
            .from('episodes')
            .select('*')
            .eq('anime_id', currentAnimeId)
            .order('episode_number', { ascending: true });

        if (error) {
            episodeListEl.innerHTML = `<p class="catalog-empty">Error: ${error.message}</p>`;
            return;
        }

        episodes = data;
        episodeListEl.innerHTML = data.length
            ? data.map(episodeRowHTML).join('')
            : '<p class="catalog-empty">Este anime todavía no tiene capítulos.</p>';
    }

    episodeListEl.addEventListener('click', async (event) => {
        const btn = event.target.closest('.admin-row-btn');
        if (!btn) return;

        const row = btn.closest('.admin-row');
        const id = row.dataset.id;
        const ep = episodes.find((e) => e.id === id);

        if (btn.dataset.action === 'edit') {
            editingEpisodeId = ep.id;
            episodeForm.episode_number.value = ep.episode_number;
            episodeForm.title.value = ep.title || '';
            episodeForm.video.value = '';
            episodeFormTitle.textContent = `Editando capítulo ${ep.episode_number}`;
            episodeSaveBtn.textContent = 'Guardar cambios';
            episodeCancelBtn.hidden = false;
            window.scrollTo({ top: document.querySelector('.admin-episodes-section').offsetTop - 20, behavior: 'smooth' });
        }

        if (btn.dataset.action === 'delete') {
            const confirmed = confirm(`¿Borrar el capítulo ${ep.episode_number}? Esto no se puede deshacer.`);
            if (!confirmed) return;

            const { error } = await supabase.from('episodes').delete().eq('id', id);
            if (error) {
                showEpisodeError('No se pudo borrar: ' + error.message);
                return;
            }

            showEpisodeSuccess(`Capítulo ${ep.episode_number} borrado.`);
            loadEpisodes();
        }
    });

    episodeCancelBtn.addEventListener('click', () => {
        resetEpisodeForm();
    });

    episodeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        episodeErrorBox.hidden = true;
        episodeSuccessBox.hidden = true;

        if (!currentAnimeId) {
            showEpisodeError('Primero selecciona un anime del buscador de arriba.');
            return;
        }

        const videoFile = episodeForm.video.files[0];

        if (!videoFile && !editingEpisodeId) {
            showEpisodeError('Necesitas subir un archivo de video.');
            return;
        }

        if (videoFile && videoFile.size > MAX_VIDEO_BYTES) {
            showEpisodeError('El video pesa demasiado (máximo 500 MB).');
            return;
        }

        episodeSaveBtn.disabled = true;
        episodeSaveBtn.textContent = 'Subiendo…';

        const payload = {
            anime_id: currentAnimeId,
            episode_number: parseInt(episodeForm.episode_number.value, 10),
            title: episodeForm.title.value.trim() || null,
        };

        if (videoFile) {
            const extension = videoFile.name.split('.').pop();
            const path = `${currentAnimeSlug}/ep-${payload.episode_number}-${Date.now()}.${extension}`;

            const { error: uploadError } = await supabase
                .storage
                .from('episodes')
                .upload(path, videoFile);

            if (uploadError) {
                episodeSaveBtn.disabled = false;
                episodeSaveBtn.textContent = editingEpisodeId ? 'Guardar cambios' : 'Agregar capítulo';
                showEpisodeError('No se pudo subir el video: ' + uploadError.message);
                return;
            }

            const { data: publicUrlData } = supabase.storage.from('episodes').getPublicUrl(path);
            payload.video_url = publicUrlData.publicUrl;
        }

        const { error } = editingEpisodeId
            ? await supabase.from('episodes').update(payload).eq('id', editingEpisodeId)
            : await supabase.from('episodes').insert(payload);

        episodeSaveBtn.disabled = false;
        episodeSaveBtn.textContent = editingEpisodeId ? 'Guardar cambios' : 'Agregar capítulo';

        if (error) {
            showEpisodeError(
                error.message.includes('duplicate') || error.message.includes('unique')
                    ? 'Ya existe un capítulo con ese número para este anime.'
                    : error.message
            );
            return;
        }

        showEpisodeSuccess(editingEpisodeId ? 'Cambios guardados.' : `Capítulo ${payload.episode_number} agregado.`);
        resetEpisodeForm();
        loadEpisodes();
    });
}

// ============================================================
// Imágenes de Home: Carrusel Principal + Secciones
// ============================================================

async function initHomeMediaManager() {
    const SLOT_COUNT = 10;
    const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

    const overlayEl = document.querySelector('#media-picker-overlay');
    const previewEl = document.querySelector('#media-picker-preview');
    const searchEl = document.querySelector('#media-picker-search');
    const resultsEl = document.querySelector('#media-picker-results');
    const cancelBtn = document.querySelector('#media-picker-cancel');
    const saveBtn = document.querySelector('#media-picker-save');

    const GROUPS = {
        carousel: {
            table: 'home_carousel_slots',
            section: null,
            layout: 'list',
            slotsEl: document.querySelector('#carousel-slots'),
            countEl: document.querySelector('#carousel-count'),
        },
        estrenos: {
            table: 'home_section_slots',
            section: 'estrenos',
            layout: 'grid',
            slotsEl: document.querySelector('#estrenos-slots'),
            countEl: document.querySelector('#estrenos-count'),
        },
        recomendados: {
            table: 'home_section_slots',
            section: 'recomendados',
            layout: 'grid',
            slotsEl: document.querySelector('#recomendados-slots'),
            countEl: document.querySelector('#recomendados-count'),
        },
        tendencias: {
            table: 'home_section_slots',
            section: 'tendencias',
            layout: 'grid',
            slotsEl: document.querySelector('#tendencias-slots'),
            countEl: document.querySelector('#tendencias-count'),
        },
    };

    // Trae todos los animes una sola vez, para el buscador del modal.
    const { data: animeOptions } = await supabase
        .from('anime')
        .select('id, title')
        .order('title', { ascending: true });

    const allAnime = animeOptions || [];

    // --- Estado del modal (qué slot se está editando) ---

    let pendingGroupKey = null;
    let pendingPosition = null;
    let pendingFile = null;
    let pendingExistingRow = null;
    let pendingSelectedAnimeId = null;
    let pendingReloadGroupKey = null;

    function findAnime(id) {
        return allAnime.find((a) => a.id === id) || null;
    }

    function renderPickerResults(query) {
        const normalized = query.trim().toLowerCase();
        const matches = normalized
            ? allAnime.filter((a) => a.title.toLowerCase().includes(normalized))
            : allAnime;

        if (matches.length === 0) {
            resultsEl.innerHTML = '<p class="catalog-empty">Sin resultados.</p>';
            return;
        }

        resultsEl.innerHTML = matches.map((anime) => `
            <div class="media-picker-option${anime.id === pendingSelectedAnimeId ? ' is-selected' : ''}" data-id="${anime.id}">
                ${anime.title}
            </div>
        `).join('');
    }

    function openPicker({ groupKey, position, existingRow = null, file = null }) {
        pendingGroupKey = groupKey;
        pendingPosition = position;
        pendingFile = file;
        pendingExistingRow = existingRow;
        pendingSelectedAnimeId = existingRow?.anime_id || null;
        pendingReloadGroupKey = groupKey;

        searchEl.value = '';
        renderPickerResults('');

        if (file) {
            previewEl.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
        } else if (existingRow?.image_url) {
            previewEl.innerHTML = `<img src="${existingRow.image_url}" alt="">`;
        } else {
            previewEl.innerHTML = '';
        }

        saveBtn.disabled = !pendingSelectedAnimeId;
        overlayEl.hidden = false;
        searchEl.focus();
    }

    function closePicker() {
        overlayEl.hidden = true;
        pendingGroupKey = null;
        pendingPosition = null;
        pendingFile = null;
        pendingExistingRow = null;
        pendingSelectedAnimeId = null;
    }

    searchEl.addEventListener('input', () => renderPickerResults(searchEl.value));

    resultsEl.addEventListener('click', (event) => {
        const option = event.target.closest('.media-picker-option');
        if (!option) return;

        pendingSelectedAnimeId = option.dataset.id;
        saveBtn.disabled = false;
        renderPickerResults(searchEl.value);
    });

    cancelBtn.addEventListener('click', closePicker);
    overlayEl.addEventListener('click', (event) => {
        if (event.target === overlayEl) closePicker();
    });

    saveBtn.addEventListener('click', async () => {
        const group = GROUPS[pendingGroupKey];
        if (!group) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando…';

        let imageUrl = pendingExistingRow?.image_url || null;

        if (pendingFile) {
            const extension = pendingFile.name.split('.').pop();
            const folder = group.section || 'carousel';
            const path = `${folder}/${pendingPosition}-${Date.now()}.${extension}`;

            const { error: uploadError } = await supabase.storage.from('homepage').upload(path, pendingFile);

            if (uploadError) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar';
                alert('No se pudo subir la imagen: ' + uploadError.message);
                return;
            }

            const { data: publicUrlData } = supabase.storage.from('homepage').getPublicUrl(path);
            imageUrl = publicUrlData.publicUrl;
        }

        const payload = {
            position: pendingPosition,
            ...(group.section ? { section: group.section } : {}),
            anime_id: pendingSelectedAnimeId,
            image_url: imageUrl,
        };

        const conflictTarget = group.section ? 'section,position' : 'position';
        const { error } = await supabase.from(group.table).upsert(payload, { onConflict: conflictTarget });

        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';

        if (error) {
            alert('No se pudo guardar: ' + error.message);
            return;
        }

        closePicker();
        loadGroup(GROUPS[pendingReloadGroupKey], pendingReloadGroupKey);
    });

    // --- Render de cada grupo ---

    function slotThumbHTML(row) {
        if (row?.image_url) return `<img src="${row.image_url}" alt="">`;
        return `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
            </svg>
        `;
    }

    function listRowHTML(position, row) {
        const anime = row?.anime_id ? findAnime(row.anime_id) : null;
        const label = anime ? anime.title : 'Sin imagen';
        const hasImage = !!row?.image_url;

        return `
            <div class="media-slot" data-position="${position}" draggable="true">
                <span class="media-slot-index">${position}</span>
                <div class="media-slot-thumb">${slotThumbHTML(row)}</div>
                <button type="button" class="media-slot-label${anime ? ' has-anime' : ''}" data-action="edit">${label}</button>
                <span class="media-slot-drag" title="Arrastra para reordenar">
                    <i class='bx bx-dots-vertical-rounded'></i>
                </span>
                <button type="button" class="media-slot-view${hasImage ? '' : ' is-empty'}" data-action="view" title="${hasImage ? 'Ver imagen' : ''}" ${hasImage ? '' : 'tabindex="-1"'}>
                    <i class='bx bx-show'></i>
                </button>
                <button type="button" class="media-slot-delete${row ? '' : ' is-empty'}" data-action="delete" title="${row ? 'Quitar' : ''}" ${row ? '' : 'tabindex="-1"'}>
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        `;
    }

    function gridTileHTML(position, row) {
        const hasImage = !!row?.image_url;
        return `
            <div class="media-tile${hasImage ? ' has-image' : ''}" data-position="${position}" draggable="${hasImage}" data-action="edit">
                ${hasImage ? `<img src="${row.image_url}" alt="">` : `
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                `}
                ${hasImage ? `
                    <button type="button" class="media-tile-delete" data-action="delete" title="Quitar">
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;
    }

    async function fetchGroupRows(group) {
        let query = supabase.from(group.table).select('*');
        if (group.section) query = query.eq('section', group.section);
        const { data, error } = await query.order('position', { ascending: true });
        return { data: data || [], error };
    }

    async function loadGroup(group, groupKey) {
        const { data, error } = await fetchGroupRows(group);

        if (error) {
            group.slotsEl.innerHTML = `<p class="catalog-empty">Error: ${error.message}</p>`;
            return;
        }

        const byPosition = {};
        data.forEach((row) => { byPosition[row.position] = row; });

        const rowsHTML = [];
        for (let position = 1; position <= SLOT_COUNT; position++) {
            const row = byPosition[position] || null;
            rowsHTML.push(group.layout === 'grid' ? gridTileHTML(position, row) : listRowHTML(position, row));
        }
        group.slotsEl.innerHTML = rowsHTML.join('');

        if (group.countEl) {
            group.countEl.textContent = `${data.length} / ${SLOT_COUNT}`;
        }

        group.slotsEl.dataset.groupKey = groupKey;
    }

    function firstEmptyPosition(group, rows) {
        const used = new Set(rows.map((r) => r.position));
        for (let position = 1; position <= SLOT_COUNT; position++) {
            if (!used.has(position)) return position;
        }
        return null;
    }

    async function handleNewFile(groupKey, file, forcedPosition = null) {
        const group = GROUPS[groupKey];
        if (!file) return;

        if (file.size > MAX_IMAGE_BYTES) {
            alert('La imagen pesa demasiado (máximo 4 MB).');
            return;
        }

        let position = forcedPosition;
        if (!position) {
            const { data: rows } = await fetchGroupRows(group);
            position = firstEmptyPosition(group, rows);
            if (!position) {
                alert('Ya se alcanzó el máximo de 10 imágenes.');
                return;
            }
        }

        openPicker({ groupKey, position, file });
    }

    async function handleEditSlot(groupKey, position) {
        const group = GROUPS[groupKey];
        const { data: rows } = await fetchGroupRows(group);
        const existingRow = rows.find((r) => r.position === position) || null;

        if (!existingRow) {
            // Slot vacío: primero pide el archivo de imagen.
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png, image/jpeg, image/webp';
            input.addEventListener('change', () => {
                if (input.files[0]) handleNewFile(groupKey, input.files[0], position);
            });
            input.click();
            return;
        }

        openPicker({ groupKey, position, existingRow });
    }

    async function handleDeleteSlot(groupKey, position) {
        const group = GROUPS[groupKey];
        const confirmed = confirm(`¿Quitar la imagen del espacio ${position}?`);
        if (!confirmed) return;

        let query = supabase.from(group.table).delete().eq('position', position);
        if (group.section) query = query.eq('section', group.section);

        const { error } = await query;
        if (error) {
            alert('No se pudo borrar: ' + error.message);
            return;
        }

        loadGroup(group, groupKey);
    }

    async function swapPositions(groupKey, positionA, positionB) {
        if (positionA === positionB) return;

        const group = GROUPS[groupKey];
        const { data: rows } = await fetchGroupRows(group);
        const rowA = rows.find((r) => r.position === positionA);
        const rowB = rows.find((r) => r.position === positionB);

        if (!rowA && !rowB) return;

        // Borra ambas filas primero, para no chocar con la restricción de
        // posición única, y luego las vuelve a insertar ya intercambiadas.
        const idsToDelete = [rowA?.id, rowB?.id].filter(Boolean);
        if (idsToDelete.length) {
            await supabase.from(group.table).delete().in('id', idsToDelete);
        }

        const inserts = [];
        if (rowA) inserts.push({ ...stripId(rowA), position: positionB });
        if (rowB) inserts.push({ ...stripId(rowB), position: positionA });

        if (inserts.length) {
            const { error } = await supabase.from(group.table).insert(inserts);
            if (error) {
                alert('No se pudo reordenar: ' + error.message);
            }
        }

        loadGroup(group, groupKey);
    }

    function stripId(row) {
        const { id, created_at, ...rest } = row;
        return rest;
    }

    // --- Listeners por grupo ---

    Object.entries(GROUPS).forEach(([groupKey, group]) => {
        group.slotsEl.addEventListener('click', async (event) => {
            const deleteBtn = event.target.closest('[data-action="delete"]');
            if (deleteBtn) {
                const el = deleteBtn.closest('[data-position]');
                handleDeleteSlot(groupKey, parseInt(el.dataset.position, 10));
                return;
            }

            const viewBtn = event.target.closest('[data-action="view"]');
            if (viewBtn) {
                const el = viewBtn.closest('[data-position]');
                const { data: rows } = await fetchGroupRows(group);
                const row = rows.find((r) => r.position === parseInt(el.dataset.position, 10));
                if (row?.image_url) window.open(row.image_url, '_blank');
                return;
            }

            const editTarget = event.target.closest('[data-action="edit"]');
            if (editTarget) {
                const el = editTarget.closest('[data-position]') || editTarget;
                handleEditSlot(groupKey, parseInt(el.dataset.position, 10));
            }
        });

        // Reordenar arrastrando.
        let draggedPosition = null;

        group.slotsEl.addEventListener('dragstart', (event) => {
            const el = event.target.closest('[data-position]');
            if (!el) return;
            draggedPosition = parseInt(el.dataset.position, 10);
            el.classList.add('is-dragging');
        });

        group.slotsEl.addEventListener('dragend', (event) => {
            const el = event.target.closest('[data-position]');
            if (el) el.classList.remove('is-dragging');
        });

        group.slotsEl.addEventListener('dragover', (event) => {
            if (event.target.closest('[data-position]')) event.preventDefault();
        });

        group.slotsEl.addEventListener('drop', (event) => {
            event.preventDefault();
            const el = event.target.closest('[data-position]');
            if (!el || draggedPosition === null) return;

            const targetPosition = parseInt(el.dataset.position, 10);
            swapPositions(groupKey, draggedPosition, targetPosition);
            draggedPosition = null;
        });

        loadGroup(group, groupKey);
    });

    // --- Botón "+ Agregar Imagen" y dropzone del Carrusel ---

    const carouselAddBtn = document.querySelector('#carousel-add-btn');
    const carouselDropzone = document.querySelector('#carousel-dropzone');
    const carouselDropzoneInput = document.querySelector('#carousel-dropzone-input');

    carouselAddBtn.addEventListener('click', () => carouselDropzoneInput.click());

    carouselDropzoneInput.addEventListener('change', () => {
        Array.from(carouselDropzoneInput.files).forEach((file) => handleNewFile('carousel', file));
        carouselDropzoneInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) => {
        carouselDropzone.addEventListener(evt, (event) => {
            event.preventDefault();
            carouselDropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'drop'].forEach((evt) => {
        carouselDropzone.addEventListener(evt, () => {
            carouselDropzone.classList.remove('is-dragover');
        });
    });

    carouselDropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        Array.from(event.dataTransfer.files).forEach((file) => handleNewFile('carousel', file));
    });

    // --- Botón "+ Agregar Imagen" de Secciones (sube al primer espacio libre de Estrenos) ---

    const sectionsAddBtn = document.querySelector('#sections-add-btn');
    const sectionsFileInput = document.querySelector('#sections-file-input');

    sectionsAddBtn.addEventListener('click', () => sectionsFileInput.click());

    sectionsFileInput.addEventListener('change', () => {
        if (sectionsFileInput.files[0]) {
            handleNewFile('estrenos', sectionsFileInput.files[0]);
        }
        sectionsFileInput.value = '';
    });
}