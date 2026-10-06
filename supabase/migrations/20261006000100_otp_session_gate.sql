-- PEKASA STORE - make the SMS sign-in code impossible to bypass
--
-- The Supabase "anon" key is public, so anyone who knows a cashier's password could ask Supabase Auth
-- for a session directly and never see the SMS step. This migration closes that gap in the DATABASE:
--
--   * Cashiers (role-cashier) get NO access, to anything, until their session is marked "code verified".
--   * Only the server can mark a session verified (after the right SMS code was entered).
--   * The mark reaches the database as a claim (otp_ok) added to the login token by a Supabase
--     "Custom Access Token" hook. Because the mark belongs to one specific login session, a stolen
--     password gives a session that stays locked out.
--   * Admins and managers are not affected (as today).
--
-- SETUP STEP (Supabase dashboard, once): Authentication -> Hooks -> "Customize Access Token (JWT)
-- Claims" -> choose Postgres function -> public.custom_access_token_hook -> Save.
-- Until that hook is switched on, cashiers stay locked out (safe failure; admins/managers still work).

-- ---------------------------------------------------------------------------------------------
-- 1. Which sessions have passed the SMS code
-- ---------------------------------------------------------------------------------------------
create table if not exists public.otp_verified_sessions (
  session_id  uuid primary key,
  user_id     uuid not null,
  verified_at timestamptz not null default now()
);
alter table public.otp_verified_sessions enable row level security;
revoke all on public.otp_verified_sessions from anon, authenticated;

-- Called by the server only, right after a correct code.
create or replace function public.otp_mark_session(p_session uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.otp_verified_sessions where verified_at < now() - interval '2 days';
  insert into public.otp_verified_sessions (session_id, user_id) values (p_session, p_user)
  on conflict (session_id) do update set verified_at = now(), user_id = excluded.user_id;
end $$;

revoke all on function public.otp_mark_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.otp_mark_session(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. The hook that puts the mark into the login token (a verification stays valid for 12 hours,
--    about one shift; after that the cashier is asked for a new code)
-- ---------------------------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  sid uuid;
begin
  begin
    sid := (claims ->> 'session_id')::uuid;
  exception when others then
    sid := null;
  end;

  if sid is not null and exists (
       select 1 from public.otp_verified_sessions s
       where s.session_id = sid and s.verified_at > now() - interval '12 hours') then
    claims := jsonb_set(claims, '{otp_ok}', 'true'::jsonb);
  else
    claims := claims - 'otp_ok';
  end if;

  return jsonb_set(event, '{claims}', claims);
end $$;

grant usage on schema public to supabase_auth_admin;
revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------------------------
-- 3. The gate. Every access rule starts from these helper functions, so gating them gates everything.
-- ---------------------------------------------------------------------------------------------
create or replace function public.role_needs_otp(p_role text) returns boolean
language sql immutable
as $$ select p_role = 'role-cashier' $$;

create or replace function public.otp_ok() returns boolean
language sql stable
as $$ select coalesce((auth.jwt() ->> 'otp_ok')::boolean, false) $$;

create or replace function public.app_user_id() returns text
language sql stable security definer set search_path = ''
as $$
  select u.id from public.users u
  where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
    and (not public.role_needs_otp(u.role_id) or public.otp_ok())
$$;

create or replace function public.app_user_branch() returns text
language sql stable security definer set search_path = ''
as $$
  select u.branch_id from public.users u
  where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
    and (not public.role_needs_otp(u.role_id) or public.otp_ok())
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.users u
                 where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
                   and (not public.role_needs_otp(u.role_id) or public.otp_ok()))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.users u
                 where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
                   and u.role_id = 'role-admin'
                   and (not public.role_needs_otp(u.role_id) or public.otp_ok()))
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.users u
                 where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
                   and u.role_id = 'role-manager'
                   and (not public.role_needs_otp(u.role_id) or public.otp_ok()))
$$;

create or replace function public.can_any(perms text[]) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or exists (
        select 1
        from public.users u
        join public.user_roles r on r.id = u.role_id
        cross join unnest(perms) as p
        where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
          and (not public.role_needs_otp(u.role_id) or public.otp_ok())
          and coalesce((r.permissions_json::jsonb ->> p)::boolean, false)
      )
$$;

revoke all on function public.role_needs_otp(text), public.otp_ok() from public, anon;
grant execute on function public.role_needs_otp(text), public.otp_ok() to authenticated;
