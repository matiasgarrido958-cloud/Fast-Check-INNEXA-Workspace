// Matriz de priorización automática (etapa En Discusión).
// Combina señales calculadas por la página (circulación, actualidad, demanda,
// equilibrio) con la evaluación de Gemini (consecuencias, relevancia,
// verificabilidad, esfuerzo y potencial comercial). Configuración en
// js/lineamientos.js → MATRIX.

const MATRIX = window.LINEAMIENTOS.MATRIX;

// Plataformas reconocidas a partir del dominio del enlace.
const PLATFORMS = [
    ['LinkedIn', /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/],
    ['X / Twitter', /(^|\.)(x|twitter)\.com$|(^|\.)t\.co$/],
    ['Instagram', /(^|\.)instagram\.com$/],
    ['TikTok', /(^|\.)tiktok\.com$/],
    ['Facebook', /(^|\.)(facebook|fb)\.com$|(^|\.)fb\.watch$/],
    ['YouTube', /(^|\.)(youtube\.com|youtu\.be)$/],
    ['WhatsApp', /(^|\.)(whatsapp\.com|wa\.me)$/],
    ['Telegram', /(^|\.)(t\.me|telegram\.org)$/],
    ['Threads', /(^|\.)threads\.(net|com)$/],
    ['Reddit', /(^|\.)reddit\.com$/]
];

const STOPWORDS = new Set(['para', 'como', 'pero', 'porque', 'sobre', 'entre', 'desde', 'hasta', 'todos', 'todas', 'este',
    'esta', 'estos', 'estas', 'esto', 'será', 'serán', 'tiene', 'tienen', 'más', 'menos', 'cada', 'solo', 'sólo', 'años',
    'según', 'cuando', 'donde', 'también', 'mucho', 'muchos', 'van', 'que', 'los', 'las', 'del', 'una', 'uno', 'con']);

function normalizeText(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function hostOf(ref) {
    const value = String(ref || '').trim();
    if (!value) return '';
    try {
        return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase();
    } catch (e) {
        return '';
    }
}

// Devuelve el nombre de la plataforma o, para otros sitios, el dominio (prensa / web).
function platformOf(ref) {
    const host = hostOf(ref);
    if (!host || !host.includes('.')) return '';
    const match = PLATFORMS.find(([, re]) => re.test(host));
    return match ? match[0] : `Web: ${host}`;
}

function daysSince(dateText) {
    if (!dateText) return null;
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((today - date) / 86400000));
}

function titleTokens(title) {
    return new Set(normalizeText(title).split(/[^a-z0-9%]+/).filter(w => w.length > 3 && !STOPWORDS.has(w)));
}

function similarTitles(a, b) {
    const ta = titleTokens(a);
    const tb = titleTokens(b);
    if (!ta.size || !tb.size) return false;
    let shared = 0;
    for (const w of ta) if (tb.has(w)) shared++;
    return shared / (ta.size + tb.size - shared) >= 0.5;
}

function sameAuthor(a, b) {
    const na = normalizeText(a).replace(/[@\s]+/g, ' ').trim();
    return na !== '' && na === normalizeText(b).replace(/[@\s]+/g, ' ').trim();
}

// --- Señales calculadas por la página ---

function circulationSignal(idea) {
    const refs = [idea.claim_url, ...idea.initial_sources.map(s => s.ref)];
    const platforms = [...new Set(refs.map(platformOf).filter(Boolean))];
    const sources = refs.filter(r => String(r || '').trim()).length;
    let value = platforms.length >= 3 ? 3 : platforms.length === 2 ? 2 : 1;
    if (value < 2 && sources >= 4) value = 2;
    const list = platforms.map(p => p.replace(/^Web: /, '')).join(', ');
    const reason = platforms.length
        ? `${platforms.length} plataforma(s): ${list}`
        : 'Sin enlaces reconocibles en la afirmación ni en las fuentes';
    return { value, reason };
}

