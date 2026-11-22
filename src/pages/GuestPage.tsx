import { CalendarClock, Layers, Radio, Trophy, Volume2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Placeholder } from '../components/RouteHeader.tsx';
import { ConnectionBadge } from '../components/StatusIndicators.tsx';
import { usePresenceRole } from '../hooks/useTransport.ts';

type Tab = 'live' | 'schedule' | 'standings' | 'cards' | 'sound';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { id: 'standings', label: 'Standings', icon: Trophy },
  { id: 'cards', label: 'Cards', icon: Layers },
  { id: 'sound', label: 'Sound', icon: Volume2 },
];

/** iPhone-first (390–430 px) guest companion with safe-area aware bottom tabs. */
export function GuestPage() {
  usePresenceRole('guest');
  const [tab, setTab] = useState<Tab>('live');
  const active = TABS.find((t) => t.id === tab) ?? TABS[0]!;

  return (
    <div className="touch-route flex min-h-dvh flex-col bg-bg-primary">
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-surface px-4 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <h1 className="font-display text-lg font-semibold tracking-wide uppercase">Darts Live</h1>
        <ConnectionBadge />
      </header>

      <main className="flex-1 p-4 pb-28">
        <h2 className="mb-3 font-display text-sm tracking-widest text-text-muted uppercase">{active.label}</h2>
        <Placeholder milestone={5}>
          The guest companion ({active.label.toLowerCase()}) goes live in Milestone 5, once the core scoring
          and card engine exist.
        </Placeholder>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border-subtle bg-bg-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Guest sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`touch-target flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
              tab === id ? 'text-accent-gold' : 'text-text-muted'
            }`}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
