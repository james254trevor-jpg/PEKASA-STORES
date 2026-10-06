import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth } from './auth.ts';

// ---- a small fake of Supabase Auth + PostgREST (enough for the sign-in server) -------------------
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub: string, sid: string) => `${b64({ alg: 'HS256' })}.${b64({ sub, session_id: sid })}.sig`;

type Row = Record<string, any>;
let authUsers: Map<string, { id: string; email: string; password: string }>;
let users: Row[];
let branches: Row[];
let tokens: Map<string, { sub: string; sid: string }>;
let challenges: Map<string, { user: string; attempts: number; consumed: boolean; exp: number }>;
let marked: Array<{ session: string; user: string }>;
let sms: Array<{ to: string; text: string }>;
let lastPost: Record<string, any>;
let failUserInsert = false;
let raceConsume = false;
let n = 0;

const reply = (status: number, data?: unknown) =>
  new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const fakeFetch = async (input: any, init: any = {}): Promise<Response> => {
  const url = new URL(String(input));
  const method = init.method || 'GET';
  const body = init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : init.body;
  const bearer = /^Bearer (.+)$/.exec(init.headers?.Authorization || '')?.[1] || '';

  if (url.hostname === 'abc123.api.infobip.com') {
    sms.push({ to: body.messages[0].destinations[0].to, text: body.messages[0].text });
    return reply(200, { messages: [{ status: { groupName: 'PENDING' } }] });
  }
  const p = url.pathname;

  if (p === '/auth/v1/token') {
    const u = [...authUsers.values()].find((x) => x.email === body.email && x.password === body.password);
    if (!u) return reply(400, { error: 'invalid_grant' });
    const sid = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    const access = jwt(u.id, sid);
    tokens.set(access, { sub: u.id, sid });
    return reply(200, { access_token: access, refresh_token: 'r', expires_in: 3600, expires_at: 1, token_type: 'bearer', user: { id: u.id } });
  }
  if (p === '/auth/v1/user') {
    const t = tokens.get(bearer);
    return t ? reply(200, { id: t.sub }) : reply(401, {});
  }
  if (p === '/auth/v1/logout') return reply(204);
  if (p === '/auth/v1/admin/users' && method === 'POST') {
    if (bearer !== 'SERVICE') return reply(401, {});
    if ([...authUsers.values()].some((x) => x.email === body.email)) return reply(422, { msg: 'already registered' });
    const id = `auth-${++n}`;
    authUsers.set(id, { id, email: body.email, password: body.password });
    return reply(200, { id });
  }
  if (p.startsWith('/auth/v1/admin/users/')) {
    const id = p.split('/').pop()!;
    if (bearer !== 'SERVICE') return reply(401, {});
    if (method === 'DELETE') authUsers.delete(id);
    if (method === 'PUT') authUsers.get(id)!.password = body.password;
    return reply(200, {});
  }

  if (bearer !== 'SERVICE') return reply(401, {}); // PostgREST calls here are all service-role
  if (p === '/rest/v1/users' && method === 'GET') {
    const a = url.searchParams.get('auth_user_id')?.replace('eq.', '');
    const i = url.searchParams.get('id')?.replace('eq.', '');
    return reply(200, users.filter((u) => (a ? u.auth_user_id === a : u.id === i)));
  }
  if (p === '/rest/v1/users' && method === 'POST') {
    lastPost = body;
    if (failUserInsert) return reply(500, {});
    if (users.some((u) => u.username === body.username)) return reply(409, {});
    users.push(body);
    return reply(201);
  }
  if (p === '/rest/v1/branches') {
    const id = url.searchParams.get('id')?.replace('eq.', '');
    return reply(200, branches.filter((x) => x.id === id));
  }
  if (p.startsWith('/rest/v1/rpc/')) {
    const f = p.split('/').pop();
    if (f === 'otp_start') {
      if ([...challenges.values()].some((c) => c.user === body.p_user_id && Date.now() - c.exp < 0 && c.attempts >= 0 && (c as any).fresh)) return reply(200, 'cooldown');
      challenges.set(body.p_nonce, { user: body.p_user_id, attempts: 0, consumed: false, exp: Date.now() + 600000 });
      (challenges.get(body.p_nonce) as any).fresh = false;
      return reply(200, 'ok');
    }
    if (f === 'otp_attempt') {
      const c = challenges.get(body.p_nonce);
      if (!c || c.user !== body.p_user_id) return reply(200, 'unknown');
      if (c.consumed) return reply(200, 'used');
      if (c.attempts >= 5) return reply(200, 'locked');
      c.attempts++;
      return reply(200, 'ok');
    }
    if (f === 'otp_consume') {
      const c = challenges.get(body.p_nonce);
      if (!c || c.consumed || raceConsume) return reply(200, false);
      c.consumed = true;
      return reply(200, true);
    }
    if (f === 'otp_mark_session') {
      marked.push({ session: body.p_session, user: body.p_user });
      return reply(204);
    }
  }
  return reply(404, {});
};

