import { Copy, ExternalLink, Hash, Monitor, MonitorUp, MonitorX, Smartphone, Tablet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { QrCode } from '../../../components/JoinQr.tsx';
import { Button, Field, Notice, TextInput, Toggle } from '../../../components/ui.tsx';
import type { TournamentState } from '../../../engine/state.ts';
import { useControl } from '../../../hooks/ControlProvider.tsx';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';
import { useAsyncAction } from '../../../hooks/useTransport.ts';
import { describeControlError } from '../../../services/control/index.ts';
import { appUrl, openAppWindow, type AppRoute } from '../../../services/links.ts';

/** One-click windows for every screen, plus the guest link / QR. */
export function ScreensSection({ state, isLive }: { state: TournamentState; isLive: boolean }) {
  const dispatch = useDispatch();
  const [copied, setCopied] = useState(false);
  // Not live: pin the links to this tournament so the preview shows it.
  const pin = isLive ? null : (state.meta?.id ?? null);
  const guest = appUrl('', pin);
  const qrOnStage = state.stageOverlay?.kind === 'QR';
  const screens: { route: AppRoute; label: string; icon: typeof Monitor }[] = [
    { route: 'stage', label: 'Stage (projector)', icon: Monitor },
    { route: 'scorer', label: 'Scorer (tablet)', icon: Tablet },
    { route: '', label: 'Guest (phone)', icon: Smartphone },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {screens.map(({ route, label, icon }) => (
          <Button key={route || 'guest'} icon={icon} onClick={() => openAppWindow(route, pin)} className="justify-start">
            <span className="truncate">{label}</span>
            <ExternalLink size={14} className="ml-auto shrink-0 text-text-muted" aria-hidden />
          </Button>
        ))}
      </div>
      <Toggle
        label="Small QR code on the stage between matches"
        checked={state.settings.visibility.showJoinQr !== false}
        onChange={(showJoinQr) => void dispatch({ type: 'UPDATE_VISIBILITY', patch: { showJoinQr } }, { persist: 'immediate' })}
      />
      {!isLive && <Notice tone="info">This tournament is not live: the links open it directly (with ?t=) instead of the live one.</Notice>}
      <div className="flex flex-wrap items-center gap-4">
        <QrCode url={guest} size={132} label="QR code of the guest link" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm">Guests scan this with their phone camera to open the live view, schedule, cards and soundboard. No typing, no app.</p>
          <p className="truncate font-mono text-xs text-text-muted">{guest}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={Copy}
              onClick={() =>
                void navigator.clipboard?.writeText(guest).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? 'Copied' : 'Copy guest link'}
            </Button>
            <Button
              size="sm"
              variant={qrOnStage ? 'gold' : 'secondary'}
              icon={qrOnStage ? MonitorX : MonitorUp}
              onClick={() => void dispatch({ type: 'SET_STAGE_OVERLAY', overlay: qrOnStage ? null : { kind: 'QR' } }, { persist: 'immediate' })}
            >
              {qrOnStage ? 'Hide big QR on stage' : 'Show big QR on stage'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Optional 6-digit Admin PIN: quick host login on the scorer tablet. */
export function AdminPinCard() {
  const { api, hostToken } = useControl();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useAsyncAction();
  useEffect(() => {
    void api.hostStatus().then((s) => setEnabled(!!s.adminPinEnabled), () => setEnabled(false));
  }, [api]);

  const save = async (value: string | null) => {
    if (!hostToken) return;
    const ok = await run(async () => {
      await api.setAdminPin(hostToken, value);
      return true;
    }, describeControlError);
    if (ok) {
      setEnabled(!!value);
      setPin('');
      setDone(value ? 'Admin PIN saved. Any tablet logged in with the old PIN was logged out.' : 'Admin PIN turned off.');
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-muted">
        The scorer tablet asks for this PIN for admin-only actions (pause, restart, start over). Each use approves one action only. It also works instead of the password on the admin login. {enabled ? 'Currently ON.' : 'Currently OFF.'}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={enabled ? 'New Admin PIN' : 'Admin PIN'}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="w-36 text-center font-mono tracking-[0.4em]"
              value={pin}
              onChange={(e) => {
                setDone(null);
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
            />
          )}
        </Field>
        <Button icon={Hash} disabled={pin.length !== 6} busy={busy} onClick={() => void save(pin)}>
          {enabled ? 'Change PIN' : 'Set PIN'}
        </Button>
        {enabled && (
          <Button variant="ghost" busy={busy} onClick={() => void save(null)}>
            Turn off
          </Button>
        )}
      </div>
      <p className="text-xs text-text-muted">6 digits, different from the scorer PIN. 5 wrong tries lock it for 10 minutes. Change it if someone saw it.</p>
      {done && <Notice tone="success">{done}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
