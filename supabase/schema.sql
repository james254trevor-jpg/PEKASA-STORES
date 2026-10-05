-- PEKASA Stores cloud sync. Run this once in Supabase SQL Editor.
create table if not exists public.pekasa_store_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot_base64 text not null,
  device_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.pekasa_store_snapshots enable row level security;
grant select, insert, update on public.pekasa_store_snapshots to authenticated;

drop policy if exists "Users can read their own PEKASA store" on public.pekasa_store_snapshots;
create policy "Users can read their own PEKASA store"
  on public.pekasa_store_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own PEKASA store" on public.pekasa_store_snapshots;
create policy "Users can create their own PEKASA store"
  on public.pekasa_store_snapshots for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own PEKASA store" on public.pekasa_store_snapshots;
create policy "Users can update their own PEKASA store"
  on public.pekasa_store_snapshots for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.touch_pekasa_store_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pekasa_store_snapshots_updated_at on public.pekasa_store_snapshots;
create trigger pekasa_store_snapshots_updated_at
  before update on public.pekasa_store_snapshots
  for each row execute function public.touch_pekasa_store_snapshot();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pekasa_store_snapshots'
  ) then
    alter publication supabase_realtime add table public.pekasa_store_snapshots;
  end if;
end;
$$;
