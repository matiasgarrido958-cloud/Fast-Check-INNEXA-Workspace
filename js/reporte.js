// Reporte formal de la propuesta (etapa En Discusión en adelante).
// Arma un PDF A4 con toda la información de la idea, listo para que un
// profesor lo revise, y lo descarga directamente. Usa pdfmake (js/vendor/,
// licencia MIT), que se carga solo la primera vez que se pide un reporte.
// Usa las constantes y funciones globales de app.js.

const REPORT_LIBS = ['js/vendor/pdfmake.min.js?v=0.2.20', 'js/vendor/vfs_fonts.js?v=0.2.20'];
const REPORT_LOGO = 'assets/innexa-hub-logo-light.png';

const RC = {
    navy: '#0B2A6F', blue: '#043087', orange: '#F28C28', text: '#0f1b33', muted: '#5b6b86',
    na: '#94a3b8', line: '#d5dce8', soft: '#eef2f8', quote: '#fdf5ec', verdictBg: '#f4f6fa'
};

const REPORT_VERDICT_COLORS = {
    verdadero: '#15803d', falso: '#c81e1e', 'engañoso': '#c2410c', depende: '#a16207', insuficiente: '#64748b'
};

function reportDate(value, withTime = false) {
    if (!value) return '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const options = withTime
        ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-CL', options);
}

function reportFileName(idea) {
    const slug = (idea.title || 'propuesta').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
    return `Propuesta Fast Check ${idea.id} - ${slug}`;
}

// --- Piezas del documento (formato pdfmake) ---

const NA = { text: 'No informado', color: RC.na, italics: true };

function rText(value) {
    const text = String(value ?? '').trim();
    return text ? { text } : { ...NA };
}

function rLink(url) {
    const text = String(url ?? '').trim();
    if (!text) return { ...NA };
    return /^https?:\/\//i.test(text) ? { text, link: text, color: RC.blue, decoration: 'underline' } : { text };
}

// Texto largo: un párrafo por cada bloque separado por una línea en blanco.
function rParagraphs(value) {
    const text = String(value ?? '').trim();
    if (!text) return [{ ...NA, margin: [0, 0, 0, 8] }];
    return text.split(/\n{2,}/).map(p => ({ text: p, alignment: 'justify', margin: [0, 0, 0, 8] }));
}

function rHeading(number, title) {
    return {
        margin: [0, 16, 0, 8],
        headlineLevel: 1,
        stack: [
            {
                columns: [
                    {
                        width: 20,
                        table: { widths: [14], body: [[{ text: String(number), color: '#ffffff', bold: true, fontSize: 10, alignment: 'center' }]] },
                        layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => RC.navy, paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 2, paddingBottom: () => 2 }
                    },
                    { width: '*', text: title, style: 'h2', margin: [6, 1, 0, 0] }
                ]
            },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: RC.line }], margin: [0, 5, 0, 0] }
        ]
    };
}

function rSub(title) {
    return { text: title, style: 'h3', margin: [0, 10, 0, 5] };
}

// Tabla de dos columnas (dato / valor) con líneas punteadas entre filas.
function rRows(rows) {
    return {
        table: {
            widths: ['34%', '*'],
            body: rows.map(([label, value]) => [{ text: label, style: 'kvLabel' }, value])
        },
        layout: {
            hLineWidth: i => (i === 0 || i === rows.length ? 0 : 0.6),
            vLineWidth: () => 0,
            hLineColor: () => RC.line,
            hLineStyle: () => ({ dash: { length: 2, space: 2 } }),
            paddingLeft: () => 0, paddingRight: () => 8, paddingTop: () => 4, paddingBottom: () => 4
        },
        margin: [0, 0, 0, 6]
    };
}

function rGridLayout() {
    return {
        hLineWidth: () => 0.6, vLineWidth: () => 0.6,
        hLineColor: () => RC.line, vLineColor: () => RC.line,
        fillColor: row => (row === 0 ? RC.soft : null),
        paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5
    };
}

function rSummary(cells) {
    const cell = ([label, value]) => ({ stack: [{ text: label.toUpperCase(), style: 'tiny' }, value] });
    return {
        table: { widths: ['*', '*', '*'], body: [cells.slice(0, 3).map(cell), cells.slice(3, 6).map(cell)] },
        layout: {
            hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => RC.line, vLineColor: () => RC.line,
            paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6
        },
        margin: [0, 0, 0, 4]
    };
}

