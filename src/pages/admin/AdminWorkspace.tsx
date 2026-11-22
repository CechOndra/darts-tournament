import { CalendarClock, Coffee, Crosshair, Eye, KeyRound, LayoutGrid, Layers, ListOrdered, Radio, ScrollText, Settings2, ShieldAlert, ShieldCheck, Trophy, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { RouteHeader } from '../../components/RouteHeader.tsx';
import { ConnectionBadge, PingIndicator } from '../../components/StatusIndicators.tsx';
import { Badge, Button, Modal, Notice, Section, useMediaQuery } from '../../components/ui.tsx';
import { TableSettingsForm } from '../../components/admin/TableSettingsForm.tsx';
import { upNextMatch, describeSlot } from '../../engine/selectors.ts';
import { useControl } from '../../hooks/ControlProvider.tsx';
import { useDispatch, useTournamentState, useTransportContext } from '../../hooks/TransportProvider.tsx';
import { useAsyncAction, usePresenceRole } from '../../hooks/useTransport.ts';
import { describeControlError } from '../../services/control/index.ts';
import { countActiveScorers } from '../../services/presence.ts';
import { LiveOpsSection, PinRotation } from './sections/LiveOpsSection.tsx';
import { ResultsSection } from './sections/ResultsSection.tsx';
import { RosterSection } from './sections/RosterSection.tsx';
import { RulesSection } from './sections/RulesSection.tsx';
import { BreakEditor, ScheduleSection } from './sections/ScheduleSection.tsx';
import { VisibilitySection } from './sections/VisibilitySection.tsx';

type SectionId = 'live' | 'visibility' | 'roster' | 'schedule' | 'rules' | 'table';
type QuickSheet = 'pin' | 'break' | null;
type TabId = 'live' | 'results' | 'teams' | 'settings';

const TABS: { id: TabId; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'live', label: 'Live', short: 'Live', icon: Radio },
  { id: 'results', label: 'Results & Standings', short: 'Results', icon: Trophy },
  { id: 'teams', label: 'Teams', short: 'Teams', icon: Users },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: Settings2 },
];

const TAB_OF: Record<SectionId, TabId> = { live: 'live', schedule: 'live', roster: 'teams', visibility: 'settings', rules: 'settings', table: 'settings' };

