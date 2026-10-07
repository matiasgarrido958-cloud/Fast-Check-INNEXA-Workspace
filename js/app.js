const { TABLE, SYNC_INTERVAL_MS } = window.APP_CONFIG;
const CACHE_KEY = 'fast-check-ideas';

const STATUSES = [
    { id: 'initial', label: 'Ideas Iniciales' },
    { id: 'discussion', label: 'En Discusión' },
    { id: 'working', label: 'En Proceso' },
    { id: 'pending', label: 'Pendiente Publicación' },
    { id: 'published', label: 'Publicadas' }
];

const VERDICTS = [
    { id: 'verdadero', label: 'Verdadero' },
    { id: 'falso', label: 'Falso' },
    { id: 'engañoso', label: 'Engañoso' },
    { id: 'depende', label: 'Depende' },
    { id: 'insuficiente', label: 'Evidencia Insuficiente' }
];

const PRIORITIES = [
    { id: 'low', label: 'Baja' },
    { id: 'medium', label: 'Media' },
    { id: 'high', label: 'Alta' }
];

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

function showToast(msg, type = 'success', durationMs = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
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
        saveCache();
    } catch (error) {
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
    if (currentEditingId) return;
    try {
        const data = await supabaseCall('GET', `${TABLE}?order=id`);
        if (Array.isArray(data) && JSON.stringify(ideas) !== JSON.stringify(data)) {
            ideas = data;
            saveCache();
            render();
            showToast('🔄 Sincronizado desde Supabase', 'success');
        }
    } catch (error) {
        console.error('Sync error:', error);
    }
}, SYNC_INTERVAL_MS);

function render() {
    renderTabs();
    renderContent();
}

function renderTabs() {
    document.getElementById('tabs').innerHTML = STATUSES.map((status) => {
        const count = ideas.filter(idea => idea.status === status.id).length;
        return `<button class="tab ${status.id === currentTab ? 'active' : ''}" data-status="${status.id}">${status.label} (${count})</button>`;
    }).join('');

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.getAttribute('data-status');
            render();
        });
    });
}

function renderContent() {
    const filtered = ideas.filter(idea => idea.status === currentTab);
    let html = filtered.map(idea => `
        <div class="card priority-${escapeHtml(idea.priority)}" data-id="${escapeHtml(idea.id)}">
            <button class="card-delete" data-id="${escapeHtml(idea.id)}" aria-label="Eliminar">🗑️</button>
            <div class="card-content" data-id="${escapeHtml(idea.id)}">
                <div class="card-id">#${escapeHtml(idea.id)}</div>
                <div class="card-title">${escapeHtml(idea.title) || '(sin título)'}</div>
                <div class="card-badges">
                    <span class="badge">${escapeHtml(idea.category) || 'Sin categoría'}</span>
                    ${idea.verdict ? `<span class="badge verdict-${escapeHtml(idea.verdict)}">${escapeHtml(idea.verdict)}</span>` : ''}
                </div>
                <div class="card-meta">
                    ${escapeHtml(idea.last_edited_by || 'Usuario')} · ${idea.last_edited_at ? new Date(idea.last_edited_at).toLocaleString('es-CL') : 'Nunca'}
                </div>
            </div>
        </div>
    `).join('');
    if (!html) html = '<div class="empty">Sin ideas en este estado</div>';
    document.getElementById('content').innerHTML = `<div class="grid">${html}</div>`;

    document.querySelectorAll('.card-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteIdea(btn.getAttribute('data-id'));
        });
    });

    document.querySelectorAll('.card-content').forEach(content => {
        content.addEventListener('click', () => openModal(content.getAttribute('data-id')));
    });
}

async function createNewIdea() {
    const maxId = Math.max(0, ...ideas.map(i => parseInt(i.id, 10) || 0));
    const newIdea = blankIdea(String(maxId + 1).padStart(3, '0'));
    ideas.push(newIdea);

    try {
        await supabaseCall('POST', TABLE, newIdea);
    } catch (error) {
        console.error('Error creating:', error);
        showToast('⚠️ Error en Supabase, idea guardada localmente', 'warning');
    }
    saveCache();
    openModal(newIdea.id);
}

function optionsHtml(list, selected, placeholder) {
    const first = placeholder ? `<option value="">${placeholder}</option>` : '';
    return first + list.map(o => `<option value="${o.id}" ${selected === o.id ? 'selected' : ''}>${o.label}</option>`).join('');
}

