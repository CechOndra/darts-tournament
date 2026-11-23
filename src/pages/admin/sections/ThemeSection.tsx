import { Check, Paintbrush, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui.tsx';
import type { TournamentState } from '../../../engine/state.ts';
import { DEFAULT_THEME, THEMES, type ThemeId } from '../../../engine/themes.ts';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';

const SWATCHES = ['#ffd60a', '#f59e0b', '#f97316', '#e11d48', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e'];

/** Theme presets with live preview tiles + an optional main color. Applies to every device. */
export function ThemeSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const theme = state.settings.theme ?? DEFAULT_THEME;
  const [custom, setCustom] = useState(theme.accent ?? '#ffd60a');
  const set = (preset: ThemeId, accent: string | null) => void dispatch({ type: 'SET_THEME', theme: { preset, accent } }, { persist: 'immediate' });

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Changes colors on every screen (stage, tablet, phones, admin). Layout and game logic stay the same. Classic is the original look.</p>
      <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const [bg, surface, text, accent, primary] = t.preview;
          const selected = theme.preset === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => set(t.id, theme.accent)}
              className={`overflow-hidden rounded-lg border-2 text-left transition ${selected ? 'border-accent-gold' : 'border-border-subtle hover:border-border-strong'}`}
            >
              {/* Mini preview painted with the theme's own colors */}
              <div className="flex h-20 items-center gap-2 p-3" style={{ background: bg }}>
                <div className="flex h-full flex-1 flex-col justify-center gap-1.5 rounded-md px-2" style={{ background: surface, border: t.id === 'pop' ? '2px solid #141414' : undefined }}>
                  <span className="block h-2 w-3/4 rounded" style={{ background: text }} />
                  <span className="block h-2 w-1/2 rounded" style={{ background: theme.accent ?? accent }} />
                </div>
                <span className="h-8 w-14 rounded-full" style={{ background: theme.accent ?? primary, border: t.id === 'pop' ? '2px solid #141414' : undefined }} />
              </div>
              <div className="flex items-start gap-2 bg-bg-surface p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.name}</span>
                  <span className="block text-xs text-text-muted">{t.description}</span>
                </span>
                {selected && <Check size={18} className="shrink-0 text-accent-gold" aria-hidden />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Main color (optional)</p>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Main color ${c}`}
              onClick={() => set(theme.preset, c)}
              className={`h-9 w-9 rounded-full border-2 ${theme.accent === c ? 'border-text-primary ring-2 ring-accent-gold' : 'border-border-strong'}`}
              style={{ background: c }}
            />
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border-strong bg-transparent" aria-label="Custom main color" />
            <Button size="sm" icon={Paintbrush} onClick={() => set(theme.preset, custom)}>
              Use this color
            </Button>
          </label>
          {theme.accent && (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => set(theme.preset, null)}>
              Theme default
            </Button>
          )}
        </div>
        <p className="text-xs text-text-muted">Replaces the theme's highlight and main button color. Text on it switches between black and white automatically.</p>
      </div>
      {(theme.preset !== 'classic' || theme.accent) && (
        <Button icon={RotateCcw} onClick={() => set('classic', null)}>
          Back to Classic
        </Button>
      )}
    </div>
  );
}