export function AdminWorkspace({
  tournamentId,
  onShowList,
  onDeleted,
  lockButton,
}: {
  tournamentId: string;
  onShowList: () => void;
  onDeleted: () => void;
  lockButton: ReactNode;
}) {
  usePresenceRole('admin', true);
  const { api, hostToken, activeTournamentId, refreshActive } = useControl();
  const { transport, hydrated, peers, connectError } = useTransportContext();
  const state = useTournamentState();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const dispatch = useDispatch();
  const [tab, setTab] = useState<TabId>('live');
  const [open, setOpen] = useState<Record<SectionId, boolean>>({ live: true, visibility: false, roster: true, schedule: true, rules: false, table: true });
  const [sheet, setSheet] = useState<QuickSheet>(null);
  const { busy, error, run } = useAsyncAction();

  // Host session authorizes persisted writes for this tournament.
  useEffect(() => {
    transport.setAuthToken(hostToken);
  }, [transport, hostToken]);

  const isLive = activeTournamentId === tournamentId;
  const scorers = countActiveScorers(peers);

  const toggle = (id: SectionId) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const jump = (id: SectionId) => {
    setTab(TAB_OF[id]);
    setOpen((o) => ({ ...o, [id]: true }));
    requestAnimationFrame(() => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  if (!hydrated) {
    return <div className="flex min-h-dvh items-center justify-center bg-bg-primary text-sm text-text-muted">Loading tournament...</div>;
  }

  if (!state) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg-primary p-6 text-center">
        <p className="text-text-muted">{connectError ? `Connection problem: ${connectError}` : 'This tournament no longer exists.'}</p>
        <Button icon={LayoutGrid} onClick={onDeleted}>
          All tournaments
        </Button>
      </div>
    );
  }

  const next = upNextMatch(state);

  return (
    <div className="min-h-dvh bg-bg-primary pb-24 lg:pb-8">
      <RouteHeader
        icon={ShieldCheck}
        title={state.meta?.name ?? 'Tournament'}
        subtitle={next ? `Up next: ${describeSlot(state, next.home)} vs ${describeSlot(state, next.away)}` : 'All matches played'}
        actions={
          <>
            {scorers > 1 && (
              <button type="button" onClick={() => setSheet('pin')} className="animate-pulse">
                <Badge tone="danger">
                  <ShieldAlert size={12} className="mr-1" aria-hidden /> {scorers} SCORERS
                </Badge>
              </button>
            )}
            {isLive ? (
              <Badge tone="success">LIVE</Badge>
            ) : (
              <Button
                size="sm"
                icon={Radio}
                busy={busy}
                onClick={async () => {
                  if (!hostToken) return;
                  await run(() => api.setActiveTournament(hostToken, tournamentId), describeControlError);
                  await refreshActive();
                }}
              >
                Set Live
              </Button>
            )}
            <PingIndicator />
            <ConnectionBadge />
            <Button size="sm" icon={LayoutGrid} onClick={onShowList}>
              <span className="hidden sm:inline">All tournaments</span>
            </Button>
            {lockButton}
          </>
        }
      />

      <main className="mx-auto max-w-7xl space-y-4 p-4">
        {!isLive && <Notice tone="info">Not live: stage, scorer and guest devices are showing {activeTournamentId ? 'another tournament' : 'nothing'}.</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}

        <nav aria-label="Admin sections" className="sticky top-0 z-30 -mx-4 grid grid-cols-4 gap-1 border-b border-border-subtle bg-bg-primary px-4 py-2 sm:flex">
          {TABS.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${
                tab === id ? 'bg-accent-gold text-text-inverse' : 'text-text-muted hover:bg-bg-elevated hover:text-text-primary'
              }`}
            >
              <Icon size={16} aria-hidden />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
              {id === 'live' && scorers > 1 && <span className="h-2 w-2 rounded-full bg-accent-danger" aria-label="alert" />}
            </button>
          ))}
        </nav>

        {tab === 'live' && (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <Section id="section-live" title="Live Operations" icon={KeyRound} open={open.live} onToggle={() => toggle('live')}
              badge={scorers > 1 ? <Badge tone="danger">{scorers} scorers</Badge> : undefined}>
              <LiveOpsSection state={state} />
            </Section>
            <Section id="section-schedule" title="Schedule Queue" icon={ListOrdered} open={open.schedule} onToggle={() => toggle('schedule')}>
              <ScheduleSection state={state} />
            </Section>
          </div>
        )}

        {tab === 'results' && <ResultsSection state={state} />}

        {tab === 'teams' && (
          <Section id="section-roster" title="Teams & Roster" icon={Users} open={open.roster} onToggle={() => toggle('roster')}>
            <RosterSection state={state} />
          </Section>
        )}

        {tab === 'settings' && (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <Section id="section-table" title="Scorer Tablet" icon={Crosshair} open={open.table} onToggle={() => toggle('table')}>
                <TableSettingsForm
                  value={state.settings.table}
                  onPatch={(patch) => void dispatch({ type: 'UPDATE_TABLE_SETTINGS', patch }, { persist: 'immediate' })}
                />
              </Section>
              <Section id="section-visibility" title="Visibility" icon={Eye} open={open.visibility} onToggle={() => toggle('visibility')}>
                <VisibilitySection state={state} />
              </Section>
            </div>
            <Section id="section-rules" title="Format & Rules" icon={ScrollText} open={open.rules} onToggle={() => toggle('rules')}>
              <RulesSection state={state} />
            </Section>
          </div>
        )}
      </main>

      {!desktop && (
        <nav
          aria-label="Quick actions"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border-subtle bg-bg-surface"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <QuickAction icon={Eye} label="Visibility" onClick={() => jump('visibility')} />
          <QuickAction icon={CalendarClock} label="Next Match" onClick={() => jump('schedule')} />
          <QuickAction icon={Layers} label="Cards" disabled title="Card transfers arrive in Milestone 4" />
          <QuickAction icon={KeyRound} label="PIN" alert={scorers > 1} onClick={() => setSheet('pin')} />
          <QuickAction icon={Coffee} label="Breaks" onClick={() => setSheet('break')} />
        </nav>
      )}

      {sheet === 'pin' && (
        <Modal title="Rotate Scorer PIN" onClose={() => setSheet(null)}>
          <PinRotation compact />
        </Modal>
      )}
      {sheet === 'break' && (
        <Modal title="Schedule a break" onClose={() => setSheet(null)}>
          <BreakEditor state={state} onDone={() => setSheet(null)} />
        </Modal>
      )}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  alert,
  title,
}: {
  icon: typeof Eye;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  alert?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`touch-target flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium disabled:opacity-40 ${
        alert ? 'animate-pulse text-accent-danger' : 'text-text-muted'
      }`}
    >
      <Icon size={20} aria-hidden />
      {label}
    </button>
  );
}
