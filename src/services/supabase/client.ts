import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const clients = new Map<string, SupabaseClient>();

/** One Supabase client per (url, key) for the whole page: shared by transport + control API. */
export function getSupabaseClient(url: string, anonKey: string): SupabaseClient {
  const key = `${url}|${anonKey}`;
  let client = clients.get(key);
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 30 } },
    });
    clients.set(key, client);
  }
  return client;
}
