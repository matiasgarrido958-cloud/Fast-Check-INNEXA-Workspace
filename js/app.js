const { TABLE, SYNC_INTERVAL_MS, TEAM_EMAIL } = window.APP_CONFIG;
const L = window.LINEAMIENTOS;
const CACHE_KEY = 'fast-check-ideas';

// Flujo de 5 etapas (Lineamientos → "Flujo de trabajo completo").
const STATUSES = [
    { id: 'initial', label: 'Ideas Iniciales', color: 'var(--k-initial)', hint: 'Captura la afirmación exacta: quién la dijo, dónde, cuándo y al menos 2 fuentes iniciales.' },
    { id: 'discussion', label: 'En Discusión', color: 'var(--k-discussion)', hint: 'Evaluación inicial: ¿está en cobertura y es verificable? Se asigna prioridad y responsable.' },
    { id: 'working', label: 'En Proceso', color: 'var(--k-working)', hint: 'Investigación: fuentes de verificación, veredicto, explicación y checklist.' },
    { id: 'pending', label: 'Pendiente Publicación', color: 'var(--k-pending)', hint: 'Redacción y diseño del post, revisión por otra persona y aprobación del equipo.' },
    { id: 'published', label: 'Publicadas', color: 'var(--k-published)', hint: 'Link, métricas y registro de correcciones (protocolo de error).' }
];
const DISCARDED = { id: 'discarded', label: 'Descartadas', color: 'var(--k-neutral)', hint: 'Ideas que no siguieron, con su motivo. Se pueden restaurar.' };
const ALL_STATUSES = [...STATUSES, DISCARDED];

// Escala oficial de veredictos (Lineamientos → "Escala de veredictos").
const VERDICTS = [
    { id: 'verdadero', label: 'Verdadero', color: 'var(--k-verdadero)', hint: 'La evidencia respalda la afirmación dentro del alcance definido.' },
    { id: 'falso', label: 'Falso', color: 'var(--k-falso)', hint: 'La evidencia contradice su contenido central.' },
    { id: 'engañoso', label: 'Engañoso', color: 'var(--k-enganoso)', hint: 'Contiene elementos ciertos, pero omite o altera contexto decisivo.' },
    { id: 'depende', label: 'Depende', color: 'var(--k-depende)', hint: 'La respuesta cambia según condiciones identificables (se explicitan).' },
    { id: 'insuficiente', label: 'Evidencia Insuficiente', color: 'var(--k-insuficiente)', hint: 'No hay sustento suficiente para confirmar ni refutar. No demostrado ≠ Falso.' }
];

const PRIORITIES = [
    { id: 'high', label: 'Alta', color: 'var(--k-high)' },
    { id: 'medium', label: 'Media', color: 'var(--k-medium)' },
    { id: 'low', label: 'Baja', color: 'var(--k-low)' }
];

// Protocolo de corrección (Fe de Erratas).
const CORRECTION_LEVELS = [
    { id: '1', label: 'Nivel 1 — Error menor', hint: 'Typo, enlace roto, fecha. Editar caption o dejar constancia en comentario.' },
    { id: '2', label: 'Nivel 2 — Error en evidencia o veredicto', hint: 'Story de Fe de Erratas, pinear si es importante y responder en comentarios.' },
    { id: '3', label: 'Nivel 3 — Información nueva', hint: 'Publicar como ACTUALIZACIÓN, distinguiéndolo de un error.' }
];

// Los colores reales los define cada tema (css/theme-*.css) en variables --k-*.
const FALLBACK_COLOR = 'var(--k-neutral)';

// Busca la opción por id; si el valor no está en la lista (dato antiguo), la
// crea para mostrarlo tal cual en vez de perderlo.
function findOption(list, id) {
    return list.find(o => o.id === id) || { id, label: id, color: FALLBACK_COLOR };
}

// La prioridad sale de la matriz en En Discusión (en vivo); antes no aplica y
// después queda la que se guardó al avanzar.
function priorityOf(idea) {
    if (idea.status === 'initial') return '';
    if (idea.status === 'discussion') return effectivePriority(idea, matrixFor(idea, ideas));
    return idea.priority;
}

function stageIndex(status) {
    return STATUSES.findIndex(s => s.id === status);
}

function nextStatus(status) {
    const i = stageIndex(status);
    return i >= 0 && i < STATUSES.length - 1 ? STATUSES[i + 1] : null;
}

function prevStatus(status) {
    const i = stageIndex(status);
    return i > 0 ? STATUSES[i - 1] : null;
}

function blankIdea(id, title = '', category = '', priority = '', editedBy = 'Usuario') {
    return {
        id, title, category, priority, gancho: '', source: '', status: 'initial',
        claim_author: '', claim_url: '', claim_date: '', scope: '', question: '', initial_sources: [],
        in_coverage: false, is_verifiable: false, circulates: false, owner: '', discard_reason: '', discarded_from: '',
        ai_eval: null, priority_score: null, priority_override: '', priority_override_reason: '',
        sources: [], single_source_exception: '', verdict: '', analysis: '', missing_context: '', checklist: {},
        hook: '', key_points: '', design_url: '', reviewed_by: '', approved_by_team: false,
        published_url: '', published_at: '', saves: null, shares: null, corrections: [],
        errorLevel: '', errorNotes: '',
        last_edited_by: editedBy, last_edited_at: new Date().toISOString()
    };
}

// Completa los campos que falten (filas antiguas o cache) para que el resto
// del código pueda asumir la estructura completa.
function normalizeIdea(raw) {
    const idea = { ...raw };
    const defaults = blankIdea(idea.id);
    for (const [key, value] of Object.entries(defaults)) {
        if (key === 'saves' || key === 'shares') continue;
        if (idea[key] === undefined || idea[key] === null) idea[key] = value;
    }
    for (const key of ['initial_sources', 'sources', 'corrections']) {
        if (!Array.isArray(idea[key])) idea[key] = [];
    }
    if (typeof idea.checklist !== 'object' || Array.isArray(idea.checklist)) idea.checklist = {};
    if (idea.initial_sources.length === 0 && idea.source) idea.initial_sources = [{ ref: idea.source }];
    return idea;
}

