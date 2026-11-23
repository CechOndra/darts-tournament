import { Undo2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Multiplier } from '../../engine/scoring.ts';
import type { KeypadLayout } from '../../engine/types.ts';

export interface KeypadProps {
  layout: KeypadLayout;
  /** MODIFIER layout only: DOUBLE/TRIPLE stays on until tapped again (otherwise it applies to one dart). */
  stickyModifier?: boolean;
  onDart: (segment: number, multiplier: Multiplier) => void;
  onUndo: () => void;
  disabled?: boolean;
  canUndo: boolean;
  /** Card restrictions (Bottom Half / Parity Lock): darts that score 0 are dimmed but still tappable. */
  isDimmed?: (segment: number, multiplier: Multiplier) => boolean;
  /** Text for the undo key (e.g. "Undo Card: Extra Dart" when the last action was a card). */
  undoLabel?: string;
}

const TONE: Record<number, string> = {
  1: 'bg-bg-elevated border-border-subtle hover:border-border-strong',
  2: 'bg-accent-secondary/15 border-accent-secondary/50 text-accent-secondary',
  3: 'bg-accent-primary/15 border-accent-primary/50 text-accent-primary',
};
const PREFIX: Record<number, string> = { 1: 'S', 2: 'D', 3: 'T' };
const KEY = 'flex min-h-11 min-w-0 items-center justify-center rounded-md border font-mono font-bold transition active:scale-95 disabled:opacity-40';
const range = (from: number, n = 10) => Array.from({ length: n }, (_, i) => from + i);

const DIM = 'opacity-30 saturate-0';

function DartKey({ seg, mult, disabled, onDart, dim, className = '' }: { seg: number; mult: Multiplier; disabled?: boolean; onDart: KeypadProps['onDart']; dim?: KeypadProps['isDimmed']; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onDart(seg, mult)}
      className={`${KEY} text-base ${TONE[mult]} ${dim?.(seg, mult) ? DIM : ''} ${className}`}
      aria-label={`${PREFIX[mult]}${seg}`}
    >
      <span className="text-[0.65em] opacity-70">{PREFIX[mult]}</span>
      {seg}
    </button>
  );
}

function Rows({ rows, disabled, onDart, dim }: { rows: { mult: Multiplier; from: number }[]; disabled?: boolean; onDart: KeypadProps['onDart']; dim?: KeypadProps['isDimmed'] }) {
  return (
    <>
      {rows.map(({ mult, from }) => (
        <div key={`${mult}-${from}`} className="grid grid-cols-10 gap-1.5">
          {range(from).map((seg) => (
            <DartKey key={seg} seg={seg} mult={mult} disabled={disabled} onDart={onDart} dim={dim} />
          ))}
        </div>
      ))}
    </>
  );
}

function SpecialRow({ disabled, onDart, onUndo, canUndo, after, isDimmed, undoLabel }: Omit<KeypadProps, 'layout'> & { after?: () => void }) {
  const hit = (seg: number, mult: Multiplier) => {
    onDart(seg, mult);
    after?.();
  };
  return (
    <div className="grid grid-cols-10 gap-1.5">
      <button type="button" disabled={disabled} onClick={() => hit(25, 1)} aria-label="Outer bull 25" className={`${KEY} col-span-2 border-border-subtle bg-bg-elevated text-lg ${isDimmed?.(25, 1) ? DIM : ''}`}>
        25
      </button>
      <button type="button" disabled={disabled} onClick={() => hit(50, 1)} aria-label="Bullseye 50" className={`${KEY} col-span-2 border-accent-gold/60 bg-accent-gold/15 text-lg text-accent-gold ${isDimmed?.(50, 1) ? DIM : ''}`}>
        BULL
      </button>
      <button type="button" disabled={disabled} onClick={() => hit(0, 0)} aria-label="Miss" className={`${KEY} col-span-3 border-border-strong bg-bg-primary text-lg text-text-muted`}>
        MISS 0
      </button>
      <button type="button" disabled={!canUndo} onClick={onUndo} className={`${KEY} col-span-3 gap-2 border-accent-warning/60 bg-accent-warning/10 font-sans text-sm text-accent-warning`}>
        <Undo2 size={18} aria-hidden /> <span className="truncate">{undoLabel ?? 'Undo Last Dart'}</span>
      </button>
    </div>
  );
}

