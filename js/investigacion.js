// Investigación profunda con IA (etapa Ideas Iniciales).
// 1. La página arma un prompt con la afirmación para usarlo en Claude u otra IA.
// 2. La IA entrega un informe y, al final, un bloque JSON con formato fijo.
// 3. Se pega la respuesta: la página lee el JSON, completa la idea y la avanza
//    a En Discusión si cumple los requisitos. En En Discusión sirve para actualizar
//    los datos con un informe corregido (por ejemplo, revisado por otra IA).
// Usa las constantes y funciones globales de app.js y lineamientos.js.

function researchIds(list) {
    return list.map(o => `"${o.id}" (${o.label})`).join(', ');
}

function buildResearchPrompt(idea) {
    const known = [
        ['Quién la dijo', idea.claim_author],
        ['Fecha', idea.claim_date],
        ['Enlace', idea.claim_url],
        ['Categoría', idea.category],
        ['Alcance', idea.scope],
        ['Pregunta a verificar', idea.question],
        ['Contexto', idea.gancho],
        ['Fuentes ya encontradas', idea.initial_sources.map(s => s.ref).filter(Boolean).join(' · ')]
    ].filter(([, v]) => String(v || '').trim()).map(([k, v]) => `- ${k}: ${v}`).join('\n');
    const today = new Date().toISOString().slice(0, 10);
    return `Eres investigador del equipo de fact-checking Fast Check INNEXA (INNEXA HUB, UDLA, Chile). Verifica la siguiente afirmación con una investigación profunda y rigurosa.

AFIRMACIÓN: "${idea.title || '[escribe aquí la afirmación]'}"
${known ? `\nDATOS QUE YA TENEMOS:\n${known}\n` : ''}
Fecha de hoy: ${today}.

CÓMO INVESTIGAR
- Identifica quién dijo la afirmación (autor o medio), cuándo y dónde. Si no tiene un autor único verificable, dilo y señala el origen más cercano.
- Busca fuentes verificables, de preferencia chilenas y de los últimos 12 meses. Usa al menos ${L.MIN_VERIFICATION_SOURCES} fuentes independientes y busca también evidencia contraria, no solo confirmaciones.
- Comprueba cada cifra y cita en su fuente original. No inventes enlaces, autores, fechas ni cifras: si no encuentras algo, dilo.
- Distingue hechos, predicciones y opiniones. Advierte conflictos de interés y fuentes secundarias.
- Elige el veredicto según la escala oficial: ${researchIds(VERDICTS)}.
- Áreas de cobertura: IA, innovación, tecnología y política que impacta la innovación.

QUÉ ENTREGAR
Parte 1 — Informe en español con estas secciones:
1. TL;DR: veredicto probable, datos clave y pregunta a verificar recomendada.
2. ¿Quién lo dijo?: tabla con declarante, qué dijo exactamente, fecha, enlace y si se citó en Chile.
3. Fuentes: para cada una, título, medio/autor, fecha, URL, resumen y si respalda, contradice o aporta contexto.
4. Detalles e interpretación de los datos.
5. Calidad de las fuentes y advertencias.

Parte 2 — Al final, OBLIGATORIO, un bloque de código \`\`\`json con exactamente esta estructura (JSON válido, sin comentarios, comillas dobles):

\`\`\`json
{
  "afirmacion": "texto de la afirmación",
  "autor": "quién la dijo (autor / medio), o su origen más cercano",
  "fecha": "AAAA-MM-DD (fecha de la afirmación)",
  "enlace": "URL principal de la afirmación",
  "categoria": "IA | Startups | Innovación | Tecnología | Política",
  "alcance": "país, sector y población",
  "pregunta": "pregunta precisa a verificar",
  "gancho": "por qué vale la pena verificarla ahora",
  "fuentes_iniciales": ["URL o referencia 1", "URL o referencia 2"],
  "en_cobertura": true,
  "verificable": true,
  "circula": true,
  "fuentes_verificacion": [
    {
      "titulo": "título del artículo, estudio o reporte",
      "autor": "autor(es) / medio / institución",
      "enlace": "URL",
      "anio": "AAAA",
      "tipo": "uno de: ${L.SOURCE_TYPES.map(t => t.id).join(', ')}",
      "postura": "uno de: ${L.SOURCE_STANCES.map(s => s.id).join(', ')}",
      "notas": "fecha exacta, hallazgos clave y limitaciones"
    }
  ],
  "excepcion_fuente_unica": "",
  "veredicto": "uno de: ${VERDICTS.map(v => v.id).join(', ')}",
  "explicacion": "qué dice la evidencia y por qué el veredicto (2 a 4 párrafos)",
  "contexto_faltante": "lo que la afirmación omite o altera",
  "advertencias": ["limitación o advertencia 1", "limitación o advertencia 2"]
}
\`\`\`

Tipos de fuente: ${researchIds(L.SOURCE_TYPES)}.
Posturas: ${researchIds(L.SOURCE_STANCES)}.
"en_cobertura", "verificable" y "circula" son true o false según tu evaluación.

Si ya tienes un informe hecho sobre esta afirmación, no repitas la búsqueda: conviértelo a este formato (Parte 1 y Parte 2) sin agregar datos que no estén en él.`;
}

