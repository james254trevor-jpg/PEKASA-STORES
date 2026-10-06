/**
 * Server side of staff sign-in and staff accounts when the app runs on Supabase (PEKASA STORE).
 *
 * Web-standard only (Request / Response / fetch / crypto.subtle), so it runs unchanged as a Netlify
 * Function and a Vercel Function (see netlify/functions/auth.ts and api/auth/[action].ts).
 *
 * Endpoints (all POST, JSON):
 *   login                  { email, password }          -> { ok, session, otpRequired }
 *   otp-send               Bearer <access token>         -> { ok, token, maskedPhone }
 *   otp-verify             Bearer + { token, code }      -> { ok }   (client then refreshes its session)
 *   staff-create           Bearer (admin) + staff fields -> { ok, user }
 *   staff-reset-password   Bearer (admin) + { userId, password } -> { ok }
 *
 * How the cashier SMS step cannot be skipped:
 *   - The database itself gives a cashier NOTHING until the login session carries `otp_ok`
 *     (supabase/migrations/20261006000100_otp_session_gate.sql). A cashier session straight from
 *     Supabase Auth is therefore useless.
 *   - Only this server (service role) can mark a session as code-verified, and only after the right
 *     SMS code was typed for THAT session.
 *   - The code is never sent to the browser. The browser only gets a signed token that can be checked
 *     against the typed code; attempts, expiry and single use are tracked in the database.
 *   - The phone number the SMS goes to is read from the database, never from the browser.
 *
 * Environment (hosting settings only, never committed):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OTP_SECRET + an SMS provider (see otp.ts)
 */
import {
  type Env,
  json,
  toB64Url,
  fromB64Url,
  hmac,
  timingSafeEqual,
  generateCode,
  normalizeKenyanPhone,
  maskPhone,
  sendSms
} from './otp.ts';

const OTP_TTL_MS = 10 * 60 * 1000;
const enc = new TextEncoder();

const ROLES: Record<string, string> = {
  'role-admin': 'Administrator',
  'role-manager': 'Branch Manager',
  'role-cashier': 'Cashier'
};
const needsOtp = (roleId: string) => roleId === 'role-cashier'; // mirrors public.role_needs_otp()

type AppUser = {
  id: string;
  auth_user_id: string;
  role_id: string;
  is_active: number | null;
  phone: string;
  full_name: string;
  branch_id: string | null;
};

type Cfg = { url: string; anon: string; service: string; secret: string };

const config = (env: Env): Cfg | null => {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anon = env.SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = env.OTP_SECRET;
  if (!url || !anon || !service || !secret || secret.length < 16) return null;
  return { url, anon, service, secret };
};

const fail = (error: string, status: number) => json({ ok: false, error }, status);

// ----------------------------------------------------------------------------- Supabase calls

