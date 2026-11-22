import type { RulesPatch } from '../../engine/actions.ts';
import type { CheckoutMode, FirstThrowRule, FirstThrowTiebreak, GameRules, StartingScore } from '../../engine/types.ts';
import { Field, SegmentedControl, Select, TextInput, Toggle } from '../ui.tsx';
import { CHECKOUT_LABEL, FIRST_THROW_LABEL, TIEBREAK_LABEL } from './labels.ts';

/** Controlled editor for game rules; emits partial patches (works for wizard + live edits). */
export function RulesForm({ value, onPatch }: { value: GameRules; onPatch: (patch: RulesPatch) => void }) {
  const sr = value.specialRules;
  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starting score">
          {() => (
            <SegmentedControl
              ariaLabel="Starting score"
              value={value.startingScore}
              options={([301, 501] as StartingScore[]).map((n) => ({ value: n, label: String(n) }))}
              onChange={(startingScore) => onPatch({ startingScore })}
            />
          )}
        </Field>
        <Field label="Checkout">
          {(id) => (
            <Select id={id} value={value.checkoutMode} onChange={(e) => onPatch({ checkoutMode: e.target.value as CheckoutMode })}>
              {(Object.keys(CHECKOUT_LABEL) as CheckoutMode[]).map((m) => (
                <option key={m} value={m}>{CHECKOUT_LABEL[m]}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Who throws first" hint="Alternates each leg in BO3+, re-applied on the deciding leg.">
          {(id) => (
            <Select id={id} value={value.firstThrowRule} onChange={(e) => onPatch({ firstThrowRule: e.target.value as FirstThrowRule })}>
              {(Object.keys(FIRST_THROW_LABEL) as FirstThrowRule[]).map((m) => (
                <option key={m} value={m}>{FIRST_THROW_LABEL[m]}</option>
              ))}
            </Select>
          )}
        </Field>
        {value.firstThrowRule === 'LOWER_SEED_FIRST' && (
          <Field label="Tie-breaker (equal seeds)">
            {(id) => (
              <Select id={id} value={value.firstThrowTiebreak} onChange={(e) => onPatch({ firstThrowTiebreak: e.target.value as FirstThrowTiebreak })}>
                {(Object.keys(TIEBREAK_LABEL) as FirstThrowTiebreak[]).map((m) => (
                  <option key={m} value={m}>{TIEBREAK_LABEL[m]}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium tracking-wide text-text-muted uppercase">Special rules</p>
        <div className="divide-y divide-border-subtle">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <Toggle
                label="Double checkout bonus"
                description="Tiebreaker points for finishing on D1–D20 or Bull 50."
                checked={sr.doubleCheckoutBonus.enabled}
                onChange={(enabled) => onPatch({ specialRules: { doubleCheckoutBonus: { enabled } } })}
              />
            </div>
            {sr.doubleCheckoutBonus.enabled && (
              <TextInput
                aria-label="Double checkout bonus points"
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                className="w-24"
                value={sr.doubleCheckoutBonus.points}
                onChange={(e) => onPatch({ specialRules: { doubleCheckoutBonus: { points: num(e.target.value, 1) } } })}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <Toggle
                label="Triple checkout bonus"
                description="Tiebreaker points for finishing on T1–T20."
                checked={sr.tripleCheckoutBonus.enabled}
                onChange={(enabled) => onPatch({ specialRules: { tripleCheckoutBonus: { enabled } } })}
              />
            </div>
            {sr.tripleCheckoutBonus.enabled && (
              <TextInput
                aria-label="Triple checkout bonus points"
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                className="w-24"
                value={sr.tripleCheckoutBonus.points}
                onChange={(e) => onPatch({ specialRules: { tripleCheckoutBonus: { points: num(e.target.value, 1) } } })}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <Toggle
                label="Visit cap"
                description="Maximum visits per team per leg."
                checked={sr.visitCap.enabled}
                onChange={(enabled) => onPatch({ specialRules: { visitCap: { enabled } } })}
              />
            </div>
            {sr.visitCap.enabled && (
              <TextInput
                aria-label="Maximum visits"
                type="number"
                min={1}
                inputMode="numeric"
                className="w-24"
                value={sr.visitCap.maxVisits}
                onChange={(e) => onPatch({ specialRules: { visitCap: { maxVisits: Math.max(1, Math.round(num(e.target.value, 20))) } } })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
