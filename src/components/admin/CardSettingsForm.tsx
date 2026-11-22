import { CARD_TYPES, RARITY_LABEL, type CardTypeId } from '../../engine/cardCatalog.ts';
import { circulationEstimate } from '../../engine/cards.ts';
import type { CardSettings } from '../../engine/types.ts';
import { CardIcon, RARITY_VAR } from '../cards/PowerCard.tsx';
import { Field, SegmentedControl, Toggle } from '../ui.tsx';

const num = (v: string, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(num(e.target.value, min, max, value))}
          className="min-h-11 w-full rounded-md border border-border-subtle bg-bg-primary px-3 text-base outline-none focus:border-accent-gold"
        />
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
              { value: 'ALL_STAGES', label: 'All stages' },
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
              { value: 'CS2_CASE_OPENING', label: 'Case opening' },
              { value: 'SPIN_WHEEL', label: 'Spinning wheel' },
            ]}
            onChange={(drawAnimationStyle) => onPatch({ drawAnimationStyle })}
          />
        )}
      </Field>
    </div>
  );
}

/** Full card economy settings (admin Cards tab). */
export function CardSettingsForm({ value, onPatch }: { value: CardSettings; onPatch: (p: Partial<CardSettings>) => void }) {
  const est = circulationEstimate(value);
  return (
    <div className="space-y-5">
      <CardBasicsForm value={value} onPatch={onPatch} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pool structure">
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
        <Field label="Supply">
          {() => (
            <SegmentedControl
              ariaLabel="Supply"
              value={value.supplyMode}
              options={[
                { value: 'FINITE_PHYSICAL_POOL', label: 'Printed copies' },
                { value: 'FIXED_PROBABILITIES', label: 'Fixed odds' },
              ]}
              onChange={(supplyMode) => onPatch({ supplyMode })}
            />
          )}
        </Field>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Circulation</p>
          <span className="rounded-full border border-accent-gold/60 bg-accent-gold/10 px-3 py-1 text-xs font-semibold text-accent-gold">
            ~{est.toFixed(1)} cards drawn per team per match
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stepper label="Starting hand" value={value.startingHandSize} min={0} max={2} onChange={(startingHandSize) => onPatch({ startingHandSize })} />
          <Stepper label="Loser draws / match" value={value.loserSpinsPerMatch} min={0} max={2} onChange={(loserSpinsPerMatch) => onPatch({ loserSpinsPerMatch })} />
          <Stepper label="Winner draws / match" value={value.winnerSpinsPerMatch} min={0} max={1} onChange={(winnerSpinsPerMatch) => onPatch({ winnerSpinsPerMatch })} />
          <Stepper label="Max hand size" value={value.maxHandSize} min={1} max={4} onChange={(maxHandSize) => onPatch({ maxHandSize })} />
          <Stepper label="Max played / match" value={value.maxCardsPlayedPerMatch} min={1} max={3} onChange={(maxCardsPlayedPerMatch) => onPatch({ maxCardsPlayedPerMatch })} />
          <Stepper label="Max played / leg" value={value.maxCardsPlayedPerLeg} min={1} max={2} onChange={(maxCardsPlayedPerLeg) => onPatch({ maxCardsPlayedPerLeg })} />
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
          <Stepper label="All or Nothing quota" value={value.params.allOrNothingQuota} min={10} max={180} onChange={(allOrNothingQuota) => onPatch({ params: { ...value.params, allOrNothingQuota } })} />
          <Stepper label="All or Nothing bonus" value={value.params.allOrNothingBonus} min={0} max={100} onChange={(allOrNothingBonus) => onPatch({ params: { ...value.params, allOrNothingBonus } })} />
          <Stepper label="Showboat bonus" value={value.params.showboatBonus} min={0} max={3} step={0.5} onChange={(showboatBonus) => onPatch({ params: { ...value.params, showboatBonus } })} />
          <Stepper label="Shot clock (s)" value={value.params.shotClockSeconds} min={3} max={60} onChange={(shotClockSeconds) => onPatch({ params: { ...value.params, shotClockSeconds } })} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">
          Copies per card {value.supplyMode === 'FIXED_PROBABILITIES' ? '(used as odds weights)' : '(match your printed deck)'}
        </p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {CARD_TYPES.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-md bg-bg-primary px-2 py-1">
              <span style={{ color: RARITY_VAR[c.rarity] }}>
                <CardIcon id={c.id} size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm" title={c.rules}>
                {c.name}
                <span className="ml-1 text-xs text-text-muted">
                  {RARITY_LABEL[c.rarity]} · {c.pool === 'LOSER' ? 'Loser' : 'Winner'}
                </span>
              </span>
              <input
                type="number"
                min={0}
                max={10}
                aria-label={`${c.name} copies`}
                value={value.copies[c.id as CardTypeId] ?? 0}
                onChange={(e) => onPatch({ copies: { ...value.copies, [c.id]: num(e.target.value, 0, 10, 0) } })}
                className="h-9 w-16 rounded border border-border-subtle bg-bg-surface px-2 text-right font-mono text-base"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
