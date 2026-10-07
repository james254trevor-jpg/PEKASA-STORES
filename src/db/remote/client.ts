/**
 * Small Supabase client (PostgREST + Auth refresh) using only fetch, so it needs no extra package and
 * can be tested without a network. Every call carries the signed-in user's token, so the database's
 * row-level security (branches, roles, SMS gate) decides what the user can see and change.
 */
import type { RemoteConfig } from './config.ts';

export interface Session {
  access_token: string;
  refresh_token: string;
  /** seconds since epoch */
  expires_at: number;
}

export interface SessionStore {
  get(): Session | null;
  set(s: Session | null): void;
}

/** Tab-scoped storage: a staff computer forgets the session when the tab/browser closes. */
export const browserSessionStore = (key = 'pekasa.session'): SessionStore => ({
  get() {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  set(s) {
    try {
      if (s) sessionStorage.setItem(key, JSON.stringify(s));
      else sessionStorage.removeItem(key);
    } catch {
      /* storage blocked: the session just lives in memory */
    }
  }
});

export class RemoteError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ClientOptions {
  fetch?: typeof fetch;
  store?: SessionStore;
  /** milliseconds; injectable for tests */
  now?: () => number;
}

export class RemoteClient {
  private session: Session | null;
  private refreshing: Promise<Session | null> | null = null;
  private f: typeof fetch;
  private store: SessionStore;
  private now: () => number;
  private cfg: RemoteConfig;

  constructor(cfg: RemoteConfig, opts: ClientOptions = {}) {
    this.cfg = cfg;
    this.f = opts.fetch ?? ((...a) => fetch(...a));
    this.store = opts.store ?? { get: () => null, set: () => undefined };
    this.now = opts.now ?? Date.now;
    this.session = this.store.get();
  }

  hasSession(): boolean {
    return !!this.session;
  }

  setSession(s: Session | null) {
    this.session = s;
    this.store.set(s);
  }

  /** Ask Supabase Auth for a fresh token. Needed after the SMS step, which adds the otp_ok claim. */
  refresh(): Promise<Session | null> {
    if (!this.session) return Promise.resolve(null);
    if (!this.refreshing) {
      const rt = this.session.refresh_token;
      this.refreshing = (async () => {
        try {
          const res = await this.f(`${this.cfg.url}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { apikey: this.cfg.anonKey, 'content-type': 'application/json' },
            body: JSON.stringify({ refresh_token: rt })
          });
          if (!res.ok) {
            this.setSession(null);
            return null;
          }
          const d: any = await res.json();
          const s: Session = {
            access_token: d.access_token,
            refresh_token: d.refresh_token,
            expires_at: d.expires_at ?? Math.floor(this.now() / 1000) + Number(d.expires_in || 3600)
          };
          this.setSession(s);
          return s;
        } catch {
          return this.session; // offline: keep what we have, the next call will fail visibly
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }

  /** Current access token (refreshed first if it is about to expire). */
  async accessToken(): Promise<string | null> {
    if (!this.session) return null;
    if (this.session.expires_at - Math.floor(this.now() / 1000) < 60) await this.refresh();
    return this.session?.access_token ?? null;
  }

  signOut() {
    const token = this.session?.access_token;
    this.setSession(null);
    if (token) {
      this.f(`${this.cfg.url}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: this.cfg.anonKey, Authorization: `Bearer ${token}` }
      }).catch(() => undefined);
    }
  }

  private async call(path: string, init: { method: string; body?: unknown; prefer?: string }, retried = false): Promise<any> {
    const token = await this.accessToken();
    if (!token) throw new RemoteError(401, 'Please sign in again.');
    const res = await this.f(`${this.cfg.url}/rest/v1/${path}`, {
      method: init.method,
      headers: {
        apikey: this.cfg.anonKey,
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(init.prefer ? { Prefer: init.prefer } : {})
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
    if (res.status === 401 && !retried) {
      const s = await this.refresh();
      if (s) return this.call(path, init, true);
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new RemoteError(res.status, data?.message || 'Request failed', data?.code);
    return data;
  }

  /** `query` is PostgREST syntax, e.g. "select=*&order=created_at.desc&id=eq.cus-1" */
  select<T>(table: string, query = 'select=*'): Promise<T[]> {
    return this.call(`${table}?${query}`, { method: 'GET' });
  }

  async insert<T>(table: string, row: Record<string, unknown>): Promise<T> {
    const rows = await this.call(table, { method: 'POST', body: row, prefer: 'return=representation' });
    return rows[0];
  }

  async update<T>(table: string, filter: string, patch: Record<string, unknown>): Promise<T[]> {
    return this.call(`${table}?${filter}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  }

  rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.call(`rpc/${name}`, { method: 'POST', body: args });
  }
}
