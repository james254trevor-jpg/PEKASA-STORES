-- PEKASA Stores customers table. Run once in the Supabase SQL Editor (safe to re-run).
-- Each row belongs to one store account (auth.users); row-level security keeps accounts apart.
-- Columns mirror the local SQLite `customers` table in src/db/sqlite.ts.
create table if not exists public.customers (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  id text not null,
  customer_number text not null,
  name text not null,
  id_number text not null,
  phone text not null,
  alt_phone text,
  email text,
  address text,
  county text,
  photo_url text,
  id_photo_url text,
  status text not null default 'Good Standing'
    check (status in ('Good Standing', 'Watchlist', 'High Risk', 'Blacklisted')),
  notes text,
  previous_loans_count integer not null default 0,
  total_borrowed numeric(14, 2) not null default 0,
  total_repaid numeric(14, 2) not null default 0,
  current_balance numeric(14, 2) not null default 0,
  defaults_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, customer_number)
);

-- National ID must be unique per store, except the 'N/A' placeholder used by quick intake.
create unique index if not exists customers_user_id_number_key
  on public.customers (user_id, id_number)
  where id_number <> 'N/A';

create index if not exists customers_user_phone_idx on public.customers (user_id, phone);

alter table public.customers enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.customers to authenticated;

drop policy if exists "Users can read their own customers" on public.customers;
create policy "Users can read their own customers"
  on public.customers for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own customers" on public.customers;
create policy "Users can create their own customers"
  on public.customers for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own customers" on public.customers;
create policy "Users can update their own customers"
  on public.customers for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own customers" on public.customers;
create policy "Users can delete their own customers"
  on public.customers for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.touch_customer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.touch_customer();
