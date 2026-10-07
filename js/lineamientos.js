// Reglas del flujo de trabajo, basadas en "LINEAMIENTOS FAST CHECK INNEXA" v3.0.
// Este es el archivo a editar cuando el equipo cambie integrantes, checklist,
// tipos de fuente o motivos de descarte.
window.LINEAMIENTOS = {
    // Integrantes: aparecen en Responsable y Revisado por.
    TEAM_MEMBERS: ['Cristian', 'Mario Estay', 'Matías'],

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