// --- Lectura de la respuesta ---

function researchNorm(text) {
    return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function researchStr(value) {
    if (Array.isArray(value)) return value.map(researchStr).filter(Boolean).join('\n');
    return value == null ? '' : String(value).trim();
}

function researchBool(value) {
    if (typeof value === 'boolean') return value;
    return ['true', 'si', 'yes', '1'].includes(researchNorm(value));
}

// Acepta el id o la etiqueta de la opción (con o sin tildes).
function researchOption(list, value, aliases = {}) {
    const v = researchNorm(value);
    if (!v) return '';
    if (aliases[v]) return aliases[v];
    const hit = list.find(o => researchNorm(o.id) === v || researchNorm(o.label) === v)
        || list.find(o => v.startsWith(researchNorm(o.id)) || researchNorm(o.label).startsWith(v));
    return hit ? hit.id : '';
}

function researchDate(value) {
    const text = researchStr(value);
    const iso = text.match(/\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    const parsed = new Date(text);
    return text && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : '';
}

// Busca el último bloque ```json; si no hay, el texto entre la primera { y la última }.
function extractResearchJson(text) {
    const blocks = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m => m[1]).filter(b => b.trim().startsWith('{'));
    let raw = blocks.length ? blocks[blocks.length - 1] : '';
    if (!raw) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start < 0 || end <= start) throw new Error('No se encontró el bloque JSON al final de la respuesta. Pide a la IA que entregue la "Parte 2".');
        raw = text.slice(start, end + 1);
    }
    raw = raw.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1');
    try {
        return JSON.parse(raw);
    } catch (e) {
        throw new Error(`El bloque JSON no es válido (${e.message}). Pide a la IA que lo corrija.`);
    }
}

function parseResearch(text) {
    const d = extractResearchJson(text);
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('El bloque JSON no tiene la estructura esperada.');
    const list = v => (Array.isArray(v) ? v : v ? [v] : []);
    return {
        title: researchStr(d.afirmacion),
        claim_author: researchStr(d.autor),
        claim_date: researchDate(d.fecha),
        claim_url: researchStr(d.enlace),
        category: researchStr(d.categoria),
        scope: researchStr(d.alcance),
        question: researchStr(d.pregunta),
        gancho: researchStr(d.gancho),
        initial_sources: list(d.fuentes_iniciales).map(s => ({ ref: researchStr(typeof s === 'object' && s ? (s.enlace || s.url || s.titulo) : s) })).filter(s => s.ref),
        in_coverage: researchBool(d.en_cobertura),
        is_verifiable: researchBool(d.verificable),
        circulates: researchBool(d.circula),
        sources: list(d.fuentes_verificacion).filter(s => s && typeof s === 'object').map(s => ({
            title: researchStr(s.titulo),
            author: researchStr(s.autor),
            url: researchStr(s.enlace || s.url),
            year: researchStr(s.anio || s['año']),
            type: researchOption(L.SOURCE_TYPES, s.tipo),
            stance: researchOption(L.SOURCE_STANCES, s.postura, { respalda_parcialmente: 'respalda', 'respalda parcialmente': 'respalda', matiza: 'contexto' }),
            notes: researchStr(s.notas)
        })).filter(s => s.title || s.url),
        single_source_exception: researchStr(d.excepcion_fuente_unica),
        verdict: researchOption(VERDICTS, d.veredicto, { enganoso: 'engañoso', exagerada: 'engañoso', exagerado: 'engañoso', 'evidencia insuficiente': 'insuficiente' }),
        analysis: researchStr(d.explicacion),
        missing_context: researchStr(d.contexto_faltante),
        warnings: list(d.advertencias).map(researchStr).filter(Boolean)
    };
}

// Combina la investigación con la idea. Lo que la IA deja vacío conserva lo que
// ya había; la afirmación escrita por el equipo no se reemplaza.
function mergeResearch(base, r) {
    const idea = JSON.parse(JSON.stringify(base));
    for (const key of ['claim_author', 'claim_date', 'claim_url', 'category', 'scope', 'question', 'gancho',
        'single_source_exception', 'verdict', 'analysis']) {
        if (r[key]) idea[key] = r[key];
    }
    if (!idea.title.trim() && r.title) idea.title = r.title;
    if (r.initial_sources.length) {
        idea.initial_sources = r.initial_sources;
        idea.source = r.initial_sources[0].ref;
    }
    if (r.sources.length) idea.sources = r.sources;
    const limits = r.warnings.length ? `Advertencias de la investigación:\n${r.warnings.map(w => `- ${w}`).join('\n')}` : '';
    const context = [r.missing_context, limits].filter(Boolean).join('\n\n');
    if (context) idea.missing_context = context;
    idea.in_coverage = r.in_coverage;
    idea.is_verifiable = r.is_verifiable;
    idea.circulates = r.circulates;
    return idea;
}