function buildReportDoc(idea, logo) {
    const stage = findOption(ALL_STATUSES, idea.status);
    const verdict = idea.verdict ? findOption(VERDICTS, idea.verdict) : null;
    const verdictColor = REPORT_VERDICT_COLORS[idea.verdict] || '#334155';
    const label = (list, id) => (id ? findOption(list, id).label : '');
    const typeShort = id => label(L.SOURCE_TYPES, id).replace(/\s*★+$/, '');

    // 1 · Afirmación
    const initialSources = idea.initial_sources.filter(s => (s.ref || '').trim());
    const claim = [
        rHeading(1, 'La afirmación'),
        {
            table: { widths: ['*'], body: [[{ text: `“${idea.title || 'Sin afirmación'}”`, italics: true, fontSize: 12 }]] },
            layout: {
                hLineWidth: () => 0, vLineWidth: i => (i === 0 ? 3 : 0), vLineColor: () => RC.orange,
                fillColor: () => RC.quote, paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 9, paddingBottom: () => 9
            },
            margin: [0, 0, 0, 10]
        },
        rRows([
            ['Autor / medio', rText(idea.claim_author)],
            ['Fecha de la afirmación', rText(reportDate(idea.claim_date))],
            ['Enlace', rLink(idea.claim_url)],
            ['Categoría', rText(idea.category)],
            ['Alcance', rText(idea.scope)],
            ['Pregunta a verificar', rText(idea.question)]
        ]),
        rSub('Gancho y contexto'),
        ...rParagraphs(idea.gancho),
        rSub('Fuentes iniciales'),
        initialSources.length
            ? { ol: initialSources.map(s => ({ ...rLink(s.ref), fontSize: 9 })), margin: [0, 0, 0, 4] }
            : { ...NA }
    ];

    // 2 · Investigación
    const sources = idea.sources.filter(s => Object.values(s).some(v => String(v || '').trim()));
    const stanceCount = id => sources.filter(s => s.stance === id).length;
    const sourceRows = sources.map((s, i) => [
        { text: String(i + 1), alignment: 'center', bold: true, color: RC.orange },
        {
            stack: [
                { ...rText(s.title), bold: true },
                ...([s.author, s.year].some(v => String(v || '').trim())
                    ? [{ text: [s.author, s.year].map(v => String(v || '').trim()).filter(Boolean).join(' · '), color: RC.muted, fontSize: 8.5 }] : []),
                ...(s.url ? [{ ...rLink(s.url), fontSize: 8 }] : []),
                ...(s.notes ? [{ text: s.notes, fontSize: 8.5, color: '#334155', margin: [0, 3, 0, 0] }] : [])
            ]
        },
        rText(typeShort(s.type)),
        rText(label(L.SOURCE_STANCES, s.stance))
    ]);
    const research = [
        rHeading(2, 'Investigación'),
        rSub('Fuentes de verificación'),
        {
            text: `${sources.length} fuente(s) registrada(s) · mínimo requerido: ${L.MIN_VERIFICATION_SOURCES} independientes · respaldan: ${stanceCount('respalda')} · contradicen: ${stanceCount('contradice')} · aportan contexto: ${stanceCount('contexto')}`,
            style: 'muted', margin: [0, 0, 0, 6]
        },
        sources.length ? {
            table: {
                headerRows: 1,
                dontBreakRows: true,
                widths: [22, '*', 75, 70],
                body: [
                    ['N°', 'Fuente', 'Tipo', 'Postura'].map(h => ({ text: h.toUpperCase(), style: 'th' })),
                    ...sourceRows
                ]
            },
            layout: rGridLayout(),
            fontSize: 9
        } : { text: 'Aún no se registran fuentes de verificación.', color: RC.na, italics: true },
        ...(idea.single_source_exception ? [rSub('Excepción de fuente única'), ...rParagraphs(idea.single_source_exception)] : [])
    ];

    // 3 · Veredicto y análisis
    const conclusion = [
        rHeading(3, 'Veredicto y análisis'),
        {
            table: {
                widths: ['auto', 'auto', '*'],
                body: [[
                    { text: 'VEREDICTO PROPUESTO', style: 'tiny', bold: true, color: RC.navy, margin: [0, 2, 0, 0] },
                    verdict ? { text: verdict.label, bold: true, color: verdictColor } : { text: 'Sin definir', color: RC.na, italics: true },
                    verdict && verdict.hint ? { text: verdict.hint, style: 'muted' } : ''
                ]]
            },
            layout: {
                hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => RC.verdictBg,
                paddingLeft: () => 10, paddingRight: () => 6, paddingTop: () => 8, paddingBottom: () => 8
            },
            margin: [0, 0, 0, 4]
        },
        rSub('Explicación'),
        ...rParagraphs(idea.analysis),
        rSub('Contexto que falta'),
        ...rParagraphs(idea.missing_context)
    ];

    return {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 50],
        // Un título de sección no queda solo al final de una página.
        pageBreakBefore: (node, followingOnPage) => node.headlineLevel === 1 && followingOnPage.length < 6,
        info: { title: reportFileName(idea), author: 'Fast Check INNEXA', subject: idea.title || '' },
        defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: RC.text },
        styles: {
            title: { fontSize: 19, bold: true, color: RC.navy },
            subtitle: { fontSize: 9.5, color: RC.muted, characterSpacing: 0.5 },
            h2: { fontSize: 13, bold: true, color: RC.navy },
            h3: { fontSize: 10.5, bold: true, color: RC.blue },
            kvLabel: { fontSize: 9, bold: true, color: RC.muted },
            th: { fontSize: 8, bold: true, color: RC.navy },
            tiny: { fontSize: 7, color: RC.muted, characterSpacing: 0.4 },
            muted: { fontSize: 9, color: RC.muted }
        },
        footer: (page, pages) => ({
            columns: [
                { text: `Fast Check INNEXA · Propuesta ${idea.id}`, alignment: 'left' },
                { text: `Página ${page} de ${pages}`, alignment: 'right' }
            ],
            fontSize: 8, color: RC.muted, margin: [40, 18, 40, 0]
        }),
        content: [
            {
                columns: [
                    logo ? { image: logo, width: 120 } : { text: 'INNEXA HUB', bold: true, color: RC.navy, fontSize: 14 },
                    { text: [`Fast Check INNEXA · Workspace de verificación\nEmitido el ${reportDate(new Date(), true)}`], alignment: 'right', fontSize: 8.5, color: RC.muted, margin: [0, 14, 0, 0] }
                ]
            },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2.5, lineColor: RC.navy }], margin: [0, 8, 0, 14] },
            { text: `Propuesta de verificación N° ${idea.id}`, style: 'title' },
            { text: 'INFORME DE INVESTIGACIÓN PARA REVISIÓN ACADÉMICA', style: 'subtitle', margin: [0, 3, 0, 12] },
            rSummary([
                ['Etapa actual', { text: stage.label }],
                ['Categoría', rText(idea.category)],
                ['Fecha de la afirmación', rText(reportDate(idea.claim_date))],
                ['Responsable', rText(idea.owner)],
                ['Veredicto propuesto', verdict ? { text: verdict.label } : { text: 'Pendiente', color: RC.na, italics: true }],
                ['Última edición', { text: reportDate(idea.last_edited_at) || '—' }]
            ]),
            ...claim,
            ...research,
            ...conclusion,
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: RC.line }], margin: [0, 18, 0, 6] },
            {
                text: `Documento generado automáticamente desde Fast Check INNEXA a partir de la información registrada por el equipo. Basado en los Lineamientos Fast Check INNEXA v3.0. Escala de veredictos: ${VERDICTS.map(v => v.label).join(' · ')}.`,
                fontSize: 8, color: RC.muted
            }
        ]
    };
}

// --- Descarga ---

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(script);
    });
}

let reportLibsLoading = null;

function loadReportLibs() {
    if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve();
    if (!reportLibsLoading) {
        reportLibsLoading = REPORT_LIBS.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
            .catch(error => { reportLibsLoading = null; throw error; });
    }
    return reportLibsLoading;
}

async function loadReportLogo() {
    try {
        const blob = await (await fetch(REPORT_LOGO)).blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return null;
    }
}

// Genera el PDF de la idea y lo descarga como archivo.
async function downloadReport(idea) {
    showToast('Generando el PDF de la propuesta…', 'success', 2500);
    try {
        const [, logo] = await Promise.all([loadReportLibs(), loadReportLogo()]);
        pdfMake.createPdf(buildReportDoc(idea, logo)).download(`${reportFileName(idea)}.pdf`);
    } catch (error) {
        console.error('Report error:', error);
        showToast(`✗ No se pudo generar el PDF. Detalle: ${error.message}`, 'error', 8000);
    }
}
