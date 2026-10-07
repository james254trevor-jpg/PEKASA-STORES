/**
 * Browser side of the Supabase sign-in (talks to /api/auth/*, see server/auth.ts).
 * Staff never see or type a code the browser could read: the server texts it to their phone.
 */
import type { RemoteClient, Session } from './client.ts';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

type Post = (action: string, body: unknown, bearer?: string | null) => Promise<any>;

export const makePost =
  (f: typeof fetch = (...a) => fetch(...a)): Post =>
  async (action, body, bearer) => {
    try {
      const res = await f(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify(body ?? {})
      });
      const data = await res.json().catch(() => null);
      if (data && typeof data.ok === 'boolean') return data;
      return { ok: false, error: 'The sign-in service is unavailable. Please try again shortly.' };
    } catch {
      return { ok: false, error: 'Could not reach the sign-in service. Check your internet connection.' };
    }
  };

export class RemoteAuth {
  private client: RemoteClient;
  private post: Post;

  constructor(client: RemoteClient, post: Post = makePost()) {
    this.client = client;
    this.post = post;
  }

  /** Step 1. For a cashier, `otpRequired` is true and the session stays locked out by the database. */
  async login(email: string, password: string): Promise<AuthResult & { otpRequired?: boolean }> {
    const r = await this.post('login', { email, password });
    if (!r.ok) return { ok: false, error: r.error };
    this.client.setSession(r.session as Session);
    return { ok: true, otpRequired: !!r.otpRequired };
  }

  /** Step 2 (cashiers): the server texts a code to the number saved on the account. */
  async sendCode(): Promise<AuthResult & { token?: string; maskedPhone?: string }> {
    const r = await this.post('otp-send', {}, await this.client.accessToken());
    return r.ok ? { ok: true, token: r.token, maskedPhone: r.maskedPhone } : { ok: false, error: r.error };
  }

  /** Step 3: check the typed code; on success get a fresh token that carries the verified mark. */
  async verifyCode(token: string, code: string): Promise<AuthResult> {
    const r = await this.post('otp-verify', { token, code }, await this.client.accessToken());
    if (!r.ok) return { ok: false, error: r.error };
    const s = await this.client.refresh();
    return s ? { ok: true } : { ok: false, error: 'Could not finish signing in. Please sign in again.' };
  }

  signOut() {
    this.client.signOut();
  }

  createStaff(fields: Record<string, unknown>) {
    return this.admin('staff-create', fields);
  }

  resetPassword(userId: string, password: string) {
    return this.admin('staff-reset-password', { userId, password });
  }

  private async admin(action: string, body: unknown): Promise<AuthResult & { user?: any }> {
    const r = await this.post(action, body, await this.client.accessToken());
    return r.ok ? { ok: true, user: r.user } : { ok: false, error: r.error };
  }
}
