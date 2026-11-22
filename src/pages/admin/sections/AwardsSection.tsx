import { Award as AwardIcon, Download, IdCard, MonitorUp, MonitorX, Trophy } from 'lucide-react';
import { useRef, useState } from 'react';
import { SettingsDraft } from '../../../components/admin/SettingsDraft.tsx';
import { AwardCard, awardWinnerName } from '../../../components/fut/AwardCard.tsx';
import { FutCard } from '../../../components/fut/FutCard.tsx';
import { RadarChart } from '../../../components/fut/RadarChart.tsx';
import { Badge, Button, Field, Modal, Notice, Section, Select } from '../../../components/ui.tsx';
import { STATS_SCOPE_LABEL } from '../../../components/admin/labels.ts';
import { STAT_CODES, STAT_LABEL, type FutCard as FutCardData } from '../../../engine/stats.ts';
import type { TournamentState } from '../../../engine/state.ts';
import type { StatCode } from '../../../engine/types.ts';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';
import { playerRole, useTournamentStats } from '../../../hooks/useStats.ts';
import { downloadSvgAsPng } from '../../../services/media/customAssets.ts';

type Attrs = [StatCode, StatCode, StatCode, StatCode, StatCode, StatCode];

export function FutCardFor({ state, card, className }: { state: TournamentState; card: FutCardData; className?: string }) {
  const p = state.players[card.playerId];
  const team = state.teams.find((t) => t.id === card.teamId);
  return <FutCard card={card} name={p?.name ?? ''} teamName={team?.name ?? ''} role={playerRole(state, card.playerId)} avatar={p?.avatarDataUrl ?? null} teamLogo={team?.logoDataUrl} className={className} />;
}

