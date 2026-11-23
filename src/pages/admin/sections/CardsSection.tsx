import { ArrowRightLeft, Gift, Layers, Plus, Printer, Settings2, Undo2, Users } from 'lucide-react';
import { openAppWindow } from '../../../services/links.ts';
import { useState } from 'react';
import { CardSettingsForm } from '../../../components/admin/CardSettingsForm.tsx';
import { SettingsDraft } from '../../../components/admin/SettingsDraft.tsx';
import type { CardSettings } from '../../../engine/types.ts';
import { CardIcon, RARITY_VAR } from '../../../components/cards/PowerCard.tsx';
import { Badge, Button, Field, Notice, Section, Select } from '../../../components/ui.tsx';
import { CARD_BY_ID, CARD_TYPES, type CardPool, type CardTypeId } from '../../../engine/cardCatalog.ts';
import { handOf, poolInstances } from '../../../engine/cardPool.ts';
import { canDraw } from '../../../engine/cards.ts';
import type { TournamentState } from '../../../engine/state.ts';
import { useDispatch, useTransportContext } from '../../../hooks/TransportProvider.tsx';
import { drawCard, grantCard } from '../../../services/cardOps.ts';
import { useRarityOf } from '../../../hooks/useCardLook.ts';
import { DiscardPrompt } from '../../scorer/CardDrawPanel.tsx';

