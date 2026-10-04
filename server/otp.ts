/**
 * Server-side OTP for cashier sign-in (PEKASA STORE).
 *
 * Framework-agnostic: uses only Web standards (Request/Response/fetch/crypto.subtle) so the
 * same code runs as a Netlify Function and a Vercel Function (see netlify/functions and api/).
 *
 * How it works (stateless):
 *   send:   generate a 6-digit code -> SMS it to the cashier's phone through Africa's Talking ->
 *           return a signed token { uid, exp, nonce } + HMAC(secret, payload:code).
 *           The code itself is NEVER returned to the browser.
 *   verify: browser sends { token, code } -> we recompute the HMAC with the typed code and
 *           compare in constant time, and check expiry.
 *
 * Required environment variables:
 *   OTP_SECRET     long random string used to sign tokens
 *   AT_USERNAME    Africa's Talking username ("sandbox" for testing)
 *   AT_API_KEY     Africa's Talking API key
 * Optional:
 *   AT_SENDER_ID   approved alphanumeric sender id
 *   OTP_DEV_LOG    "true" to print the code in the server log when SMS is not configured (local dev only)
 */

export type Env = Record<string, string | undefined>;

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

// Best-effort abuse limits. Serverless instances are short-lived and not shared, so these only
// slow down casual abuse; they are not a substitute for server-side accounts (see README note).
const verifyAttempts = new Map<string, number>();
const lastSentAt = new Map<string, number>();

const enc = new TextEncoder();

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

const toB64Url = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64Url = (str: string): Uint8Array => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const hmac = async (secret: string, message: string): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
};

const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

/** Uniformly random 6-digit code from the CSPRNG. */
export const generateCode = (): string => {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000; // avoid modulo bias
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, '0');
};

/** "0727108749" | "+254727108749" | "254 727 108 749" -> "+254727108749", or null if not a Kenyan mobile. */
export const normalizeKenyanPhone = (raw: string): string | null => {
  let p = String(raw || '').replace(/[^0-9+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!/^254[17]\d{8}$/.test(p)) return null;
  return '+' + p;
};

const maskPhone = (e164: string): string => e164.slice(0, 7) + '•••' + e164.slice(-3);

const sendSms = async (env: Env, to: string, message: string): Promise<{ ok: boolean; error?: string }> => {
  const username = env.AT_USERNAME;
  const apiKey = env.AT_API_KEY;
  if (!username || !apiKey) return { ok: false, error: 'not_configured' };

  const base = username === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
  const form = new URLSearchParams({ username, to, message });
  if (env.AT_SENDER_ID) form.set('from', env.AT_SENDER_ID);

  try {
    const res = await fetch(`${base}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    if (!res.ok) return { ok: false, error: `gateway_${res.status}` };
    const data: any = await res.json().catch(() => null);
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    // Africa's Talking answers 201 even for rejected numbers; check the per-recipient status.
    if (!recipient || !/success|sent|queued/i.test(String(recipient.status))) {
      return { ok: false, error: 'rejected' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
};

/** POST { userId, phone, name? } -> { ok, token, maskedPhone } */
export async function handleSend(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  const secret = env.OTP_SECRET;
  if (!secret || secret.length < 16) return json({ ok: false, error: 'OTP service is not configured.' }, 503);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const userId = String(body?.userId || '').slice(0, 64);
  const phone = normalizeKenyanPhone(body?.phone);
  if (!userId) return json({ ok: false, error: 'Invalid request.' }, 400);
  if (!phone) {
    return json({ ok: false, error: 'No valid mobile number is saved for this account. Ask an administrator to update it.' }, 422);
  }

  const now = Date.now();
  if (now - (lastSentAt.get(userId) || 0) < RESEND_COOLDOWN_MS) {
    return json({ ok: false, error: 'A code was just sent. Please wait 30 seconds before requesting another.' }, 429);
  }

  const code = generateCode();
  const nonce = toB64Url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = toB64Url(enc.encode(JSON.stringify({ uid: userId, exp: now + OTP_TTL_MS, n: nonce })));
  const sig = toB64Url(await hmac(secret, `${payload}:${code}`));
  const token = `${payload}.${sig}`;

  const message = `PEKASA STORE: your sign-in code is ${code}. It expires in 10 minutes. Do not share it with anyone.`;
  const sms = await sendSms(env, phone, message);

  if (!sms.ok) {
    if (sms.error === 'not_configured' && env.OTP_DEV_LOG === 'true') {
      console.log(`[OTP_DEV_LOG] code for ${maskPhone(phone)}: ${code}`); // server log only, never sent to the browser
    } else {
      console.error(`[otp] SMS failed: ${sms.error}`);
      return json({ ok: false, error: 'Could not send the SMS code right now. Please try again or contact an administrator.' }, 502);
    }
  }

  lastSentAt.set(userId, now);
  return json({ ok: true, token, maskedPhone: maskPhone(phone) });
}

/** POST { token, code } -> { ok, userId } */
export async function handleVerify(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  const secret = env.OTP_SECRET;
  if (!secret || secret.length < 16) return json({ ok: false, error: 'OTP service is not configured.' }, 503);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const token = String(body?.token || '');
  const code = String(body?.code || '').trim();
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !/^\d{6}$/.test(code)) {
    return json({ ok: false, error: 'Invalid OTP code. Please enter the 6-digit code you received.' }, 400);
  }

  let data: { uid: string; exp: number; n: string };
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
  } catch {
    return json({ ok: false, error: 'OTP session invalid. Please sign in again.' }, 400);
  }

  if (Date.now() > data.exp) {
    return json({ ok: false, error: 'OTP code expired. Please sign in again to get a new code.' }, 410);
  }

  const tries = (verifyAttempts.get(data.n) || 0) + 1;
  verifyAttempts.set(data.n, tries);
  if (tries > MAX_VERIFY_ATTEMPTS) {
    return json({ ok: false, error: 'Too many wrong attempts. Please sign in again to get a new code.' }, 429);
  }

  const expected = await hmac(secret, `${payload}:${code}`);
  let provided: Uint8Array;
  try {
    provided = fromB64Url(sig);
  } catch {
    return json({ ok: false, error: 'OTP session invalid. Please sign in again.' }, 400);
  }

  if (!timingSafeEqual(expected, provided)) {
    return json({ ok: false, error: 'Invalid OTP code. Please enter the 6-digit code you received.' }, 401);
  }

  verifyAttempts.delete(data.n);
  return json({ ok: true, userId: data.uid });
}