const INITIAL_IDEAS = [
    ['001', 'La IA va a reemplazar a todos los ingenieros en 5 años', 'IA'],
    ['002', 'El 90% de startups de IA fracasan en el primer año', 'Startups'],
    ['003', 'Solo los fondos de VC grandes logran salidas de unicornios', 'Startups'],
    ['004', 'La creatividad NO se puede automatizar con IA', 'IA'],
    ['005', 'Chile tiene ventaja competitiva en startups Deep Tech', 'Innovación'],
    ['006', 'El blockchain es más seguro que criptografía convencional', 'Tecnología'],
    ['007', 'La sostenibilidad en tech cuesta 50% más en presupuesto', 'Innovación'],
    ['008', 'Machine Learning requiere mínimo 1 millón de datos', 'IA'],
    ['009', 'Argentina es el nuevo hub de IA en Latinoamérica', 'Innovación'],
    ['010', 'El 80% de empleos desaparecerá en 20 años', 'IA'],
    ['011', 'Los algoritmos de recomendación causan depresión en jóvenes', 'Tecnología'],
    ['012', 'La innovación en startups es 10x más rápida que en corporaciones', 'Innovación']
];

// --- Requisitos para avanzar de etapa (validaciones de los Lineamientos) ---

function filledInitialSources(idea) {
    return idea.initial_sources.filter(s => (s.ref || '').trim()).length;
}

function completeVerificationSources(idea) {
    return idea.sources.filter(s => (s.title || '').trim() && (s.url || '').trim()).length;
}

function hookWords(hook) {
    return (hook || '').trim().split(/\s+/).filter(Boolean).length;
}

// Devuelve la lista de lo que falta para que `idea` pueda pasar a `target`.
function requirementsFor(idea, target) {
    const missing = [];
    const unchecked = list => list.filter(item => !idea.checklist[item.id]).length;
    switch (target) {
        case 'discussion': {
            if (!idea.title.trim()) missing.push('Escribe la afirmación.');
            if (!idea.category.trim()) missing.push('Indica la categoría.');
            if (!idea.claim_author.trim()) missing.push('Indica quién hizo la afirmación (autor o medio).');
            if (!idea.claim_date) missing.push('Indica la fecha de la afirmación.');
            const n = filledInitialSources(idea);
            if (n < L.MIN_INITIAL_SOURCES) missing.push(`Agrega al menos ${L.MIN_INITIAL_SOURCES} fuentes iniciales (hay ${n}).`);
            break;
        }
        case 'working':
            if (!idea.in_coverage) missing.push('Confirma que está dentro de las áreas de cobertura.');
            if (!idea.is_verifiable) missing.push('Confirma que es verificable (no opinión ni especulación).');
            if (!idea.circulates) missing.push('Confirma que circula de verdad o tiene un riesgo claro (para no amplificarla).');
            if (idea.priority_override && !idea.priority_override_reason.trim()) missing.push('Escribe el motivo por el que cambiaron la prioridad de la matriz.');
            if (!idea.owner) missing.push('Asigna un responsable.');
            break;
        case 'pending': {
            const n = completeVerificationSources(idea);
            const exception = idea.single_source_exception.trim() && n >= 1;
            if (n < L.MIN_VERIFICATION_SOURCES && !exception) {
                missing.push(`Agrega al menos ${L.MIN_VERIFICATION_SOURCES} fuentes de verificación con título y enlace (hay ${n}), o documenta la excepción de fuente única.`);
            }
            if (!idea.verdict) missing.push('Elige un veredicto.');
            if (!idea.analysis.trim()) missing.push('Escribe la explicación concisa.');
            const k = unchecked(L.CHECKLIST_RESEARCH);
            if (k) missing.push(`Completa el checklist de investigación (faltan ${k}).`);
            break;
        }
        case 'published': {
            const words = hookWords(idea.hook);
            if (!words) missing.push('Escribe el hook.');
            else if (words > 10) missing.push(`El hook tiene ${words} palabras (máximo 10).`);
            if (!idea.key_points.trim()) missing.push('Escribe los puntos clave del post.');
            if (!idea.reviewed_by) missing.push('Indica quién revisó.');
            else if (samePerson(idea.reviewed_by, idea.owner)) missing.push('La revisión debe hacerla una persona distinta del responsable.');
            const k = unchecked(L.CHECKLIST_PUBLISH);
            if (k) missing.push(`Completa el checklist de publicación (faltan ${k}).`);
            if (!idea.approved_by_team) missing.push('Falta la aprobación del equipo.');
            break;
        }
    }
    return missing;
}

// Avisos que no bloquean, pero que los Lineamientos piden revisar.
function warningsFor(idea) {
    const warnings = [];
    if (stageIndex(idea.status) >= 2 && idea.sources.length >= 2 && !idea.sources.some(s => s.stance === 'contradice')) {
        warnings.push('Ninguna fuente contradice la afirmación: ¿se buscó evidencia contraria?');
    }
    if (idea.sources.some(s => s.type === 'rumor')) {
        warnings.push('Hay una fuente tipo rumor: requiere 2+ fuentes independientes públicas que la respalden.');
    }
    return warnings;
}

let ideas = [];
let currentEditingId = null;
let hasUnsavedChanges = false;
let currentTab = 'initial';
let searchQuery = '';
// Ideas que se están evaluando con IA, y las que ya se intentó evaluar solas
// en esta sesión (para no repetir llamadas si la IA falla).
const evaluatingIds = new Set();
const autoEvalTried = new Set();
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
            ideas = data.map(normalizeIdea);
            showToast(`✓ Cargadas ${ideas.length} ideas desde Supabase`, 'success');
        } else {
            ideas = INITIAL_IDEAS.map(([id, title, category]) => blankIdea(id, title, category, '', 'Sistema'));
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
        ideas = (readCache() || INITIAL_IDEAS.map(([id, title, category]) => blankIdea(id, title, category, '', 'Sistema'))).map(normalizeIdea);
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
        if (!Array.isArray(data)) return;
        const fresh = data.map(normalizeIdea);
        if (JSON.stringify(ideas) !== JSON.stringify(fresh)) {
            ideas = fresh;
            saveCache();
            render();
            showToast('🔄 Sincronizado desde Supabase', 'success');
        }
    } catch (error) {
        if (handleAuthError(error)) return;
        console.error('Sync error:', error);
    }
}, SYNC_INTERVAL_MS);

