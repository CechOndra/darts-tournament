import { usePresenceRole } from '../hooks/useTransport.ts';

/** Projection-mapping canvas: pure black by design (Milestone 6). */
export function BoardMapPage() {
  usePresenceRole('board-map');
  return (
    <div className="flex h-dvh items-center justify-center bg-black text-sm text-text-muted">
      Board projection mapping — Milestone 6
    </div>
  );
}
