-- MANU OS — avisos con la app cerrada (WEB-99). Idempotente.
-- Privacidad: sin texto por defecto (body null → «Tienes un recordatorio en MANU»). Cada fila se
-- borra al enviarse. Solo la sesión de Manu (RLS por auth.uid()) ve y cambia sus suscripciones
-- y su cola. Las claves VAPID y el token del cron no tienen ningún permiso para anon ni
-- authenticated: solo el servidor (service_role) las lee.

create table if not exists public.manu_push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/' and length(endpoint) < 1000),
  p256dh text not null check (length(p256dh) between 80 and 100),
  auth text not null check (length(auth) between 16 and 30),
  device text check (device is null or length(device) <= 40),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.manu_push_queue (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  at timestamptz not null,
  body text check (body is null or length(body) <= 120),
  primary key (user_id, id)
);
create index if not exists manu_push_queue_at on public.manu_push_queue (at);

create table if not exists public.manu_push_keys (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.manu_push_cron (
  id int primary key default 1 check (id = 1),
  token text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
insert into public.manu_push_cron (id) values (1) on conflict (id) do nothing;

alter table public.manu_push_subs enable row level security;
alter table public.manu_push_queue enable row level security;
alter table public.manu_push_keys enable row level security;
alter table public.manu_push_cron enable row level security;
revoke all on public.manu_push_subs, public.manu_push_queue, public.manu_push_keys, public.manu_push_cron from anon, authenticated;
grant select, insert, update, delete on public.manu_push_subs, public.manu_push_queue to authenticated;

drop policy if exists "solo mis suscripciones" on public.manu_push_subs;
create policy "solo mis suscripciones" on public.manu_push_subs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "solo mi cola" on public.manu_push_queue;
create policy "solo mi cola" on public.manu_push_queue for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Límite de filas por usuario: una cola desbocada no puede gastar la cuota.
create or replace function public.manu_push_limits() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'manu_push_queue' and (select count(*) from public.manu_push_queue where user_id = new.user_id) >= 100 then
    raise exception 'Demasiados avisos pendientes';
  end if;
  if tg_table_name = 'manu_push_subs' and (select count(*) from public.manu_push_subs where user_id = new.user_id) >= 5 then
    raise exception 'Demasiados dispositivos con avisos';
  end if;
  return new;
end $$;
drop trigger if exists manu_push_queue_limit on public.manu_push_queue;
create trigger manu_push_queue_limit before insert on public.manu_push_queue for each row execute function public.manu_push_limits();
drop trigger if exists manu_push_subs_limit on public.manu_push_subs;
create trigger manu_push_subs_limit before insert on public.manu_push_subs for each row execute function public.manu_push_limits();

-- La app solo necesita la clave PÚBLICA para suscribirse.
create or replace function public.manu_push_public_key() returns text language sql stable security definer set search_path = public as $$
  select public_key from public.manu_push_keys where id = 1
$$;
revoke all on function public.manu_push_public_key() from public, anon;
grant execute on function public.manu_push_public_key() to authenticated;

-- Cada minuto, la función manda lo que toca. Solo si hay algo en la cola (no gasta invocaciones en vano).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'manu-push';
select cron.schedule('manu-push', '* * * * *', $cron$
  select net.http_post(
    url := 'https://xqsexjpuhvmwkclpnvjo.supabase.co/functions/v1/manu-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-manu-cron', (select token from public.manu_push_cron where id = 1)),
    body := '{}'::jsonb)
  where exists (select 1 from public.manu_push_queue where at <= now())
     or not exists (select 1 from public.manu_push_keys where id = 1);
$cron$);
