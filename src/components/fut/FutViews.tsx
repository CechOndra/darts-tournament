import { Download, MonitorUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { STAT_CODES, STAT_HELP, STAT_LABEL, type FutCard as FutCardData, type UltimateSlot } from '../../engine/stats.ts';
import type { TournamentState } from '../../engine/state.ts';
import { FutNameSwitch, futName, useFutNames } from '../../hooks/FutNames.tsx';
import { useDispatch } from '../../hooks/TransportProvider.tsx';
import { playerRole } from '../../hooks/useStats.ts';
import { downloadSvgAsPng } from '../../services/media/customAssets.ts';
import { Button, Field, Modal, Select } from '../ui.tsx';
import { FutCard } from './FutCard.tsx';
import { RadarChart } from './RadarChart.tsx';

/** Expandable "What the stats mean" (same pattern as the Power Card rules). */
export function StatsGuide({ state }: { state: TournamentState }) {
  const shown = new Set(state.settings.futCardAttributes);
  return (
    <details className="surface p-3">
      <summary className="cursor-pointer text-sm font-medium">What the card stats mean</summary>
      <div className="mt-3 space-y-3 text-sm">
        <ul className="space-y-2">
          {STAT_CODES.filter((c) => shown.has(c)).map((c) => (
            <li key={c}>
              <span className="font-mono font-bold text-accent-gold">{c}</span> <span className="font-semibold">{STAT_LABEL[c].name}</span>
              <span className="block text-xs text-text-muted">{STAT_HELP[c]}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-border-subtle pt-3 text-xs text-text-muted">
          <p>
            <span className="font-semibold text-text-primary">Ratings 55-99:</span> each stat is ranked against everyone else in the tournament. The best player gets 99,
            the lowest 55, the middle about 77.
          </p>
          <p>
            <span className="font-semibold text-text-primary">OVR:</span> the average of the 6 ratings. Frames: Bronze below 66, Silver 66+, Gold 77+, Icon 87+.
          </p>
          <p>
            <span className="font-semibold text-text-primary">Playstyle+:</span> named after the player's best stat.
          </p>
          <p>Visits changed by a Power Card are left out unless the host includes them. Cards update after every visit.</p>
        </div>
      </div>
    </details>
  );
}

/** FUT card for a player id (name, team, role, photo, logo looked up from state). */
export function FutCardFor({ state, card, className }: { state: TournamentState; card: FutCardData; className?: string }) {
  const { mode } = useFutNames(state);
  const p = state.players[card.playerId];
  const team = state.teams.find((t) => t.id === card.teamId);
  return <FutCard card={card} name={p ? futName(p, mode) : ''} teamName={team?.name ?? ''} role={playerRole(state, card.playerId)} avatar={p?.futPhotoDataUrl ?? p?.avatarDataUrl ?? null} teamLogo={team?.logoDataUrl} className={className} />;
}

/** Big card + radar with "compare with" (teammate by default), PNG download, and (admin) Project to Stage. */
export function FutDetail({ state, card, cards, onClose, admin = false }: { state: TournamentState; card: FutCardData; cards: FutCardData[]; onClose: () => void; admin?: boolean }) {
  const dispatch = useDispatch();
  const { mode } = useFutNames(state);
  const nameOf = (id: string) => (state.players[id] ? futName(state.players[id]!, mode) : '');
  const svgRef = useRef<SVGSVGElement>(null);
  const team = state.teams.find((t) => t.id === card.teamId);
  const mate = cards.find((c) => c.teamId === card.teamId && c.playerId !== card.playerId);
  const [compareId, setCompareId] = useState<string>(mate?.playerId ?? '');
  const compare = cards.find((c) => c.playerId === compareId) ?? null;
  const name = nameOf(card.playerId);
  return (
    <Modal title={`${name} · ${team?.name ?? ''}`} wide onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FutCard
          ref={svgRef}
          card={card}
          name={name}
          teamName={team?.name ?? ''}
          role={playerRole(state, card.playerId)}
          avatar={state.players[card.playerId]?.futPhotoDataUrl ?? state.players[card.playerId]?.avatarDataUrl ?? null}
          teamLogo={team?.logoDataUrl}
          className="mx-auto w-full max-w-xs"
        />
        <div className="min-w-0 space-y-3">
          <FutNameSwitch state={state} />
          <Field label="Compare with">
            {(id) => (
              <Select id={id} value={compareId} onChange={(e) => setCompareId(e.target.value)}>
                <option value="">Nobody</option>
                {cards
                  .filter((c) => c.playerId !== card.playerId)
                  .map((c) => (
                    <option key={c.playerId} value={c.playerId}>
                      {nameOf(c.playerId)} ({state.teams.find((t) => t.id === c.teamId)?.name})
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <RadarChart card={card} compare={compare} label={name} compareLabel={compare ? nameOf(compare.playerId) : undefined} />
          <StatsGuide state={state} />
          <div className="flex flex-wrap gap-2">
            <Button icon={Download} onClick={() => svgRef.current && void downloadSvgAsPng(svgRef.current, `${name.replace(/\W+/g, '_') || 'player'}_fut.png`, 2)}>
              Download Card as PNG
            </Button>
            {admin && (
              <Button variant="gold" icon={MonitorUp} onClick={() => void dispatch({ type: 'SET_STAGE_OVERLAY', overlay: { kind: 'FUT', playerId: card.playerId } }, { persist: 'immediate' })}>
                Project to Stage
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Grid of FUT cards; tapping one opens the detail with the radar chart. */
export function FutGallery({ state, cards, columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5', admin = false, highlightTeam }: { state: TournamentState; cards: FutCardData[]; columns?: string; admin?: boolean; highlightTeam?: string | null }) {
  const [detail, setDetail] = useState<string | null>(null);
  const { mode } = useFutNames(state);
  const nameOf = (id: string) => (state.players[id] ? futName(state.players[id]!, mode) : '');
  const card = cards.find((c) => c.playerId === detail);
  return (
    <>
      <div className={`grid gap-3 ${columns}`}>
        {cards.map((c) => (
          <button
            key={c.playerId}
            type="button"
            onClick={() => setDetail(c.playerId)}
            aria-label={`Open ${nameOf(c.playerId)} card and radar chart`}
            className={`rounded-lg transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-accent-gold ${highlightTeam && c.teamId === highlightTeam ? 'ring-2 ring-accent-gold' : ''}`}
          >
            <FutCardFor state={state} card={c} className="w-full" />
          </button>
        ))}
      </div>
      {card && <FutDetail state={state} card={card} cards={cards} admin={admin} onClose={() => setDetail(null)} />}
    </>
  );
}

/** Ultimate Team: one card per stat spot. size xl = stage. */
export function UltimateTeamView({ state, team, size = 'md', onOpen }: { state: TournamentState; team: UltimateSlot[]; size?: 'md' | 'xl'; onOpen?: (playerId: string) => void }) {
  const xl = size === 'xl';
  const { mode } = useFutNames(state);
  const nameOf = (id: string) => (state.players[id] ? futName(state.players[id]!, mode) : '');
  return (
    <div className={`grid gap-3 ${xl ? 'h-full grid-cols-6 items-center gap-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
      {team.map((slot) => (
        <div key={slot.code} className="flex min-w-0 flex-col items-center gap-2">
          <p className={`text-center font-display tracking-widest text-accent-gold uppercase ${xl ? 'text-2xl' : 'text-xs'}`}>
            Best {STAT_LABEL[slot.code].short}
            <span className={`block text-text-muted normal-case ${xl ? 'text-lg' : 'text-[10px]'}`}>{STAT_LABEL[slot.code].name}</span>
          </p>
          {slot.card ? (
            onOpen ? (
              <button type="button" className="w-full rounded-lg focus-visible:ring-2 focus-visible:ring-accent-gold" onClick={() => onOpen(slot.card!.playerId)} aria-label={`Open ${nameOf(slot.card.playerId)}`}>
                <FutCardFor state={state} card={slot.card} className="w-full" />
              </button>
            ) : (
              <FutCardFor state={state} card={slot.card} className="w-full" />
            )
          ) : (
            <p className="text-xs text-text-muted">Not enough players yet</p>
          )}
        </div>
      ))}
    </div>
  );
}
