-- MANU OS — reintentos controlados de los avisos (WEB-99b). Idempotente.
-- Un fallo temporal del servicio push (429, 5xx, red) vuelve a la cola solo para ese dispositivo,
-- como mucho 3 intentos. La app nunca borra estas filas al reemplazar su cola (attempts > 0).
alter table public.manu_push_queue add column if not exists attempts int not null default 0 check (attempts between 0 and 5);
alter table public.manu_push_queue add column if not exists sub_id uuid references public.manu_push_subs(id) on delete cascade;
alter table public.manu_push_queue add column if not exists first_at timestamptz;
