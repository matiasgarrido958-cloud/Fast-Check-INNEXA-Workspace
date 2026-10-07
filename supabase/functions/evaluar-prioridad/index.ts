// Supabase Edge Function: evalúa una idea con Gemini para la matriz de priorización.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY  (obligatorio) clave de Google AI Studio
//   GEMINI_MODEL    (opcional)    modelo a usar; por defecto el Flash vigente
//
// Solo responde a usuarios con sesión iniciada en el workspace: la página envía
// su token y aquí se valida contra Supabase Auth. La clave de Gemini nunca sale
// de este servidor.

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Si un modelo no existe, está saturado o sin cuota, se prueba el siguiente.
const DEFAULT_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];
// Respuestas de Gemini que justifican probar otro modelo.
const RETRY_WITH_NEXT_MODEL = new Set([404, 429, 500, 503]);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const REASON = { type: 'STRING', description: 'Justificación en español, máximo 30 palabras, con razonamiento propio (no repitas los datos entregados).' };

const SCORE = (description: string) => ({
    type: 'OBJECT',
    properties: {
        value: { type: 'INTEGER', description: `${description} Valor entero 1, 2 o 3.` },
        reason: REASON
    },
    required: ['value', 'reason']
});

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        verificabilidad: SCORE('Verificabilidad.'),
        relevancia: SCORE('Relevancia del tema y del emisor.'),
        consecuencias: SCORE('Consecuencias si la gente la cree.'),
        circulacion: SCORE('Circulación y vigencia de la afirmación.'),
        esfuerzo: {
            type: 'OBJECT',
            properties: {
                value: { type: 'STRING', enum: ['bajo', 'medio', 'alto'] },
                reason: REASON
            },
            required: ['value', 'reason']
        },
        comercial: SCORE('Potencial comercial o institucional para INNEXA HUB.'),
        alertas: {
            type: 'STRING',
            description: 'Señales de alerta para quien investigue, separadas por " | ". Texto vacío si no hay.'
        }
    },
    required: ['verificabilidad', 'relevancia', 'consecuencias', 'circulacion', 'esfuerzo', 'comercial', 'alertas']
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function clip(value: unknown, max = 600): string {
    return String(value ?? '').slice(0, max);
}

function describeIdea(idea: Record<string, unknown>): string {
    const sources = Array.isArray(idea.initial_sources) ? idea.initial_sources.slice(0, 10).map(s => `  - ${clip(s, 300)}`).join('\n') : '';
    return `- Afirmación: ${clip(idea.title)}
- Quién la dijo: ${clip(idea.claim_author, 200)}
- Fecha de la afirmación (según el equipo): ${clip(idea.claim_date, 20)}
- Enlace: ${clip(idea.claim_url, 300)}
- Categoría: ${clip(idea.category, 100)}
- Alcance: ${clip(idea.scope, 300)}
- Pregunta a verificar: ${clip(idea.question, 300)}
- Gancho / contexto: ${clip(idea.gancho, 800)}
- Fuentes iniciales:
${sources || '  - (sin fuentes)'}`;
}

