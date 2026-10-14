// Reporte formal de la propuesta (etapa En Discusión en adelante).
// Arma un documento A4 con toda la información de la idea, listo para que
// un profesor lo revise. Se abre en una pestaña nueva y "Descargar PDF" usa
// el diálogo de impresión del navegador (Guardar como PDF), sin dependencias.
// Usa las constantes y funciones globales de app.js y prioridad.js.

const REPORT_COLORS = {
    verdadero: '#15803d', falso: '#c81e1e', 'engañoso': '#c2410c', depende: '#a16207', insuficiente: '#64748b'
};

function reportText(value) {
    const text = String(value ?? '').trim();
    return text ? escapeHtml(text) : '<span class="na">No informado</span>';
}

// Texto largo: respeta los saltos de línea que escribió el equipo.
function reportParagraphs(value) {
    const text = String(value ?? '').trim();
    if (!text) return '<p class="na">No informado</p>';
    return text.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

function reportLink(url) {
    const text = String(url ?? '').trim();
    if (!text) return '<span class="na">No informado</span>';
    return /^https?:\/\//i.test(text)
        ? `<a href="${escapeHtml(text)}">${escapeHtml(text)}</a>`
        : escapeHtml(text);
}

function reportDate(value, withTime = false) {
    if (!value) return '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const options = withTime
        ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-CL', options);
}

function reportBadge(option, colorKey) {
    if (!option) return '<span class="na">Sin definir</span>';
    const color = REPORT_COLORS[colorKey] || '#334155';
    return `<span class="badge" style="--c:${color}">${escapeHtml(option.label)}</span>`;
}

function reportRows(rows) {
    return `<table class="kv">${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`).join('')}</table>`;
}

function reportSection(number, title, body) {
    return `<section><h2><span class="num">${number}</span>${escapeHtml(title)}</h2>${body}</section>`;
}

function reportFileName(idea) {
    const slug = (idea.title || 'propuesta').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
    return `Propuesta Fast Check ${idea.id} - ${slug}`;
}

function buildReportHtml(idea) {
    const stage = findOption(ALL_STATUSES, idea.status);
    const verdict = idea.verdict ? findOption(VERDICTS, idea.verdict) : null;
    const now = new Date();
    const logo = new URL('assets/innexa-hub-logo-light.png', window.location.href).href;
    const label = (list, id) => (id ? findOption(list, id).label : '');

    // 1 · Afirmación
    const initialSources = idea.initial_sources.filter(s => (s.ref || '').trim());
    const claim = `
        <blockquote>“${escapeHtml(idea.title || 'Sin afirmación')}”</blockquote>
        ${reportRows([
            ['Autor / medio', reportText(idea.claim_author)],
            ['Fecha de la afirmación', reportText(reportDate(idea.claim_date))],
            ['Enlace', reportLink(idea.claim_url)],
            ['Categoría', reportText(idea.category)],
            ['Alcance', reportText(idea.scope)],
            ['Pregunta a verificar', reportText(idea.question)]
        ])}
        <h3>Gancho y contexto</h3>
        ${reportParagraphs(idea.gancho)}
        <h3>Fuentes iniciales</h3>
        ${initialSources.length
            ? `<ol class="refs">${initialSources.map(s => `<li>${reportLink(s.ref)}</li>`).join('')}</ol>`
            : '<p class="na">No informado</p>'}`;

    // 2 · Investigación
    const sources = idea.sources.filter(s => Object.values(s).some(v => String(v || '').trim()));
    const stanceCount = id => sources.filter(s => s.stance === id).length;
    const typeShort = id => label(L.SOURCE_TYPES, id).replace(/\s*★+$/, '');
    const sourcesHtml = sources.length ? `<table class="grid sources">
            <thead><tr><th class="c">N°</th><th>Fuente</th><th>Tipo</th><th>Postura</th></tr></thead>
            <tbody>${sources.map((s, i) => `<tr>
                <td class="c">${i + 1}</td>
                <td><strong>${reportText(s.title)}</strong>
                    <div class="src-meta">${[s.author, s.year].map(v => String(v || '').trim()).filter(Boolean).map(escapeHtml).join(' · ')}</div>
                    ${s.url ? `<div class="src-link">${reportLink(s.url)}</div>` : ''}
                    ${s.notes ? `<div class="src-notes">${escapeHtml(s.notes)}</div>` : ''}</td>
                <td>${reportText(typeShort(s.type))}</td>
                <td>${reportText(label(L.SOURCE_STANCES, s.stance))}</td>
            </tr>`).join('')}</tbody>
        </table>` : '<p class="na">Aún no se registran fuentes de verificación.</p>';
    const research = `
        <h3>Fuentes de verificación</h3>
        <p class="muted">${sources.length} fuente(s) registrada(s) · mínimo requerido: ${L.MIN_VERIFICATION_SOURCES} independientes ·
            respaldan: ${stanceCount('respalda')} · contradicen: ${stanceCount('contradice')} · aportan contexto: ${stanceCount('contexto')}</p>
        ${sourcesHtml}
        ${idea.single_source_exception ? `<h3>Excepción de fuente única</h3>${reportParagraphs(idea.single_source_exception)}` : ''}`;

    // 3 · Veredicto y análisis
    const conclusion = `
        <div class="verdict">
            <span class="verdict-label">Veredicto propuesto</span>
            ${reportBadge(verdict, idea.verdict)}
            ${verdict && verdict.hint ? `<span class="muted">${escapeHtml(verdict.hint)}</span>` : ''}
        </div>
        <h3>Explicación</h3>
        ${reportParagraphs(idea.analysis)}
        <h3>Contexto que falta</h3>
        ${reportParagraphs(idea.missing_context)}`;

    const sections = [
        reportSection(1, 'La afirmación', claim),
        reportSection(2, 'Investigación', research),
        reportSection(3, 'Veredicto y análisis', conclusion)
    ];

    const title = reportFileName(idea);
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
    @page { size: A4; margin: 18mm 18mm 20mm; @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Arial, sans-serif; color: #5b6b86; } @bottom-left { content: "Fast Check INNEXA · Propuesta ${escapeHtml(String(idea.id))}"; font: 8pt Arial, sans-serif; color: #5b6b86; } }
    * { box-sizing: border-box; }
    html { background: #e9edf3; }
    body { margin: 0; color: #0f1b33; font: 10.5pt/1.55 Georgia, 'Times New Roman', serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; padding: 12px 16px; background: #0B2A6F; color: #fff; font: 13px/1.4 Arial, sans-serif; }
    .toolbar button { font: 600 14px Arial, sans-serif; padding: 9px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,.4); background: transparent; color: #fff; cursor: pointer; }
    .toolbar button.primary { background: #F28C28; border-color: #F28C28; }
    .toolbar span { opacity: .8; }
    .page { width: 210mm; max-width: 100%; margin: 24px auto; padding: 18mm; background: #fff; box-shadow: 0 8px 30px rgba(11,42,111,.15); }
    header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 3px solid #0B2A6F; padding-bottom: 10px; }
    header img { height: 46px; }
    header .meta { text-align: right; font: 9pt/1.5 Arial, sans-serif; color: #5b6b86; }
    .doc-title { margin: 18px 0 4px; font: 700 19pt/1.25 Arial, sans-serif; color: #0B2A6F; }
    .doc-sub { margin: 0 0 14px; font: 10pt Arial, sans-serif; color: #5b6b86; letter-spacing: .04em; text-transform: uppercase; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #d5dce8; border-radius: 6px; overflow: hidden; margin-bottom: 8px; }
    .summary div { padding: 8px 10px; border-right: 1px solid #d5dce8; border-bottom: 1px solid #d5dce8; font: 10pt Arial, sans-serif; }
    .summary div:nth-child(3n) { border-right: 0; }
    .summary div:nth-last-child(-n+3) { border-bottom: 0; }
    .summary small { display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: #5b6b86; }
    section { margin-top: 20px; }
    h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; padding-bottom: 5px; border-bottom: 1px solid #d5dce8; font: 700 13pt Arial, sans-serif; color: #0B2A6F; break-after: avoid; }
    h2 .num { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #0B2A6F; color: #fff; font-size: 10pt; }
    h3 { margin: 14px 0 6px; font: 700 10.5pt Arial, sans-serif; color: #043087; break-after: avoid; }
    p { margin: 0 0 8px; text-align: justify; }
    a { color: #043087; word-break: break-all; }
    blockquote { margin: 0 0 12px; padding: 10px 14px; border-left: 4px solid #F28C28; background: #fdf5ec; font-size: 12pt; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 8px; break-inside: auto; }
    tr { break-inside: avoid; }
    .kv th { width: 34%; text-align: left; vertical-align: top; padding: 5px 10px 5px 0; font: 600 9pt Arial, sans-serif; color: #5b6b86; }
    .kv td { padding: 5px 0; vertical-align: top; }
    .kv tr + tr th, .kv tr + tr td { border-top: 1px dotted #d5dce8; }
    .grid th, .grid td { border: 1px solid #d5dce8; padding: 6px 8px; vertical-align: top; font-size: 9.5pt; }
    .grid th { background: #eef2f8; font: 700 8.5pt Arial, sans-serif; text-align: left; text-transform: uppercase; letter-spacing: .04em; color: #0B2A6F; }
    .grid .c, .grid th.c { text-align: center; white-space: nowrap; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1.5px solid var(--c); color: var(--c); font: 700 9.5pt Arial, sans-serif; }
    .na { color: #94a3b8; font-style: italic; }
    .muted { color: #5b6b86; font-size: 9.5pt; }
    .sources td { font-size: 9pt; }
    .sources td:first-child { width: 30px; font: 700 9pt Arial, sans-serif; color: #F28C28; }
    .sources td:nth-child(3), .sources td:nth-child(4) { width: 17%; }
    .src-meta { color: #5b6b86; font-size: 8.5pt; }
    .src-link { font-size: 8pt; }
    .src-notes { margin-top: 3px; font-size: 8.5pt; color: #334155; }
    .refs { margin: 0; padding-left: 20px; }
    .verdict { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 10px 12px; background: #f4f6fa; border-radius: 6px; }
    .verdict-label { font: 700 9pt Arial, sans-serif; text-transform: uppercase; letter-spacing: .05em; color: #0B2A6F; }
    footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #d5dce8; font: 8pt Arial, sans-serif; color: #5b6b86; }
    @media (max-width: 720px) {
        .page { margin: 0; padding: 16px; box-shadow: none; }
        .summary { grid-template-columns: 1fr 1fr; }
        .summary div { border-right: 1px solid #d5dce8 !important; border-bottom: 1px solid #d5dce8 !important; }
        .kv th { width: 40%; }
    }
    @media print {
        html { background: #fff; }
        .toolbar { display: none; }
        .page { width: auto; margin: 0; padding: 0; box-shadow: none; }
    }
</style>
</head>
<body>
<div class="toolbar">
    <button class="primary" onclick="window.print()">⬇ Descargar PDF</button>
    <button onclick="window.close()">Cerrar</button>
    <span>En el diálogo, elige “Guardar como PDF” y desmarca “Encabezados y pies de página”.</span>
</div>
<div class="page">
    <header>
        <img src="${escapeHtml(logo)}" alt="INNEXA HUB UDLA">
        <div class="meta">Fast Check INNEXA · Workspace de verificación<br>Emitido el ${escapeHtml(reportDate(now, true))}</div>
    </header>
    <h1 class="doc-title">Propuesta de verificación N° ${escapeHtml(String(idea.id))}</h1>
    <p class="doc-sub">Informe de investigación para revisión académica</p>
    <div class="summary">
        <div><small>Etapa actual</small>${escapeHtml(stage.label)}</div>
        <div><small>Categoría</small>${reportText(idea.category)}</div>
        <div><small>Fecha de la afirmación</small>${reportText(reportDate(idea.claim_date))}</div>
        <div><small>Responsable</small>${reportText(idea.owner)}</div>
        <div><small>Veredicto propuesto</small>${verdict ? escapeHtml(verdict.label) : '<span class="na">Pendiente</span>'}</div>
        <div><small>Última edición</small>${escapeHtml(reportDate(idea.last_edited_at) || '—')}</div>
    </div>
    ${sections.join('')}
    <footer>Documento generado automáticamente desde Fast Check INNEXA a partir de la información registrada por el equipo.
        Basado en los Lineamientos Fast Check INNEXA v3.0. Escala de veredictos: ${VERDICTS.map(v => escapeHtml(v.label)).join(' · ')}.</footer>
</div>
</body>
</html>`;
}

// Abre el reporte en una pestaña nueva. Debe llamarse desde un clic (bloqueador de ventanas).
function openReport(idea) {
    const win = window.open('', '_blank');
    if (!win) {
        showToast('⚠️ El navegador bloqueó la ventana del reporte. Permite ventanas emergentes para esta página.', 'warning', 8000);
        return;
    }
    win.document.open();
    win.document.write(buildReportHtml(idea));
    win.document.close();
}