const gotrue = (c: Cfg, path: string, init: { method?: string; bearer?: string; admin?: boolean; body?: unknown }) =>
  fetch(`${c.url}/auth/v1${path}`, {
    method: init.method || 'POST',
    headers: {
      apikey: init.admin ? c.service : c.anon,
      Authorization: `Bearer ${init.admin ? c.service : init.bearer || c.anon}`,
      'content-type': 'application/json'
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

const rest = (c: Cfg, path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) =>
  fetch(`${c.url}/rest/v1/${path}`, {
    method: init.method || 'GET',
    headers: {
      apikey: c.service,
      Authorization: `Bearer ${c.service}`,
      'content-type': 'application/json',
      ...(init.prefer ? { Prefer: init.prefer } : {})
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

const rpc = async (c: Cfg, name: string, args: Record<string, unknown>): Promise<{ ok: boolean; data: any }> => {
  const res = await rest(c, `rpc/${name}`, { method: 'POST', body: args });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
};

const USER_COLS = 'id,auth_user_id,role_id,is_active,phone,full_name,branch_id';

const appUserByAuthId = async (c: Cfg, authId: string): Promise<AppUser | null> => {
  const res = await rest(c, `users?auth_user_id=eq.${encodeURIComponent(authId)}&select=${USER_COLS}&limit=1`);
  if (!res.ok) return null;
  const rows: AppUser[] = await res.json().catch(() => []);
  const u = rows[0];
  return u && (u.is_active ?? 1) === 1 ? u : null;
};

/** Ask Supabase Auth whether this access token is genuine. Returns the auth user id + session id. */
const authenticate = async (c: Cfg, req: Request): Promise<{ authId: string; sessionId: string } | null> => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  const token = m[1].trim();
  try {
    const res = await gotrue(c, '/user', { method: 'GET', bearer: token });
    if (!res.ok) return null;
    const user: any = await res.json();
    if (!user?.id) return null;
    // The token was just proven genuine by Supabase, so reading its claims here is safe.
    const claims = JSON.parse(new TextDecoder().decode(fromB64Url(token.split('.')[1])));
    const sessionId = String(claims.session_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
    return { authId: String(user.id), sessionId };
  } catch {
    return null;
  }
};

const body = async (req: Request): Promise<any | null> => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

// ----------------------------------------------------------------------------- login

async function login(req: Request, c: Cfg): Promise<Response> {
  const b = await body(req);
  const email = String(b?.email || '').trim().toLowerCase();
  const password = String(b?.password || '');
  if (!email || !password) return fail('Enter your email and password.', 400);

  const res = await gotrue(c, '/token?grant_type=password', { body: { email, password } });
  if (!res.ok) return fail('Incorrect email or password.', 401);
  const s: any = await res.json().catch(() => null);
  if (!s?.access_token || !s?.user?.id) return fail('Sign-in failed. Please try again.', 502);

  const user = await appUserByAuthId(c, s.user.id);
  if (!user) {
    await gotrue(c, '/logout', { bearer: s.access_token }).catch(() => undefined);
    return fail('This account is not active. Contact an administrator.', 403);
  }

  return json({
    ok: true,
    otpRequired: needsOtp(user.role_id),
    session: {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_in: s.expires_in,
      expires_at: s.expires_at,
      token_type: s.token_type || 'bearer'
    }
  });
}

// ----------------------------------------------------------------------------- SMS code

async function otpSend(req: Request, c: Cfg, env: Env): Promise<Response> {
  const who = await authenticate(c, req);
  if (!who) return fail('Please sign in again.', 401);
  const user = await appUserByAuthId(c, who.authId);
  if (!user) return fail('This account is not active. Contact an administrator.', 403);
  if (!needsOtp(user.role_id)) return fail('A sign-in code is not needed for this account.', 400);

  const phone = normalizeKenyanPhone(user.phone);
  if (!phone) {
    return fail('No valid mobile number is saved for this account. Ask an administrator to update it.', 422);
  }

  const nonce = toB64Url(crypto.getRandomValues(new Uint8Array(12)));
  const started = await rpc(c, 'otp_start', { p_nonce: nonce, p_user_id: user.id });
  if (!started.ok) return fail('Could not start the sign-in code. Please try again.', 502);
  if (started.data === 'cooldown') return fail('A code was just sent. Please wait 30 seconds before requesting another.', 429);
  if (started.data === 'rate_limited') return fail('Too many codes requested. Please wait a few minutes and try again.', 429);

  const code = generateCode();
  const payload = toB64Url(enc.encode(JSON.stringify({ uid: user.id, sid: who.sessionId, exp: Date.now() + OTP_TTL_MS, n: nonce })));
  const sig = toB64Url(await hmac(c.secret, `${payload}:${code}`));

  const sms = await sendSms(env, phone, `PEKASA STORE: your sign-in code is ${code}. It expires in 10 minutes. Do not share it with anyone.`);
  if (!sms.ok) {
    if (sms.error === 'not_configured' && env.OTP_DEV_LOG === 'true') {
      console.log(`[OTP_DEV_LOG] code for ${maskPhone(phone)}: ${code}`); // server log only
    } else {
      console.error(`[auth] SMS failed: ${sms.error}`);
      return fail('Could not send the SMS code right now. Please try again or contact an administrator.', 502);
    }
  }
  return json({ ok: true, token: `${payload}.${sig}`, maskedPhone: maskPhone(phone) });
}

async function otpVerify(req: Request, c: Cfg): Promise<Response> {
  const who = await authenticate(c, req);
  if (!who) return fail('Please sign in again.', 401);
  const user = await appUserByAuthId(c, who.authId);
  if (!user) return fail('This account is not active. Contact an administrator.', 403);

  const b = await body(req);
  const code = String(b?.code || '').trim();
  const [payload, sig] = String(b?.token || '').split('.');
  if (!payload || !sig || !/^\d{6}$/.test(code)) {
    return fail('Invalid code. Please enter the 6-digit code you received.', 400);
  }

  let data: { uid: string; sid: string; exp: number; n: string };
  let provided: Uint8Array;
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    provided = fromB64Url(sig);
  } catch {
    return fail('Code session invalid. Please sign in again.', 400);
  }
  // The token must belong to this very person and this very login session.
  if (data.uid !== user.id || data.sid !== who.sessionId || typeof data.n !== 'string') {
    return fail('Code session invalid. Please sign in again.', 400);
  }
  if (Date.now() > data.exp) return fail('Code expired. Please sign in again to get a new code.', 410);

  // Count the guess first (so guessing is limited even if the rest is skipped).
  const attempt = await rpc(c, 'otp_attempt', { p_nonce: data.n, p_user_id: user.id });
  if (!attempt.ok) return fail('Could not check the code. Please try again.', 502);
  switch (attempt.data) {
    case 'ok':
      break;
    case 'locked':
      return fail('Too many wrong attempts. Please sign in again to get a new code.', 429);
    case 'expired':
      return fail('Code expired. Please sign in again to get a new code.', 410);
    case 'used':
      return fail('This code was already used. Please sign in again.', 409);
    default:
      return fail('Code session invalid. Please sign in again.', 400);
  }

  const expected = await hmac(c.secret, `${payload}:${code}`);
  if (!timingSafeEqual(expected, provided)) return fail('Invalid code. Please check the SMS and try again.', 401);

  const used = await rpc(c, 'otp_consume', { p_nonce: data.n, p_user_id: user.id });
  if (!used.ok || used.data !== true) return fail('This code was already used. Please sign in again.', 409);

  const marked = await rpc(c, 'otp_mark_session', { p_session: who.sessionId, p_user: who.authId });
  if (!marked.ok) return fail('Could not complete sign-in. Please try again.', 502);
  return json({ ok: true });
}

// ----------------------------------------------------------------------------- staff accounts

const requireAdmin = async (req: Request, c: Cfg): Promise<Response | AppUser> => {
  const who = await authenticate(c, req);
  if (!who) return fail('Please sign in again.', 401);
  const user = await appUserByAuthId(c, who.authId);
  if (!user || user.role_id !== 'role-admin') return fail('Only an administrator can do this.', 403);
  return user;
};

const validPassword = (p: string) => p.length >= 10 && p.length <= 72;

async function staffCreate(req: Request, c: Cfg): Promise<Response> {
  const admin = await requireAdmin(req, c);
  if (admin instanceof Response) return admin;

  const b = await body(req);
  const fullName = String(b?.fullName || '').trim().slice(0, 80);
  const username = String(b?.username || '').trim().toLowerCase();
  const email = String(b?.email || '').trim().toLowerCase();
  const password = String(b?.password || '');
  const roleId = String(b?.roleId || '');
  const branchId = String(b?.branchId || '');
  const phone = normalizeKenyanPhone(String(b?.phone || ''));

  if (!fullName) return fail('Enter the full name.', 400);
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return fail('Username must be 3-32 letters, numbers, dot, dash or underscore.', 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Enter a real email address (it is used to sign in).', 400);
  if (!validPassword(password)) return fail('Password must be at least 10 characters.', 400);
  if (!ROLES[roleId]) return fail('Choose a valid role.', 400);
  if (!phone) return fail('Enter a valid Kenyan mobile number (e.g. 0712345678).', 400);
  if (!branchId) return fail('Choose a branch.', 400);

  const br = await rest(c, `branches?id=eq.${encodeURIComponent(branchId)}&select=id&limit=1`);
  const branches: any[] = br.ok ? await br.json().catch(() => []) : [];
  if (!branches.length) return fail('That branch does not exist.', 400);

  const created = await gotrue(c, '/admin/users', { admin: true, body: { email, password, email_confirm: true } });
  const authUser: any = await created.json().catch(() => null);
  if (!created.ok || !authUser?.id) {
    const taken = created.status === 422 || /already|registered|exists/i.test(String(authUser?.msg || authUser?.message || ''));
    return fail(taken ? 'That email already has an account.' : 'Could not create the login. Please try again.', taken ? 409 : 502);
  }

  const id = `usr-${toB64Url(crypto.getRandomValues(new Uint8Array(9)))}`;
  const row = {
    id,
    username,
    full_name: fullName,
    email,
    phone,
    role_id: roleId,
    role_title: ROLES[roleId],
    branch_id: branchId,
    is_active: 1,
    created_at: new Date().toISOString(),
    auth_user_id: authUser.id
  };
  const ins = await rest(c, 'users', { method: 'POST', body: row, prefer: 'return=minimal' });
  if (!ins.ok) {
    // roll back the login so no orphan account is left behind
    await gotrue(c, `/admin/users/${authUser.id}`, { method: 'DELETE', admin: true }).catch(() => undefined);
    const dup = ins.status === 409;
    return fail(dup ? 'That username is already taken.' : 'Could not save the staff member. Please try again.', dup ? 409 : 502);
  }
  return json({ ok: true, user: { id, username, fullName, email, phone, roleId, branchId } }, 201);
}

async function staffResetPassword(req: Request, c: Cfg): Promise<Response> {
  const admin = await requireAdmin(req, c);
  if (admin instanceof Response) return admin;

  const b = await body(req);
  const userId = String(b?.userId || '');
  const password = String(b?.password || '');
  if (!userId) return fail('Choose a staff member.', 400);
  if (!validPassword(password)) return fail('Password must be at least 10 characters.', 400);

  const res = await rest(c, `users?id=eq.${encodeURIComponent(userId)}&select=auth_user_id&limit=1`);
  const rows: any[] = res.ok ? await res.json().catch(() => []) : [];
  const authId = rows[0]?.auth_user_id;
  if (!authId) return fail('That staff member has no login account.', 404);

  const upd = await gotrue(c, `/admin/users/${authId}`, { method: 'PUT', admin: true, body: { password } });
  if (!upd.ok) return fail('Could not change the password. Please try again.', 502);
  return json({ ok: true });
}

// ----------------------------------------------------------------------------- router

/** Dispatches on the last path segment, so any host mount point (/api/auth/login, /.netlify/...) works. */
export async function handleAuth(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return fail('Method not allowed', 405);
  const c = config(env);
  if (!c) return fail('The sign-in service is not configured.', 503);

  const action = new URL(req.url).pathname.replace(/\/+$/, '').split('/').pop();
  try {
    switch (action) {
      case 'login':
        return await login(req, c);
      case 'otp-send':
        return await otpSend(req, c, env);
      case 'otp-verify':
        return await otpVerify(req, c);
      case 'staff-create':
        return await staffCreate(req, c);
      case 'staff-reset-password':
        return await staffResetPassword(req, c);
      default:
        return fail('Not found', 404);
    }
  } catch (e) {
    console.error('[auth] unexpected error', e);
    return fail('Something went wrong. Please try again.', 500);
  }
}
