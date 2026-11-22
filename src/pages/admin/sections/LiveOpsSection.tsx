import { Download, KeyRound, ShieldAlert, Smartphone, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge, Button, Field, Modal, Notice, Select, TextInput } from '../../../components/ui.tsx';
import { useControl } from '../../../hooks/ControlProvider.tsx';
import { useDispatch, useTransportContext } from '../../../hooks/TransportProvider.tsx';
import { useAsyncAction } from '../../../hooks/useTransport.ts';
import { describeControlError } from '../../../services/control/index.ts';
import { countActiveScorers, countByRole } from '../../../services/presence.ts';
import { backupFileName, createBackup, parseBackup, rotatePinAndKick } from '../../../services/tournamentOps.ts';
import type { TournamentState } from '../../../engine/state.ts';

export function PinRotation({ compact = false }: { compact?: boolean }) {
  const { api, hostToken } = useControl();
  const { transport, peers } = useTransportContext();
  const [pin, setPin] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useAsyncAction();
  const scorers = countActiveScorers(peers);

  const rotate = async () => {
    if (!hostToken) return;
    const v = await run(() => rotatePinAndKick(api, transport, hostToken, pin), describeControlError);
    if (v !== undefined) {
      setDone(`New PIN ${pin} is active. All scorer tablets were locked.`);
      setPin('');
    }
  };

  return (
    <div className="space-y-2">
      {scorers > 1 && (
        <Notice tone="danger">
          <span className="flex items-center gap-2 font-semibold">
            <ShieldAlert size={16} aria-hidden /> {scorers} scorer devices are unlocked. Rotate the PIN to kick everyone out.
          </span>
        </Notice>
      )}
      <div className={`flex flex-wrap items-end gap-2 ${compact ? '' : ''}`}>
        <Field label="New scorer PIN">
          {(id) => (
            <TextInput
              id={id}
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="0000"
              className="w-28 text-center font-mono tracking-[0.4em]"
              value={pin}
              onChange={(e) => {
                setDone(null);
                setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
              }}
            />
          )}
        </Field>
        <Button variant={scorers > 1 ? 'danger' : 'secondary'} icon={KeyRound} disabled={pin.length !== 4} busy={busy} onClick={rotate}>
          Rotate PIN & Kick All
        </Button>
      </div>
      {done && <Notice tone="success">{done}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

export function LiveOpsSection({ state }: { state: TournamentState }) {
  const { peers, envelope } = useTransportContext();
  const dispatch = useDispatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<TournamentState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const roles = countByRole(peers);

  const exportBackup = () => {
    if (!envelope) return;
    const backup = createBackup(envelope);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(backup);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (file: File | undefined) => {
    setImportError(null);
    if (!file || !state.meta) return;
    try {
      setPendingImport(parseBackup(await file.text(), state.meta.id));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-text-muted uppercase">
          <Smartphone size={14} aria-hidden /> Connected devices
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(roles).map(([role, n]) => (
            <Badge key={role} tone={role === 'scorer' && countActiveScorers(peers) > 1 ? 'danger' : 'muted'}>
              {role}: {n}
            </Badge>
          ))}
          {peers.length === 0 && <span className="text-sm text-text-muted">No devices connected.</span>}
        </div>
      </div>

      <PinRotation />

      <Field label="Table scorer duty (next match)" hint="Automatic = loser of the previous match scores next (Match 1: Admin).">
        {(id) => (
          <Select
            id={id}
            value={state.scorerDutyOverride ?? ''}
            onChange={(e) => void dispatch({ type: 'SET_SCORER_DUTY_OVERRIDE', value: e.target.value || null }, { persist: 'immediate' })}
          >
            <option value="">Automatic (loser scores next)</option>
            <option value="ADMIN">Admin (Host)</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        )}
      </Field>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Backup</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={exportBackup}>
            Export Backup (.json)
          </Button>
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>
            Import Backup (.json)
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        {importError && <div className="mt-2"><Notice tone="danger">{importError}</Notice></div>}
      </div>

      {pendingImport && (
        <Modal
          title="Restore backup?"
          onClose={() => setPendingImport(null)}
          footer={
            <>
              <Button onClick={() => setPendingImport(null)}>Cancel</Button>
              <Button
                variant="danger"
                icon={Upload}
                onClick={async () => {
                  await dispatch({ type: 'REPLACE_STATE', state: pendingImport }, { persist: 'immediate' });
                  setPendingImport(null);
                }}
              >
                Replace current data
              </Button>
            </>
          }
        >
          <p>
            This replaces everything in <strong>{state.meta?.name}</strong> with the backup "{pendingImport.meta?.name}" ({pendingImport.teams.length} teams,{' '}
            {pendingImport.matches.length} matches). All connected devices update immediately.
          </p>
        </Modal>
      )}
    </div>
  );
}
