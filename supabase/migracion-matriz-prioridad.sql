-- Migración: matriz de priorización automática (etapa En Discusión).
-- Ejecutar UNA vez en Supabase → SQL Editor → New query. No borra datos y se puede repetir.

alter table public.fast_check_ideas
    add column if not exists circulates               boolean default false, -- filtro: circula o tiene riesgo claro
    add column if not exists ai_eval                  jsonb,                  -- evaluación de Gemini (puntajes y motivos)
    add column if not exists priority_score           integer,                -- puntaje de la matriz (0-100)
    add column if not exists priority_override        text default '',        -- prioridad cambiada por el equipo
    add column if not exists priority_override_reason text default '';        -- motivo del cambio

notify pgrst, 'reload schema';
