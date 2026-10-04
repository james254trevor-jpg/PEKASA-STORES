import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleSend, handleVerify, normalizeKenyanPhone, generateCode, type Env } from './otp.ts';

// Run with:  npm test   (uses Node's built-in test runner, no extra packages)

const BASE: Env = { OTP_SECRET: 'x'.repeat(40) };
const AT: Env = { ...BASE, AT_USERNAME: 'sandbox', AT_API_KEY: 'test-key' };
const INFOBIP: Env = {
  ...BASE,
  INFOBIP_BASE_URL: 'abc123.api.infobip.com',
  INFOBIP_API_KEY: 'test-key',
  INFOBIP_SENDER: 'PEKASA'
};

type Call = { url: string; init: RequestInit & { headers: Record<string, string> } };
let calls: Call[] = [];
let reply: { status: number; body: unknown } = { status: 201, body: {} };
const realFetch = globalThis.fetch;
const realNow = Date.now;
const realLog = console.log;
const realError = console.error;
let n = 0;
const uid = () => `usr-${++n}`;

const atOk = () => (reply = { status: 201, body: { SMSMessageData: { Recipients: [{ status: 'Success' }] } } });
const infobipOk = () => (reply = { status: 200, body: { messages: [{ status: { groupName: 'PENDING' } }] } });

beforeEach(() => {
  calls = [];
  atOk();
  console.error = () => {}; // expected failure paths log to stderr; keep test output clean
  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Date.now = realNow;
  console.log = realLog;
  console.error = realError;
});

const post = (fn: typeof handleSend, body: unknown, env: Env) =>
  fn(new Request('https://x/api', { method: 'POST', body: JSON.stringify(body) }), env);
const read = async (r: Response) => ({ status: r.status, ...((await r.json()) as any) });
const smsText = (): string => {
  const c = calls.at(-1)!;
  return c.init.headers.Authorization
    ? JSON.parse(c.init.body as string).messages[0].text // Infobip
    : new URLSearchParams(c.init.body as string).get('message')!; // Africa's Talking
};
const codeFromSms = () => smsText().match(/is (\d{6})\./)![1];

describe('helpers', () => {
  test('normalizes Kenyan mobile numbers', () => {
    assert.equal(normalizeKenyanPhone('0727108749'), '+254727108749');
    assert.equal(normalizeKenyanPhone('+254 727 108 749'), '+254727108749');
    assert.equal(normalizeKenyanPhone('0180366344'), '+254180366344');
    assert.equal(normalizeKenyanPhone('12345'), null);
    assert.equal(normalizeKenyanPhone('+1 555 123 4567'), null);
  });

  test('codes are always 6 digits and vary', () => {
    const codes = Array.from({ length: 200 }, generateCode);
    assert.ok(codes.every((c) => /^\d{6}$/.test(c)));
    assert.ok(new Set(codes).size > 150);
  });
});

describe('send', () => {
  test('texts the cashier and never returns the code', async () => {
    const res = await read(await post(handleSend, { userId: uid(), phone: '0712 345 678' }, AT));
    assert.equal(res.ok, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /sandbox/);
    assert.equal(new URLSearchParams(calls[0].init.body as string).get('to'), '+254712345678');
    assert.ok(!JSON.stringify(res).includes(codeFromSms()), 'code leaked in response');
    assert.ok(res.maskedPhone.includes('•••'));
  });

  test('refuses an invalid phone and sends nothing', async () => {
    const res = await read(await post(handleSend, { userId: uid(), phone: 'abc' }, AT));
    assert.equal(res.status, 422);
    assert.equal(calls.length, 0);
  });

  test('30 second resend cooldown per user', async () => {
    const id = uid();
    assert.equal((await read(await post(handleSend, { userId: id, phone: '0712345678' }, AT))).status, 200);
    assert.equal((await read(await post(handleSend, { userId: id, phone: '0712345678' }, AT))).status, 429);
    assert.equal(calls.length, 1);
  });

  test('gateway rejection returns an error and no token', async () => {
    reply = { status: 201, body: { SMSMessageData: { Recipients: [{ status: 'InvalidPhoneNumber' }] } } };
    const res = await read(await post(handleSend, { userId: uid(), phone: '0712345678' }, AT));
    assert.equal(res.status, 502);
    assert.equal(res.token, undefined);
  });

  test('fails closed without OTP_SECRET or SMS credentials', async () => {
    assert.equal((await read(await post(handleSend, { userId: uid(), phone: '0712345678' }, {}))).status, 503);
    const logged: string[] = [];
    console.log = (...a: unknown[]) => logged.push(a.join(' '));
    const res = await read(await post(handleSend, { userId: uid(), phone: '0712345678' }, BASE));
    assert.equal(res.status, 502);
    assert.equal(logged.length, 0);
  });

  test('OTP_DEV_LOG prints the code in the server log only', async () => {
    const logged: string[] = [];
    console.log = (...a: unknown[]) => logged.push(a.join(' '));
    const res = await read(await post(handleSend, { userId: uid(), phone: '0712345678' }, { ...BASE, OTP_DEV_LOG: 'true' }));
    const code = logged[0].match(/: (\d{6})$/)![1];
    assert.equal(res.status, 200);
    assert.ok(!JSON.stringify(res).includes(code), 'dev code leaked in response');
  });

  test('GET is refused', async () => {
    assert.equal((await handleSend(new Request('https://x', { method: 'GET' }), AT)).status, 405);
    assert.equal((await handleVerify(new Request('https://x', { method: 'GET' }), AT)).status, 405);
  });
});

