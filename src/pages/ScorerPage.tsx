import { Crosshair } from 'lucide-react';
import { Placeholder, RouteHeader } from '../components/RouteHeader.tsx';
import { ConnectionBadge, FullscreenButton, PingIndicator } from '../components/StatusIndicators.tsx';
import { usePresenceRole } from '../hooks/useTransport.ts';

/** 16:9 landscape tablet: zero-scroll split grid (scoreboard + cards left, keypad right). */
export function ScorerPage() {
  usePresenceRole('scorer');
  return (
    <div className="touch-route flex h-dvh flex-col overflow-hidden bg-bg-primary">
      <RouteHeader
        icon={Crosshair}
        title="Table Scorer"
        subtitle="PIN-protected live scoring"
        actions={
          <>
            <PingIndicator />
            <ConnectionBadge />
            <FullscreenButton />
          </>
        }
      />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <section className="surface flex min-h-0 flex-col p-4">
          <h2 className="font-display text-sm tracking-widest text-text-muted uppercase">Scoreboard & Power Cards</h2>
          <div className="mt-3 flex-1">
            <Placeholder milestone={3}>Live scoreboard, checkout routes and owned Power Cards render here.</Placeholder>
          </div>
        </section>
        <section className="surface flex min-h-0 flex-col p-4">
          <h2 className="font-display text-sm tracking-widest text-text-muted uppercase">Dart Keypad</h2>
          <div className="mt-3 flex-1">
            <Placeholder milestone={3}>1-tap per-dart keypad (48 px+ targets) with Undo Last Dart.</Placeholder>
          </div>
        </section>
      </main>
    </div>
  );
}
