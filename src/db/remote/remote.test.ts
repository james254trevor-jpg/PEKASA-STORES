import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remoteConfig } from './config.ts';
import { RemoteClient, RemoteError } from './client.ts';
import { RemoteAuth } from './authApi.ts';
import { CustomersRepo } from './customers.ts';

const CFG = { url: 'https://abc.supabase.co', anonKey: 'ANON' };
const res = (status: number, data?: unknown) => new Response(data === undefined ? null : JSON.stringify(data), { status });

type Call = { url: string; method: string; headers: Record<string, string>; body: any };
const harness = (handler: (c: Call) => Response | Promise<Response>, expiresAt = 4_000_000_000) => {
  const calls: Call[] = [];
  const f = (async (url: any, init: any = {}) => {
    const c = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(c);
    return handler(c);
  }) as typeof fetch;
  const client = new RemoteClient(CFG, { fetch: f, now: () => 1_000_000_000_000 });
  client.setSession({ access_token: 'T1', refresh_token: 'R1', expires_at: expiresAt });
  return { calls, client, f };
};

// ---- config: the switch ------------------------------------------------------------------------
test('switch is OFF unless explicitly on and fully configured', () => {
  assert.equal(remoteConfig({}), null);
  assert.equal(remoteConfig({ VITE_SUPABASE_URL: CFG.url, VITE_SUPABASE_ANON_KEY: 'k' }), null, 'URL+key alone is not enough');
  assert.equal(remoteConfig({ VITE_USE_SUPABASE: 'true', VITE_SUPABASE_URL: CFG.url }), null, 'no key');
  assert.equal(remoteConfig({ VITE_USE_SUPABASE: 'true', VITE_SUPABASE_URL: 'http://evil.test', VITE_SUPABASE_ANON_KEY: 'k' }), null);
  assert.equal(remoteConfig({ VITE_USE_SUPABASE: 'false', VITE_SUPABASE_URL: CFG.url, VITE_SUPABASE_ANON_KEY: 'k' }), null);
  assert.deepEqual(remoteConfig({ VITE_USE_SUPABASE: 'true', VITE_SUPABASE_URL: CFG.url + '/', VITE_SUPABASE_ANON_KEY: 'k' }), { url: CFG.url, anonKey: 'k' });
});

// ---- client ------------------------------------------------------------------------------------
test('client: sends the user token and anon key, never the service role', async () => {
  const { client, calls } = harness(() => res(200, []));
  await client.select('customers');
  assert.equal(calls[0].headers.Authorization, 'Bearer T1');
  assert.equal(calls[0].headers.apikey, 'ANON');
});

test('client: no session -> 401 without calling the network', async () => {
  const calls: any[] = [];
  const c = new RemoteClient(CFG, { fetch: (async (...a: any[]) => (calls.push(a), res(200, []))) as any });
  await assert.rejects(c.select('customers'), (e: any) => e instanceof RemoteError && e.status === 401);
  assert.equal(calls.length, 0);
});

test('client: refreshes an about-to-expire token first and uses the new one', async () => {
  const { client, calls } = harness((c) =>
    c.url.includes('grant_type=refresh_token')
      ? res(200, { access_token: 'T2', refresh_token: 'R2', expires_in: 3600 })
      : res(200, []), 1_000_000_010);
  await client.select('customers');
  assert.match(calls[0].url, /grant_type=refresh_token/);
  assert.equal(calls[0].body.refresh_token, 'R1');
  assert.equal(calls[1].headers.Authorization, 'Bearer T2');
});

test('client: a 401 triggers one refresh and one retry', async () => {
  let first = true;
  const { client, calls } = harness((c) => {
    if (c.url.includes('grant_type=refresh_token')) return res(200, { access_token: 'T2', refresh_token: 'R2', expires_in: 3600 });
    if (first) { first = false; return res(401, { message: 'JWT expired' }); }
    return res(200, [{ id: 1 }]);
  });
  assert.deepEqual(await client.select('customers'), [{ id: 1 }]);
  assert.equal(calls.length, 3);
});

test('client: failed refresh signs the user out', async () => {
  const { client } = harness((c) => (c.url.includes('refresh_token') ? res(400, {}) : res(401, {})));
  await assert.rejects(client.select('customers'));
  assert.equal(client.hasSession(), false);
});

test('client: database errors carry status and code', async () => {
  const { client } = harness(() => res(409, { message: 'dup', code: '23505' }));
  await assert.rejects(client.insert('customers', {}), (e: any) => e.status === 409 && e.code === '23505');
});

