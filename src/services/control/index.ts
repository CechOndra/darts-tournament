import type { ResolvedTransportEnv } from '../transport/config.ts';
import type { ControlApi } from './types.ts';

export * from './types.ts';

/** Lazily loads the control backend matching the transport mode. */
export async function createControlApi(env: ResolvedTransportEnv): Promise<ControlApi> {
  switch (env.mode) {
    case 'supabase': {
      const { SupabaseControlApi } = await import('./SupabaseControlApi.ts');
      return new SupabaseControlApi(env.supabaseUrl, env.supabaseAnonKey);
    }
    case 'local': {
      const { LocalControlApi } = await import('./LocalControlApi.ts');
      return new LocalControlApi(env.localServerUrl);
    }
    case 'loopback': {
      const { LoopbackControlApi } = await import('./LoopbackControlApi.ts');
      return new LoopbackControlApi();
    }
  }
}
