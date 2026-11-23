import { Award as AwardIcon, Crown, IdCard, MonitorUp, MonitorX, Trophy } from 'lucide-react';
import { useState } from 'react';
import { SettingsDraft } from '../../../components/admin/SettingsDraft.tsx';
import { AwardCard, awardWinnerName } from '../../../components/fut/AwardCard.tsx';
import { FutDetail, FutGallery, StatsGuide, UltimateTeamView } from '../../../components/fut/FutViews.tsx';
import { Badge, Button, Notice, Section, Select } from '../../../components/ui.tsx';
import { STATS_SCOPE_LABEL } from '../../../components/admin/labels.ts';
import { STAT_CODES, STAT_LABEL, ultimateTeam } from '../../../engine/stats.ts';
import type { TournamentState } from '../../../engine/state.ts';
import type { StatCode } from '../../../engine/types.ts';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';
import { useTournamentStats } from '../../../hooks/useStats.ts';

type Attrs = [StatCode, StatCode, StatCode, StatCode, StatCode, StatCode];

/** Admin ceremony dashboard: all awards and FUT cards (always visible here), Project to Stage. */
export function AwardsSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const stats = useTournamentStats(state);
  const [open, setOpen] = useState({ team: true, player: true, fut: true, ultimate: true });
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
  } else if (overlay?.kind === 'ULTIMATE') overlayText = 'Ultimate Team';
  else if (overlay?.kind === 'FUT') overlayText = `FUT card: ${state.players[overlay.playerId]?.name ?? ''}`;
  else if (overlay?.kind === 'QR') overlayText = 'Join QR code';

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
                  <p className="text-xs font-medium tracking-wide text-text-muted uppercase">The 6 stats on every card, most important first (also the Ultimate Team pick order)</p>
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
            <>
              <StatsGuide state={state} />
              <FutGallery state={state} cards={[...stats.cards].sort((a, b) => b.ovr - a.ovr)} admin />
            </>
          )}
        </div>
      </Section>
      <Section id="section-ultimate" title="Ultimate Team" icon={Crown} open={open.ultimate} onToggle={() => setOpen((o) => ({ ...o, ultimate: !o.ultimate }))}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-muted">
              One spot per card stat, filled in priority order: the best player in that stat gets the spot, and nobody appears twice. Guests see it when you switch on
              {' '}
              <em>Ultimate Team</em> in Settings, Visibility.
            </p>
            <Button
              size="sm"
              variant={overlay?.kind === 'ULTIMATE' ? 'gold' : 'secondary'}
              icon={MonitorUp}
              disabled={!stats.cards.length}
              onClick={() => void dispatch({ type: 'SET_STAGE_OVERLAY', overlay: { kind: 'ULTIMATE' } }, { persist: 'immediate' })}
            >
              {overlay?.kind === 'ULTIMATE' ? 'On stage now' : 'Project to Stage'}
            </Button>
          </div>
          <UltimateTeamView state={state} team={ultimateTeam(state, stats.cards)} onOpen={setDetail} />
        </div>
      </Section>
      {detailCard && <FutDetail state={state} card={detailCard} cards={stats.cards} admin onClose={() => setDetail(null)} />}
    </div>
  );
}