function buildPrompt(idea: Record<string, unknown>, today: string): string {
    return `Eres parte del equipo editorial de "Fast Check INNEXA", un proyecto de INNEXA HUB (Universidad de Las Américas, Chile)
que verifica afirmaciones, mitos y rumores sobre innovación, inteligencia artificial, tecnología y startups, con foco en Chile,
y publica en Instagram. El equipo son 3 estudiantes.

Tu tarea: puntuar UNA afirmación para priorizar qué se verifica primero. Los criterios siguen la práctica de verificadores
profesionales (Full Fact, Maldita.es, Chequeado, Fast Check CL) y la investigación sobre "check-worthiness" (ClaimBuster, CheckThat!).

Reglas:
- No repitas los datos entregados: cada motivo debe aportar razonamiento propio.
- Puedes usar conocimiento general bien establecido (por ejemplo, el tamaño aproximado de la población o de la fuerza
  laboral de Chile) para detectar cifras imposibles o inconsistentes. No inventes datos específicos.
- Si falta información para un criterio, usa 2 y dilo.
- Sé mesurado con las consecuencias: suelen sobreestimarse.
- Fecha de hoy: ${clip(today, 10)}.

Criterios (1 a 3):
- verificabilidad: 3 = hecho concreto y comprobable con datos públicos (cifra, estadística, comparación, hecho fechado);
  2 = factual pero general o difícil de delimitar; 1 = opinión, valoración, predicción sobre el futuro o algo no comprobable.
- relevancia: 3 = impacto directo en innovación, tecnología o emprendimiento en Chile, o la dice una persona o institución influyente;
  2 = tema global relevante para la audiencia chilena, o emisor de alcance medio; 1 = tema marginal o fuera del foco.
- consecuencias (si la gente la cree): 3 = puede llevar a decisiones con costo real (dinero, inversión, empleo, carrera,
  políticas públicas, seguridad); 2 = distorsiona la comprensión del tema y puede llevar a malas decisiones menores;
  1 = anecdótico, con poco efecto práctico.
  El daño solo ocurre si suficiente gente la ve y la cree: si circula poco o es antigua, NO uses 3, salvo que el riesgo
  sea grave aunque la vea poca gente (salud, seguridad, fraude).
- circulacion (alcance y vigencia), juzgada por los enlaces, el emisor, la fecha y tu conocimiento general:
  3 = circula ampliamente (medios nacionales, figura pública o viral en redes) y es reciente o se sigue citando;
  2 = circulación moderada o de nicho, o amplia pero antigua; 1 = marginal, sin señales de difusión ni vigencia.
  Varios sitios pequeños que replican lo mismo NO equivalen a circulación amplia. No inventes cifras de difusión.
- esfuerzo (para verificarla este equipo): bajo = menos de 2 horas, hay datos oficiales fáciles de encontrar;
  medio = cerca de 1 día, requiere varias fuentes o cálculos; alto = más de 3 días, requiere estudios especializados,
  expertos o datos no públicos.
- comercial: potencial de valor institucional o comercial para INNEXA HUB (vinculación con empresas, formación, alianzas,
  posicionamiento universitario). Es solo informativo: no cambia la prioridad. 3 = alto, 2 = medio, 1 = bajo.
- alertas: inconsistencias que el equipo debe revisar al investigar (cifras imposibles, error de unidades o decimales,
  datos desactualizados, fuente original distinta de lo que se afirma, fecha dudosa). Texto vacío si no hay.

Afirmación a evaluar:
${describeIdea(idea)}`;
}

async function isAuthenticated(req: Request): Promise<boolean> {
    const auth = req.headers.get('Authorization') || '';
    const apikey = req.headers.get('apikey') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!auth.startsWith('Bearer ') || !apikey || !supabaseUrl) return false;
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
    return res.ok;
}

async function callGemini(apiKey: string, model: string, body: unknown) {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body)
    });
}

// Llama a Gemini probando los modelos en orden; reintenta una vez si está saturado.
async function callWithFallback(apiKey: string, models: string[], body: unknown) {
    let lastError = '';
    let lastStatus = 502;
    for (const model of models) {
        let res = await callGemini(apiKey, model, body);
        if (res.status === 503) {
            await sleep(1500);
            res = await callGemini(apiKey, model, body);
        }
        const data = await res.json().catch(() => null);
        if (res.ok) return { ok: true as const, model, data };
        const message = data?.error?.message || `Gemini respondió ${res.status}`;
        if (!RETRY_WITH_NEXT_MODEL.has(res.status)) return { ok: false as const, status: 502, error: message };
        lastError = res.status === 404 ? `Modelo ${model} no disponible`
            : res.status === 429 ? `Cuota de Gemini agotada por ahora: ${message}`
                : `Gemini saturado por ahora: ${message}`;
        lastStatus = res.status === 429 ? 429 : 502;
    }
    return { ok: false as const, status: lastStatus, error: lastError || 'Ningún modelo disponible' };
}

function textOf(data: any): string {
    return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    try {
        if (!(await isAuthenticated(req))) return json({ error: 'Sesión no válida' }, 401);

        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) return json({ error: 'Falta el secret GEMINI_API_KEY en Supabase' }, 500);

        const body = await req.json().catch(() => null);
        const idea = body && typeof body.idea === 'object' ? body.idea : null;
        if (!idea || !String(idea.title || '').trim()) return json({ error: 'Falta la afirmación a evaluar' }, 400);
        const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today)) ? String(body.today) : new Date().toISOString().slice(0, 10);

        const configured = Deno.env.get('GEMINI_MODEL');
        const models = configured ? [configured, ...DEFAULT_MODELS.filter(m => m !== configured)] : DEFAULT_MODELS;

        const result = await callWithFallback(apiKey, models, {
            contents: [{ role: 'user', parts: [{ text: buildPrompt(idea, today) }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA }
        });
        if (!result.ok) return json({ error: result.error }, result.status);

        let parsed;
        try {
            parsed = JSON.parse(textOf(result.data));
        } catch {
            return json({ error: 'Gemini no devolvió un JSON válido' }, 502);
        }
        return json({ ...parsed, model: result.model });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
});
