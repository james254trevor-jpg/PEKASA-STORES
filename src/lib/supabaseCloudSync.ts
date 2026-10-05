import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig';

const SESSION_KEY = 'pekasa_supabase_session_v1';
const DEVICE_KEY = 'pekasa_supabase_device_v1';
const TABLE_URL = SUPABASE_URL + '/rest/v1/pekasa_store_snapshots';

export type CloudUser = { id: string; email?: string };
export type CloudSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: CloudUser;
};
type SnapshotRow = {
  user_id: string;
  snapshot_base64?: string;
  device_id: string;
  updated_at: string;
};
type Conflict = { localBytes: Uint8Array; remoteBytes: Uint8Array; updatedAt: string };
type Status = 'signed-out' | 'ready' | 'syncing' | 'synced' | 'error' | 'conflict';

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function decodeBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

class SupabaseCloudSync {
  private session: CloudSession | null = null;
  private deviceId = '';
  private timer: number | null = null;
  private pollTimer: number | null = null;
  private pendingBytes: Uint8Array | null = null;
  private lastRemoteUpdatedAt: string | null = null;
  private lastLocalWriteAt: string | null = null;
  private conflict: Conflict | null = null;
  private applyingRemote = false;
  private uploadInProgress = false;
  private applyRemote: ((bytes: Uint8Array) => Promise<void>) | null = null;
  private readLocal: (() => Uint8Array) | null = null;
  private status: Status = 'signed-out';
  private errorMessage = '';
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): { status: Status; error: string; conflict: boolean; email: string } {
    return {
      status: this.status,
      error: this.errorMessage,
      conflict: !!this.conflict,
      email: this.session?.user.email || '',
    };
  }

  private setState(status: Status, error = '') {
    this.status = status;
    this.errorMessage = error;
    this.listeners.forEach((listener) => listener());
  }

  private getDeviceId(): string {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'device-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  private storeSession(session: CloudSession | null) {
    this.session = session;
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }

  private async authRequest(path: string, body: Record<string, unknown>): Promise<any> {
    const response = await fetch(SUPABASE_URL + '/auth/v1/' + path, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.msg || result.message || result.error_description || result.error || 'Supabase sign-in failed.');
    return result;
  }

  private parseSession(result: any): CloudSession | null {
    if (!result?.access_token || !result?.refresh_token || !result?.user?.id) return null;
    return {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: result.expires_at || Math.floor(Date.now() / 1000) + (result.expires_in || 3600),
      user: { id: result.user.id, email: result.user.email },
    };
  }

  async signIn(email: string, password: string): Promise<CloudSession> {
    const result = await this.authRequest('token?grant_type=password', { email, password });
    const session = this.parseSession(result);
    if (!session) throw new Error('No session was returned. Check your email confirmation settings and try signing in again.');
    this.storeSession(session);
    return session;
  }

  async signUp(email: string, password: string): Promise<CloudSession | null> {
    const result = await this.authRequest('signup', { email, password });
    const session = this.parseSession(result);
    if (session) this.storeSession(session);
    return session;
  }

  async restoreSession(): Promise<CloudSession | null> {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const session = JSON.parse(stored) as CloudSession;
      if (!session?.refresh_token || !session?.user?.id) return null;
      this.storeSession(session);
      if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
      const refreshed = await this.authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      const nextSession = this.parseSession(refreshed);
      if (!nextSession) throw new Error('Supabase session refresh did not return a session.');
      this.storeSession(nextSession);
      return nextSession;
    } catch {
      this.storeSession(null);
      return null;
    }
  }

  async signOut(): Promise<void> {
    const session = this.session;
    this.stopLiveSync();
    this.storeSession(null);
    if (session) {
      await fetch(SUPABASE_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + session.access_token },
      }).catch(() => undefined);
    }
    this.setState('signed-out');
  }

  private async ensureFreshSession(): Promise<CloudSession> {
    if (!this.session) throw new Error('Sign in to the store account to sync data.');
    if (this.session.expires_at > Math.floor(Date.now() / 1000) + 60) return this.session;
    const result = await this.authRequest('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token });
    const refreshed = this.parseSession(result);
    if (!refreshed) throw new Error('Supabase session expired. Sign in again.');
    this.storeSession(refreshed);
    return refreshed;
  }

  private async requestRows(includeSnapshot = true): Promise<SnapshotRow[]> {
    const session = await this.ensureFreshSession();
    const url = new URL(TABLE_URL);
    url.searchParams.set('select', includeSnapshot ? 'user_id,snapshot_base64,device_id,updated_at' : 'user_id,device_id,updated_at');
    url.searchParams.set('user_id', 'eq.' + session.user.id);
    const response = await fetch(url.toString(), {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + session.access_token },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.details || 'Could not read the store snapshot. Apply the Supabase SQL setup first.');
    return result as SnapshotRow[];
  }

  async loadInitialSnapshot(): Promise<Uint8Array | null> {
    const rows = await this.requestRows();
    const row = rows[0];
    this.lastRemoteUpdatedAt = row?.updated_at || null;
    if (!row) return null;
    return decodeBytes(row.snapshot_base64);
  }

  startLiveSync(applyRemote: (bytes: Uint8Array) => Promise<void>, readLocal: () => Uint8Array) {
    this.stopLiveSync();
    this.applyRemote = applyRemote;
    this.readLocal = readLocal;
    this.deviceId = this.getDeviceId();
    this.setState('ready');
    this.pollTimer = window.setInterval(() => void this.pollRemote(), 3000);
    void this.pollRemote();
    if (!this.lastRemoteUpdatedAt) this.queueUpload(readLocal());
  }

  stopLiveSync() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    this.timer = null;
    this.pollTimer = null;
    this.pendingBytes = null;
    this.conflict = null;
    this.applyRemote = null;
    this.readLocal = null;
  }

  queueUpload(bytes: Uint8Array) {
    if (!this.session || !this.readLocal || this.applyingRemote) return;
    this.pendingBytes = bytes.slice();
    this.setState('syncing');
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flushUpload(false), 700);
  }

  async retryPending(): Promise<void> {
    if (this.pendingBytes && !this.conflict) await this.flushUpload(false);
    else await this.pollRemote();
  }

  private async flushUpload(force: boolean) {
    if (!this.session || !this.pendingBytes || this.conflict || this.uploadInProgress) return;
    this.uploadInProgress = true;
    const bytes = this.pendingBytes;
    this.pendingBytes = null;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    try {
      if (!force) {
        const rows = await this.requestRows(false);
        const latest = rows[0];
        if (latest && this.lastRemoteUpdatedAt && latest.updated_at !== this.lastRemoteUpdatedAt && latest.device_id !== this.deviceId) {
          const fullRows = await this.requestRows(true);
          const current = fullRows[0];
          if (!current || current.updated_at !== latest.updated_at) return;
          this.pendingBytes = bytes;
          await this.createConflict(current, bytes);
          return;
        }
        if (latest && !this.lastRemoteUpdatedAt) this.lastRemoteUpdatedAt = latest.updated_at;
      }
      const session = await this.ensureFreshSession();
      const response = await fetch(TABLE_URL + '?on_conflict=user_id', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          user_id: session.user.id,
          snapshot_base64: encodeBytes(bytes),
          device_id: this.deviceId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Could not save the store snapshot.');
      this.lastRemoteUpdatedAt = result[0]?.updated_at || this.lastRemoteUpdatedAt;
      this.lastLocalWriteAt = this.lastRemoteUpdatedAt;
      this.setState('synced');
    } catch (error) {
      this.pendingBytes = bytes;
      this.setState('error', error instanceof Error ? error.message : 'Cloud sync failed.');
    } finally {
      this.uploadInProgress = false;
    }
  }

  private async createConflict(remote: SnapshotRow, localBytes: Uint8Array) {
    this.conflict = {
      localBytes: localBytes.slice(),
      remoteBytes: decodeBytes(remote.snapshot_base64 || ''),
      updatedAt: remote.updated_at,
    };
    this.setState('conflict');
  }

  private async pollRemote() {
    if (!this.session || !this.applyRemote || this.conflict || this.uploadInProgress) return;
    if (this.pendingBytes && this.timer === null && this.status === 'error') {
      await this.flushUpload(false);
      return;
    }
    try {
      const rows = await this.requestRows(false);
      const metadata = rows[0];
      if (!metadata) return;
      if (metadata.updated_at === this.lastRemoteUpdatedAt) return;
      if (metadata.device_id === this.deviceId) {
        this.lastRemoteUpdatedAt = metadata.updated_at;
        this.setState('synced');
        return;
      }
      const fullRows = await this.requestRows(true);
      const remote = fullRows[0];
      if (!remote || remote.updated_at !== metadata.updated_at || !remote.snapshot_base64) return;
      const localChangedAfterRemote = this.lastLocalWriteAt && Date.parse(remote.updated_at) > Date.parse(this.lastLocalWriteAt);
      if (this.pendingBytes || localChangedAfterRemote) {
        await this.createConflict(remote, this.pendingBytes || (this.readLocal ? this.readLocal() : new Uint8Array()));
        return;
      }
      this.applyingRemote = true;
      try {
        await this.applyRemote(decodeBytes(remote.snapshot_base64));
      } finally {
        this.applyingRemote = false;
      }
      this.lastRemoteUpdatedAt = remote.updated_at;
      this.setState('synced');
    } catch (error) {
      this.setState('error', error instanceof Error ? error.message : 'Could not refresh the cloud snapshot.');
    }
  }

  async useCloudVersion(): Promise<void> {
    if (!this.conflict || !this.applyRemote) return;
    const conflict = this.conflict;
    this.applyingRemote = true;
    try {
      await this.applyRemote(conflict.remoteBytes);
    } finally {
      this.applyingRemote = false;
    }
    this.lastRemoteUpdatedAt = conflict.updatedAt;
    this.lastLocalWriteAt = null;
    this.conflict = null;
    this.pendingBytes = null;
    this.setState('synced');
  }

  async keepThisDeviceVersion(): Promise<void> {
    if (!this.conflict) return;
    const conflict = this.conflict;
    this.lastRemoteUpdatedAt = conflict.updatedAt;
    this.pendingBytes = conflict.localBytes;
    this.conflict = null;
    this.setState('syncing');
    await this.flushUpload(true);
  }
}

export const supabaseCloudSync = new SupabaseCloudSync();
