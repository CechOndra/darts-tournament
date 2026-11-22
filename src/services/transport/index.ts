import { resolveTransportEnv, type ResolvedTransportEnv } from './config.ts';
import type { TournamentTransport, TransportConfig } from './types.ts';

export * from './types.ts';
export { resolveTransportEnv } from './config.ts';
export type { ResolvedTransportEnv } from './config.ts';

export function readTransportEnv(): ResolvedTransportEnv {
  const loc = typeof window !== 'undefined' ? window.location : undefined;
  return resolveTransportEnv(import.meta.env, loc?.hostname, loc?.protocol);
}

/**
 * Factory: the only place that knows which concrete transport is in use.
 * Each backend is a separate lazily-loaded chunk, so guests on mobile data only
 * download the client library actually needed (Supabase OR Socket.io).
 */
export async function createTransport<S, A>(
  config: Omit<TransportConfig<S, A>, 'tournamentId'> & { tournamentId?: string },
  env: ResolvedTransportEnv = readTransportEnv(),
): Promise<TournamentTransport<S, A>> {
  const full: TransportConfig<S, A> = { ...config, tournamentId: config.tournamentId ?? env.tournamentId };
  if (env.fallbackReason) console.info(`[transport] ${env.fallbackReason}`);
  switch (env.mode) {
    case 'supabase': {
      const { SupabaseTransport } = await import('./SupabaseTransport.ts');
      return new SupabaseTransport(full, { url: env.supabaseUrl, anonKey: env.supabaseAnonKey });
    }
    case 'local': {
      const { LocalSocketTransport } = await import('./LocalSocketTransport.ts');
      return new LocalSocketTransport(full, { url: env.localServerUrl });
    }
    case 'loopback': {
      const { LoopbackTransport } = await import('./LoopbackTransport.ts');
      return new LoopbackTransport(full);
    }
  }
}
