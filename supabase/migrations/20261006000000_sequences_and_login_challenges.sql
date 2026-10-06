-- PEKASA STORE - database-issued numbers + sign-in code tracking
--
-- 1. next_sequence(): receipt / loan / customer ... numbers come from the database, atomically, so two
--    computers (or two cashiers at once) can never be given the same number. Today each browser
--    counts on its own, which would create duplicates the moment data is shared.
--    Staff can no longer write to sequence_counters directly (only through this function), so a
--    counter can't be rewound to force a duplicate. Only admins can edit counters by hand.
--
-- 2. auth_otp_challenges + otp_* functions: the server-side record behind the SMS sign-in code.
--    It makes a code single-use, limits wrong guesses (5), and limits how many SMS one account can
--    trigger. Nobody can read or write this table from the app: only the server (service_role) can.

-- ---------------------------------------------------------------------------------------------
-- 1. Sequence numbers
-- ---------------------------------------------------------------------------------------------
drop policy if exists "add"        on public.sequence_counters;
drop policy if exists "edit"       on public.sequence_counters;
drop policy if exists "admin add"  on public.sequence_counters;
drop policy if exists "admin edit" on public.sequence_counters;
create policy "admin add"  on public.sequence_counters for insert to authenticated with check (public.is_admin());
create policy "admin edit" on public.sequence_counters for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.next_sequence(p_prefix text, p_year integer default 2026)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v integer;
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_prefix is null or p_prefix not in ('LN','COL','CUS','RCT','TXN','RNW','SAL','EXP','APP','INV','VOD','SES') then
    raise exception 'unknown sequence prefix: %', p_prefix using errcode = '22023';
  end if;

  -- one atomic statement: concurrent callers queue on the row lock and each gets its own number
  insert into public.sequence_counters (prefix, current_year, last_sequence)
  values (p_prefix, p_year, 1)
  on conflict (prefix) do update
    set last_sequence = public.sequence_counters.last_sequence + 1,
        current_year  = excluded.current_year
  returning last_sequence into v;

  return v;
end $$;

revoke all on function public.next_sequence(text, integer) from public, anon;
grant execute on function public.next_sequence(text, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Sign-in code tracking (server only)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.auth_otp_challenges (
  nonce       text primary key,
  user_id     text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists auth_otp_challenges_user_idx on public.auth_otp_challenges (user_id, created_at desc);

alter table public.auth_otp_challenges enable row level security;
revoke all on public.auth_otp_challenges from anon, authenticated;
-- (no policies on purpose: with row level security on and no policy, only service_role can use it)

-- Register a new code for a user. Returns 'ok', 'cooldown' (asked again within 30 s) or
-- 'rate_limited' (5 codes already issued in the last 10 minutes).
create or replace function public.otp_start(p_nonce text, p_user_id text, p_ttl_seconds integer default 600)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.auth_otp_challenges where created_at < now() - interval '1 day';

  if exists (select 1 from public.auth_otp_challenges
             where user_id = p_user_id and created_at > now() - interval '30 seconds') then
    return 'cooldown';
  end if;
  if (select count(*) from public.auth_otp_challenges
      where user_id = p_user_id and created_at > now() - interval '10 minutes') >= 5 then
    return 'rate_limited';
  end if;

  insert into public.auth_otp_challenges (nonce, user_id, expires_at)
  values (p_nonce, p_user_id, now() + make_interval(secs => p_ttl_seconds));
  return 'ok';
end $$;

-- Count one guess against a code. Returns 'ok' if the guess may be checked, otherwise
-- 'unknown' | 'used' | 'expired' | 'locked' (already guessed p_max times).
create or replace function public.otp_attempt(p_nonce text, p_user_id text, p_max integer default 5)
returns text
language plpgsql security definer set search_path = ''
as $$
declare c public.auth_otp_challenges%rowtype;
begin
  update public.auth_otp_challenges
     set attempts = attempts + 1
   where nonce = p_nonce and user_id = p_user_id
     and consumed_at is null and expires_at > now() and attempts < p_max
  returning * into c;
  if found then return 'ok'; end if;

  select * into c from public.auth_otp_challenges where nonce = p_nonce and user_id = p_user_id;
  if not found then return 'unknown'; end if;
  if c.consumed_at is not null then return 'used'; end if;
  if c.expires_at <= now() then return 'expired'; end if;
  return 'locked';
end $$;

-- Mark a code as used after the right code was entered. True only for the first caller, so a code
-- (or two simultaneous requests with the same code) can only ever sign in once.
create or replace function public.otp_consume(p_nonce text, p_user_id text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  update public.auth_otp_challenges set consumed_at = now()
   where nonce = p_nonce and user_id = p_user_id and consumed_at is null and expires_at > now();
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke all on function public.otp_start(text, text, integer), public.otp_attempt(text, text, integer),
                       public.otp_consume(text, text) from public, anon, authenticated;
grant execute on function public.otp_start(text, text, integer), public.otp_attempt(text, text, integer),
                          public.otp_consume(text, text) to service_role;
