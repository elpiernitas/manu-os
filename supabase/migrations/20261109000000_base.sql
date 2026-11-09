-- MANU OS — esquema base de Tu nube (WEB-64/67) y del buzón del atajo (WEB-86).
-- Manu ya lo creó a mano en el SQL Editor; aquí queda declarado e idempotente para que las
-- funcionalidades nuevas se apliquen con «supabase db push» o la API, sin pegar SQL.
-- Mismo texto que web/core/sync.js (SUPABASE_SQL e INBOX_SQL); el test supabase-migrations lo comprueba.

create table if not exists public.manu_sync (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('vault')),
  data jsonb not null check (octet_length(data::text) < 8000000),
  rev bigint not null default 1,
  device text,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.manu_sync enable row level security;
revoke all on public.manu_sync from anon;
grant select, insert, update on public.manu_sync to authenticated;
drop policy if exists "solo lo mio" on public.manu_sync;
create policy "solo lo mio" on public.manu_sync for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- MANU: buzón del atajo «MANU Dinero» (WEB-86)
create table if not exists public.manu_inbox (
  id uuid primary key default gen_random_uuid(),
  token text not null check (length(token) between 20 and 80),
  line text not null check (length(line) <= 300),
  created_at timestamptz not null default now()
);
create table if not exists public.manu_inbox_owner (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  token text not null unique check (length(token) between 20 and 80)
);
alter table public.manu_inbox enable row level security;
alter table public.manu_inbox_owner enable row level security;
revoke all on public.manu_inbox from anon, authenticated;
revoke all on public.manu_inbox_owner from anon, authenticated;
grant insert (token, line) on public.manu_inbox to anon;
grant select, delete on public.manu_inbox to authenticated;
grant select, insert, update on public.manu_inbox_owner to authenticated;
drop policy if exists "atajo deja" on public.manu_inbox;
create policy "atajo deja" on public.manu_inbox for insert to anon with check (true);
drop policy if exists "dueño lee" on public.manu_inbox;
create policy "dueño lee" on public.manu_inbox for select to authenticated using (token in (select token from public.manu_inbox_owner where user_id = auth.uid()));
drop policy if exists "dueño borra" on public.manu_inbox;
create policy "dueño borra" on public.manu_inbox for delete to authenticated using (token in (select token from public.manu_inbox_owner where user_id = auth.uid()));
drop policy if exists "dueño de su código" on public.manu_inbox_owner;
create policy "dueño de su código" on public.manu_inbox_owner for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
