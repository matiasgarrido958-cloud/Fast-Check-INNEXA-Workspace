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

const SCORE = (description: string) => ({
    type: 'OBJECT',
    properties: {
        value: { type: 'INTEGER', description: `${description} Valor entero 1, 2 o 3.` },
        reason: { type: 'STRING', description: 'Justificación breve en español (máximo 25 palabras).' }
    },
    required: ['value', 'reason']
});

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        verificabilidad: SCORE('Verificabilidad.'),
        relevancia: SCORE('Relevancia del tema y del emisor.'),
        consecuencias: SCORE('Consecuencias si la gente la cree.'),
        esfuerzo: {
            type: 'OBJECT',
            properties: {
                value: { type: 'STRING', enum: ['bajo', 'medio', 'alto'] },
                reason: { type: 'STRING', description: 'Justificación breve en español (máximo 25 palabras).' }
            },
            required: ['value', 'reason']
        },
        comercial: SCORE('Potencial comercial o institucional para INNEXA HUB.')
    },
    required: ['verificabilidad', 'relevancia', 'consecuencias', 'esfuerzo', 'comercial']
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function clip(value: unknown, max = 600): string {
    return String(value ?? '').slice(0, max);
}

function buildPrompt(idea: Record<string, unknown>, today: string): string {
    const sources = Array.isArray(idea.initial_sources) ? idea.initial_sources.slice(0, 10).map(s => `- ${clip(s, 300)}`).join('\n') : '';
    return `Eres parte del equipo editorial de "Fast Check INNEXA", un proyecto de INNEXA HUB (Universidad de Las Américas, Chile)
que verifica afirmaciones, mitos y rumores sobre innovación, inteligencia artificial, tecnología y startups, con foco en Chile,
y publica en Instagram. El equipo son 3 estudiantes.

Tu tarea: puntuar UNA afirmación para priorizar qué se verifica primero. Los criterios siguen la práctica de verificadores
profesionales (Full Fact, Maldita.es, Chequeado, Fast Check CL) y la investigación sobre "check-worthiness" (ClaimBuster, CheckThat!).

Reglas:
- Evalúa solo con la información entregada. No inventes datos sobre cuánto circula ni hechos externos.
- Si falta información para un criterio, usa 2.
- Sé mesurado con las consecuencias: suelen sobreestimarse.
- Razones en español, neutrales, máximo 25 palabras cada una.
- Fecha de hoy: ${clip(today, 10)}.

Criterios (1 a 3):
- verificabilidad: 3 = hecho concreto y comprobable con datos públicos (cifra, estadística, comparación, hecho fechado);
  2 = factual pero general o difícil de delimitar; 1 = opinión, valoración, predicción sobre el futuro o algo no comprobable.
- relevancia: 3 = impacto directo en innovación, tecnología o emprendimiento en Chile, o la dice una persona o institución influyente;
  2 = tema global relevante para la audiencia chilena, o emisor de alcance medio; 1 = tema marginal o fuera del foco.
- consecuencias (si la gente la cree): 3 = puede llevar a decisiones con costo real (dinero, inversión, empleo, carrera,
  políticas públicas, seguridad); 2 = distorsiona la comprensión del tema y puede llevar a malas decisiones menores;
  1 = anecdótico, con poco efecto práctico.
- esfuerzo (para verificarla este equipo): bajo = menos de 2 horas, hay datos oficiales fáciles de encontrar;
  medio = cerca de 1 día, requiere varias fuentes o cálculos; alto = más de 3 días, requiere estudios especializados,
  expertos o datos no públicos.
- comercial: potencial de valor institucional o comercial para INNEXA HUB (vinculación con empresas, formación, alianzas,
  posicionamiento universitario). Es solo informativo: no cambia la prioridad. 3 = alto, 2 = medio, 1 = bajo.

Afirmación a evaluar:
- Afirmación: ${clip(idea.title)}
- Quién la dijo: ${clip(idea.claim_author, 200)}
- Fecha: ${clip(idea.claim_date, 20)}
- Enlace: ${clip(idea.claim_url, 300)}
- Categoría: ${clip(idea.category, 100)}
- Alcance: ${clip(idea.scope, 300)}
- Pregunta a verificar: ${clip(idea.question, 300)}
- Gancho / contexto: ${clip(idea.gancho, 800)}
- Fuentes iniciales:
${sources || '- (sin fuentes)'}`;
}

async function isAuthenticated(req: Request): Promise<boolean> {
    const auth = req.headers.get('Authorization') || '';
    const apikey = req.headers.get('apikey') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!auth.startsWith('Bearer ') || !apikey || !supabaseUrl) return false;
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
    return res.ok;
}

async function callGemini(apiKey: string, model: string, prompt: string) {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseSchema: RESPONSE_SCHEMA
            }
        })
    });
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
        const prompt = buildPrompt(idea, today);

        const configured = Deno.env.get('GEMINI_MODEL');
        const models = configured ? [configured, ...DEFAULT_MODELS.filter(m => m !== configured)] : DEFAULT_MODELS;
        let lastError = '';
        let lastStatus = 502;
        for (const model of models) {
            let res = await callGemini(apiKey, model, prompt);
            // Saturación momentánea: un reintento breve antes de cambiar de modelo.
            if (res.status === 503) {
                await sleep(1500);
                res = await callGemini(apiKey, model, prompt);
            }
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const message = data?.error?.message || `Gemini respondió ${res.status}`;
                if (RETRY_WITH_NEXT_MODEL.has(res.status)) {
                    lastError = res.status === 404 ? `Modelo ${model} no disponible`
                        : res.status === 429 ? `Cuota de Gemini agotada por ahora: ${message}`
                            : `Gemini saturado por ahora: ${message}`;
                    lastStatus = res.status === 429 ? 429 : 502;
                    continue;
                }
                return json({ error: message }, 502);
            }
            const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch {
                return json({ error: 'Gemini no devolvió un JSON válido' }, 502);
            }
            return json({ ...parsed, model });
        }
        return json({ error: lastError || 'Ningún modelo disponible' }, lastStatus);
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
});
