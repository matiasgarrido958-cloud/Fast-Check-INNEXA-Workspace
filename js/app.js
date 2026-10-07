const { TABLE, SYNC_INTERVAL_MS, TEAM_EMAIL } = window.APP_CONFIG;
const CACHE_KEY = 'fast-check-ideas';

const STATUSES = [
    { id: 'initial', label: 'Ideas Iniciales', color: '#00f0ff' },
    { id: 'discussion', label: 'En Discusión', color: '#d05cff' },
    { id: 'working', label: 'En Proceso', color: '#39ff14' },
    { id: 'pending', label: 'Pendiente Publicación', color: '#ff9900' },
    { id: 'published', label: 'Publicadas', color: '#00ffcc' }
];

const VERDICTS = [
    { id: 'verdadero', label: 'Verdadero', color: '#00ffcc' },
    { id: 'falso', label: 'Falso', color: '#ff2a6d' },
    { id: 'engañoso', label: 'Engañoso', color: '#ff9900' },
    { id: 'exagerada', label: 'Exagerada', color: '#ffd000' },
    { id: 'depende', label: 'Depende', color: '#d05cff' },
    { id: 'insuficiente', label: 'Evidencia Insuficiente', color: '#8fa8d8' }
];

const PRIORITIES = [
    { id: 'high', label: 'Alta', color: '#ff2a6d' },
    { id: 'medium', label: 'Media', color: '#ff9900' },
    { id: 'low', label: 'Baja', color: '#39ff14' }
];

const FALLBACK_COLOR = '#8fa8d8';

// Busca la opción por id; si el valor no está en la lista (dato antiguo), la
// crea para mostrarlo tal cual en vez de perderlo.
function findOption(list, id) {
    return list.find(o => o.id === id) || { id, label: id, color: FALLBACK_COLOR };
}

function blankIdea(id, title = '', category = '', priority = 'medium', editedBy = 'Usuario') {
    return {
        id, title, category, priority, gancho: '', source: '', status: 'initial',
        verdict: '', analysis: '', sources: [], errorLevel: '', errorNotes: '',
        checklist: {}, last_edited_by: editedBy, last_edited_at: new Date().toISOString()
    };
}

const INITIAL_IDEAS = [
    ['001', 'La IA va a reemplazar a todos los ingenieros en 5 años', 'IA', 'high'],
    ['002', 'El 90% de startups de IA fracasan en el primer año', 'Startups', 'high'],
    ['003', 'Solo los fondos de VC grandes logran salidas de unicornios', 'Startups', 'high'],
    ['004', 'La creatividad NO se puede automatizar con IA', 'IA', 'medium'],
    ['005', 'Chile tiene ventaja competitiva en startups Deep Tech', 'Innovación', 'medium'],
    ['006', 'El blockchain es más seguro que criptografía convencional', 'Tecnología', 'low'],
    ['007', 'La sostenibilidad en tech cuesta 50% más en presupuesto', 'Innovación', 'medium'],
    ['008', 'Machine Learning requiere mínimo 1 millón de datos', 'IA', 'high'],
    ['009', 'Argentina es el nuevo hub de IA en Latinoamérica', 'Innovación', 'medium'],
    ['010', 'El 80% de empleos desaparecerá en 20 años', 'IA', 'high'],
    ['011', 'Los algoritmos de recomendación causan depresión en jóvenes', 'Tecnología', 'medium'],
    ['012', 'La innovación en startups es 10x más rápida que en corporaciones', 'Innovación', 'high']
];

let ideas = [];
let currentEditingId = null;
let hasUnsavedChanges = false;
let currentTab = 'initial';
let searchQuery = '';
// Solo se sincroniza con Supabase si la carga inicial funcionó; si no, el
// tablero vacío de Supabase reemplazaría las ideas del cache local.
let connected = false;

function showToast(msg, type = 'success', durationMs = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.getElementById('toasts').appendChild(toast);
    setTimeout(() => toast.remove(), durationMs);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML.replace(/"/g, '&quot;');
}

function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(ideas)); } catch (e) { /* sin storage */ }
}

function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* sin storage */ }
}