// Desde Ideas Iniciales pasa a En Discusión si cumple los requisitos; en En
// Discusión se queda ahí (solo se actualizan los datos).
function advanceResearch(idea, status) {
    if (status === 'discussion') return { status, missing: [] };
    const missing = requirementsFor(idea, 'discussion');
    return { status: missing.length ? 'initial' : 'discussion', missing };
}

// --- Panel en el formulario ---

function researchPanelHtml(idea) {
    return `<div class="research-panel" id="researchPanel" hidden>
        <div class="section-title">✨ Investigación profunda IA</div>
        <p class="form-hint">${idea.status === 'discussion'
            ? 'Para actualizar la idea con un informe corregido (por ejemplo, revisado por otra IA): pide a la IA el formato del prompt y pega aquí su respuesta. Los datos se reemplazan y la idea sigue en En Discusión.'
            : 'Investiga la afirmación con Claude u otra IA y pega aquí su respuesta: la idea se completa y pasa sola a En Discusión si cumple los requisitos.'}</p>
        <div class="form-group">
            <span class="form-label">1 · Copia este prompt y úsalo en la IA</span>
            <textarea class="form-textarea research-prompt" id="researchPrompt" readonly rows="8"></textarea>
            <button type="button" class="btn btn-ghost btn-add" data-action="research-copy">📋 Copiar prompt</button>
        </div>
        <div class="form-group">
            <label class="form-label" for="researchText">2 · Pega la respuesta completa de la IA</label>
            <textarea class="form-textarea" id="researchText" rows="8" placeholder="Pega aquí el informe con el bloque JSON del final…"></textarea>
        </div>
        <div id="researchResult"></div>
        <div class="discard-actions">
            <button type="button" class="btn btn-ghost" data-action="research-cancel">Cancelar</button>
            <button type="button" class="btn btn-ghost" data-action="research-preview">Revisar respuesta</button>
            <button type="button" class="btn btn-primary" data-action="research-confirm" id="researchConfirm" hidden>Aplicar</button>
        </div>
    </div>`;
}

function researchPreviewHtml(r, merged, outcome) {
    const stage = findOption(STATUSES, outcome.status);
    const filled = [
        ['Autor / medio', r.claim_author], ['Fecha', r.claim_date], ['Enlace', r.claim_url], ['Categoría', r.category],
        ['Alcance', r.scope], ['Pregunta', r.question], ['Gancho', r.gancho], ['Explicación', r.analysis], ['Contexto que falta', r.missing_context]
    ];
    const verdict = r.verdict ? findOption(VERDICTS, r.verdict).label : '';
    const stances = L.SOURCE_STANCES.map(s => `${s.label.toLowerCase()}: ${r.sources.filter(x => x.stance === s.id).length}`).join(' · ');
    const flags = [['Cobertura', r.in_coverage], ['Verificable', r.is_verifiable], ['Circula', r.circulates]]
        .map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · ');
    return `<div class="req ${outcome.missing.length ? 'missing' : 'ok'}">
            <strong>${outcome.missing.length ? `Quedará en ${escapeHtml(stage.label)}. Para pasar a En Discusión falta:` : `✓ Quedará en ${escapeHtml(stage.label)}.`}</strong>
            ${outcome.missing.length ? `<ul>${outcome.missing.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="research-summary">
            <div><strong>Afirmación:</strong> ${escapeHtml(merged.title || '—')}${r.title && r.title !== merged.title ? ' <span class="form-hint inline">(se mantiene la del equipo)</span>' : ''}</div>
            <div><strong>Campos leídos:</strong> ${filled.map(([k, v]) => `${v ? '✓' : '✗'} ${escapeHtml(k)}`).join(' · ')}</div>
            <div><strong>Filtros:</strong> ${flags}</div>
            <div><strong>Fuentes:</strong> ${r.initial_sources.length} iniciales · ${r.sources.length} de verificación (${escapeHtml(stances)})</div>
            <div><strong>Veredicto:</strong> ${verdict ? escapeHtml(verdict) : '✗ no reconocido'}${r.warnings.length ? ` · ${r.warnings.length} advertencia(s)` : ''}</div>
            <div class="form-hint">El checklist de investigación no se marca solo: el equipo debe revisarlo, en especial que cada cifra se comprobó en su fuente original.</div>
        </div>`;
}
