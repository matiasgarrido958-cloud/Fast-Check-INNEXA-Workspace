// Reglas del flujo de trabajo, basadas en "LINEAMIENTOS FAST CHECK INNEXA" v3.0.
// Este es el archivo a editar cuando el equipo cambie el checklist, los tipos
// de fuente o los motivos de descarte. Los nombres (Responsable, Revisado por)
// se escriben libremente en cada idea.
window.LINEAMIENTOS = {
    // Mínimos de la sección "Criterios obligatorios".
    MIN_INITIAL_SOURCES: 2,
    MIN_VERIFICATION_SOURCES: 2,

    // "Análisis y evaluación de fuentes" → tipo de fuente y confiabilidad.
    SOURCE_TYPES: [
        { id: 'peer', label: 'Estudio peer-reviewed ★★★★★' },
        { id: 'thinktank', label: 'Reporte de think tank ★★★★' },
        { id: 'oficial', label: 'Comunicado / documento oficial ★★★★' },
        { id: 'medio', label: 'Medio reconocido ★★★' },
        { id: 'experto', label: 'Experto / post en redes ★★' },
        { id: 'rumor', label: 'Mensaje privado / rumor ★' }
    ],

    // Qué hace cada fuente respecto de la afirmación.
    SOURCE_STANCES: [
        { id: 'respalda', label: 'Respalda' },
        { id: 'contradice', label: 'Contradice' },
        { id: 'contexto', label: 'Aporta contexto' }
    ],

    // "Áreas que no cubrimos" y "Límites claros".
    DISCARD_REASONS: [
        'Fuera de las áreas de cobertura',
        'No es verificable (opinión o especulación)',
        'Sin evidencia suficiente en el plazo',
        'Duplicada',
        'Otro'
    ],

    // Matriz de priorización automática (etapa En Discusión).
    // Cada criterio vale 1 a 3. "source" indica quién lo calcula:
    //   auto = la página, con los datos de la idea · ia = Gemini (con respaldo automático si no hay IA).
    // El puntaje se normaliza a 0–100, se ajusta por esfuerzo y equilibrio, y los cortes dan Alta/Media/Baja.
    MATRIX: {
        CRITERIA: [
            { id: 'consecuencias', label: 'Consecuencias si se cree', weight: 3, source: 'ia',
                hint: 'Decisiones de emprendedores, inversión, empleo o políticas públicas que podría afectar.' },
            { id: 'circulacion', label: 'Circulación', weight: 2, source: 'auto',
                hint: 'Plataformas distintas entre la afirmación y sus fuentes iniciales.' },
            { id: 'relevancia', label: 'Relevancia (tema y emisor)', weight: 2, source: 'ia',
                hint: 'Importancia para la innovación y tecnología en Chile; peso de quien lo dice.' },
            { id: 'verificabilidad', label: 'Verificabilidad', weight: 1, source: 'ia',
                hint: 'Hecho concreto y comprobable (cifra, dato) vs. opinión o predicción.' },
            { id: 'actualidad', label: 'Actualidad', weight: 1, source: 'auto',
                hint: 'Días desde la fecha de la afirmación.' },
            { id: 'demanda', label: 'Demanda', weight: 1, source: 'auto',
                hint: 'Veces que se propuso la misma afirmación en el workspace.' }
        ],
        // El esfuerzo (lo estima la IA) multiplica el puntaje.
        EFFORT: [
            { id: 'bajo', label: 'Bajo (menos de 2 horas)', factor: 1 },
            { id: 'medio', label: 'Medio (cerca de 1 día)', factor: 0.85 },
            { id: 'alto', label: 'Alto (más de 3 días)', factor: 0.7 }
        ],
        // Cortes sobre 100.
        THRESHOLDS: { high: 60, medium: 35 },
        // Actualidad: días máximos para 3 y 2 puntos.
        RECENCY_DAYS: { three: 7, two: 30 },
        // Equilibrio: si el mismo autor/medio ya tiene esta cantidad de ideas activas
        // en los últimos días indicados, el puntaje se multiplica por FACTOR.
        BALANCE: { maxSameAuthor: 2, days: 30, factor: 0.9 },
        // Respaldo sin IA para relevancia: palabras clave prioritarias.
        KEYWORDS: ['chile', 'chileno', 'chilena', 'corfo', 'anid', 'ia', 'inteligencia artificial', 'startup', 'startups',
            'innovación', 'empleo', 'empleos', 'trabajo', 'ley', 'regulación', 'inversión', 'emprendimiento', 'universidad',
            'tecnología', 'automatización', 'datos', 'pyme', 'pymes', 'exportación', 'i+d']
    },

    // Nombre de la función de Supabase que llama a Gemini (supabase/functions/).
    AI_FUNCTION: 'evaluar-prioridad',

    // "Checklist antes de publicar", dividido por etapa.
    // En Proceso: debe estar completo para pasar a Pendiente de Publicación.
    CHECKLIST_RESEARCH: [
        { id: 'fuentes', label: 'Tengo 2+ fuentes confiables independientes (o excepción documentada)' },
        { id: 'origen', label: 'Registré autor original, enlace, fecha y contexto de la afirmación' },
        { id: 'calidad', label: 'Evalué la calidad de las fuentes (¿origen común? ¿conflictos de interés?)' },
        { id: 'contraria', label: 'Busqué también evidencia contraria, no solo confirmaciones' },
        { id: 'datos', label: 'Cada número o cita se comprobó en su fuente original (no en IA)' },
        { id: 'neutral', label: 'El veredicto es neutral y usa la escala oficial' },
        { id: 'citadas', label: 'Las fuentes están completamente citadas (nombres + enlaces)' }
    ],
    // Pendiente de Publicación: debe estar completo para pasar a Publicadas.
    CHECKLIST_PUBLISH: [
        { id: 'clara', label: 'La explicación es clara y concisa' },
        { id: 'tono', label: 'El tono es educativo, no sensacionalista' },
        { id: 'hook', label: 'El hook es llamativo pero preciso' },
        { id: 'cobertura', label: 'Se ajusta a las áreas de cobertura' }
    ]
};
