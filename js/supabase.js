// Cliente mínimo para la API REST de Supabase (PostgREST), sin dependencias.
async function supabaseCall(method, endpoint, body = null) {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        // Sin esto, POST/PATCH responden 201/204 sin cuerpo.
        'Prefer': 'return=representation'
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        let detail = text;
        try {
            const json = JSON.parse(text);
            detail = [json.message, json.hint].filter(Boolean).join(' — ') || text;
        } catch (e) { /* respuesta no JSON */ }
        const error = new Error(`HTTP ${response.status}: ${detail}`);
        console.error('Supabase error:', error);
        throw error;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}