function readCache() {
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

async function loadIdeas() {
    try {
        const data = await supabaseCall('GET', `${TABLE}?order=id`);

        if (Array.isArray(data) && data.length > 0) {
            ideas = data;
            showToast(`✓ Cargadas ${ideas.length} ideas desde Supabase`, 'success');
        } else {
            ideas = INITIAL_IDEAS.map(([id, title, category, priority]) => blankIdea(id, title, category, priority, 'Sistema'));
            await supabaseCall('POST', TABLE, ideas);
            showToast(`✓ Inicializadas ${ideas.length} ideas en Supabase`, 'success');
        }
        connected = true;
        saveCache();
    } catch (error) {
        connected = false;
        if (handleAuthError(error)) return;
        console.error('Error loading from Supabase:', error);
        showToast(`⚠️ Error conectando a Supabase, usando cache local. Detalle: ${error.message}`, 'warning', 15000);
        ideas = readCache() || INITIAL_IDEAS.map(([id, title, category, priority]) => blankIdea(id, title, category, priority, 'Sistema'));
        saveCache();
    }
    render();
}

// Sincronización con Supabase (polling). Se pausa mientras se edita una idea
// para no pisar los cambios del formulario abierto.
setInterval(async () => {
    if (!connected || currentEditingId) return;
    try {
        const data = await supabaseCall('GET', `${TABLE}?order=id`);
        if (Array.isArray(data) && JSON.stringify(ideas) !== JSON.stringify(data)) {
            ideas = data;
            saveCache();
            render();
            showToast('🔄 Sincronizado desde Supabase', 'success');
        }
    } catch (error) {
        if (handleAuthError(error)) return;
        console.error('Sync error:', error);
    }
}, SYNC_INTERVAL_MS);

function render() {
    renderSummary();
    renderTabs();
    renderContent();
}

function initials(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
}

function timeAgo(value) {
    if (!value) return 'nunca';
    // Columnas "timestamp without time zone" llegan sin zona: se asumen UTC.
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
    const seconds = Math.round((date - Date.now()) / 1000);
    if (Number.isNaN(seconds)) return '';
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'hace un momento';
}

function chip(option, extraClass = '') {
    return `<span class="chip ${extraClass}" style="--c:${option.color}"><span class="dot"></span>${escapeHtml(option.label)}</span>`;
}

function renderSummary() {
    const withVerdict = ideas.filter(i => i.verdict).length;
    const published = ideas.filter(i => i.status === 'published').length;
    document.getElementById('summary').textContent =
        `${ideas.length} ideas · ${withVerdict} con veredicto · ${published} publicadas`;
}

function renderTabs() {
    document.getElementById('tabs').innerHTML = STATUSES.map((status, index) => {
        const count = ideas.filter(idea => idea.status === status.id).length;
        return `
            <button class="stage ${status.id === currentTab ? 'active' : ''}" data-status="${status.id}" style="--stage:${status.color}" aria-pressed="${status.id === currentTab}">
                <div class="stage-step"><span class="stage-dot"></span>Etapa ${index + 1}</div>
                <div class="stage-label">${status.label}</div>
                <div class="stage-count">${count}</div>
            </button>`;
    }).join('');

    document.querySelectorAll('.stage').forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.getAttribute('data-status');
            render();
        });
    });
}

function matchesSearch(idea) {
    if (!searchQuery) return true;
    const haystack = `${idea.id} ${idea.title || ''} ${idea.category || ''}`.toLowerCase();
    return haystack.includes(searchQuery);
}

function renderContent() {
    const filtered = ideas.filter(idea => idea.status === currentTab && matchesSearch(idea));
    let html = filtered.map(idea => `
        <article class="card" data-id="${escapeHtml(idea.id)}" tabindex="0" style="--stage:${findOption(STATUSES, idea.status).color};--prio:${findOption(PRIORITIES, idea.priority).color}">
            <button class="card-delete" data-id="${escapeHtml(idea.id)}" aria-label="Eliminar idea" title="Eliminar"><svg><use href="#i-trash"/></svg></button>
            <div class="card-top">
                <span class="card-id">#${escapeHtml(idea.id)}</span>
                ${idea.priority ? chip(findOption(PRIORITIES, idea.priority), 'priority') : ''}
            </div>
            <div class="card-title ${idea.title ? '' : 'untitled'}">${escapeHtml(idea.title) || 'Sin título'}</div>
            <div class="card-tags">
                ${idea.verdict ? chip(findOption(VERDICTS, idea.verdict)) : ''}
                <span class="chip outline">${escapeHtml(idea.category) || 'Sin categoría'}</span>
            </div>
            <div class="card-foot">
                <span class="avatar sm">${escapeHtml(initials(idea.last_edited_by))}</span>
                <span><strong>${escapeHtml(idea.last_edited_by || 'Usuario')}</strong> · ${escapeHtml(timeAgo(idea.last_edited_at))}</span>
            </div>
        </article>
    `).join('');
    if (!html) {
        html = searchQuery
            ? `<div class="empty"><div class="empty-icon">🔍</div><strong>Sin resultados</strong>Ninguna idea de esta etapa coincide con "${escapeHtml(searchQuery)}".</div>`
            : '<div class="empty"><div class="empty-icon">🗂️</div><strong>Nada por aquí todavía</strong>Las ideas que lleguen a esta etapa aparecerán aquí.</div>';
    }
    document.getElementById('content').innerHTML = `<div class="grid">${html}</div>`;

    document.querySelectorAll('.card-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteIdea(btn.getAttribute('data-id'));
        });
    });

    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => openModal(card.getAttribute('data-id')));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target === card) openModal(card.getAttribute('data-id'));
        });
    });
}