function Inventory({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const [moving, setMoving] = useState<string | null>(null);
  const rarityOf = useRarityOf();
  const max = state.settings.cards.maxHandSize;
  return (
    <div className="space-y-3">
      {state.cards.pendingDiscard && <DiscardPrompt state={state} interactive />}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {state.teams.map((t) => {
          const hand = handOf(state.cards, t.id);
          return (
            <li key={t.id} className="surface-elevated space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{t.name}</p>
                <Badge tone={hand.length > max ? 'danger' : hand.length === max ? 'gold' : 'muted'}>
                  {hand.length}/{max}
                </Badge>
              </div>
              {hand.length === 0 && <p className="text-xs text-text-muted">No cards.</p>}
              {hand.map((inst) => {
                const card = CARD_BY_ID[inst.cardTypeId];
                return (
                  <div key={inst.instanceId} className="flex items-center gap-2 rounded-md border-l-4 bg-bg-primary px-2 py-1" style={{ borderColor: RARITY_VAR[rarityOf(inst.cardTypeId)] }}>
                    <span style={{ color: RARITY_VAR[rarityOf(inst.cardTypeId)] }}>
                      <CardIcon id={inst.cardTypeId} size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm" title={card.rules}>
                      {card.name}
                    </span>
                    {moving === inst.instanceId ? (
                      <Select
                        aria-label="Transfer to team"
                        className="h-9 min-h-9 w-36 text-sm"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) void dispatch({ type: 'TRANSFER_CARD', instanceId: inst.instanceId, toTeamId: e.target.value }, { persist: 'immediate' });
                          setMoving(null);
                        }}
                      >
                        <option value="">Give to...</option>
                        {state.teams
                          .filter((x) => x.id !== t.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                      </Select>
                    ) : (
                      <Button size="sm" variant="ghost" icon={ArrowRightLeft} aria-label={`Transfer ${card.name}`} title="Transfer / steal to another team" onClick={() => setMoving(inst.instanceId)} />
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Undo2}
                      aria-label={`Return ${card.name} to the pool`}
                      title="Return / void to the pool"
                      onClick={() => void dispatch({ type: 'VOID_CARD', instanceId: inst.instanceId }, { persist: 'immediate' })}
                    />
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GrantTools({ state }: { state: TournamentState }) {
  const { transport } = useTransportContext();
  const [teamId, setTeamId] = useState(state.teams[0]?.id ?? '');
  const [card, setCard] = useState<CardTypeId | 'RANDOM'>('RANDOM');
  const [pool, setPool] = useState<CardPool | 'ANY'>('LOSER');
  const fixed = state.settings.cards.supplyMode === 'FIXED_PROBABILITIES';
  const available = (id: CardTypeId | 'RANDOM') => (id === 'RANDOM' ? canDraw(state, 'ANY') : fixed || state.cards.instances.some((i) => i.status === 'IN_POOL' && i.cardTypeId === id));
  const blocked = !!state.cards.pendingDiscard;

  return (
    <div className="space-y-3">
      <Field label="Team">
        {(id) => (
          <Select id={id} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="Give a card (no animation)">
          {(id) => (
            <Select id={id} value={card} onChange={(e) => setCard(e.target.value as CardTypeId | 'RANDOM')}>
              <option value="RANDOM">Random card (current odds)</option>
              {CARD_TYPES.map((c) => (
                <option key={c.id} value={c.id} disabled={!available(c.id)}>
                  {c.name}
                  {available(c.id) ? '' : ' (none in pool)'}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button icon={Plus} disabled={!teamId || !available(card) || blocked} onClick={() => void grantCard(transport, teamId, card)}>
          Grant
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="Bonus draw (animated on stage)">
          {(id) => (
            <Select id={id} value={pool} onChange={(e) => setPool(e.target.value as CardPool | 'ANY')}>
              <option value="LOSER">Loser pool</option>
              <option value="WINNER">Winner pool</option>
              <option value="ANY">Any card</option>
            </Select>
          )}
        </Field>
        <Button variant="gold" icon={Gift} disabled={!teamId || blocked || !canDraw(state, pool)} onClick={() => void drawCard(transport, teamId, 'GRANT', pool)}>
          Draw
        </Button>
      </div>
      {blocked && <Notice tone="warning">A team must discard a card first.</Notice>}
    </div>
  );
}

/** Admin Cards tab: inventory + side-game transfers, and the card economy settings. */
export function CardsSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const [open, setOpen] = useState({ inv: true, tools: true, settings: false });
  const s = state.settings.cards;
  const inPool = poolInstances(state.cards, 'ANY').length;
  const held = state.cards.instances.filter((i) => i.status === 'IN_HAND').length;
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        {s.mode === 'OFF' && <Notice tone="info">Power Cards are off for this tournament. Turn them on in the settings below.</Notice>}
        <Section
          id="section-cards-inv"
          title="Team Hands"
          icon={Users}
          open={open.inv}
          onToggle={() => setOpen((o) => ({ ...o, inv: !o.inv }))}
          badge={
            <Badge tone="muted">
              {held} held · {inPool} in pool
            </Badge>
          }
        >
          <Inventory state={state} />
        </Section>
        <Section id="section-cards-settings" title="Card Settings" icon={Settings2} open={open.settings} onToggle={() => setOpen((o) => ({ ...o, settings: !o.settings }))}>
          <SettingsDraft<CardSettings>
            value={s}
            labels={{ config: 'Card', params: 'Card numbers' }}
            liveWarning={
              state.live
                ? 'A match is live right now. Card numbers (All or Nothing quota and bonus, Showboat bonus, shot clock), the Double-Edged finish rule and which cards are allowed take effect in this match immediately, including cards already played.'
                : null
            }
            onApply={(d) => dispatch({ type: 'UPDATE_CARD_SETTINGS', patch: d }, { persist: 'immediate' })}
          >
            {(d, set) => <CardSettingsForm value={d} onPatch={(patch) => set({ ...d, ...patch })} />}
          </SettingsDraft>
        </Section>
      </div>
      <Section id="section-cards-tools" title="Minigame Transfers" icon={Layers} open={open.tools} onToggle={() => setOpen((o) => ({ ...o, tools: !o.tools }))}>
        <GrantTools state={state} />
      </Section>
      <div className="flex flex-wrap items-center justify-between gap-2 lg:col-span-3">
        <p className="text-sm text-text-muted">Printable A4 deck: 63 x 88 mm cards with cut lines, copies from the card settings.</p>
        <Button icon={Printer} onClick={() => openAppWindow('print-cards', state.meta?.id ?? null)}>
          Print card deck
        </Button>
      </div>
    </div>
  );
}
