-- WEB-93b. Server-only state for an owner-authorised, read-only Enable Banking session.
-- Do NOT expose this table to anon or authenticated: it holds a session identifier.
create table if not exists public.manu_bank_ais (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_hash text unique,
  state_until timestamptz,
  session_id uuid,
  accounts jsonb not null default '[]'::jsonb,
  consent_until timestamptz,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint manu_bank_ais_state_hash check (state_hash is null or state_hash ~ '^[0-9a-f]{64}$'),
  constraint manu_bank_ais_accounts_size check (octet_length(accounts::text) < 8000)
);
alter table public.manu_bank_ais enable row level security;
revoke all on public.manu_bank_ais from public, anon, authenticated;
-- The Edge Function accesses this table with the Supabase service role.
-- No SELECT/INSERT/UPDATE/DELETE policies for browser roles: all denied.
