import { RotateCcw } from 'lucide-react';
import { CARD_TYPES, RARITY_COPIES, RARITY_COST, RARITY_LABEL, type CardRarity, type CardTypeId } from '../../engine/cardCatalog.ts';
import { animationMs, cardConfig, defaultCardConfigs, energyRule, limitModeOf } from '../../engine/cardConfig.ts';
import { circulationEstimate } from '../../engine/cards.ts';
import type { CardSettings, CardTypeConfig } from '../../engine/types.ts';
import { CardIcon, RARITY_VAR } from '../cards/PowerCard.tsx';
import { Button, Field, SegmentedControl, Toggle } from '../ui.tsx';

const num = (v: string, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const inputCls = 'min-h-11 w-full rounded-md border border-border-subtle bg-bg-primary px-3 text-base outline-none focus:border-accent-gold';
const smallInput = 'h-10 w-full rounded border border-border-subtle bg-bg-surface px-2 text-base';

function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={(e) => onChange(num(e.target.value, min, max, value))} className={inputCls} />
      )}
    </Field>
  );
}

/** Basic card setup (used by the wizard). */
export function CardBasicsForm({ value, onPatch }: { value: CardSettings; onPatch: (p: Partial<CardSettings>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Power Cards">
        {() => (
          <SegmentedControl
            ariaLabel="Power Cards"
            value={value.mode}
            options={[
              { value: 'OFF', label: 'Off' },
              { value: 'GROUP_STAGE_ONLY', label: 'Groups only' },
              { value: 'ALL_STAGES', label: 'Groups + playoffs' },
            ]}
            onChange={(mode) => onPatch({ mode })}
          />
        )}
      </Field>
      <Field label="Draw animation">
        {() => (
          <SegmentedControl
            ariaLabel="Draw animation"
            value={value.drawAnimationStyle}
            options={[
              { value: 'CARD_REVEAL', label: 'Card reveal (new)' },
              { value: 'CS2_CASE_OPENING', label: 'Case opening' },
              { value: 'SPIN_WHEEL', label: 'Spinning wheel' },
            ]}
            onChange={(drawAnimationStyle) => onPatch({ drawAnimationStyle })}
          />
        )}
      </Field>
      <Field
        label="Draw shows"
        hint={
          value.drawAnimationStyle === 'CARD_REVEAL'
            ? 'Card reveal always hides the power until the card lands. Pick Case opening or Spinning wheel to choose what they show.'
            : 'The rolling shows only the rarity colour (no power names). The power is revealed afterwards.'
        }
      >
        {() => (
          <SegmentedControl
            ariaLabel="Draw shows"
            value={value.drawShows ?? 'POWERS'}
            options={[
              { value: 'POWERS', label: 'The powers (as before)' },
              { value: 'RARITY', label: 'Rarity, then reveal' },
              { value: 'RARITY_PACK', label: 'Rarity, then a pack' },
            ]}
            onChange={(drawShows) => onPatch({ drawShows })}
          />
        )}
      </Field>
      <Field label="Cards" hint="Printed: a drawn card leaves the deck until it is played or discarded, so odds change as cards are held. Unlimited: every draw has the same odds.">
        {() => (
          <SegmentedControl
            ariaLabel="Supply"
            value={value.supplyMode}
            options={[
              { value: 'FINITE_PHYSICAL_POOL', label: 'Printed deck' },
              { value: 'FIXED_PROBABILITIES', label: 'Unlimited, fixed odds' },
            ]}
            onChange={(supplyMode) => onPatch({ supplyMode })}
          />
        )}
      </Field>
    </div>
  );
}

function CardRow({ id, cfg, fixed, energy, onChange }: { id: CardTypeId; cfg: CardTypeConfig; fixed: boolean; energy: boolean; onChange: (c: CardTypeConfig) => void }) {
  const card = CARD_TYPES.find((c) => c.id === id)!;
  const color = RARITY_VAR[cfg.rarity];
  return (
    <li className={`grid grid-cols-2 items-end gap-2 rounded-md border-l-4 bg-bg-primary p-2 ${energy ? 'sm:grid-cols-[minmax(0,1.6fr)_repeat(6,minmax(0,1fr))]' : 'sm:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))]'} ${cfg.enabled ? '' : 'opacity-50'}`} style={{ borderColor: color }}>
      <label className="col-span-2 flex min-h-10 cursor-pointer items-center gap-2 sm:col-span-1" title={card.rules}>
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent-gold)]" checked={cfg.enabled} onChange={(e) => onChange({ ...cfg, enabled: e.target.checked })} aria-label={`${card.name} in the deck`} />
        <span style={{ color }}>
          <CardIcon id={id} size={18} />
        </span>
        <span className="min-w-0 truncate text-sm font-medium">{card.name}</span>
      </label>
      <label className="text-[11px] text-text-muted">
        Rarity
        <select
          className={smallInput}
          value={cfg.rarity}
          onChange={(e) => {
            const rarity = e.target.value as CardRarity;
            // Re-tiering also applies that tier's default copies / odds (editable after).
            onChange({ ...cfg, rarity, copies: RARITY_COPIES[rarity], cost: null });
          }}
        >
          {(Object.keys(RARITY_LABEL) as CardRarity[]).map((r) => (
            <option key={r} value={r}>
              {RARITY_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] text-text-muted">
        Pool
        <select className={smallInput} value={cfg.pool} onChange={(e) => onChange({ ...cfg, pool: e.target.value as CardTypeConfig['pool'] })}>
          <option value="LOSER">Loser</option>
          <option value="WINNER">Winner</option>
        </select>
      </label>
      <label className="text-[11px] text-text-muted">
        {fixed ? 'Odds weight' : 'Copies'}
        <input type="number" min={0} max={20} className={`${smallInput} text-right font-mono`} value={cfg.copies} onChange={(e) => onChange({ ...cfg, copies: num(e.target.value, 0, 20, cfg.copies) })} />
      </label>
      {energy && (
        <label className="text-[11px] text-text-muted" title="Energy this card costs (empty = default for its rarity)">
          Energy cost
          <input
            type="number"
            min={0}
            max={10}
            placeholder={String(RARITY_COST[cfg.rarity])}
            className={`${smallInput} text-right font-mono`}
            value={cfg.cost ?? ''}
            onChange={(e) => onChange({ ...cfg, cost: e.target.value === '' ? null : num(e.target.value, 0, 10, 0) })}
          />
        </label>
      )}
      <label className="flex min-h-10 items-center gap-2 text-xs">
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent-gold)]" checked={cfg.playoffs} onChange={(e) => onChange({ ...cfg, playoffs: e.target.checked })} />
        Playoffs
      </label>
      <label className="text-[11px] text-text-muted" title={fixed ? 'Different odds weight for playoff draws (empty = same)' : 'Only with unlimited cards'}>
        Playoff odds
        <input
          type="number"
          min={0}
          max={20}
          disabled={!fixed || !cfg.playoffs}
          placeholder="same"
          className={`${smallInput} text-right font-mono disabled:opacity-40`}
          value={cfg.playoffCopies ?? ''}
          onChange={(e) => onChange({ ...cfg, playoffCopies: e.target.value === '' ? null : num(e.target.value, 0, 20, 0) })}
        />
      </label>
    </li>
  );
}

