-- Migración: flujo por etapas según los Lineamientos Fast Check INNEXA v3.0.
-- Ejecutar UNA vez en Supabase → SQL Editor. No borra datos y se puede repetir.

alter table public.fast_check_ideas
    -- Etapa 1 · Ideas Iniciales: delimitar la afirmación
    add column if not exists claim_author      text  default '',   -- quién lo dijo / medio
    add column if not exists claim_url         text  default '',   -- enlace a la afirmación
    add column if not exists claim_date        text  default '',   -- fecha de la afirmación
    add column if not exists scope             text  default '',   -- alcance: país, sector, población
    add column if not exists question          text  default '',   -- qué queremos verificar exactamente
    add column if not exists initial_sources   jsonb default '[]'::jsonb,
    -- Etapa 2 · En Discusión: evaluación inicial
    add column if not exists in_coverage       boolean default false,
    add column if not exists is_verifiable     boolean default false,
    add column if not exists owner             text  default '',   -- responsable
    -- Descartadas
    add column if not exists discard_reason    text  default '',
    add column if not exists discarded_from    text  default '',   -- etapa desde la que se descartó
    -- Etapa 3 · En Proceso: investigación (usa también sources, verdict, analysis, checklist)
    add column if not exists single_source_exception text default '',
    add column if not exists missing_context   text  default '',
    -- Etapa 4 · Pendiente de Publicación
    add column if not exists hook              text  default '',
    add column if not exists key_points        text  default '',
    add column if not exists design_url        text  default '',
    add column if not exists reviewed_by       text  default '',
    add column if not exists approved_by_team  boolean default false,
    -- Etapa 5 · Publicadas
    add column if not exists published_url     text  default '',
    add column if not exists published_at      text  default '',
    add column if not exists saves             integer,
    add column if not exists shares            integer,
    add column if not exists corrections       jsonb default '[]'::jsonb;

-- Nuevo estado "discarded" (Descartadas).
alter table public.fast_check_ideas drop constraint if exists fast_check_ideas_status_check;
alter table public.fast_check_ideas add constraint fast_check_ideas_status_check
    check (status in ('initial', 'discussion', 'working', 'pending', 'published', 'discarded'));

-- La fuente inicial única antigua pasa a la lista de fuentes iniciales.
update public.fast_check_ideas
   set initial_sources = jsonb_build_array(jsonb_build_object('ref', source))
 where coalesce(source, '') <> ''
   and (initial_sources is null or initial_sources = '[]'::jsonb);

-- "Exagerada" no está en la escala oficial de veredictos: pasa a "Engañoso".
update public.fast_check_ideas set verdict = 'engañoso' where verdict = 'exagerada';

notify pgrst, 'reload schema';
