import { Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FullscreenButton } from '../components/StatusIndicators.tsx';
import { useTransportContext } from '../hooks/TransportProvider.tsx';
import { usePresenceRole } from '../hooks/useTransport.ts';

/** Projector kiosk: no admin or scoring controls (fullscreen toggle auto-hides on hover-out). */
export function StagePage() {
  usePresenceRole('stage');
  const { status } = useTransportContext();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="touch-route group relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-bg-primary [background:var(--surface-gradient)]">
      <div className="absolute top-4 right-4 opacity-0 transition-opacity group-hover:opacity-100">
        <FullscreenButton />
      </div>
      <Target size={96} className="text-accent-primary" aria-hidden />
      <h1 className="mt-6 font-display text-6xl font-bold tracking-wider uppercase">Darts Tournament Live</h1>
      <p className="mt-3 text-xl text-text-muted">Broadcast stage — waiting for the next match</p>
      <p className="mt-10 font-mono text-5xl text-accent-gold">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      <span
        className={`absolute bottom-4 left-4 h-2.5 w-2.5 rounded-full ${status === 'connected' ? 'bg-accent-success' : 'bg-accent-warning'}`}
        title={status}
      />
    </div>
  );
}
