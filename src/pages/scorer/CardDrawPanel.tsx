import { Gift, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PowerCard } from '../../components/cards/PowerCard.tsx';
import { Button, Notice } from '../../components/ui.tsx';
import { CARD_BY_ID } from '../../engine/cardCatalog.ts';
import { handOf } from '../../engine/cardPool.ts';
import { canDraw, drawQuota } from '../../engine/cards.ts';
import { teamName } from '../../engine/selectors.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { CardDrawKind } from '../../engine/types.ts';
import { useDispatch, useTransportContext } from '../../hooks/TransportProvider.tsx';
import { drawCard } from '../../services/cardOps.ts';

/** "Hand Full — choose 1 card to discard" (scorer is interactive; stage mirrors it read-only). */
export function DiscardPrompt({ state, interactive }: { state: TournamentState; interactive: boolean }) {
  const dispatch = useDispatch();
  const pending = state.cards.pendingDiscard;
  if (!pending) return null;
  const hand = handOf(state.cards, pending.teamId);
  return (
    <div className="space-y-3 rounded-lg border-2 border-accent-warning bg-accent-warning/10 p-4">
      <p className="font-display text-lg tracking-wide text-accent-warning uppercase">
        Hand full: {teamName(state, pending.teamId)} must discard 1 card
      </p>
      <div className="flex flex-wrap gap-2">
        {hand.map((inst) => (
          <div key={inst.instanceId} className="flex flex-col items-center gap-1">
            <PowerCard id={inst.cardTypeId} size="sm" showRules={false} className={inst.instanceId === pending.drawnInstanceId ? 'ring-2 ring-accent-gold' : ''} />
            {inst.instanceId === pending.drawnInstanceId && <span className="text-[10px] text-accent-gold uppercase">New</span>}
            {interactive && (
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => void dispatch({ type: 'RESOLVE_DISCARD', instanceId: inst.instanceId }, { persist: 'immediate' })}>
                Discard
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Post-match: the draw buttons the settings call for, plus the last card drawn. */
export function CardDrawPanel({ state }: { state: TournamentState }) {
  const { transport } = useTransportContext();
  const [busy, setBusy] = useState(false);
  const quota = drawQuota(state);
  const matchId = state.live?.matchId;
  const drawn = state.cards.draws.filter((d) => d.matchId === matchId);
  const last = drawn[drawn.length - 1];
  const tiered = state.settings.cards.poolStructure === 'TIERED_POOLS';
  const poolFor = (kind: CardDrawKind) => (!tiered ? 'ANY' : kind === 'LOSER' ? 'LOSER' : 'WINNER');

  const entries = [
    quota.loser && { kind: 'LOSER' as const, label: 'Draw Loser Card', ...quota.loser },
    quota.winner && { kind: 'WINNER' as const, label: 'Draw Winner Card', ...quota.winner },
  ].filter((e): e is NonNullable<typeof e> => !!e);
  if (!entries.length && !last && !state.cards.pendingDiscard) return null;

  const draw = async (teamId: string, kind: CardDrawKind) => {
    if (busy) return;
    setBusy(true);
    try {
      await drawCard(transport, teamId, kind);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <DiscardPrompt state={state} interactive />
      {entries.map((e) => {
        const empty = !canDraw(state, poolFor(e.kind));
        return (
          <Button
            key={e.kind}
            size="lg"
            variant={e.kind === 'LOSER' ? 'gold' : 'secondary'}
            icon={Gift}
            className="w-full"
            busy={busy}
            disabled={e.left <= 0 || empty || !!state.cards.pendingDiscard}
            onClick={() => void draw(e.teamId, e.kind)}
          >
            {e.label}: {teamName(state, e.teamId)} {e.left > 0 ? `(${e.left} left)` : '(done)'}
          </Button>
        );
      })}
      {entries.some((e) => e.left > 0 && !canDraw(state, poolFor(e.kind))) && <Notice tone="info">That card pool is empty right now.</Notice>}
      {last && !state.cards.pendingDiscard && (
        <p className="text-center text-sm text-text-muted">
          Last draw: <span className="font-semibold text-text-primary">{CARD_BY_ID[last.cardTypeId].name}</span> to {teamName(state, last.teamId)}
        </p>
      )}
    </div>
  );
}
