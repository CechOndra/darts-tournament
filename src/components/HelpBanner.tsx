import { AlertTriangle, Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatClock } from '../engine/pace.ts';
import type { TournamentState } from '../engine/state.ts';
import { useTransportContext } from '../hooks/TransportProvider.tsx';
import { playAlert } from '../services/audio/sound.ts';
import { HELP_RING_EVENT, resolveHelp } from '../services/tableOps.ts';
import { Button } from './ui.tsx';

/** Plays the alert when the table calls (new request or "Ring again"). */
export function useHelpAlert(state: TournamentState | null): void {
  const { transport } = useTransportContext();
  const at = state?.helpRequest?.at ?? null;
  const seen = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const prev = seen.current;
    seen.current = at;
    if (prev !== undefined && at && at !== prev) playAlert();
  }, [at]);
  useEffect(() => transport.onLiveEvent((e) => e.type === HELP_RING_EVENT && playAlert()), [transport]);
}

/** "Admin needed at the table" banner. size xl = stage; md = admin (with Resolved). */
export function HelpBanner({ state, size = 'md' }: { state: TournamentState; size?: 'md' | 'xl' }) {
  const { transport } = useTransportContext();
  const help = state.helpRequest;
  if (!help) return null;
  const xl = size === 'xl';
  return (
    <div
      role="alert"
      className={`flex items-center gap-4 rounded-lg bg-accent-warning font-display font-bold tracking-wide text-text-inverse uppercase ${
        xl ? 'px-8 py-4 text-4xl' : 'px-4 py-3 text-base'
      }`}
    >
      <AlertTriangle size={xl ? 48 : 22} className="shrink-0 animate-pulse" aria-hidden />
      <span className="min-w-0 flex-1">Admin needed at the table</span>
      <span className={`shrink-0 font-mono normal-case ${xl ? 'text-2xl' : 'text-xs'}`}>since {formatClock(help.at)}</span>
      {!xl && (
        <Button size="sm" icon={Check} onClick={() => void resolveHelp(transport)}>
          Resolved
        </Button>
      )}
    </div>
  );
}
