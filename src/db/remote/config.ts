/**
 * The Supabase switch. OFF unless all three settings are present, so the app keeps running on the
 * browser database exactly as before until the conversion is complete and the data is imported.
 *
 *   VITE_USE_SUPABASE=true
 *   VITE_SUPABASE_URL=https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon / publishable key>   (public by design; row-level security protects the data)
 */
export interface RemoteConfig {
  url: string;
  anonKey: string;
}

type Env = Record<string, string | undefined>;

export const remoteConfig = (env: Env): RemoteConfig | null => {
  if (String(env.VITE_USE_SUPABASE || '').toLowerCase() !== 'true') return null;
  const url = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) || !anonKey) return null;
  return { url, anonKey };
};
