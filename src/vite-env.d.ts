/// <reference types="vite/client" />

/** Build id injected by vite.config.ts (compared with version.json to detect new deployments). */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TRANSPORT_MODE?: string;
  readonly VITE_LOCAL_SERVER_URL?: string;
  readonly VITE_TOURNAMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
