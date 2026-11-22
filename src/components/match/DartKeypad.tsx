import { Undo2 } from 'lucide-react';
import type { Multiplier } from '../../engine/scoring.ts';

const ROWS: { mult: Multiplier; from: number }[] = [
  { mult: 1, from: 1 },
  { mult: 2, from: 1 },
  { mult: 3, from: 1 },
  { mult: 1, from: 11 },
  { mult: 2, from: 11 },
  { mult: 3, from: 11 },
];

const TONE: Record<number, string> = {
  1: 'bg-bg-elevated border-border-subtle hover:border-border-strong',
  2: 'bg-accent-secondary/15 border-accent-secondary/50 text-accent-secondary',
  3: 'bg-accent-primary/15 border-accent-primary/50 text-accent-primary',
};

const PREFIX: Record<number, string> = { 1: 'S', 2: 'D', 3: 'T' };

/** 1-tap per-dart keypad: every button is one dart (S/D/T 1–20, 25, Bull, Miss). */
export function DartKeypad({
  onDart,
  onUndo,
  disabled,
  canUndo,
}: {
  onDart: (segment: number, multiplier: Multiplier) => void;
  onUndo: () => void;
  disabled?: boolean;
  canUndo: boolean;
}) {
  const key = 'flex min-h-12 items-center justify-center rounded-md border font-mono font-bold transition active:scale-95 disabled:opacity-40';
  return (
    <div className="grid h-full min-h-0 grid-rows-[repeat(7,minmax(0,1fr))] gap-1.5" role="group" aria-label="Dart keypad">
      {ROWS.map(({ mult, from }) => (
        <div key={`${mult}-${from}`} className="grid grid-cols-10 gap-1.5">
          {Array.from({ length: 10 }, (_, i) => {
            const seg = from + i;
            return (
              <button
                key={seg}
                type="button"
                disabled={disabled}
                onClick={() => onDart(seg, mult)}
                className={`${key} text-base ${TONE[mult]}`}
                aria-label={`${PREFIX[mult]}${seg}`}
              >
                <span className="text-[0.65em] opacity-70">{PREFIX[mult]}</span>
                {seg}
              </button>
            );
          })}
        </div>
      ))}
      <div className="grid grid-cols-10 gap-1.5">
        <button type="button" disabled={disabled} onClick={() => onDart(25, 1)} aria-label="Outer bull 25" className={`${key} col-span-2 bg-bg-elevated border-border-subtle text-lg`}>
          25
        </button>
        <button type="button" disabled={disabled} onClick={() => onDart(50, 1)} aria-label="Bullseye 50" className={`${key} col-span-2 border-accent-gold/60 bg-accent-gold/15 text-lg text-accent-gold`}>
          BULL
        </button>
        <button type="button" disabled={disabled} onClick={() => onDart(0, 0)} aria-label="Miss" className={`${key} col-span-3 border-border-strong bg-bg-primary text-lg text-text-muted`}>
          MISS 0
        </button>
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className={`${key} col-span-3 gap-2 border-accent-warning/60 bg-accent-warning/10 font-sans text-sm text-accent-warning`}
        >
          <Undo2 size={18} aria-hidden /> Undo Last Dart
        </button>
      </div>
    </div>
  );
}