// --- Tablero ---

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
    const active = ideas.filter(i => i.status !== 'discarded');
    const withVerdict = active.filter(i => i.verdict).length;
    const published = ideas.filter(i => i.status === 'published').length;
    const discarded = ideas.length - active.length;
    document.getElementById('summary').textContent =
        `${active.length} ideas activas · ${withVerdict} con veredicto · ${published} publicadas · ${discarded} descartadas`;
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

    const current = findOption(ALL_STATUSES, currentTab);
    const discardedCount = ideas.filter(idea => idea.status === 'discarded').length;
    document.getElementById('boardBar').innerHTML = `
        <p class="stage-hint"><strong>${escapeHtml(current.label)}:</strong> ${escapeHtml(current.hint || '')}</p>
        <button class="discard-tab ${currentTab === 'discarded' ? 'active' : ''}" data-status="discarded" aria-pressed="${currentTab === 'discarded'}">
            <svg><use href="#i-archive"/></svg>Descartadas (${discardedCount})
        </button>`;

    document.querySelectorAll('.stage, .discard-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.getAttribute('data-status');
            render();
        });
    });
}

function matchesSearch(idea) {
    if (!searchQuery) return true;
    const haystack = `${idea.id} ${idea.title} ${idea.category} ${idea.claim_author} ${idea.owner}`.toLowerCase();
    return haystack.includes(searchQuery);
}

// Línea de estado de la tarjeta: qué falta para avanzar, o datos de cierre.
function cardProgress(idea) {
    if (idea.status === 'discarded') {
        return `<div class="card-progress muted">Motivo: ${escapeHtml(idea.discard_reason || 'sin motivo')}</div>`;
    }
    if (idea.status === 'published') {
        const parts = [];
        if (!idea.published_url) parts.push('<span class="warn">Falta el link</span>');
        if (idea.corrections.length) parts.push(`${idea.corrections.length} corrección(es)`);
        return parts.length ? `<div class="card-progress">${parts.join(' · ')}</div>` : '';
    }
    const next = nextStatus(idea.status);
    const missing = requirementsFor(idea, next.id);
    return missing.length
        ? `<div class="card-progress" title="${escapeHtml(missing.join('\n'))}">Faltan ${missing.length} para pasar a ${escapeHtml(next.label)}</div>`
        : `<div class="card-progress ready">✓ Lista para pasar a ${escapeHtml(next.label)}</div>`;
}

// Puntaje de la matriz para la tarjeta: en Discusión se calcula en vivo; después, el guardado.
function cardScore(idea) {
    if (idea.status === 'discussion') return matrixFor(idea, ideas).score;
    return typeof idea.priority_score === 'number' ? idea.priority_score : null;
}

function scoreChip(idea) {
    const score = cardScore(idea);
    if (score === null || idea.status === 'initial' || idea.status === 'discarded') return '';
    const ai = aiStatusOf(idea) === 'ok';
    const manual = idea.priority_override ? ' · cambiada por el equipo' : '';
    return `<span class="chip outline score" title="Puntaje de la matriz${ai ? ' (evaluado con IA)' : ' (IA pendiente)'}${manual}">⚖ ${score}${ai ? '' : ' · IA pendiente'}${idea.priority_override ? ' · ✎' : ''}</span>`;
}