function Shell({ rows, children }: { rows: number; children: ReactNode }) {
  return (
    <div className="grid h-full min-h-0 gap-1.5" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }} role="group" aria-label="Dart keypad">
      {children}
    </div>
  );
}

function ModifierPad(props: KeypadProps) {
  const { disabled, onDart, stickyModifier, isDimmed } = props;
  const [mod, setMod] = useState<Multiplier>(1);
  const toggle = (m: Multiplier) => setMod((cur) => (cur === m ? 1 : m));
  const reset = () => !stickyModifier && setMod(1);
  const modBtn = (m: Multiplier, label: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={mod === m}
      onClick={() => toggle(m)}
      className={`${KEY} col-span-1 font-display text-xl tracking-widest uppercase ${
        mod === m ? (m === 2 ? 'border-accent-secondary bg-accent-secondary text-text-inverse' : 'border-accent-primary bg-accent-primary text-on-primary') : TONE[m]
      }`}
    >
      {label}
      {mod === m && stickyModifier && <span className="ml-2 font-sans text-xs tracking-normal opacity-80">(locked)</span>}
    </button>
  );
  return (
    <Shell rows={6}>
      <div className="grid grid-cols-2 gap-1.5">
        {modBtn(2, 'Double')}
        {modBtn(3, 'Triple')}
      </div>
      {[1, 6, 11, 16].map((from) => (
        <div key={from} className="grid grid-cols-5 gap-1.5">
          {range(from, 5).map((seg) => (
            <button
              key={seg}
              type="button"
              disabled={disabled}
              onClick={() => {
                onDart(seg, mod);
                reset();
              }}
              aria-label={`${PREFIX[mod]}${seg}`}
              className={`${KEY} text-2xl ${TONE[mod]} ${isDimmed?.(seg, mod) ? DIM : ''}`}
            >
              {mod !== 1 && <span className="text-[0.6em] opacity-70">{PREFIX[mod]}</span>}
              {seg}
            </button>
          ))}
        </div>
      ))}
      <SpecialRow {...props} after={reset} />
    </Shell>
  );
}

function ColumnsPad(props: KeypadProps) {
  const { disabled, onDart, isDimmed } = props;
  const block = (from: number) => (
    <div className="grid min-h-0 gap-1.5" style={{ gridTemplateRows: 'repeat(10, minmax(0, 1fr))' }}>
      {range(from).map((seg) => (
        <div key={seg} className="grid grid-cols-3 gap-1.5">
          {([1, 2, 3] as Multiplier[]).map((m) => (
            <DartKey key={m} seg={seg} mult={m} disabled={disabled} onDart={onDart} dim={isDimmed} />
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,10fr)_minmax(0,1fr)] gap-1.5" role="group" aria-label="Dart keypad">
      <div className="grid min-h-0 grid-cols-2 gap-3">
        {block(1)}
        {block(11)}
      </div>
      <SpecialRow {...props} />
    </div>
  );
}

/** 1-tap per-dart keypad in four layouts (every tap is one dart). */
export function DartKeypad(props: KeypadProps) {
  const { layout, disabled, onDart, isDimmed } = props;
  if (layout === 'MODIFIER') return <ModifierPad {...props} />;
  if (layout === 'COLUMNS') return <ColumnsPad {...props} />;
  const rows: { mult: Multiplier; from: number }[] =
    layout === 'STACKED_ROWS'
      ? [
          { mult: 1, from: 1 },
          { mult: 1, from: 11 },
          { mult: 2, from: 1 },
          { mult: 2, from: 11 },
          { mult: 3, from: 1 },
          { mult: 3, from: 11 },
        ]
      : [
          { mult: 1, from: 1 },
          { mult: 2, from: 1 },
          { mult: 3, from: 1 },
          { mult: 1, from: 11 },
          { mult: 2, from: 11 },
          { mult: 3, from: 11 },
        ];
  return (
    <Shell rows={7}>
      <Rows rows={rows} disabled={disabled} onDart={onDart} dim={isDimmed} />
      <SpecialRow {...props} />
    </Shell>
  );
}
