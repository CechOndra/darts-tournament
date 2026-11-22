import { LogOut, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { KEYPAD_LABEL } from '../../components/admin/labels.ts';
import { DartKeypad } from '../../components/match/DartKeypad.tsx';
import { Button, Toggle } from '../../components/ui.tsx';
import { newPractice, practiceThrow, practiceUndo, practiceView } from '../../engine/practice.ts';
import { dartLabel } from '../../engine/scoring.ts';
import type { TournamentState } from '../../engine/state.ts';
import { KEYPAD_LAYOUTS } from '../../engine/types.ts';
import type { KeypadControl } from './KeypadSettings.tsx';

/** Local-only sandbox: try keypad layouts without touching tournament data. */
export function PracticePanel({ state, keypad, onExit }: { state: TournamentState; keypad: KeypadControl; onExit: () => void }) {
  const { startingScore, checkoutMode } = state.settings.rules;
  const [practice, setPractice] = useState(() => newPractice(startingScore, checkoutMode));
  const view = useMemo(() => practiceView(practice), [practice]);
  const recent = view.visits.slice(-6).reverse();

  return (
    <>
      <section className="surface flex min-h-0 flex-col gap-3 overflow-hidden border-accent-info/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="rounded bg-accent-info/20 px-2 py-1 font-display text-sm tracking-widest text-accent-info uppercase">Practice - not counted</p>
          <div className="flex gap-2">
            <Button size="sm" icon={RotateCcw} onClick={() => setPractice(newPractice(startingScore, checkoutMode))}>
              Restart
            </Button>
            <Button size="sm" variant="primary" icon={LogOut} onClick={onExit}>
              Exit Practice
            </Button>
          </div>
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="font-display text-7xl leading-none font-bold tabular-nums">{view.finished ? 'GAME SHOT' : view.remaining}</p>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => {
              const d = view.current.darts[i];
              return (
                <span
                  key={i}
                  className={`flex h-10 w-16 items-center justify-center rounded-md border font-mono text-lg font-bold ${
                    d ? 'border-accent-info/70 bg-accent-info/10' : 'border-dashed border-border-strong text-text-muted'
                  }`}
                >
                  {d ? dartLabel(d) : i + 1}
                </span>
              );
            })}
          </div>
        </div>
        <ol className="min-h-0 flex-1 space-y-1 overflow-hidden text-sm">
          {recent.map((v, i) => (
            <li key={view.visits.length - i} className="flex justify-between gap-2 rounded bg-bg-elevated/60 px-3 py-1">
              <span className="font-mono text-text-muted">{v.darts.map(dartLabel).join('  ')}</span>
              <span className={v.bust ? 'text-accent-danger' : v.checkout ? 'text-accent-gold' : ''}>{v.bust ? 'BUST' : v.checkout ? 'CHECKOUT' : v.scored}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-2 border-t border-border-subtle pt-3">
          <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Keypad layout (this tablet)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {KEYPAD_LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={keypad.layout === l}
                onClick={() => keypad.update({ layout: l })}
                className={`min-h-10 rounded-md border px-2 text-sm ${keypad.layout === l ? 'border-accent-gold bg-accent-gold text-text-inverse' : 'border-border-subtle bg-bg-primary text-text-muted'}`}
              >
                {KEYPAD_LABEL[l].name}
              </button>
            ))}
          </div>
          {keypad.layout === 'MODIFIER' && (
            <Toggle label="Keep DOUBLE / TRIPLE switched on" checked={keypad.prefs.stickyModifier} onChange={(stickyModifier) => keypad.update({ stickyModifier })} />
          )}
        </div>
      </section>
      <section className="surface flex min-h-0 flex-col overflow-hidden p-3">
        <DartKeypad
          layout={keypad.layout}
          stickyModifier={keypad.prefs.stickyModifier}
          onDart={(segment, multiplier) => setPractice((p) => practiceThrow(p, { segment, multiplier }))}
          onUndo={() => setPractice(practiceUndo)}
          disabled={view.finished}
          canUndo={practice.darts.length > 0}
        />
      </section>
    </>
  );
}
