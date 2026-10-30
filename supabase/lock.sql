-- PEKASA STORE server-side lock (kill switch).
-- While locked = true, every read/write on the store data is refused by RLS,
-- no matter which app, website or API key is used.
--
-- LOCK:    update public.pekasa_lock set locked = true  where id;
-- UNLOCK:  update public.pekasa_lock set locked = false where id;
-- Run these in the Supabase SQL Editor (or with the service role).
-- Normal app users cannot change the switch.

create table if not exists public.pekasa_lock (
  id boolean primary key default true check (id),   -- single-row table
  locked boolean not null default true,
  message text not null default 'PEKASA STORE is locked by Trevor James. Contact him for access.',
  updated_at timestamptz not null default now()
);

insert into public.pekasa_lock (id, locked) values (true, true)
on conflict (id) do nothing;

alter table public.pekasa_lock enable row level security;

-- Anyone may read the lock state (so apps can show the message); nobody but
-- the service role / SQL editor can change it (no insert/update/delete policies).
drop policy if exists "Anyone can read lock state" on public.pekasa_lock;
create policy "Anyone can read lock state"
  on public.pekasa_lock for select to anon, authenticated
  using (true);

revoke all on public.pekasa_lock from anon, authenticated;
grant select on public.pekasa_lock to anon, authenticated;

-- Fails closed: if the row is ever missing, the store stays locked.
create or replace function public.pekasa_is_locked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select locked from public.pekasa_lock where id), true);
$$;

revoke all on function public.pekasa_is_locked() from public;
grant execute on function public.pekasa_is_locked() to anon, authenticated;

-- RESTRICTIVE policies are AND-ed with the existing per-user policies,
-- so they block everything while locked and change nothing once unlocked.
drop policy if exists "Store lock blocks all access" on public.pekasa_store_snapshots;
create policy "Store lock blocks all access"
  on public.pekasa_store_snapshots
  as restrictive
  for all to anon, authenticated
  using (not public.pekasa_is_locked())
  with check (not public.pekasa_is_locked());