describe('verify', () => {
  const issue = async (env: Env = AT) => {
    const id = uid();
    const sent = await read(await post(handleSend, { userId: id, phone: '0712345678' }, env));
    return { id, token: sent.token as string, code: codeFromSms() };
  };
  const wrongFor = (code: string) => (code === '123456' ? '654321' : '123456');

  test('accepts the right code and returns the same user', async () => {
    const { id, token, code } = await issue();
    const res = await read(await post(handleVerify, { token, code }, AT));
    assert.equal(res.ok, true);
    assert.equal(res.userId, id);
  });

  test('rejects a wrong code', async () => {
    const { token, code } = await issue();
    assert.equal((await read(await post(handleVerify, { token, code: wrongFor(code) }, AT))).status, 401);
  });

  test('locks after 5 wrong tries, even for the right code afterwards', async () => {
    const { token, code } = await issue();
    for (let i = 0; i < 5; i++) {
      assert.equal((await read(await post(handleVerify, { token, code: wrongFor(code) }, AT))).status, 401);
    }
    assert.equal((await read(await post(handleVerify, { token, code }, AT))).status, 429);
  });

  test('rejects tampered or forged tokens', async () => {
    const { token, code } = await issue();
    const [payload, sig] = token.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    data.uid = 'usr-admin';
    const forged = `${Buffer.from(JSON.stringify(data)).toString('base64url')}.${sig}`;
    assert.equal((await read(await post(handleVerify, { token: forged, code }, AT))).ok, false);
    assert.equal((await read(await post(handleVerify, { token: `${payload}.AAAA`, code }, AT))).ok, false);
    assert.equal((await read(await post(handleVerify, { token: 'garbage', code }, AT))).ok, false);
  });

  test('rejects a token signed with a different secret', async () => {
    const { token, code } = await issue({ ...AT, OTP_SECRET: 'y'.repeat(40) });
    assert.equal((await read(await post(handleVerify, { token, code }, AT))).ok, false);
  });

  test('rejects an expired code', async () => {
    const { token, code } = await issue();
    Date.now = () => realNow() + 11 * 60 * 1000;
    assert.equal((await read(await post(handleVerify, { token, code }, AT))).status, 410);
  });
});

describe('Infobip provider', () => {
  beforeEach(infobipOk);

  test('sends the right request and the code only goes in the SMS', async () => {
    const res = await read(await post(handleSend, { userId: uid(), phone: '0712 345 678' }, INFOBIP));
    const call = calls[0];
    const body = JSON.parse(call.init.body as string);
    assert.equal(res.ok, true);
    assert.equal(call.url, 'https://abc123.api.infobip.com/sms/2/text/advanced');
    assert.equal(call.init.headers.Authorization, 'App test-key');
    assert.equal(body.messages[0].destinations[0].to, '254712345678');
    assert.equal(body.messages[0].from, 'PEKASA');
    const code = codeFromSms();
    assert.ok(!JSON.stringify(res).includes(code));
    assert.equal((await read(await post(handleVerify, { token: res.token, code }, INFOBIP))).ok, true);
  });

  test('accepts a base URL written with https:// and a trailing slash', async () => {
    const env = { ...INFOBIP, INFOBIP_BASE_URL: 'https://abc123.api.infobip.com/' };
    assert.equal((await read(await post(handleSend, { userId: uid(), phone: '0712345678' }, env))).ok, true);
    assert.equal(calls[0].url, 'https://abc123.api.infobip.com/sms/2/text/advanced');
  });

  test('never sends the API key to a non-Infobip host', async () => {
    const env = { ...INFOBIP, INFOBIP_BASE_URL: 'evil.example.com' };
    assert.equal((await read(await post(handleSend, { userId: uid(), phone: '0712345678' }, env))).status, 502);
    assert.equal(calls.length, 0);
  });

  test('REJECTED status and a bad key both fail without a token', async () => {
    reply = { status: 200, body: { messages: [{ status: { groupName: 'REJECTED' } }] } };
    const rejected = await read(await post(handleSend, { userId: uid(), phone: '0712345678' }, INFOBIP));
    assert.equal(rejected.status, 502);
    assert.equal(rejected.token, undefined);

    reply = { status: 401, body: {} };
    assert.equal((await read(await post(handleSend, { userId: uid(), phone: '0712345678' }, INFOBIP))).status, 502);
  });

  test("falls back to Africa's Talking when no Infobip key is set", async () => {
    atOk();
    const env = { ...AT, INFOBIP_BASE_URL: 'abc123.api.infobip.com' };
    await post(handleSend, { userId: uid(), phone: '0712345678' }, env);
    assert.match(calls[0].url, /africastalking/);
  });
});