function renderContent() {
    const filtered = ideas.filter(idea => idea.status === currentTab && matchesSearch(idea));
    // En Discusión y En Proceso, primero lo más prioritario según la matriz.
    if (currentTab === 'discussion' || currentTab === 'working') {
        const rank = { high: 3, medium: 2, low: 1 };
        filtered.sort((a, b) => (rank[priorityOf(b)] || 0) - (rank[priorityOf(a)] || 0) || (cardScore(b) ?? -1) - (cardScore(a) ?? -1));
    }
    let html = filtered.map(idea => `
        <article class="card" data-id="${escapeHtml(idea.id)}" tabindex="0" style="--stage:${findOption(ALL_STATUSES, idea.status).color};--prio:${priorityOf(idea) ? findOption(PRIORITIES, priorityOf(idea)).color : FALLBACK_COLOR}">
            ${idea.status === 'discarded' ? `<button class="card-delete" data-id="${escapeHtml(idea.id)}" aria-label="Eliminar definitivamente" title="Eliminar definitivamente"><svg><use href="#i-trash"/></svg></button>` : ''}
            <div class="card-top">
                <span class="card-id">#${escapeHtml(idea.id)}</span>
                ${priorityOf(idea) ? chip(findOption(PRIORITIES, priorityOf(idea)), 'priority') : ''}
            </div>
            <div class="card-title ${idea.title ? '' : 'untitled'}">${escapeHtml(idea.title) || 'Sin título'}</div>
            <div class="card-tags">
                ${idea.verdict ? chip(findOption(VERDICTS, idea.verdict)) : ''}
                <span class="chip outline">${escapeHtml(idea.category) || 'Sin categoría'}</span>
                ${idea.owner ? `<span class="chip outline owner">👤 ${escapeHtml(idea.owner)}</span>` : ''}
                ${scoreChip(idea)}
            </div>
            ${cardProgress(idea)}
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
    const newIdea = blankIdea(String(maxId + 1).padStart(3, '0'), '', '', '', editorName());
    ideas.push(newIdea);

    try {
        await supabaseCall('POST', TABLE, newIdea);
    } catch (error) {
        if (handleAuthError(error)) return;
        console.error('Error creating:', error);
        showToast('⚠️ Error en Supabase, idea guardada localmente', 'warning');
    }
    saveCache();
    currentTab = 'initial';
    render();
    openModal(newIdea.id);
}

// --- Formulario por etapas ---

function optionsHtml(list, selected, placeholder = '') {
    const options = selected && !list.some(o => o.id === selected) ? [...list, findOption(list, selected)] : list;
    const first = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : '';
    return first + options.map(o => `<option value="${escapeHtml(o.id)}" ${selected === o.id ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
}

// Nombres libres: se sugieren los que ya se usaron para mantenerlos parejos.
function samePerson(a, b) {
    const norm = s => (s || '').trim().toLowerCase();
    return norm(a) !== '' && norm(a) === norm(b);
}

function peopleDatalist() {
    const names = new Map();
    for (const idea of ideas) {
        for (const name of [idea.owner, idea.reviewed_by]) {
            const clean = (name || '').trim();
            if (clean && !names.has(clean.toLowerCase())) names.set(clean.toLowerCase(), clean);
        }
    }
    return `<datalist id="peopleList">${[...names.values()].sort().map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>`;
}

function personInput(id, value) {
    return `<input class="form-input" id="${id}" list="peopleList" value="${escapeHtml(value)}" placeholder="Escribe un nombre" autocomplete="off">`;
}

function pillsHtml(name, list, selected, allowEmpty) {
    const options = selected && !list.some(o => o.id === selected) ? [...list, findOption(list, selected)] : list;
    const empty = allowEmpty
        ? `<label class="pill" style="--c:var(--k-neutral)"><input type="radio" name="${name}" value="" ${selected ? '' : 'checked'}><span>Sin definir</span></label>`
        : '';
    return `<div class="pills" role="radiogroup">${empty}${options.map(o => `
        <label class="pill" style="--c:${o.color}" ${o.hint ? `title="${escapeHtml(o.hint)}"` : ''}><input type="radio" name="${name}" value="${escapeHtml(o.id)}" ${selected === o.id ? 'checked' : ''}><span>${escapeHtml(o.label)}</span></label>
    `).join('')}</div>`;
}

function field(id, label, value, { type = 'text', placeholder = '', textarea = false, rows = 0, hint = '' } = {}) {
    const control = textarea
        ? `<textarea class="form-textarea" id="${id}" placeholder="${escapeHtml(placeholder)}" ${rows ? `style="min-height:${rows}px"` : ''}>${escapeHtml(value)}</textarea>`
        : `<input class="form-input" id="${id}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`;
    return `<div class="form-group"><label class="form-label" for="${id}">${label}</label>${control}${hint ? `<span class="form-hint">${hint}</span>` : ''}</div>`;
}

function checkbox(id, label, checked, attrs = '') {
    return `<label class="check"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${attrs}><span>${escapeHtml(label)}</span></label>`;
}

function checklistHtml(list, idea) {
    const done = list.filter(item => idea.checklist[item.id]).length;
    return `<div class="checklist">
        <div class="checklist-head">Checklist <span class="checklist-count">${done}/${list.length}</span></div>
        ${list.map(item => checkbox(`ck-${item.id}`, item.label, idea.checklist[item.id], 'data-check="1"')).join('')}
    </div>`;
}

function initialSourceRow(src = {}) {
    return `<div class="src-row" data-row="initial">
        <input class="form-input" data-k="ref" value="${escapeHtml(src.ref)}" placeholder="Enlace o referencia de la fuente">
        <button type="button" class="row-remove" title="Quitar fuente" aria-label="Quitar fuente">×</button>
    </div>`;
}

function verificationSourceRow(src = {}, index = 0) {
    const sel = (key, list, placeholder) => `<select class="form-select" data-k="${key}">${optionsHtml(list, src[key] || '', placeholder)}</select>`;
    return `<div class="vsrc" data-row="verification">
        <div class="vsrc-head"><span class="vsrc-num">Fuente ${index + 1}</span><button type="button" class="row-remove" title="Quitar fuente" aria-label="Quitar fuente">×</button></div>
        <div class="row-2">
            <input class="form-input" data-k="title" value="${escapeHtml(src.title)}" placeholder="Título del estudio, reporte o nota">
            <input class="form-input" data-k="author" value="${escapeHtml(src.author)}" placeholder="Autor(es) / institución">
        </div>
        <div class="row-3">
            <input class="form-input" data-k="url" value="${escapeHtml(src.url)}" placeholder="Enlace (DOI o URL)">
            <input class="form-input" data-k="year" value="${escapeHtml(src.year)}" placeholder="Año">
        </div>
        <div class="row-2">
            ${sel('type', L.SOURCE_TYPES, 'Tipo de fuente…')}
            ${sel('stance', L.SOURCE_STANCES, 'Postura…')}
        </div>
        <textarea class="form-textarea small" data-k="notes" placeholder="Hallazgos clave, limitaciones, conflictos de interés…">${escapeHtml(src.notes)}</textarea>
    </div>`;
}

function correctionRow(c = {}) {
    return `<div class="vsrc" data-row="correction">
        <div class="vsrc-head"><span class="vsrc-num">Corrección</span><button type="button" class="row-remove" title="Quitar" aria-label="Quitar">×</button></div>
        <div class="row-2">
            <select class="form-select" data-k="level">${optionsHtml(CORRECTION_LEVELS, c.level || '', 'Nivel…')}</select>
            <input class="form-input" type="date" data-k="date" value="${escapeHtml(c.date)}">
        </div>
        <textarea class="form-textarea small" data-k="what" placeholder="¿Qué salió mal y por qué?">${escapeHtml(c.what)}</textarea>
        <textarea class="form-textarea small" data-k="action" placeholder="¿Cómo se corrigió? (Story, comentario, actualización…)">${escapeHtml(c.action)}</textarea>
    </div>`;
}

// Sección plegable: abierta si es la etapa actual.
function fold(title, open, body, done = false) {
    return `<details class="fold" ${open ? 'open' : ''}>
        <summary class="section-title">${title}${done ? '<span class="fold-done">✓</span>' : ''}</summary>
        <div class="section">${body}</div>
    </details>`;
}

function sectionClaim(idea, open) {
    return fold('1 · La afirmación', open, `
        ${field('title', 'Afirmación (cita literal o paráfrasis)', idea.title, { placeholder: '¿Qué se afirma exactamente?' })}
        <div class="row-3">
            ${field('claim_author', '¿Quién lo dijo? (autor / medio)', idea.claim_author, { placeholder: 'Ej: @UsuarioX en LinkedIn' })}
            ${field('claim_date', 'Fecha', idea.claim_date, { type: 'date' })}
        </div>
        <div class="row-2">
            ${field('claim_url', 'Enlace a la afirmación', idea.claim_url, { placeholder: 'https://…' })}
            ${field('category', 'Categoría', idea.category, { placeholder: 'IA, Startups, Innovación…' })}
        </div>
        ${field('scope', 'Alcance', idea.scope, { placeholder: '¿Chile o global? ¿Qué sector? ¿Qué población?' })}
        ${field('question', 'Pregunta a verificar', idea.question, { placeholder: 'Ej: ¿Hay evidencia del 40% para 2028?' })}
        ${field('gancho', 'Gancho / Contexto', idea.gancho, { textarea: true, placeholder: '¿Por qué vale la pena verificarla ahora?' })}
        <div class="form-group">
            <span class="form-label">Fuentes iniciales <span class="form-hint inline">mínimo ${L.MIN_INITIAL_SOURCES}</span></span>
            <div class="rows" id="initialSources">${(idea.initial_sources.length ? idea.initial_sources : [{}, {}]).map(initialSourceRow).join('')}</div>
            <button type="button" class="btn btn-ghost btn-add" data-add="initial">+ Agregar fuente</button>
        </div>
    `, stageIndex(idea.status) > 0);
}

const ORIGIN_LABELS = { auto: 'Auto', ia: 'IA', respaldo: 'Respaldo' };
const AI_STATUS_TEXT = {
    ok: 'Evaluado con IA',
    pendiente: 'IA pendiente: se usan valores de respaldo',
    desactualizada: 'La afirmación cambió desde la última evaluación con IA',
    evaluando: 'Evaluando con IA…'
};

function scoreDots(value) {
    return `<span class="dots" aria-label="${value} de 3">${[1, 2, 3].map(n => `<span class="dot ${n <= value ? 'on' : ''}"></span>`).join('')}</span>`;
}

// Tabla de la matriz; se vuelve a dibujar en vivo con el borrador del formulario.
function matrixHtml(draft) {
    const m = matrixFor(draft, ideas);
    const level = findOption(PRIORITIES, m.level);
    const status = evaluatingIds.has(String(draft.id)) ? 'evaluando' : m.aiStatus;
    const rows = m.criteria.map(c => `
        <tr>
            <td><span class="mx-name">${escapeHtml(c.label)}</span><span class="mx-weight">×${c.weight}</span></td>
            <td>${scoreDots(c.value)}</td>
            <td><span class="mx-origin ${c.origin}">${ORIGIN_LABELS[c.origin]}</span></td>
            <td class="mx-reason">${escapeHtml(c.reason)}</td>
        </tr>`).join('');
    return `
        <div class="matrix-head">
            <div class="matrix-score" style="--c:${level.color}">
                <span class="matrix-num">${m.score}</span><span class="matrix-of">/100</span>
                ${chip(level)}
            </div>
            <div class="matrix-meta">
                <span class="mx-status ${status}">${escapeHtml(AI_STATUS_TEXT[status])}${m.model && status === 'ok' ? ` · ${escapeHtml(m.model)}` : ''}</span>
                <button type="button" class="btn btn-ghost btn-add" data-action="ai-eval" ${status === 'evaluando' ? 'disabled' : ''}>${m.aiStatus === 'pendiente' ? '✨ Evaluar con IA' : '↻ Reevaluar con IA'}</button>
            </div>
        </div>
        <div class="matrix-bar"><span style="width:${Math.max(2, Math.min(100, m.score))}%;--c:${level.color}"></span></div>
        <div class="matrix-scroll"><table class="matrix">
            <thead><tr><th>Criterio</th><th>Puntaje</th><th>Origen</th><th>Por qué</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <div class="matrix-notes">
            <div><strong>Esfuerzo:</strong> ${escapeHtml(m.effort.label)} (×${m.effort.factor}) <span class="mx-origin ${m.effort.origin}">${ORIGIN_LABELS[m.effort.origin]}</span> — ${escapeHtml(m.effort.reason)}</div>
            ${m.balance.factor < 1 ? `<div><strong>Equilibrio:</strong> ×${m.balance.factor} — ${escapeHtml(m.balance.reason)}</div>` : ''}
            <div class="commercial"><strong>Potencial comercial / institucional</strong> (no suma al puntaje): ${m.commercial ? `${scoreDots(m.commercial.value)} ${escapeHtml(m.commercial.reason)}` : '<em>se calcula con la IA</em>'}</div>
        </div>`;
}

function sectionDiscussion(idea, open) {
    const overrideOptions = [{ id: '', label: 'Usar la prioridad de la matriz' }, ...PRIORITIES.map(p => ({ id: p.id, label: `Cambiar a ${p.label}` }))];
    return fold('2 · Evaluación del equipo', open, `
        <div class="checks">
            <span class="form-label">Filtros (si alguno no se cumple, se descarta)</span>
            ${checkbox('in_coverage', 'Está dentro de las áreas de cobertura (IA, innovación, tecnología, política que impacta innovación)', idea.in_coverage)}
            ${checkbox('is_verifiable', 'Es verificable: no es opinión ni especulación', idea.is_verifiable)}
            ${checkbox('circulates', 'Circula de verdad o tiene un riesgo claro (si casi nadie la vio, no se verifica para no amplificarla)', idea.circulates)}
        </div>
        <div class="form-group">
            <span class="form-label">Matriz de priorización <span class="form-hint inline">se calcula sola</span></span>
            <div class="matrix-box" id="matrixBox">${matrixHtml(idea)}</div>
        </div>
        <div class="row-2">
            <div class="form-group">
                <label class="form-label" for="priority_override">Prioridad final</label>
                <select class="form-select" id="priority_override">${optionsHtml(overrideOptions, idea.priority_override || '')}</select>
                <input class="form-input" id="priority_override_reason" value="${escapeHtml(idea.priority_override_reason)}" placeholder="Motivo del cambio (obligatorio si cambian la prioridad)" ${idea.priority_override ? '' : 'hidden'}>
            </div>
            <div class="form-group">
                <label class="form-label" for="owner">Responsable</label>
                ${personInput('owner', idea.owner)}
            </div>
        </div>
    `, stageIndex(idea.status) > 1);
}

function sectionResearch(idea, open) {
    const verdict = idea.verdict ? findOption(VERDICTS, idea.verdict) : null;
    return fold('3 · Investigación', open, `
        <div class="form-group">
            <span class="form-label">Fuentes de verificación <span class="form-hint inline">mínimo ${L.MIN_VERIFICATION_SOURCES} independientes · busca también evidencia contraria</span></span>
            <div class="rows" id="verificationSources">${(idea.sources.length ? idea.sources : [{}, {}]).map(verificationSourceRow).join('')}</div>
            <button type="button" class="btn btn-ghost btn-add" data-add="verification">+ Agregar fuente</button>
        </div>
        <details class="mini-fold" ${idea.single_source_exception ? 'open' : ''}>
            <summary>¿Solo hay 1 fuente primaria decisiva? (excepción documentada)</summary>
            ${field('single_source_exception', 'Justificación de la excepción', idea.single_source_exception, { textarea: true, placeholder: 'Ej: texto legal oficial; por qué es decisiva y quién la aprobó.' })}
        </details>
        <div class="form-group">
            <span class="form-label">Veredicto</span>
            ${pillsHtml('verdict', VERDICTS, idea.verdict, true)}
            <span class="form-hint" id="verdictHint">${escapeHtml(verdict ? verdict.hint || '' : 'Elige según la escala oficial.')}</span>
        </div>
        ${field('analysis', 'Explicación concisa', idea.analysis, { textarea: true, rows: 110, placeholder: 'Qué dice la evidencia y por qué el veredicto.' })}
        ${field('missing_context', 'Contexto que falta', idea.missing_context, { textarea: true, placeholder: 'Lo que la afirmación omite o altera.' })}
        ${checklistHtml(L.CHECKLIST_RESEARCH, idea)}
    `, stageIndex(idea.status) > 2);
}

function sectionPublish(idea, open) {
    const words = hookWords(idea.hook);
    return fold('4 · Publicación', open, `
        ${field('hook', 'Hook / pregunta', idea.hook, { placeholder: 'Máximo 10 palabras, llamativo pero preciso', hint: `<span id="hookCount">${words}</span>/10 palabras` })}
        ${field('key_points', 'Puntos clave (2–3)', idea.key_points, { textarea: true, placeholder: 'Máx. 300–400 caracteres en total' })}
        ${field('design_url', 'Link al diseño', idea.design_url, { placeholder: 'Canva, Drive…' })}
        <div class="row-2">
            <div class="form-group">
                <label class="form-label" for="reviewed_by">Revisado por</label>
                ${personInput('reviewed_by', idea.reviewed_by)}
                <span class="form-hint">Otra persona distinta del responsable${idea.owner ? ` (${escapeHtml(idea.owner)})` : ''}.</span>
            </div>
            <div class="form-group">
                <span class="form-label">Aprobación</span>
                ${checkbox('approved_by_team', 'El equipo aprobó la publicación', idea.approved_by_team)}
            </div>
        </div>
        ${checklistHtml(L.CHECKLIST_PUBLISH, idea)}
    `, stageIndex(idea.status) > 3);
}

function sectionPublished(idea, open) {
    return fold('5 · Publicada', open, `
        <div class="row-2">
            ${field('published_url', 'Link de la publicación', idea.published_url, { placeholder: 'https://instagram.com/p/…' })}
            ${field('published_at', 'Fecha de publicación', idea.published_at, { type: 'date' })}
        </div>
        <div class="row-2">
            ${field('saves', 'Guardados', idea.saves ?? '', { type: 'number' })}
            ${field('shares', 'Compartidos', idea.shares ?? '', { type: 'number' })}
        </div>
        <div class="form-group">
            <span class="form-label">Protocolo de corrección (Fe de Erratas)</span>
            <span class="form-hint">No se borra la publicación: se corrige y se deja constancia pública.</span>
            <div class="rows" id="corrections">${idea.corrections.map(correctionRow).join('')}</div>
            ${idea.errorNotes ? `<p class="form-hint">Nota anterior: ${escapeHtml(idea.errorNotes)}</p>` : ''}
            <button type="button" class="btn btn-ghost btn-add" data-add="correction">+ Registrar corrección</button>
        </div>
    `);
}

function sectionDiscard(idea) {
    return `<div class="discard-panel" id="discardPanel" ${idea.status === 'discarded' ? '' : 'hidden'}>
        <div class="section-title">Descartar idea</div>
        <div class="row-2">
            <select class="form-select" id="discard_choice">${optionsHtml(L.DISCARD_REASONS.map(r => ({ id: r, label: r })), L.DISCARD_REASONS.find(r => idea.discard_reason.startsWith(r)) || '', 'Motivo…')}</select>
            <input class="form-input" id="discard_note" value="${escapeHtml(idea.discard_reason.split(' — ').slice(1).join(' — '))}" placeholder="Detalle (opcional)">
        </div>
        ${idea.status === 'discarded' ? '' : '<div class="discard-actions"><button type="button" class="btn btn-ghost" data-action="discard-cancel">Cancelar</button><button type="button" class="btn btn-danger" data-action="discard-confirm">Descartar idea</button></div>'}
    </div>`;
}

function renderModalBody(idea) {
    const i = stageIndex(idea.status);
    const discarded = idea.status === 'discarded';
    let html = '<div class="req-box" id="reqBox"></div>' + peopleDatalist();
    html += sectionDiscard(idea);
    html += sectionClaim(idea, i === 0);
    if (i >= 1 || discarded) html += sectionDiscussion(idea, i === 1);
    if (i >= 2) html += sectionResearch(idea, i === 2);
    if (i >= 3) html += sectionPublish(idea, i === 3);
    if (i >= 4) html += sectionPublished(idea, true);
    return html;
}

function renderModalFooter(idea) {
    const prev = prevStatus(idea.status);
    const next = nextStatus(idea.status);
    const left = idea.status === 'discarded'
        ? `<button class="btn btn-ghost" data-action="restore">↺ Restaurar a ${escapeHtml(findOption(STATUSES, idea.discarded_from || 'initial').label)}</button>`
        : `${idea.status !== 'published' ? '<button class="btn btn-ghost danger" data-action="discard">Descartar</button>' : ''}
           ${prev ? `<button class="btn btn-ghost" data-action="back" title="Volver a ${escapeHtml(prev.label)}">← Volver</button>` : ''}`;
    return `<div class="footer-left">${left}</div>
        <div class="footer-right">
            <button class="btn btn-ghost" data-action="close">Cancelar</button>
            ${next ? `<button class="btn btn-ghost btn-advance" data-action="advance" style="--stage:${next.color}">Pasar a ${escapeHtml(next.label)} →</button>` : ''}
            <button class="btn btn-primary" data-action="save">Guardar</button>
        </div>`;
}

// Lee el formulario sobre una copia de la idea. Solo toca los campos que
// están en pantalla, así las secciones no mostradas conservan sus datos.
function readForm(base) {
    const idea = JSON.parse(JSON.stringify(base));
    const body = document.getElementById('modalBody');
    const get = id => body.querySelector(`#${id}`);
    for (const key of ['title', 'category', 'claim_author', 'claim_url', 'claim_date', 'scope', 'question', 'gancho',
        'owner', 'single_source_exception', 'analysis', 'missing_context', 'hook', 'key_points', 'design_url',
        'reviewed_by', 'published_url', 'published_at', 'priority_override', 'priority_override_reason']) {
        const el = get(key);
        if (el) idea[key] = el.value.trim();
    }
    for (const key of ['in_coverage', 'is_verifiable', 'circulates', 'approved_by_team']) {
        const el = get(key);
        if (el) idea[key] = el.checked;
    }
    for (const key of ['saves', 'shares']) {
        const el = get(key);
        if (el) idea[key] = el.value === '' ? null : Math.max(0, parseInt(el.value, 10) || 0);
    }
    for (const key of ['verdict']) {
        const radios = body.querySelectorAll(`input[name="${key}"]`);
        if (radios.length) {
            const checked = body.querySelector(`input[name="${key}"]:checked`);
            idea[key] = checked ? checked.value : '';
        }
    }
    body.querySelectorAll('input[data-check]').forEach(el => {
        idea.checklist[el.id.replace(/^ck-/, '')] = el.checked;
    });
    const rows = (containerId, keys) => {
        const container = get(containerId);
        if (!container) return null;
        return [...container.querySelectorAll('[data-row]')]
            .map(row => Object.fromEntries(keys.map(k => [k, (row.querySelector(`[data-k="${k}"]`).value || '').trim()])))
            .filter(item => keys.some(k => item[k]));
    };
    const initial = rows('initialSources', ['ref']);
    if (initial) {
        idea.initial_sources = initial;
        idea.source = initial[0] ? initial[0].ref : '';
    }
    const verification = rows('verificationSources', ['title', 'author', 'url', 'year', 'type', 'stance', 'notes']);
    if (verification) idea.sources = verification;
    const corrections = rows('corrections', ['level', 'date', 'what', 'action']);
    if (corrections) idea.corrections = corrections;
    const reason = get('discard_choice');
    if (reason && reason.value && !get('discardPanel').hidden) {
        const note = get('discard_note').value.trim();
        idea.discard_reason = note ? `${reason.value} — ${note}` : reason.value;
    }
    return idea;
}

function currentIdea() {
    return ideas.find(i => String(i.id) === String(currentEditingId));
}

// Recalcula en vivo qué falta para avanzar y los avisos.
function updateRequirements() {
    const idea = currentIdea();
    const box = document.getElementById('reqBox');
    if (!idea || !box) return;
    const draft = readForm(idea);
    const next = nextStatus(idea.status);
    const missing = next ? requirementsFor(draft, next.id) : [];
    const warnings = warningsFor(draft);
    let html = '';
    if (next && missing.length) {
        html += `<div class="req missing"><strong>Para pasar a ${escapeHtml(next.label)} falta:</strong><ul>${missing.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul></div>`;
    } else if (next) {
        html += `<div class="req ok"><strong>✓ Lista para pasar a ${escapeHtml(next.label)}.</strong></div>`;
    }
    if (warnings.length) {
        html += `<div class="req warn">${warnings.map(w => `<div>⚠️ ${escapeHtml(w)}</div>`).join('')}</div>`;
    }
    box.innerHTML = html;
    document.querySelectorAll('.checklist').forEach(list => {
        const boxes = list.querySelectorAll('input[data-check]');
        list.querySelector('.checklist-count').textContent = `${[...boxes].filter(b => b.checked).length}/${boxes.length}`;
    });
    const hookCount = document.getElementById('hookCount');
    if (hookCount) hookCount.textContent = hookWords(draft.hook);
    const matrixBox = document.getElementById('matrixBox');
    if (matrixBox) matrixBox.innerHTML = matrixHtml(draft);
    const overrideReason = document.getElementById('priority_override_reason');
    if (overrideReason) overrideReason.hidden = !draft.priority_override;
    const verdictHint = document.getElementById('verdictHint');
    if (verdictHint) verdictHint.textContent = draft.verdict ? findOption(VERDICTS, draft.verdict).hint || '' : 'Elige según la escala oficial.';
}

function openModal(id) {
    const idea = ideas.find(i => String(i.id) === String(id));
    if (!idea) return;
    currentEditingId = idea.id;
    hasUnsavedChanges = false;

    const status = findOption(ALL_STATUSES, idea.status);
    document.getElementById('modalEyebrow').innerHTML = `<span>#${escapeHtml(idea.id)}</span>${chip(status)}${idea.owner ? `<span class="eyebrow-owner">👤 ${escapeHtml(idea.owner)}</span>` : ''}`;
    document.getElementById('modalTitle').textContent = idea.title || 'Nueva idea';
    const body = document.getElementById('modalBody');
    body.innerHTML = renderModalBody(idea);
    document.getElementById('modalFooter').innerHTML = renderModalFooter(idea);
    updateRequirements();

    document.getElementById('modal').classList.add('open');
    body.scrollTop = 0;
    if (idea.status === 'discussion' && aiStatusOf(idea) === 'pendiente' && !autoEvalTried.has(String(idea.id))) {
        autoEvalTried.add(String(idea.id));
        runAiEvaluation(idea.id, { silent: true });
    }
    if (!idea.title) document.getElementById('title').focus();
}

function markDirty() {
    hasUnsavedChanges = true;
    updateRequirements();
}

function closeModal() {
    if (hasUnsavedChanges && !confirm('¿Descartar cambios sin guardar?')) return;
    document.getElementById('modal').classList.remove('open');
    currentEditingId = null;
    hasUnsavedChanges = false;
}

async function deleteIdea(id) {
    if (!confirm(`¿Eliminar definitivamente la idea #${id}? Esta acción no se puede deshacer.`)) return;

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

// Fuera de Ideas Iniciales la prioridad sale de la matriz (o del cambio del equipo).
function applyPriority(idea) {
    if (idea.status === 'initial') {
        idea.priority = '';
        idea.priority_score = null;
        return;
    }
    if (idea.status === 'discarded') return;
    const m = matrixFor(idea, ideas);
    idea.priority_score = m.score;
    idea.priority = effectivePriority(idea, m);
    if (!idea.priority_override) idea.priority_override_reason = '';
}

// Evalúa una idea con IA y guarda solo el resultado. `silent` evita avisos de
// éxito cuando corre sola en segundo plano.
async function runAiEvaluation(id, { silent = false } = {}) {
    const key = String(id);
    if (evaluatingIds.has(key)) return;
    const base = ideas.find(i => String(i.id) === key);
    if (!base) return;
    // Si el formulario de esta idea está abierto, se evalúa lo que está escrito.
    const source = String(currentEditingId) === key ? readForm(base) : base;
    evaluatingIds.add(key);
    if (String(currentEditingId) === key) updateRequirements();
    try {
        const evaluation = await requestAiEvaluation(source);
        const target = ideas.find(i => String(i.id) === key);
        if (!target) return;
        target.ai_eval = evaluation;
        applyPriority(target);
        saveCache();
        await supabaseCall('PATCH', `${TABLE}?id=eq.${encodeURIComponent(key)}`,
            { ai_eval: target.ai_eval, priority: target.priority, priority_score: target.priority_score });
        if (!silent) showToast('✓ Evaluación con IA lista', 'success');
    } catch (error) {
        if (handleAuthError(error)) return;
        console.error('AI evaluation error:', error);
        showToast(`⚠️ ${error.message} Se usan valores de respaldo.`, 'warning', 8000);
    } finally {
        evaluatingIds.delete(key);
        if (String(currentEditingId) === key) updateRequirements();
        else render();
    }
}

// Guarda la idea actualizada (local + Supabase). Devuelve true si llegó a Supabase.
async function persist(updated, successMsg) {
    const index = ideas.findIndex(i => String(i.id) === String(updated.id));
    if (index < 0) return false;
    applyPriority(updated);
    updated.last_edited_by = editorName();
    updated.last_edited_at = new Date().toISOString();
    ideas[index] = updated;
    saveCache();
    try {
        await supabaseCall('PATCH', `${TABLE}?id=eq.${encodeURIComponent(updated.id)}`, updated);
        showToast(successMsg, 'success');
        return true;
    } catch (error) {
        if (handleAuthError(error)) return false;
        console.error('Error saving:', error);
        showToast(`✗ Error al guardar en Supabase (guardado localmente). Detalle: ${error.message}`, 'error', 10000);
        return false;
    }
}

function finishEditing() {
    hasUnsavedChanges = false;
    document.getElementById('modal').classList.remove('open');
    currentEditingId = null;
    render();
}

async function saveIdea() {
    const idea = currentIdea();
    if (!idea) return;
    await persist(readForm(idea), '✓ Cambios guardados');
    finishEditing();
}

async function moveIdea(direction) {
    const idea = currentIdea();
    if (!idea) return;
    const draft = readForm(idea);
    const target = direction === 'advance' ? nextStatus(idea.status) : prevStatus(idea.status);
    if (!target) return;
    if (direction === 'advance') {
        const missing = requirementsFor(draft, target.id);
        if (missing.length) {
            updateRequirements();
            document.getElementById('modalBody').scrollTop = 0;
            showToast(`Aún no puede pasar a ${target.label}: revisa lo que falta arriba.`, 'warning', 5000);
            return;
        }
    }
    draft.status = target.id;
    await persist(draft, `✓ Movida a ${target.label}`);
    currentTab = target.id;
    finishEditing();
    if (target.id === 'discussion' && aiStatusOf(draft) !== 'ok') {
        autoEvalTried.add(String(draft.id));
        runAiEvaluation(draft.id, { silent: true });
    }
}

async function discardIdea() {
    const idea = currentIdea();
    if (!idea) return;
    const draft = readForm(idea);
    if (!document.getElementById('discard_choice').value) {
        showToast('Elige el motivo para descartar.', 'warning');
        return;
    }
    draft.discarded_from = idea.status;
    draft.status = 'discarded';
    await persist(draft, '✓ Idea descartada (se puede restaurar)');
    finishEditing();
}

async function restoreIdea() {
    const idea = currentIdea();
    if (!idea) return;
    const draft = readForm(idea);
    draft.status = stageIndex(idea.discarded_from) >= 0 ? idea.discarded_from : 'initial';
    draft.discard_reason = '';
    draft.discarded_from = '';
    await persist(draft, `✓ Restaurada a ${findOption(STATUSES, draft.status).label}`);
    currentTab = draft.status;
    finishEditing();
}

// Delegación de eventos del modal (las secciones se generan dinámicamente).
function setupModalEvents() {
    const body = document.getElementById('modalBody');
    body.addEventListener('input', markDirty);
    body.addEventListener('change', markDirty);
    body.addEventListener('click', (e) => {
        const add = e.target.closest('[data-add]');
        if (add) {
            const kind = add.getAttribute('data-add');
            const containerId = { initial: 'initialSources', verification: 'verificationSources', correction: 'corrections' }[kind];
            const container = document.getElementById(containerId);
            const html = kind === 'initial' ? initialSourceRow()
                : kind === 'verification' ? verificationSourceRow({}, container.children.length)
                    : correctionRow({ date: new Date().toISOString().slice(0, 10) });
            container.insertAdjacentHTML('beforeend', html);
            const firstInput = container.lastElementChild.querySelector('input, select, textarea');
            if (firstInput) firstInput.focus();
            markDirty();
            return;
        }
        const remove = e.target.closest('.row-remove');
        if (remove) {
            const container = remove.closest('.rows');
            remove.closest('[data-row]').remove();
            container.querySelectorAll('.vsrc-num').forEach((num, i) => {
                if (container.id === 'verificationSources') num.textContent = `Fuente ${i + 1}`;
            });
            markDirty();
            return;
        }
        const action = e.target.closest('[data-action]');
        if (action) handleModalAction(action.getAttribute('data-action'));
    });
    document.getElementById('modalFooter').addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]');
        if (action) handleModalAction(action.getAttribute('data-action'));
    });
}