function FutDetail({ state, card, cards, onClose }: { state: TournamentState; card: FutCardData; cards: FutCardData[]; onClose: () => void }) {
  const dispatch = useDispatch();
  const svgRef = useRef<SVGSVGElement>(null);
  const team = state.teams.find((t) => t.id === card.teamId);
  const mate = cards.find((c) => c.teamId === card.teamId && c.playerId !== card.playerId);
  const [compareId, setCompareId] = useState<string>(mate?.playerId ?? '');
  const compare = cards.find((c) => c.playerId === compareId) ?? null;
  const name = state.players[card.playerId]?.name ?? '';
  return (
    <Modal title={`${name} · ${team?.name ?? ''}`} wide onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FutCard
            ref={svgRef}
            card={card}
            name={name}
            teamName={team?.name ?? ''}
            role={playerRole(state, card.playerId)}
            avatar={state.players[card.playerId]?.avatarDataUrl ?? null}
            teamLogo={team?.logoDataUrl}
            className="mx-auto w-full max-w-xs"
          />
        </div>
        <div className="space-y-3">
          <Field label="Compare with">
            {(id) => (
              <Select id={id} value={compareId} onChange={(e) => setCompareId(e.target.value)}>
                <option value="">Nobody</option>
                {cards
                  .filter((c) => c.playerId !== card.playerId)
                  .map((c) => (
                    <option key={c.playerId} value={c.playerId}>
                      {state.players[c.playerId]?.name} ({state.teams.find((t) => t.id === c.teamId)?.name})
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <RadarChart card={card} compare={compare} label={name} compareLabel={compare ? state.players[compare.playerId]?.name : undefined} />
          <div className="flex flex-wrap gap-2">
            <Button icon={Download} onClick={() => svgRef.current && void downloadSvgAsPng(svgRef.current, `${name.replace(/\W+/g, '_') || 'player'}_fut.png`)}>
              Download Card as PNG
            </Button>
            <Button variant="gold" icon={MonitorUp} onClick={() => void dispatch({ type: 'SET_STAGE_OVERLAY', overlay: { kind: 'FUT', playerId: card.playerId } }, { persist: 'immediate' })}>
              Project to Stage
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Admin ceremony dashboard: all awards and FUT cards (always visible here), Project to Stage. */
export function AwardsSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const stats = useTournamentStats(state);
  const [open, setOpen] = useState({ team: true, player: true, fut: true });
  const [detail, setDetail] = useState<string | null>(null);
  if (!stats) return null;
  const overlay = state.stageOverlay ?? null;
  const project = (awardId: string) => void dispatch({ type: 'SET_STAGE_OVERLAY', overlay: { kind: 'AWARD', awardId } }, { persist: 'immediate' });
  const onStage = (awardId: string) => overlay?.kind === 'AWARD' && overlay.awardId === awardId;
  const v = state.settings.visibility;
  const detailCard = stats.cards.find((c) => c.playerId === detail);

  const awardGrid = (kind: 'TEAM' | 'PLAYER') => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {stats.awards
        .filter((a) => a.kind === kind)
        .map((a) => (
          <AwardCard key={a.id} state={state} award={a}>
            <Button size="sm" variant={onStage(a.id) ? 'gold' : 'secondary'} icon={MonitorUp} disabled={!a.winners.length} onClick={() => project(a.id)}>
              {onStage(a.id) ? 'On stage now' : 'Project to Stage'}
            </Button>
          </AwardCard>
        ))}
    </div>
  );

  let overlayText = '';
  if (overlay?.kind === 'AWARD') {
    const a = stats.awards.find((x) => x.id === overlay.awardId);
    overlayText = a ? `${a.title}: ${a.winners.map((w) => awardWinnerName(state, a, w.id)).join(', ')}` : 'Award';
  } else if (overlay?.kind === 'FUT') overlayText = `FUT card: ${state.players[overlay.playerId]?.name ?? ''}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          Scope: {STATS_SCOPE_LABEL[v.statsScope]} · Card-affected throws {v.includeCardAffectedThrows ? 'included' : 'excluded'} · Guests see awards {v.showAwardsPreview ? 'now' : 'only when you project them'}
        </p>
        {overlay && (
          <div className="flex items-center gap-2">
            <Badge tone="gold">On stage: {overlayText}</Badge>
            <Button size="sm" variant="danger" icon={MonitorX} onClick={() => void dispatch({ type: 'SET_STAGE_OVERLAY', overlay: null }, { persist: 'immediate' })}>
              Clear stage
            </Button>
          </div>
        )}
      </div>
      {state.completedOrder.length === 0 && <Notice tone="info">Awards and FUT cards fill in as matches are played.</Notice>}

      <Section id="section-awards-team" title="Team Awards" icon={Trophy} open={open.team} onToggle={() => setOpen((o) => ({ ...o, team: !o.team }))}>
        {awardGrid('TEAM')}
      </Section>
      <Section id="section-awards-player" title="Player Awards" icon={AwardIcon} open={open.player} onToggle={() => setOpen((o) => ({ ...o, player: !o.player }))}>
        {awardGrid('PLAYER')}
      </Section>
      <Section id="section-fut" title="FUT Player Cards" icon={IdCard} open={open.fut} onToggle={() => setOpen((o) => ({ ...o, fut: !o.fut }))}>
        <div className="space-y-4">
          <SettingsDraft<Attrs>
            value={state.settings.futCardAttributes}
            labels={{ 0: 'Stat 1', 1: 'Stat 2', 2: 'Stat 3', 3: 'Stat 4', 4: 'Stat 5', 5: 'Stat 6' }}
            onApply={(attributes) => dispatch({ type: 'SET_FUT_ATTRIBUTES', attributes }, { persist: 'immediate' })}
          >
            {(d, set) => {
              const dupes = new Set(d).size !== 6;
              return (
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-text-muted uppercase">The 6 stats on every card</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {d.map((code, i) => (
                      <Select
                        key={i}
                        aria-label={`Stat ${i + 1}`}
                        value={code}
                        onChange={(e) => {
                          const next = [...d] as Attrs;
                          next[i] = e.target.value as StatCode;
                          set(next);
                        }}
                      >
                        {STAT_CODES.map((c) => (
                          <option key={c} value={c}>
                            {c} · {STAT_LABEL[c].name}
                          </option>
                        ))}
                      </Select>
                    ))}
                  </div>
                  {dupes && <Notice tone="danger">Each stat can only be used once.</Notice>}
                </div>
              );
            }}
          </SettingsDraft>
          {stats.cards.length === 0 ? (
            <p className="text-sm text-text-muted">No player has thrown yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[...stats.cards]
                .sort((a, b) => b.ovr - a.ovr)
                .map((c) => (
                  <button key={c.playerId} type="button" onClick={() => setDetail(c.playerId)} className="rounded-lg transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-accent-gold">
                    <FutCardFor state={state} card={c} className="w-full" />
                  </button>
                ))}
            </div>
          )}
        </div>
      </Section>
      {detailCard && <FutDetail state={state} card={detailCard} cards={stats.cards} onClose={() => setDetail(null)} />}
    </div>
  );
}
