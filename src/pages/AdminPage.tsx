import { LayoutGrid, Lock, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { RouteHeader } from '../components/RouteHeader.tsx';
import { ConnectionBadge } from '../components/StatusIndicators.tsx';
import { Button, Notice } from '../components/ui.tsx';
import { useControl } from '../hooks/ControlProvider.tsx';
import { TournamentScope } from '../hooks/TransportProvider.tsx';
import { AdminWorkspace } from './admin/AdminWorkspace.tsx';
import { CreateTournamentWizard } from './admin/CreateTournamentWizard.tsx';
import { HostGate } from './admin/HostGate.tsx';
import { TournamentList } from './admin/TournamentList.tsx';

const SELECTED_KEY = 'darts.admin.selected';
const readSelected = () => {
  try {
    return globalThis.sessionStorage?.getItem(SELECTED_KEY) ?? null;
  } catch {
    return null;
  }
};

export function AdminPage() {
  const { hostToken } = useControl();
  return hostToken ? <AdminConsole /> : <HostGate />;
}

type View = 'list' | 'create' | 'manage';

function AdminConsole() {
  const { api, hostToken, setHostToken, activeTournamentId, env } = useControl();
  const [selectedId, setSelectedIdState] = useState<string | null>(readSelected);
  const [view, setView] = useState<View>(() => (readSelected() ? 'manage' : 'list'));

  const setSelectedId = useCallback((id: string | null) => {
    try {
      if (id) globalThis.sessionStorage?.setItem(SELECTED_KEY, id);
      else globalThis.sessionStorage?.removeItem(SELECTED_KEY);
    } catch {
      /* ignore */
    }
    setSelectedIdState(id);
  }, []);

  // Default to the live tournament when nothing is selected yet.
  useEffect(() => {
    if (!selectedId && activeTournamentId && view === 'list') {
      setSelectedId(activeTournamentId);
      setView('manage');
    }
  }, [activeTournamentId, selectedId, view, setSelectedId]);

  // Drop expired / revoked host sessions.
  useEffect(() => {
    if (!hostToken) return;
    api.validateSession(hostToken, null).then(
      (s) => !s.valid && setHostToken(null),
      () => undefined,
    );
  }, [api, hostToken, setHostToken]);

  const lock = async () => {
    if (hostToken) await api.logout(hostToken).catch(() => undefined);
    setHostToken(null);
  };

  const lockButton = (
    <Button size="sm" variant="danger" icon={Lock} onClick={lock}>
      Lock Session
    </Button>
  );

  if (view === 'manage' && selectedId) {
    return (
      <TournamentScope tournamentId={selectedId}>
        <AdminWorkspace
          tournamentId={selectedId}
          onShowList={() => setView('list')}
          onDeleted={() => {
            setSelectedId(null);
            setView('list');
          }}
          lockButton={lockButton}
        />
      </TournamentScope>
    );
  }

  return (
    <div className="min-h-dvh bg-bg-primary">
      <RouteHeader
        icon={ShieldCheck}
        title="Admin Control"
        subtitle={view === 'create' ? 'New tournament' : 'All tournaments'}
        actions={
          <>
            <ConnectionBadge />
            {selectedId && view !== 'manage' && (
              <Button size="sm" icon={LayoutGrid} onClick={() => setView('manage')}>
                Back to tournament
              </Button>
            )}
            {lockButton}
          </>
        }
      />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        {env.fallbackReason && <Notice tone="info">{env.fallbackReason}</Notice>}
        {view === 'create' ? (
          <div className="surface p-4 sm:p-6">
            <h2 className="mb-4 font-display text-lg tracking-wide uppercase">New Tournament</h2>
            <CreateTournamentWizard
              hasLive={!!activeTournamentId}
              onCancel={() => setView('list')}
              onCreated={(id) => {
                setSelectedId(id);
                setView('manage');
              }}
            />
          </div>
        ) : (
          <TournamentList
            selectedId={selectedId}
            onCreate={() => setView('create')}
            onOpen={(id) => {
              setSelectedId(id);
              setView('manage');
            }}
          />
        )}
      </main>
    </div>
  );
}
