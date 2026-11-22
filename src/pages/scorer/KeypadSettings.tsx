import { Check, Dumbbell } from 'lucide-react';
import { KEYPAD_LABEL } from '../../components/admin/labels.ts';
import { Button, Toggle } from '../../components/ui.tsx';
import { KEYPAD_LAYOUTS, type KeypadLayout } from '../../engine/types.ts';
import type { KeypadPrefs } from '../../services/keypadPrefs.ts';

export interface KeypadControl {
  prefs: KeypadPrefs;
  layout: KeypadLayout;
  update: (patch: Partial<KeypadPrefs>) => void;
}

function Choice({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-16 items-start gap-3 rounded-md border p-3 text-left transition ${
        selected ? 'border-accent-gold bg-accent-gold/10' : 'border-border-subtle bg-bg-primary hover:border-border-strong'
      }`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-accent-gold bg-accent-gold text-text-inverse' : 'border-border-strong'}`}>
        {selected && <Check size={14} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-text-muted">{description}</span>
      </span>
    </button>
  );
}

/** Per-tablet keypad choice. Stored on this device only; never changes tournament data. */
export function KeypadSettings({ keypad, tournamentDefault, onPractice }: { keypad: KeypadControl; tournamentDefault: KeypadLayout; onPractice?: () => void }) {
  const { prefs, update, layout } = keypad;
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Keypad layout" className="grid gap-2 sm:grid-cols-2">
        <Choice
          selected={prefs.layout === null}
          title={`Tournament default: ${KEYPAD_LABEL[tournamentDefault].name}`}
          description="Follow whatever the Admin picked."
          onClick={() => update({ layout: null })}
        />
        {KEYPAD_LAYOUTS.map((l) => (
          <Choice key={l} selected={prefs.layout === l} title={KEYPAD_LABEL[l].name} description={KEYPAD_LABEL[l].description} onClick={() => update({ layout: l })} />
        ))}
      </div>
      {layout === 'MODIFIER' && (
        <Toggle
          label="Keep DOUBLE / TRIPLE switched on"
          description="Off: the modifier applies to one dart, then goes back to singles. On: it stays until you tap it again."
          checked={prefs.stickyModifier}
          onChange={(stickyModifier) => update({ stickyModifier })}
        />
      )}
      <p className="text-xs text-text-muted">Saved on this tablet only.</p>
      {onPractice && (
        <Button icon={Dumbbell} onClick={onPractice}>
          Try it in Practice mode
        </Button>
      )}
    </div>
  );
}
