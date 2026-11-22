/**
 * Wire protocol shared by every transport. server/index.js mirrors these strings
 * exactly — keep them in sync.
 */
import type { StateEnvelope } from './types.ts';

/** Supabase Realtime Broadcast event names (one channel per tournament). */
export const BROADCAST_EVENTS = {
  STATE_SYNC: 'state_sync',
  /** Sent instead of STATE_SYNC when the snapshot is too large to inline; receivers re-fetch from Postgres. */
  STATE_HINT: 'state_hint',
  LIVE_EVENT: 'live_event',
  PING: 'ping',
} as const;

/** Socket.io event names for the optional LAN relay. */
export const SOCKET_EVENTS = {
  JOIN: 'session:join',
  STATE_PUSH: 'state:push',
  STATE_SYNC: 'state:sync',
  LIVE_EMIT: 'live:emit',
  LIVE_EVENT: 'live:event',
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_SYNC: 'presence:sync',
  THROWS_APPEND: 'throws:append',
  PING: 'latency:ping',
  CONTROL_RPC: 'control:rpc',
  CONTROL_ACTIVE: 'control:active',
} as const;

export const channelName = (tournamentId: string) => `tournament:${tournamentId}`;

/**
 * Supabase Broadcast payloads are size-limited; snapshots carrying player photos
 * (avatarDataUrl ~20 KB each) can exceed it. Above this we persist + send a hint.
 */
export const INLINE_STATE_MAX_BYTES = 180_000;

export function payloadBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function shouldInlineState(envelope: StateEnvelope<unknown>): boolean {
  return payloadBytes(envelope) <= INLINE_STATE_MAX_BYTES;
}

export type VersionStamp = Pick<StateEnvelope<unknown>, 'version' | 'updatedAt' | 'originClientId'>;

/**
 * Deterministic ordering so every client converges on the same snapshot even if
 * two devices dispatch concurrently at the same version.
 */
export function isNewer(candidate: VersionStamp, current: VersionStamp | null): boolean {
  if (!current) return true;
  if (candidate.version !== current.version) return candidate.version > current.version;
  if (candidate.updatedAt !== current.updatedAt) return candidate.updatedAt > current.updatedAt;
  return candidate.originClientId > current.originClientId;
}