// ---- auth flow ---------------------------------------------------------------------------------
test('auth: cashier flow = login, send code, verify, then token refresh (to pick up the verified mark)', async () => {
  const { client, calls } = harness((c) =>
    c.url.includes('grant_type=refresh_token') ? res(200, { access_token: 'T-VERIFIED', refresh_token: 'R9', expires_in: 3600 }) : res(200, []));
  client.setSession(null);
  const seen: string[] = [];
  const post = async (action: string, body: any, bearer?: string | null) => {
    seen.push(`${action}:${bearer ?? '-'}`);
    if (action === 'login') return { ok: true, otpRequired: true, session: { access_token: 'T0', refresh_token: 'R0', expires_at: 4_000_000_000 } };
    if (action === 'otp-send') return { ok: true, token: 'tok', maskedPhone: '+25471•••678' };
    if (action === 'otp-verify') return body.code === '123456' ? { ok: true } : { ok: false, error: 'Invalid code.' };
    return { ok: false };
  };
  const auth = new RemoteAuth(client, post);

  const l = await auth.login('a@b.co', 'pw');
  assert.deepEqual(l, { ok: true, otpRequired: true });
  const s = await auth.sendCode();
  assert.equal(s.token, 'tok');
  assert.equal((await auth.verifyCode('tok', '000000')).ok, false);
  assert.equal(calls.length, 0, 'a wrong code does not refresh');
  assert.equal((await auth.verifyCode('tok', '123456')).ok, true);
  assert.deepEqual(seen, ['login:-', 'otp-send:T0', 'otp-verify:T0', 'otp-verify:T0']);
  await client.select('customers');
  assert.equal(calls[calls.length - 1].headers.Authorization, 'Bearer T-VERIFIED');
});

test('auth: failed login stores no session', async () => {
  const { client } = harness(() => res(200, []));
  client.setSession(null);
  const auth = new RemoteAuth(client, async () => ({ ok: false, error: 'Incorrect email or password.' }));
  assert.deepEqual(await auth.login('a@b.co', 'x'), { ok: false, error: 'Incorrect email or password.' });
  assert.equal(client.hasSession(), false);
});

// ---- customers ---------------------------------------------------------------------------------
test('customers.list: adds loan totals like the old getCustomers()', async () => {
  const { client } = harness((c) => {
    if (c.url.includes('/customers?')) return res(200, [{ id: 'c1', name: 'A', defaults_count: '2' }, { id: 'c2', name: 'B' }]);
    return res(200, [
      { customer_id: 'c1', principal_amount: 1000, amount_paid: 400, balance_remaining: 600, status: 'ACTIVE' },
      { customer_id: 'c1', principal_amount: 500, amount_paid: 500, balance_remaining: 0, status: 'REDEEMED' },
      { customer_id: 'c1', principal_amount: 200, amount_paid: 0, balance_remaining: 250, status: 'SOLD' }
    ]);
  });
  const [a, b] = await new CustomersRepo(client).list();
  assert.deepEqual([a.previous_loans_count, a.total_borrowed, a.total_repaid, a.current_balance, a.defaults_count], [3, 1700, 900, 600, 2]);
  assert.deepEqual([b.previous_loans_count, b.total_borrowed, b.current_balance, b.defaults_count], [0, 0, 0, 0]);
});

test('customers.create: number comes from next_sequence and is formatted', async () => {
  const { client, calls } = harness((c) => {
    if (c.url.includes('rpc/next_sequence')) return res(200, 126);
    return res(201, [c.body]);
  });
  const row: any = await new CustomersRepo(client).create({ name: ' Jane ', id_number: ' 123 ', phone: '0712345678' });
  assert.equal(calls[0].body.p_prefix, 'CUS');
  assert.equal(row.customer_number, 'CUS-2026-000126');
  assert.equal(row.name, 'Jane');
  assert.equal(row.id_number, '123');
  assert.equal(row.status, 'Good Standing');
});

test('customers.create: duplicate ID number and no-permission give clear messages', async () => {
  const dup = harness((c) => (c.url.includes('rpc') ? res(200, 1) : res(409, { code: '23505', message: 'x' })));
  await assert.rejects(new CustomersRepo(dup.client).create({ name: 'A', id_number: '1', phone: '1' }), /ID number already exists/);
  const denied = harness((c) => (c.url.includes('rpc') ? res(200, 1) : res(403, { code: '42501', message: 'x' })));
  await assert.rejects(new CustomersRepo(denied.client).create({ name: 'A', id_number: '1', phone: '1' }), /not allowed/);
});

test('customers.update: sends only given fields; empty result means not found / other branch', async () => {
  const ok = harness((c) => res(200, [{ id: 'c1' }]));
  await new CustomersRepo(ok.client).update('c1', { name: 'New', phone: '' });
  const call = ok.calls[0];
  assert.equal(call.method, 'PATCH');
  assert.match(call.url, /id=eq\.c1/);
  assert.equal(call.body.name, 'New');
  assert.ok(!('phone' in call.body) && !('id' in call.body) && !('defaults_count' in call.body));
  const none = harness(() => res(200, []));
  await assert.rejects(new CustomersRepo(none.client).update('c9', { name: 'x' }), /not found|do not have access/);
});

test('customers.getById: encodes the id and returns null when absent', async () => {
  const h = harness(() => res(200, []));
  assert.equal(await new CustomersRepo(h.client).getById('a&b=c'), null);
  assert.match(h.calls[0].url, /id=eq\.a%26b%3Dc/);
});