function openModal(id) {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    currentEditingId = id;
    hasUnsavedChanges = false;

    document.getElementById('modalTitle').textContent = `#${idea.id} — ${idea.title || '(nueva idea)'}`;
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label class="form-label" for="title">Título</label>
            <input class="form-input" id="title" value="${escapeHtml(idea.title)}">
        </div>
        <div class="form-group">
            <label class="form-label" for="category">Categoría</label>
            <input class="form-input" id="category" value="${escapeHtml(idea.category)}">
        </div>
        <div class="form-group">
            <label class="form-label" for="gancho">Gancho / Contexto</label>
            <textarea class="form-textarea" id="gancho">${escapeHtml(idea.gancho)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label" for="source">Fuente Inicial</label>
            <input class="form-input" id="source" value="${escapeHtml(idea.source)}">
        </div>
        <div class="form-group">
            <label class="form-label" for="verdict">Veredicto</label>
            <select class="form-select" id="verdict">${optionsHtml(VERDICTS, idea.verdict, '-- Selecciona --')}</select>
        </div>
        <div class="form-group">
            <label class="form-label" for="analysis">Análisis Detallado</label>
            <textarea class="form-textarea" id="analysis">${escapeHtml(idea.analysis)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label" for="priority">Prioridad</label>
            <select class="form-select" id="priority">${optionsHtml(PRIORITIES, idea.priority)}</select>
        </div>
        <div class="form-group">
            <label class="form-label" for="status">Estado</label>
            <select class="form-select" id="status">${optionsHtml(STATUSES, idea.status)}</select>
        </div>
        <div class="form-group">
            <label class="form-label" for="errorNotes">Protocolo de Error (si falla)</label>
            <textarea class="form-textarea" id="errorNotes" placeholder="Documentar si se descubre un error...">${escapeHtml(idea.errorNotes)}</textarea>
        </div>
    `;

    document.getElementById('modalBody').querySelectorAll('input, textarea, select').forEach(field => {
        field.addEventListener('input', () => { hasUnsavedChanges = true; });
        field.addEventListener('change', () => { hasUnsavedChanges = true; });
    });

    document.getElementById('modal').classList.add('open');
}

function closeModal() {
    if (hasUnsavedChanges && !confirm('¿Descartar cambios sin guardar?')) return;
    document.getElementById('modal').classList.remove('open');
    currentEditingId = null;
    hasUnsavedChanges = false;
}

async function deleteIdea(id) {
    if (!confirm(`¿Eliminar idea #${id}? Esta acción no se puede deshacer.`)) return;

    const index = ideas.findIndex(i => i.id === id);
    if (index < 0) return;
    const [removed] = ideas.splice(index, 1);

    try {
        await supabaseCall('DELETE', `${TABLE}?id=eq.${encodeURIComponent(id)}`);
        showToast(`✓ Idea "${removed.title || 'sin título'}" eliminada`, 'success');
        saveCache();
    } catch (error) {
        console.error('Error deleting:', error);
        showToast('✗ Error al eliminar en Supabase', 'error');
        ideas.splice(index, 0, removed);
    }
    render();
}

async function saveIdea() {
    if (!currentEditingId) return;
    const idea = ideas.find(i => i.id === currentEditingId);
    if (!idea) return;

    for (const field of ['title', 'category', 'priority', 'gancho', 'source', 'verdict', 'analysis', 'status', 'errorNotes']) {
        idea[field] = document.getElementById(field).value;
    }
    idea.last_edited_by = 'Usuario';
    idea.last_edited_at = new Date().toISOString();
    saveCache();

    try {
        await supabaseCall('PATCH', `${TABLE}?id=eq.${encodeURIComponent(idea.id)}`, idea);
        showToast('✓ Cambios guardados en Supabase', 'success');
    } catch (error) {
        console.error('Error saving:', error);
        showToast('✗ Error al guardar en Supabase (guardado localmente)', 'error');
    }

    hasUnsavedChanges = false;
    closeModal();
    render();
}

document.getElementById('btnNewIdea').addEventListener('click', createNewIdea);
document.getElementById('btnSaveIdea').addEventListener('click', saveIdea);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
document.getElementById('btnModalClose').addEventListener('click', closeModal);

loadIdeas();
