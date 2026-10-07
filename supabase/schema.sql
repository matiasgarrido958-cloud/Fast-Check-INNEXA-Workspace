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
    status          text        default 'initial' check (status in ('initial', 'discussion', 'working', 'pending', 'published')),
    verdict         text        default '',
    analysis        text        default '',
    sources         jsonb       default '[]'::jsonb,
    "errorLevel"    text        default '',
    "errorNotes"    text        default '',
    checklist       jsonb       default '{}'::jsonb,
    last_edited_by  text        default 'Usuario',
    last_edited_at  timestamptz default now()
);

-- Row Level Security.
-- La app no tiene login: cualquiera con la publishable key puede leer y escribir.
-- Si más adelante agregas Supabase Auth, cambia "to anon" por "to authenticated".
alter table public.fast_check_ideas enable row level security;

drop policy if exists "fast_check_ideas_select" on public.fast_check_ideas;
drop policy if exists "fast_check_ideas_insert" on public.fast_check_ideas;
drop policy if exists "fast_check_ideas_update" on public.fast_check_ideas;
drop policy if exists "fast_check_ideas_delete" on public.fast_check_ideas;

create policy "fast_check_ideas_select" on public.fast_check_ideas for select to anon using (true);
create policy "fast_check_ideas_insert" on public.fast_check_ideas for insert to anon with check (true);
create policy "fast_check_ideas_update" on public.fast_check_ideas for update to anon using (true) with check (true);
create policy "fast_check_ideas_delete" on public.fast_check_ideas for delete to anon using (true);
