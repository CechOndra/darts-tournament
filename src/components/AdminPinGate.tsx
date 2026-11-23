import { ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useControl } from '../hooks/ControlProvider.tsx';
import { describeControlError } from '../services/control/index.ts';
import { verifyAdminPin } from '../services/tableOps.ts';
import { Button, Modal, Notice, TextInput } from './ui.tsx';

/**
 * "Only the admin can do this": the host types the Admin PIN, this ONE action runs,
 * and the tablet goes straight back to scorer rights.
 */
export function AdminPinGate({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const { api } = useControl();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyAdminPin(api, pin);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(describeControlError(err));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon={ShieldCheck} busy={busy} disabled={pin.length !== 6} onClick={() => void submit()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-sm">{children}</div>
        <p className="text-xs text-text-muted">Only the admin can do this. Admin: type your 6-digit Admin PIN. It is used for this one action only.</p>
        <TextInput
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Admin PIN"
          maxLength={6}
          className="text-center font-mono text-2xl tracking-[0.5em]"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && pin.length === 6 && void submit()}
          autoFocus
        />
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
