import { displayName } from '../../engine/selectors.ts';
import { Megaphone, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { QrCode as QrImage } from '../../components/JoinQr.tsx';
import { AwardCard } from '../../components/fut/AwardCard.tsx';
import { RadarChart } from '../../components/fut/RadarChart.tsx';
import type { MatchView } from '../../engine/match.ts';
import { CROWD_SOUNDS, GLOBAL_COOLDOWN_MS, soundboardLock, type CrowdSound } from '../../engine/soundboard.ts';
import type { TournamentState } from '../../engine/state.ts';
import { useTransportContext } from '../../hooks/TransportProvider.tsx';
import { useTournamentStats } from '../../hooks/useStats.ts';
import { playCrowdSound } from '../../services/audio/sound.ts';
import { appUrl } from '../../services/links.ts';
import { CROWD_EVENT, type CrowdSoundEvent } from '../../services/soundboardOps.ts';
import { FutCardFor, UltimateTeamView } from '../../components/fut/FutViews.tsx';
import { ultimateTeam } from '../../engine/stats.ts';

/** Join QR code: guests scan it to open the companion on their phone. */
export function JoinQr({ size = 200 }: { size?: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-bg-surface p-4">
      <QrImage url={appUrl('')} size={size} label="QR code to join on your phone" />
      <div className="max-w-56 space-y-1">
        <p className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
          <QrCode size={24} aria-hidden /> Join on your phone
        </p>
        <p className="text-lg text-text-muted">Live scores, schedule, cards and the crowd soundboard.</p>
      </div>
    </div>
  );
}

/** Admin-projected award / FUT card spotlight. */
export function StageOverlayView({ state }: { state: TournamentState }) {
  const stats = useTournamentStats(state);
  const overlay = state.stageOverlay ?? null;
  if (!overlay || !stats) return null;
  if (overlay.kind === 'QR') {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10 rounded-lg bg-bg-primary/95">
        <p className="font-display text-7xl tracking-wide uppercase">Join on your phone</p>
        <QrImage url={appUrl('')} size={560} label="QR code to join on your phone" />
        <p className="text-3xl text-text-muted">Open your camera and point it at the code</p>
      </div>
    );
  }
  if (overlay.kind === 'AWARD') {
    const award = stats.awards.find((a) => a.id === overlay.awardId);
    if (!award) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-bg-primary/95 p-10">
        <div className="w-full max-w-5xl">
          <AwardCard state={state} award={award} size="xl" />
        </div>
      </div>
    );
  }
  if (overlay.kind === 'ULTIMATE') return <UltimateTeamStage state={state} />;
  const card = stats.cards.find((c) => c.playerId === overlay.playerId);
  if (!card) return null;
  const mate = stats.cards.find((c) => c.teamId === card.teamId && c.playerId !== card.playerId) ?? null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center gap-16 rounded-lg bg-bg-primary/95 p-10">
      <FutCardFor state={state} card={card} className="h-full max-h-[52rem] w-auto" />
      <div className="flex flex-col items-center gap-4">
        <RadarChart
          card={card}
          compare={mate}
          size={520}
          label={state.players[card.playerId] && displayName(state.players[card.playerId]!)}
          compareLabel={mate ? state.players[mate.playerId]?.name : undefined}
        />
      </div>
    </div>
  );
}

/** Plays guest soundboard requests on the stage speakers (lock + 4 s global cooldown enforced here). */
export function CrowdSoundPlayer({ state, view }: { state: TournamentState; view: MatchView | null }) {
  const { transport } = useTransportContext();
  const last = useRef(0);
  const lockRef = useRef<string | null>(null);
  lockRef.current = soundboardLock(state, view);
  const [toast, setToast] = useState<CrowdSound | null>(null);

  useEffect(
    () =>
      transport.onLiveEvent((e) => {
        if (e.type !== CROWD_EVENT) return;
        const { sound } = e.payload as CrowdSoundEvent;
        const now = Date.now();
        if (lockRef.current || now - last.current < GLOBAL_COOLDOWN_MS) return;
        if (!CROWD_SOUNDS.some((s) => s.id === sound)) return;
        last.current = now;
        playCrowdSound(sound);
        setToast(sound);
      }),
    [transport],
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none absolute top-24 right-8 z-40 flex items-center gap-3 rounded-lg border border-accent-gold/60 bg-bg-elevated px-5 py-3 font-display text-2xl tracking-wide uppercase">
      <Megaphone size={28} className="text-accent-gold" aria-hidden />
      {CROWD_SOUNDS.find((s) => s.id === toast)?.label}
    </div>
  );
}

function UltimateTeamStage({ state }: { state: TournamentState }) {
  const stats = useTournamentStats(state);
  if (!stats) return null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col gap-8 rounded-lg bg-bg-primary/95 p-10">
      <p className="text-center font-display text-7xl tracking-wide text-accent-gold uppercase">Ultimate Team</p>
      <div className="min-h-0 flex-1">
        <UltimateTeamView state={state} team={ultimateTeam(state, stats.cards)} size="xl" />
      </div>
    </div>
  );
}