function recencySignal(idea) {
    const days = daysSince(idea.claim_date);
    if (days === null) return { value: 1, reason: 'Sin fecha de la afirmación' };
    const value = days <= MATRIX.RECENCY_DAYS.three ? 3 : days <= MATRIX.RECENCY_DAYS.two ? 2 : 1;
    return { value, reason: days === 0 ? 'Es de hoy' : `Hace ${days} día(s)` };
}

function demandSignal(idea, allIdeas) {
    const count = allIdeas.filter(other => String(other.id) === String(idea.id) || similarTitles(other.title, idea.title)).length;
    const value = count >= 3 ? 3 : count === 2 ? 2 : 1;
    return { value, reason: count > 1 ? `Propuesta ${count} veces (ideas parecidas)` : 'Propuesta 1 vez' };
}

function balanceSignal(idea, allIdeas) {
    if (!idea.claim_author.trim()) return { factor: 1, reason: '' };
    const since = MATRIX.BALANCE.days;
    const others = allIdeas.filter(other => {
        if (String(other.id) === String(idea.id) || other.status === 'discarded') return false;
        if (!sameAuthor(other.claim_author, idea.claim_author)) return false;
        const days = daysSince(other.claim_date) ?? daysSince(String(other.last_edited_at || '').slice(0, 10));
        return days !== null && days <= since;
    }).length;
    return others >= MATRIX.BALANCE.maxSameAuthor
        ? { factor: MATRIX.BALANCE.factor, reason: `${idea.claim_author} ya tiene ${others} idea(s) en los últimos ${since} días` }
        : { factor: 1, reason: '' };
}

// Respaldo sin IA para verificabilidad: dato concreto vs. predicción/opinión.
function fallbackVerifiability(idea) {
    const text = normalizeText(`${idea.title} ${idea.question}`);
    const prediction = /\b(sera|seran|va a|van a|podria|podrian|reemplazara|desaparecera|eliminara|creo|opino|deberia)\b/.test(text)
        || [...text.matchAll(/\b(20\d\d)\b/g)].some(m => Number(m[1]) > new Date().getFullYear());
    if (prediction) return { value: 1, reason: 'Parece predicción u opinión (respaldo automático)' };
    if (/\d/.test(text)) return { value: 3, reason: 'Incluye una cifra o dato concreto (respaldo automático)' };
    return { value: 2, reason: 'Afirmación general (respaldo automático)' };
}

// Respaldo sin IA para relevancia: palabras clave prioritarias.
function fallbackRelevance(idea) {
    const text = ` ${normalizeText(`${idea.title} ${idea.scope} ${idea.category} ${idea.question}`).replace(/[^a-z0-9+ ]/g, ' ')} `;
    const hits = MATRIX.KEYWORDS.filter(k => text.includes(` ${normalizeText(k)} `));
    const value = hits.length >= 2 ? 3 : hits.length === 1 ? 2 : 1;
    return { value, reason: hits.length ? `Palabras clave: ${hits.slice(0, 4).join(', ')} (respaldo automático)` : 'Sin palabras clave prioritarias (respaldo automático)' };
}

// --- Evaluación con IA ---

// Datos de la idea que se envían a la IA; si cambian, la evaluación queda desactualizada.
function aiInputOf(idea) {
    return {
        title: idea.title, claim_author: idea.claim_author, claim_date: idea.claim_date, claim_url: idea.claim_url,
        category: idea.category, scope: idea.scope, question: idea.question, gancho: idea.gancho,
        initial_sources: idea.initial_sources.map(s => s.ref).filter(Boolean)
    };
}

function aiInputKey(idea) {
    return JSON.stringify(aiInputOf(idea));
}

function aiStatusOf(idea) {
    const ai = idea.ai_eval;
    if (!ai || !ai.scores) return 'pendiente';
    return ai.input_key === aiInputKey(idea) ? 'ok' : 'desactualizada';
}