/** Full card economy settings (admin Power Cards tab). */
export function CardSettingsForm({ value, onPatch }: { value: CardSettings; onPatch: (p: Partial<CardSettings>) => void }) {
  const est = circulationEstimate(value);
  const fixed = value.supplyMode === 'FIXED_PROBABILITIES';
  const setCard = (id: CardTypeId, c: CardTypeConfig) => onPatch({ config: { ...value.config, [id]: c } });
  const params = value.params;
  const limitMode = limitModeOf(value);
  const energy = energyRule(value);
  const anim = animationMs(params);
  return (
    <div className="space-y-5">
      <CardBasicsForm value={value} onPatch={onPatch} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pool structure" hint="Loser / Winner: losers draw from the loser pool, winners from the winner pool.">
          {() => (
            <SegmentedControl
              ariaLabel="Pool structure"
              value={value.poolStructure}
              options={[
                { value: 'TIERED_POOLS', label: 'Loser / Winner pools' },
                { value: 'SHARED_POOL', label: 'One shared pool' },
              ]}
              onChange={(poolStructure) => onPatch({ poolStructure })}
            />
          )}
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Stage animation lengths (seconds)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stepper label="Case opening" value={anim.caseOpening / 1000} min={1} max={30} step={0.5} onChange={(caseOpeningSeconds) => onPatch({ params: { ...params, caseOpeningSeconds } })} />
          <Stepper label="Spinning wheel" value={anim.wheel / 1000} min={1} max={30} step={0.5} onChange={(wheelSeconds) => onPatch({ params: { ...params, wheelSeconds } })} />
          <Stepper label="Random Power roulette" value={anim.randomPower / 1000} min={1} max={30} step={0.5} onChange={(randomPowerSeconds) => onPatch({ params: { ...params, randomPowerSeconds } })} />
          <Stepper label="Card stays on screen" value={anim.reveal / 1000} min={1} max={30} step={0.5} onChange={(revealSeconds) => onPatch({ params: { ...params, revealSeconds } })} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Circulation</p>
          <span className="rounded-full border border-accent-gold/60 bg-accent-gold/10 px-3 py-1 text-xs font-semibold text-accent-gold">~{est.toFixed(1)} cards drawn per team per match</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stepper label="Starting hand" value={value.startingHandSize} min={0} max={2} onChange={(startingHandSize) => onPatch({ startingHandSize })} />
          <Stepper label="Loser draws / match" value={value.loserSpinsPerMatch} min={0} max={2} onChange={(loserSpinsPerMatch) => onPatch({ loserSpinsPerMatch })} />
          <Stepper label="Winner draws / match" value={value.winnerSpinsPerMatch} min={0} max={1} onChange={(winnerSpinsPerMatch) => onPatch({ winnerSpinsPerMatch })} />
          <Stepper label="Max hand size" value={value.maxHandSize} min={1} max={4} onChange={(maxHandSize) => onPatch({ maxHandSize })} />
        </div>
        <div className="mt-3 space-y-3 rounded-lg border border-border-subtle p-3">
          <Field label="Limit on playing cards">
            {() => (
              <SegmentedControl
                ariaLabel="Limit on playing cards"
                value={limitMode}
                options={[
                  { value: 'NONE', label: 'No limit' },
                  { value: 'COUNT', label: 'Max cards played' },
                  { value: 'ENERGY', label: 'Energy' },
                ]}
                onChange={(limitMode) => onPatch({ limitMode })}
              />
            )}
          </Field>
          {limitMode === 'COUNT' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stepper label="Max played / match" value={value.maxCardsPlayedPerMatch} min={1} max={3} onChange={(maxCardsPlayedPerMatch) => onPatch({ maxCardsPlayedPerMatch })} />
              <Stepper label="Max played / leg" value={value.maxCardsPlayedPerLeg} min={1} max={2} onChange={(maxCardsPlayedPerLeg) => onPatch({ maxCardsPlayedPerLeg })} />
            </div>
          )}
          {limitMode === 'ENERGY' && (
            <div className="space-y-3">
              <Field label="Energy budget" hint="Every card costs energy (set per card below). A team can play a card only if it has enough energy left. First Throw is paid from leg 1.">
                {() => (
                  <SegmentedControl
                    ariaLabel="Energy budget"
                    value={energy.scope}
                    options={[
                      { value: 'MATCH', label: 'Fixed energy per match' },
                      { value: 'LEG', label: 'Energy per leg (refills each leg)' },
                    ]}
                    onChange={(energyScope) => onPatch({ energyScope })}
                  />
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stepper label={energy.scope === 'MATCH' ? 'Energy / match' : 'Energy / leg'} value={energy.amount} min={1} max={20} onChange={(energyAmount) => onPatch({ energyAmount })} />
              </div>
            </div>
          )}
        </div>
        <Toggle
          label="Hands expire before the playoffs"
          description="All held cards return to the pool when the first playoff match starts."
          checked={value.expireHandsBeforePlayoffs}
          onChange={(expireHandsBeforePlayoffs) => onPatch({ expireHandsBeforePlayoffs })}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Card numbers</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stepper label="All or Nothing quota" value={params.allOrNothingQuota} min={10} max={180} onChange={(allOrNothingQuota) => onPatch({ params: { ...params, allOrNothingQuota } })} />
          <Stepper label="All or Nothing bonus" value={params.allOrNothingBonus} min={0} max={100} onChange={(allOrNothingBonus) => onPatch({ params: { ...params, allOrNothingBonus } })} />
          <Stepper label="Showboat bonus" value={params.showboatBonus} min={0} max={3} step={0.5} onChange={(showboatBonus) => onPatch({ params: { ...params, showboatBonus } })} />
          <Stepper label="Shot clock (s)" value={params.shotClockSeconds} min={3} max={60} onChange={(shotClockSeconds) => onPatch({ params: { ...params, shotClockSeconds } })} />
        </div>
        <Toggle
          label="Double-Edged Sword: boosted dart may finish"
          description="Off (default): a doubled dart that would finish the leg is a bust."
          checked={params.allowCheckoutOnBoostedDart}
          onChange={(allowCheckoutOnBoostedDart) => onPatch({ params: { ...params, allowCheckoutOnBoostedDart } })}
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-text-muted uppercase">
            Cards in this tournament {fixed ? '(odds weight: higher = drawn more often)' : '(copies in your printed deck)'}
          </p>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => onPatch({ config: defaultCardConfigs() })}>
            Reset to defaults
          </Button>
        </div>
        <p className="mb-2 text-xs text-text-muted">
          Untick a card to remove it. Changing rarity re-colors the card and sets that tier's default {fixed ? 'odds' : 'copies'} (Common 4, Uncommon 3, Rare 2, Legendary 1). Energy cost follows the rarity too (Common 1, Uncommon 1, Rare 2, Legendary 3) until you type your own.
        </p>
        <div className="mb-3 rounded-lg border border-border-subtle p-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Same {fixed ? 'odds weight' : 'copies'} for every card of a rarity</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(RARITY_LABEL) as CardRarity[]).map((r) => {
              const ids = CARD_TYPES.filter((c) => cardConfig(value, c.id).rarity === r).map((c) => c.id);
              if (!ids.length) return null;
              const amounts = new Set(ids.map((id) => cardConfig(value, id).copies));
              return (
                <label key={r} className="text-[11px] text-text-muted">
                  {RARITY_LABEL[r]} ({ids.length} cards, each)
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className={`${smallInput} text-right font-mono`}
                    placeholder="mixed"
                    value={amounts.size === 1 ? [...amounts][0] : ''}
                    onChange={(e) => {
                      if (e.target.value === '') return;
                      const n = num(e.target.value, 0, 20, 0);
                      onPatch({ config: { ...value.config, ...Object.fromEntries(ids.map((id) => [id, { ...cardConfig(value, id), copies: n }])) } });
                    }}
                  />
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-text-muted">Typing a number sets it for all cards of that rarity, so every card in a tier is equally likely. "mixed" means the cards differ (you can still set each one below).</p>
        </div>
        <ul className="space-y-1.5">
          {CARD_TYPES.map((c) => (
            <CardRow key={c.id} id={c.id} cfg={cardConfig(value, c.id)} fixed={fixed} energy={limitMode === 'ENERGY'} onChange={(cfg) => setCard(c.id, cfg)} />
          ))}
        </ul>
      </div>
    </div>
  );
}
