-- Tabla usada por Fast Check INNEXA — Workspace.
-- Ejecutar en Supabase: Dashboard → SQL Editor → New query → Run.
-- Es idempotente: si la tabla ya existe, no la modifica.

create table if not exists public.fast_check_ideas (
    id              text primary key,
    title           text        default '',
    category        text        default '',
    priority        text        default 'medium' check (priority in ('low', 'medium', 'high')),
    gancho          text        default '',
    source          text        default '',
    status          text        default 'initial' check (status in ('initial', 'discussion', 'working', 'pending', 'published', 'discarded')),
    verdict         text        default '',
    analysis        text        default '',
    sources         jsonb       default '[]'::jsonb,
    "errorLevel"    text        default '',
    "errorNotes"    text        default '',
    checklist       jsonb       default '{}'::jsonb,
    last_edited_by  text        default 'Usuario',
    last_edited_at  timestamptz default now()
);

-- Si la tabla ya existía con menos columnas, agrega las que falten.
alter table public.fast_check_ideas
    add column if not exists title          text        default '',
    add column if not exists category       text        default '',
    add column if not exists priority       text        default 'medium',
    add column if not exists gancho         text        default '',
    add column if not exists source         text        default '',
    add column if not exists status         text        default 'initial',
    add column if not exists verdict        text        default '',
    add column if not exists analysis       text        default '',
    add column if not exists sources        jsonb       default '[]'::jsonb,
    add column if not exists "errorLevel"   text        default '',
    add column if not exists "errorNotes"   text        default '',
    add column if not exists checklist      jsonb       default '{}'::jsonb,
    add column if not exists last_edited_by text        default 'Usuario',
    add column if not exists last_edited_at timestamptz default now();

-- Columnas del flujo por etapas: ver supabase/migracion-flujo-etapas.sql
-- (ejecutar también ese archivo en una instalación nueva).

-- Row Level Security: solo usuarios con sesión iniciada (Supabase Auth)
-- pueden leer y escribir. Sin sesión, la API no devuelve nada.
alter table public.fast_check_ideas enable row level security;

drop policy if exists "fast_check_ideas_select" on public.fast_check_ideas;
drop policy if exists "fast_check_ideas_insert" on public.fast_check_ideas;
drop policy if exists "fast_check_ideas_update" on public.fast_check_ideas;
drop policy if exists "fast_check_ideas_delete" on public.fast_check_ideas;

create policy "fast_check_ideas_select" on public.fast_check_ideas for select to authenticated using (true);
create policy "fast_check_ideas_insert" on public.fast_check_ideas for insert to authenticated with check (true);
create policy "fast_check_ideas_update" on public.fast_check_ideas for update to authenticated using (true) with check (true);
create policy "fast_check_ideas_delete" on public.fast_check_ideas for delete to authenticated using (true);

-- Avisa a la API de Supabase que recargue la estructura de las tablas.
notify pgrst, 'reload schema';

-- Muestra las columnas finales de la tabla (para verificar).
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'fast_check_ideas'
order by ordinal_position;
