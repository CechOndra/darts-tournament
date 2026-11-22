import type { TransportMode } from './types.ts';

export interface ResolvedTransportEnv {
  requestedMode: TransportMode;
  mode: TransportMode;
  tournamentId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  localServerUrl: string;
  /** Human-readable reason when the requested mode had to fall back. */
  fallbackReason: string | null;
}

export interface RawTransportEnv {
  VITE_TRANSPORT_MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_LOCAL_SERVER_URL?: string;
  VITE_TOURNAMENT_ID?: string;
}

/** Pure: resolve which transport to use from build-time env. */
export function resolveTransportEnv(env: RawTransportEnv, locationHost = 'localhost', protocol = 'http:'): ResolvedTransportEnv {
  const raw = (env.VITE_TRANSPORT_MODE ?? 'supabase').trim().toLowerCase();
  const requestedMode: TransportMode = raw === 'local' || raw === 'loopback' ? raw : 'supabase';
  const supabaseUrl = (env.VITE_SUPABASE_URL ?? '').trim();
  const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const localServerUrl = (env.VITE_LOCAL_SERVER_URL ?? '').trim() || `${protocol}//${locationHost}:3000`;
  const tournamentId = (env.VITE_TOURNAMENT_ID ?? '').trim() || 'main';

  let mode = requestedMode;
  let fallbackReason: string | null = null;
  if (requestedMode === 'supabase' && (!supabaseUrl || !supabaseAnonKey)) {
    mode = 'loopback';
    fallbackReason = 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — using same-browser loopback transport';
  }
  return { requestedMode, mode, tournamentId, supabaseUrl, supabaseAnonKey, localServerUrl, fallbackReason };
}
