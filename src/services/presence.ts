import type { PresenceMeta } from './transport/types.ts';

/** Unlocked /#/scorer sessions currently connected (intrusion alert when > 1). */
export function countActiveScorers(peers: PresenceMeta[]): number {
  return peers.filter((p) => p.role === 'scorer' && p.unlocked).length;
}

export function countByRole(peers: PresenceMeta[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of peers) out[p.role] = (out[p.role] ?? 0) + 1;
  return out;
}