async function createNewIdea() {
    const maxId = Math.max(0, ...ideas.map(i => parseInt(i.id, 10) || 0));
    const newIdea = blankIdea(String(maxId + 1).padStart(3, '0'), '', '', 'medium', editorName());
    ideas.push(newIdea);

    try {
        await supabaseCall('POST', TABLE, newIdea);
    } catch (error) {
        if (handleAuthError(error)) return;
        console.error('Error creating:', error);
        showToast('⚠️ Error en Supabase, idea guardada localmente', 'warning');
    }
    saveCache();
    openModal(newIdea.id);
}

function optionsHtml(list, selected) {
    const options = selected && !list.some(o => o.id === selected) ? [...list, findOption(list, selected)] : list;
    return options.map(o => `<option value="${escapeHtml(o.id)}" ${selected === o.id ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
}

function pillsHtml(name, list, selected, allowEmpty) {
    const options = selected && !list.some(o => o.id === selected) ? [...list, findOption(list, selected)] : list;
    const empty = allowEmpty
        ? `<label class="pill" style="--c:#8fa8d8"><input type="radio" name="${name}" value="" ${selected ? '' : 'checked'}><span>Sin definir</span></label>`
        : '';
    return `<div class="pills" role="radiogroup">${empty}${options.map(o => `
        <label class="pill" style="--c:${o.color}"><input type="radio" name="${name}" value="${escapeHtml(o.id)}" ${selected === o.id ? 'checked' : ''}><span>${escapeHtml(o.label)}</span></label>
    `).join('')}</div>`;
}

function openModal(id) {
    const idea = ideas.find(i => String(i.id) === String(id));
    if (!idea) return;
    currentEditingId = id;
    hasUnsavedChanges = false;

    const status = findOption(STATUSES, idea.status);
    document.getElementById('modalEyebrow').innerHTML = `<span>#${escapeHtml(idea.id)}</span>${chip(status)}`;
    document.getElementById('modalTitle').textContent = idea.title || 'Nueva idea';
    document.getElementById('modalBody').innerHTML = `
        <section class="section">
            <div class="section-title">La afirmación</div>
            <div class="form-group">
                <label class="form-label" for="title">Título</label>
                <input class="form-input title-input" id="title" value="${escapeHtml(idea.title)}" placeholder="¿Qué se afirma?">
            </div>
            <div class="row-2">
                <div class="form-group">
                    <label class="form-label" for="category">Categoría</label>
                    <input class="form-input" id="category" value="${escapeHtml(idea.category)}" placeholder="IA, Startups, Innovación…">
                </div>
                <div class="form-group">
                    <label class="form-label" for="source">Fuente inicial</label>
                    <input class="form-input" id="source" value="${escapeHtml(idea.source)}" placeholder="Enlace o referencia">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="gancho">Gancho / Contexto</label>
                <textarea class="form-textarea" id="gancho" placeholder="¿Por qué vale la pena verificarla?">${escapeHtml(idea.gancho)}</textarea>
            </div>
        </section>

        <section class="section">
            <div class="section-title">Verificación</div>
            <div class="form-group">
                <span class="form-label">Veredicto</span>
                ${pillsHtml('verdict', VERDICTS, idea.verdict, true)}
            </div>
            <div class="form-group">
                <label class="form-label" for="analysis">Análisis detallado</label>
                <textarea class="form-textarea" id="analysis" style="min-height:120px">${escapeHtml(idea.analysis)}</textarea>
            </div>
        </section>

        <section class="section">
            <div class="section-title">Gestión</div>
            <div class="row-2">
                <div class="form-group">
                    <span class="form-label">Prioridad</span>
                    ${pillsHtml('priority', PRIORITIES, idea.priority, false)}
                </div>
                <div class="form-group">
                    <label class="form-label" for="status">Etapa</label>
                    <select class="form-select" id="status">${optionsHtml(STATUSES, idea.status)}</select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="errorNotes">Protocolo de error (si falla)</label>
                <textarea class="form-textarea" id="errorNotes" placeholder="Documentar si se descubre un error...">${escapeHtml(idea.errorNotes)}</textarea>
            </div>
        </section>
    `;

    document.getElementById('modalBody').querySelectorAll('input, textarea, select').forEach(field => {
        field.addEventListener('input', () => { hasUnsavedChanges = true; });
        field.addEventListener('change', () => { hasUnsavedChanges = true; });
    });

    document.getElementById('modal').classList.add('open');
    document.getElementById('modalBody').scrollTop = 0;
    if (!idea.title) document.getElementById('title').focus();
}

function closeModal() {
    if (hasUnsavedChanges && !confirm('¿Descartar cambios sin guardar?')) return;
    document.getElementById('modal').classList.remove('open');
    currentEditingId = null;
    hasUnsavedChanges = false;
}

async function deleteIdea(id) {
    if (!confirm(`¿Eliminar idea #${id}? Esta acción no se puede deshacer.`)) return;

    const index = ideas.findIndex(i => String(i.id) === String(id));
    if (index < 0) return;
    const [removed] = ideas.splice(index, 1);

    try {
        await supabaseCall('DELETE', `${TABLE}?id=eq.${encodeURIComponent(id)}`);
        showToast(`✓ Idea "${removed.title || 'sin título'}" eliminada`, 'success');
        saveCache();
    } catch (error) {
        ideas.splice(index, 0, removed);
        if (handleAuthError(error)) return;
        console.error('Error deleting:', error);
        showToast('✗ Error al eliminar en Supabase', 'error');
    }
    render();
}

async function saveIdea() {
    if (!currentEditingId) return;
    const idea = ideas.find(i => String(i.id) === String(currentEditingId));
    if (!idea) return;

    for (const field of ['title', 'category', 'gancho', 'source', 'analysis', 'status', 'errorNotes']) {
        idea[field] = document.getElementById(field).value;
    }
    for (const field of ['verdict', 'priority']) {
        const checked = document.querySelector(`#modalBody input[name="${field}"]:checked`);
        idea[field] = checked ? checked.value : '';
    }
    idea.last_edited_by = editorName();
    idea.last_edited_at = new Date().toISOString();
    saveCache();

    try {
        await supabaseCall('PATCH', `${TABLE}?id=eq.${encodeURIComponent(idea.id)}`, idea);
        showToast('✓ Cambios guardados en Supabase', 'success');
    } catch (error) {
        if (handleAuthError(error)) return;
        console.error('Error saving:', error);
        showToast('✗ Error al guardar en Supabase (guardado localmente)', 'error');
    }

    hasUnsavedChanges = false;
    closeModal();
    render();
}

// --- Sesión ---

// Nombre que se guarda en last_edited_by y se muestra en el encabezado.
function editorName() {
    return TEAM_EMAIL ? 'Equipo' : currentUserEmail();
}

function showLogin(message = '') {
    connected = false;
    ideas = [];
    currentEditingId = null;
    hasUnsavedChanges = false;
    document.getElementById('modal').classList.remove('open');
    document.getElementById('appScreen').hidden = true;
    document.getElementById('loginScreen').hidden = false;
    const errorBox = document.getElementById('loginError');
    errorBox.textContent = message;
    errorBox.hidden = !message;
    const emailInput = document.getElementById('loginEmail');
    document.getElementById('loginEmailGroup').hidden = Boolean(TEAM_EMAIL);
    emailInput.required = !TEAM_EMAIL;
    if (TEAM_EMAIL) emailInput.value = TEAM_EMAIL;
    document.getElementById(TEAM_EMAIL ? 'loginPassword' : 'loginEmail').focus();
}

function showApp() {
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('appScreen').hidden = false;
    document.getElementById('userEmail').textContent = editorName() || '';
    document.getElementById('userAvatar').textContent = initials(editorName());
    loadIdeas();
}

// Si la sesión expiró o fue revocada, vuelve al login. Devuelve true si lo manejó.
function handleAuthError(error) {
    if (!(error instanceof AuthError)) return false;
    clearCache();
    showLogin('Tu sesión expiró. Vuelve a iniciar sesión.');
    return true;
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = document.getElementById('btnLogin');
    const errorBox = document.getElementById('loginError');
    button.disabled = true;
    errorBox.hidden = true;
    try {
        const email = TEAM_EMAIL || document.getElementById('loginEmail').value.trim();
        await signIn(email, document.getElementById('loginPassword').value);
        document.getElementById('loginPassword').value = '';
        showApp();
    } catch (error) {
        console.error('Login error:', error);
        errorBox.textContent = error instanceof AuthError && error.status === 400
            ? (TEAM_EMAIL ? 'Contraseña incorrecta.' : 'Correo o contraseña incorrectos.')
            : `No se pudo iniciar sesión: ${error.message}`;
        errorBox.hidden = false;
    } finally {
        button.disabled = false;
    }
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    if (hasUnsavedChanges && !confirm('¿Descartar cambios sin guardar?')) return;
    await signOut();
    clearCache();
    showLogin();
});

document.getElementById('btnNewIdea').addEventListener('click', createNewIdea);
document.getElementById('search').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderContent();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('modal').classList.contains('open')) closeModal();
});
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
});
document.getElementById('btnSaveIdea').addEventListener('click', saveIdea);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
document.getElementById('btnModalClose').addEventListener('click', closeModal);

if (currentUserEmail()) showApp();
else showLogin();