function clampScore(value) {
    const n = Math.round(Number(value));
    return n >= 1 && n <= 3 ? n : null;
}

async function requestAiEvaluation(idea) {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${window.LINEAMIENTOS.AI_FUNCTION}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${await getAccessToken()}`
        },
        body: JSON.stringify({ idea: aiInputOf(idea), today: new Date().toISOString().slice(0, 10) })
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { /* respuesta no JSON */ }
    if (!response.ok) {
        const detail = (data && (data.error || data.message)) || text || `HTTP ${response.status}`;
        throw new Error(response.status === 404
            ? 'La función de IA aún no está creada en Supabase.'
            : `IA no disponible (${response.status}): ${detail}`);
    }
    const scores = {};
    for (const id of ['consecuencias', 'relevancia', 'verificabilidad', 'comercial']) {
        const item = data && data[id];
        const value = item && clampScore(item.value);
        if (value) scores[id] = { value, reason: String(item.reason || '').slice(0, 300) };
    }
    const effort = data && data.esfuerzo && MATRIX.EFFORT.some(e => e.id === data.esfuerzo.value)
        ? { value: data.esfuerzo.value, reason: String(data.esfuerzo.reason || '').slice(0, 300) }
        : null;
    if (!Object.keys(scores).length) throw new Error('La IA respondió en un formato inesperado.');
    return {
        scores, effort, model: data.model || '', evaluated_at: new Date().toISOString(), input_key: aiInputKey(idea)
    };
}

// --- Matriz completa ---

function matrixFor(idea, allIdeas) {
    const ai = idea.ai_eval && idea.ai_eval.scores ? idea.ai_eval : null;
    const aiStatus = aiStatusOf(idea);
    const auto = {
        circulacion: circulationSignal(idea),
        actualidad: recencySignal(idea),
        demanda: demandSignal(idea, allIdeas)
    };
    const fallback = {
        verificabilidad: fallbackVerifiability(idea),
        relevancia: fallbackRelevance(idea),
        consecuencias: { value: 2, reason: 'Valor neutro hasta que la IA evalúe' }
    };

    const criteria = MATRIX.CRITERIA.map(c => {
        let entry;
        let origin;
        if (c.source === 'auto') {
            entry = auto[c.id];
            origin = 'auto';
        } else if (ai && ai.scores[c.id]) {
            entry = ai.scores[c.id];
            origin = 'ia';
        } else {
            entry = fallback[c.id] || { value: 2, reason: 'Sin datos' };
            origin = 'respaldo';
        }
        return { ...c, value: entry.value, reason: entry.reason, origin };
    });

    const effortDef = (ai && ai.effort && MATRIX.EFFORT.find(e => e.id === ai.effort.value)) || MATRIX.EFFORT.find(e => e.id === 'medio');
    const effort = {
        ...effortDef,
        reason: ai && ai.effort ? ai.effort.reason : 'Valor neutro hasta que la IA evalúe',
        origin: ai && ai.effort ? 'ia' : 'respaldo'
    };
    const balance = balanceSignal(idea, allIdeas);

    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const weighted = criteria.reduce((sum, c) => sum + c.value * c.weight, 0);
    const base = ((weighted - totalWeight) / (2 * totalWeight)) * 100;
    const score = Math.round(base * effort.factor * balance.factor);
    const level = score >= MATRIX.THRESHOLDS.high ? 'high' : score >= MATRIX.THRESHOLDS.medium ? 'medium' : 'low';
    const commercial = ai && ai.scores.comercial ? ai.scores.comercial : null;

    return { criteria, effort, balance, base: Math.round(base), score, level, commercial, aiStatus, model: ai ? ai.model : '' };
}

// Prioridad final: la que decidió el equipo (si cambió la de la matriz) o la de la matriz.
function effectivePriority(idea, matrix) {
    return idea.priority_override || matrix.level;
}