const ENV = {
  SUPABASE_URL: 'https://x.supabase.test',
  SUPABASE_ANON_KEY: 'ANON',
  SUPABASE_SERVICE_ROLE_KEY: 'SERVICE',
  OTP_SECRET: 'a-long-test-secret-value-1234567890',
  INFOBIP_BASE_URL: 'abc123.api.infobip.com',
  INFOBIP_API_KEY: 'k'
};

const call = async (action: string, payload: unknown, bearer?: string, env = ENV) => {
  const res = await handleAuth(
    new Request(`https://app.test/api/auth/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(payload)
    }),
    env
  );
  return { status: res.status, json: (await res.json()) as any };
};

const signIn = async (email: string, password: string) => {
  const r = await call('login', { email, password });
  return { ...r, access: r.json.session?.access_token as string };
};
const codeFromSms = () => /code is (\d{6})/.exec(sms[sms.length - 1].text)![1];

beforeEach(() => {
  authUsers = new Map([
    ['a-admin', { id: 'a-admin', email: 'boss@x.co', password: 'adminpass-123' }],
    ['a-cash', { id: 'a-cash', email: 'cash@x.co', password: 'cashierpass-1' }],
    ['a-cash2', { id: 'a-cash2', email: 'cash2@x.co', password: 'cashierpass-2' }],
    ['a-off', { id: 'a-off', email: 'off@x.co', password: 'offpass-12345' }]
  ]);
  users = [
    { id: 'usr-admin', auth_user_id: 'a-admin', role_id: 'role-admin', is_active: 1, phone: '0700000001', full_name: 'Boss', branch_id: 'br-1', username: 'boss' },
    { id: 'usr-cash', auth_user_id: 'a-cash', role_id: 'role-cashier', is_active: 1, phone: '0712345678', full_name: 'Cash', branch_id: 'br-1', username: 'cash' },
    { id: 'usr-cash2', auth_user_id: 'a-cash2', role_id: 'role-cashier', is_active: 1, phone: '0722222222', full_name: 'Cash2', branch_id: 'br-1', username: 'cash2' },
    { id: 'usr-off', auth_user_id: 'a-off', role_id: 'role-cashier', is_active: 0, phone: '0733333333', full_name: 'Off', branch_id: 'br-1', username: 'off' }
  ];
  branches = [{ id: 'br-1' }];
  tokens = new Map();
  challenges = new Map();
  marked = [];
  sms = [];
  lastPost = {};
  failUserInsert = false;
  raceConsume = false;
  globalThis.fetch = fakeFetch as any;
});

// ---- login ------------------------------------------------------------------------------------
test('login: admin gets a session and no code is required', async () => {
  const r = await signIn('boss@x.co', 'adminpass-123');
  assert.equal(r.status, 200);
  assert.equal(r.json.otpRequired, false);
  assert.ok(r.access);
});

test('login: cashier gets a session but is told a code is required', async () => {
  const r = await signIn('cash@x.co', 'cashierpass-1');
  assert.equal(r.json.otpRequired, true);
  assert.equal(sms.length, 0, 'login itself never sends or shows a code');
});

test('login: wrong password and unknown email give the same generic error', async () => {
  const a = await call('login', { email: 'cash@x.co', password: 'nope' });
  const b = await call('login', { email: 'ghost@x.co', password: 'nope' });
  assert.equal(a.status, 401);
  assert.deepEqual(a.json, b.json);
});

test('login: a deactivated account is refused', async () => {
  const r = await call('login', { email: 'off@x.co', password: 'offpass-12345' });
  assert.equal(r.status, 403);
  assert.equal(r.json.session, undefined);
});

// ---- SMS code ---------------------------------------------------------------------------------
test('otp-send: texts the number from the DATABASE and never returns the code', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const r = await call('otp-send', { phone: '0799999999', userId: 'usr-admin' }, access); // client-supplied values ignored
  assert.equal(r.status, 200);
  assert.equal(sms.length, 1);
  assert.equal(sms[0].to, '254712345678');
  assert.ok(!JSON.stringify(r.json).includes(codeFromSms()));
  assert.match(r.json.maskedPhone, /•••/);
});

test('otp-send: needs a signed-in session', async () => {
  assert.equal((await call('otp-send', {})).status, 401);
  assert.equal((await call('otp-send', {}, 'garbage')).status, 401);
});

test('otp-send: not for admins', async () => {
  const { access } = await signIn('boss@x.co', 'adminpass-123');
  assert.equal((await call('otp-send', {}, access)).status, 400);
  assert.equal(sms.length, 0);
});

test('otp-send: fails safely (and shows nothing) when SMS is not configured', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const env = { ...ENV, INFOBIP_BASE_URL: undefined, INFOBIP_API_KEY: undefined };
  const r = await call('otp-send', {}, access, env);
  assert.equal(r.status, 502);
  assert.equal(r.json.token, undefined);
});

test('otp-verify: right code marks THIS session as verified', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, access);
  const r = await call('otp-verify', { token: sent.json.token, code: codeFromSms() }, access);
  assert.equal(r.status, 200);
  assert.deepEqual(marked, [{ session: tokens.get(access)!.sid, user: 'a-cash' }]);
});

test('otp-verify: wrong code is refused and marks nothing', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, access);
  const wrong = codeFromSms() === '000000' ? '111111' : '000000';
  const r = await call('otp-verify', { token: sent.json.token, code: wrong }, access);
  assert.equal(r.status, 401);
  assert.equal(marked.length, 0);
});

test('otp-verify: a code cannot be used twice', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, access);
  const code = codeFromSms();
  assert.equal((await call('otp-verify', { token: sent.json.token, code }, access)).status, 200);
  assert.equal((await call('otp-verify', { token: sent.json.token, code }, access)).status, 409);
  assert.equal(marked.length, 1);
});

test('otp-verify: locks after 5 wrong guesses, even if the right code is then typed', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, access);
  const code = codeFromSms();
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await call('otp-verify', { token: sent.json.token, code: wrong }, access)).status, 401);
  assert.equal((await call('otp-verify', { token: sent.json.token, code }, access)).status, 429);
  assert.equal(marked.length, 0);
});

test('otp-verify: a code for one session cannot verify another session of the same cashier', async () => {
  const s1 = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, s1.access);
  const s2 = await signIn('cash@x.co', 'cashierpass-1'); // e.g. the password was stolen
  const r = await call('otp-verify', { token: sent.json.token, code: codeFromSms() }, s2.access);
  assert.equal(r.status, 400);
  assert.equal(marked.length, 0);
});

test("otp-verify: one cashier's code cannot verify another cashier", async () => {
  const c1 = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, c1.access);
  const c2 = await signIn('cash2@x.co', 'cashierpass-2');
  const r = await call('otp-verify', { token: sent.json.token, code: codeFromSms() }, c2.access);
  assert.equal(r.status, 400);
  assert.equal(marked.length, 0);
});

test('otp-verify: a tampered token is refused', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, access);
  const [payload] = sent.json.token.split('.');
  const r = await call('otp-verify', { token: `${payload}.AAAA`, code: codeFromSms() }, access);
  assert.equal(r.status, 401);
  assert.equal(marked.length, 0);
});

test('otp-verify: two simultaneous requests with the same code cannot both sign in', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, access);
  raceConsume = true; // the other request consumed the code between our attempt check and our consume
  const r = await call('otp-verify', { token: sent.json.token, code: codeFromSms() }, access);
  assert.equal(r.status, 409);
  assert.equal(marked.length, 0);
});

test('otp-verify: a correctly signed token naming a different person is refused', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  const sent = await call('otp-send', {}, access);
  const data = JSON.parse(Buffer.from(sent.json.token.split('.')[0], 'base64url').toString());
  const payload = Buffer.from(JSON.stringify({ ...data, uid: 'usr-cash2' })).toString('base64url');
  const { createHmac } = await import('node:crypto');
  const sig = createHmac('sha256', ENV.OTP_SECRET).update(`${payload}:${codeFromSms()}`).digest('base64url');
  const r = await call('otp-verify', { token: `${payload}.${sig}`, code: codeFromSms() }, access);
  assert.equal(r.status, 400);
  assert.equal(marked.length, 0);
});

test('otp-verify: needs a signed-in session', async () => {
  assert.equal((await call('otp-verify', { token: 'a.b', code: '123456' })).status, 401);
});

// ---- staff accounts ---------------------------------------------------------------------------
const staff = {
  fullName: 'New Cashier',
  username: 'newcash',
  email: 'new@x.co',
  password: 'a-strong-pass-1',
  roleId: 'role-cashier',
  branchId: 'br-1',
  phone: '0711111111'
};

test('staff-create: admin creates a login + staff row (phone stored normalised)', async () => {
  const { access } = await signIn('boss@x.co', 'adminpass-123');
  const r = await call('staff-create', staff, access);
  assert.equal(r.status, 201);
  assert.equal(lastPost.phone, '+254711111111');
  assert.equal(lastPost.role_title, 'Cashier');
  assert.ok([...authUsers.values()].some((u) => u.email === 'new@x.co'));
  assert.equal(JSON.stringify(r.json).includes(staff.password), false);
});

test('staff-create: a cashier cannot create staff', async () => {
  const { access } = await signIn('cash@x.co', 'cashierpass-1');
  assert.equal((await call('staff-create', staff, access)).status, 403);
  assert.ok(![...authUsers.values()].some((u) => u.email === 'new@x.co'));
});

test('staff-create: no session -> 401', async () => {
  assert.equal((await call('staff-create', staff)).status, 401);
});

test('staff-create: validates input', async () => {
  const { access } = await signIn('boss@x.co', 'adminpass-123');
  for (const bad of [
    { password: 'short' },
    { email: 'not-an-email' },
    { phone: '12345' },
    { roleId: 'role-god' },
    { branchId: 'br-nope' },
    { username: 'A B' }
  ]) {
    const r = await call('staff-create', { ...staff, ...bad }, access);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  assert.equal(users.length, 4);
});

test('staff-create: duplicate email and duplicate username are reported', async () => {
  const { access } = await signIn('boss@x.co', 'adminpass-123');
  assert.equal((await call('staff-create', { ...staff, email: 'cash@x.co' }, access)).status, 409);
  assert.equal((await call('staff-create', { ...staff, username: 'cash' }, access)).status, 409);
});

test('staff-create: if saving the staff row fails, the login is rolled back', async () => {
  const { access } = await signIn('boss@x.co', 'adminpass-123');
  failUserInsert = true;
  const r = await call('staff-create', staff, access);
  assert.equal(r.status, 502);
  assert.ok(![...authUsers.values()].some((u) => u.email === 'new@x.co'), 'no orphan login left');
});

test('staff-reset-password: admin only, min length', async () => {
  const admin = await signIn('boss@x.co', 'adminpass-123');
  const cash = await signIn('cash@x.co', 'cashierpass-1');
  assert.equal((await call('staff-reset-password', { userId: 'usr-cash', password: 'brand-new-pass-9' }, cash.access)).status, 403);
  assert.equal((await call('staff-reset-password', { userId: 'usr-cash', password: 'short' }, admin.access)).status, 400);
  assert.equal((await call('staff-reset-password', { userId: 'usr-cash', password: 'brand-new-pass-9' }, admin.access)).status, 200);
  assert.equal(authUsers.get('a-cash')!.password, 'brand-new-pass-9');
  assert.equal((await call('staff-reset-password', { userId: 'usr-ghost', password: 'brand-new-pass-9' }, admin.access)).status, 404);
});

// ---- plumbing ---------------------------------------------------------------------------------
test('router: non-POST, unknown action, missing configuration', async () => {
  assert.equal((await handleAuth(new Request('https://a.test/api/auth/login'), ENV)).status, 405);
  assert.equal((await call('nope', {})).status, 404);
  assert.equal((await call('login', {}, undefined, { ...ENV, SUPABASE_SERVICE_ROLE_KEY: undefined })).status, 503);
  assert.equal((await call('login', {}, undefined, { ...ENV, OTP_SECRET: 'short' })).status, 503);
});
