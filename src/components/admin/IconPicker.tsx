import { Shapes } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui.tsx';
import { ICON_COLORS, iconDataUrl, loadIcons, type IconKind } from '../../services/media/placeholders.ts';
import type { PlaceholderIcon } from '../../assets/placeholderIcons.ts';

/** Placeholder icon picker for a player (avatar) or team (logo): pick a colour, then an icon. */
export function IconPicker({ kind, label, onPick }: { kind: IconKind; label: string; onPick: (dataUrl: string) => void }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(ICON_COLORS[5]!);
  const [icons, setIcons] = useState<PlaceholderIcon[]>([]);
  useEffect(() => {
    if (open && !icons.length) void loadIcons().then((s) => setIcons(kind === 'player' ? s.PLAYER_ICONS : s.TEAM_ICONS));
  }, [open, icons.length, kind]);
  return (
    <>
      <Button size="sm" icon={Shapes} aria-label={label} title={label} onClick={() => setOpen((o) => !o)} className="shrink-0" />
      {open && (
        <div className="basis-full space-y-2 rounded-md border border-border-subtle bg-bg-primary p-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon colour">
            {ICON_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={c} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${c === color ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
            {icons.map((ic) => (
              <button
                key={ic.id}
                type="button"
                title={ic.id}
                aria-label={ic.id}
                onClick={() => {
                  onPick(iconDataUrl(ic.d, color));
                  setOpen(false);
                }}
                className="aspect-square overflow-hidden rounded-md"
                style={{ background: color }}
              >
                <svg viewBox="0 0 512 512" className="h-full w-full">
                  <path fill="#fff" d={ic.d} />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
