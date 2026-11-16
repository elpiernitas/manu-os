-- El cerebro compartido de Manu (WEB-118): lo que Claude, Claude Code, Codex, ChatGPT y el propio
-- Manu guardan de sus conversaciones, ordenado por ramas. MANU lo lee para proyectos y contexto.
-- Nadie escribe directamente en estas tablas desde el navegador: todo pasa por la función
-- `manu-cerebro`, que valida, limpia y firma el origen. Manu solo puede leer y revisar lo suyo.

create table if not exists public.cerebro (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  rama text not null check (rama ~ '^[a-z0-9-]{2,40}$'),
  subrama text check (subrama is null or subrama ~ '^[a-z0-9-]{2,40}$'),
  categoria text check (categoria is null or char_length(categoria) <= 60),
  titulo text not null check (char_length(titulo) between 1 and 160),
  resumen text not null check (char_length(resumen) between 1 and 4000),
  etiquetas text[] not null default '{}' check (cardinality(etiquetas) <= 12),
  proyecto text check (proyecto is null or char_length(proyecto) <= 80),
  origen text not null check (origen in ('claude', 'claude-code', 'codex', 'chatgpt', 'manu')),
  conversacion text check (conversacion is null or char_length(conversacion) <= 200),
  estado text not null default 'sin_revisar' check (estado in ('sin_revisar', 'revisado', 'archivado')),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists cerebro_owner_rama on public.cerebro (owner, rama, subrama, creado desc);
create index if not exists cerebro_busqueda on public.cerebro using gin (to_tsvector('spanish', titulo || ' ' || resumen));

-- Llaves de escritura de cada IA. Solo se guarda la huella SHA-256; la llave en claro se enseña una
-- vez a Manu, en su iPhone, al crearla.
create table if not exists public.cerebro_llaves (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  origen text not null check (origen in ('claude', 'claude-code', 'codex', 'chatgpt')),
  huella text not null unique check (huella ~ '^[0-9a-f]{64}$'),
  creada timestamptz not null default now(),
  usada timestamptz,
  revocada timestamptz
);

alter table public.cerebro enable row level security;
alter table public.cerebro_llaves enable row level security;

-- Manu lee lo suyo. Las escrituras van por la función (clave de servicio), nunca por el navegador.
drop policy if exists cerebro_lee_owner on public.cerebro;
create policy cerebro_lee_owner on public.cerebro for select to authenticated using (owner = auth.uid());
drop policy if exists llaves_lee_owner on public.cerebro_llaves;
create policy llaves_lee_owner on public.cerebro_llaves for select to authenticated using (owner = auth.uid());
revoke insert, update, delete on public.cerebro from anon, authenticated;
revoke insert, update, delete on public.cerebro_llaves from anon, authenticated;
