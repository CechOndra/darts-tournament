import { Archive, ArchiveRestore, FolderOpen, Plus, Radio, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Modal, Notice, TextInput, Toggle } from '../../components/ui.tsx';
import { useControl } from '../../hooks/ControlProvider.tsx';
import { useAsyncAction } from '../../hooks/useTransport.ts';
import { describeControlError, type TournamentSummary } from '../../services/control/index.ts';

const fmt = (ms: number) =>
  Number.isFinite(ms) ? new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

export function TournamentList({ selectedId, onOpen, onCreate }: { selectedId: string | null; onOpen: (id: string) => void; onCreate: () => void }) {
  const { api, hostToken, activeTournamentId, refreshActive } = useControl();
  const [items, setItems] = useState<TournamentSummary[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TournamentSummary | null>(null);
  const [typed, setTyped] = useState('');
  const { busy, error, run } = useAsyncAction();

  const load = useCallback(() => {
    void run(async () => setItems(await api.listTournaments()), describeControlError);
  }, [api, run]);

  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    if (!hostToken) return;
    await run(fn, describeControlError);
    await refreshActive();
    load();
  };

  const visible = (items ?? []).filter((t) => showArchived || !t.archived || t.id === activeTournamentId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg tracking-wide uppercase">Tournaments</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" icon={RefreshCw} onClick={load} busy={busy} aria-label="Refresh list" />
          <Button size="sm" variant="primary" icon={Plus} onClick={onCreate}>
            New Tournament
          </Button>
        </div>
      </div>

      <Toggle label="Show archived" checked={showArchived} onChange={setShowArchived} />
      {error && <Notice tone="danger">{error}</Notice>}
      {items && visible.length === 0 && (
        <div className="surface p-6 text-center text-sm text-text-muted">No tournaments yet. Create your first one to get started.</div>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((t) => {
          const live = t.id === activeTournamentId;
          return (
            <li key={t.id} className={`surface flex flex-col gap-3 p-4 ${t.id === selectedId ? 'border-accent-gold' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg">{t.name}</p>
                  <p className="truncate font-mono text-xs text-text-muted">{t.id}</p>
                  <p className="text-xs text-text-muted">Updated {fmt(t.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {live && <Badge tone="success">LIVE</Badge>}
                  {t.archived && <Badge>Archived</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="gold" icon={FolderOpen} onClick={() => onOpen(t.id)}>
                  Manage
                </Button>
                {live ? (
                  <Button size="sm" icon={Radio} onClick={() => act(() => api.setActiveTournament(hostToken!, null))}>
                    Stop Live
                  </Button>
                ) : (
                  <Button size="sm" icon={Radio} onClick={() => act(() => api.setActiveTournament(hostToken!, t.id))}>
                    Set Live
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={t.archived ? ArchiveRestore : Archive}
                  onClick={() => act(() => api.updateTournamentMeta(hostToken!, t.id, { archived: !t.archived }))}
                >
                  {t.archived ? 'Unarchive' : 'Archive'}
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${t.name}`} onClick={() => setConfirmDelete(t)} />
              </div>
            </li>
          );
        })}
      </ul>

      {confirmDelete && (
        <Modal
          title="Delete tournament"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="danger"
                icon={Trash2}
                disabled={typed.trim() !== confirmDelete.name}
                busy={busy}
                onClick={async () => {
                  await act(() => api.deleteTournament(hostToken!, confirmDelete.id));
                  setConfirmDelete(null);
                  setTyped('');
                }}
              >
                Delete forever
              </Button>
            </>
          }
        >
          <p className="mb-3">
            This permanently deletes <strong>{confirmDelete.name}</strong> including all scores, rosters and photos. Archive it instead if
            you might want it back.
          </p>
          <TextInput aria-label="Type the tournament name to confirm" placeholder={confirmDelete.name} value={typed} onChange={(e) => setTyped(e.target.value)} />
        </Modal>
      )}
    </div>
  );
}
