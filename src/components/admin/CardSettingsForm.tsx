import { RotateCcw } from 'lucide-react';
import { CARD_TYPES, RARITY_COPIES, RARITY_LABEL, type CardRarity, type CardTypeId } from '../../engine/cardCatalog.ts';
import { cardConfig, defaultCardConfigs } from '../../engine/cardConfig.ts';
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
              { value: 'CS2_CASE_OPENING', label: 'Case opening' },
              { value: 'SPIN_WHEEL', label: 'Spinning wheel' },
            ]}
            onChange={(drawAnimationStyle) => onPatch({ drawAnimationStyle })}
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

function CardRow({ id, cfg, fixed, onChange }: { id: CardTypeId; cfg: CardTypeConfig; fixed: boolean; onChange: (c: CardTypeConfig) => void }) {
  const card = CARD_TYPES.find((c) => c.id === id)!;
  const color = RARITY_VAR[cfg.rarity];
  return (
    <li className={`grid grid-cols-2 items-end gap-2 rounded-md border-l-4 bg-bg-primary p-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] ${cfg.enabled ? '' : 'opacity-50'}`} style={{ borderColor: color }}>
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
            onChange({ ...cfg, rarity, copies: RARITY_COPIES[rarity] });
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
        <Stepper
          label="Draw animation length (seconds)"
          value={params.drawAnimationSeconds}
          min={2}
          max={12}
          step={0.5}
          onChange={(drawAnimationSeconds) => onPatch({ params: { ...params, drawAnimationSeconds } })}
        />
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
          Untick a card to remove it. Changing rarity re-colors the card and sets that tier's default {fixed ? 'odds' : 'copies'} (Common 4, Silver 3, Rare 2, Legendary 1).
        </p>
        <ul className="space-y-1.5">
          {CARD_TYPES.map((c) => (
            <CardRow key={c.id} id={c.id} cfg={cardConfig(value, c.id)} fixed={fixed} onChange={(cfg) => setCard(c.id, cfg)} />
          ))}
        </ul>
      </div>
    </div>
  );
}