function handleModalAction(action) {
    switch (action) {
        case 'save': return saveIdea();
        case 'ai-eval': return runAiEvaluation(currentEditingId);
        case 'advance': return moveIdea('advance');
        case 'back': return moveIdea('back');
        case 'close': return closeModal();
        case 'restore': return restoreIdea();
        case 'discard': {
            const panel = document.getElementById('discardPanel');
            panel.hidden = false;
            document.getElementById('modalBody').scrollTop = 0;
            document.getElementById('discard_choice').focus();
            return;
        }
        case 'discard-cancel':
            document.getElementById('discardPanel').hidden = true;
            return;
        case 'discard-confirm': return discardIdea();
    }
}

setupModalEvents();

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

// --- Tema visual (institucional por defecto, cyber opcional) ---
// El tema se aplica antes de cargar la página (script en index.html);
// aquí solo se cambia y se recuerda en este navegador.
const THEMES = { institucional: 'Modo Cyber', cyber: 'Modo Institucional' };

function currentTheme() {
    return document.documentElement.dataset.theme === 'cyber' ? 'cyber' : 'institucional';
}

function applyTheme(theme) {
    const link = document.getElementById('themeCss');
    link.href = link.href.replace(/theme-(institucional|cyber)\.css/, `theme-${theme}.css`);
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('fast-check-theme', theme); } catch (e) { /* sin storage */ }
    document.getElementById('themeLabel').textContent = THEMES[theme];
}

document.getElementById('btnTheme').addEventListener('click', () => {
    applyTheme(currentTheme() === 'cyber' ? 'institucional' : 'cyber');
});
document.getElementById('themeLabel').textContent = THEMES[currentTheme()];

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
document.getElementById('btnCloseModal').addEventListener('click', closeModal);

if (currentUserEmail()) showApp();
else showLogin();
