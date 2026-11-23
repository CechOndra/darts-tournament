import { Hash, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, Notice, TextInput } from '../../components/ui.tsx';
import { useControl } from '../../hooks/ControlProvider.tsx';
import { useAsyncAction } from '../../hooks/useTransport.ts';
import { describeControlError } from '../../services/control/index.ts';

/** First visit: claim the host account. Afterwards: username + password login. */
export function HostGate() {
  const { api, setHostToken } = useControl();
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [usePin, setUsePin] = useState(true);
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, setError, run } = useAsyncAction();

  useEffect(() => {
    api.hostStatus().then(
      (s) => {
        setClaimed(s.claimed);
        setPinEnabled(!!s.adminPinEnabled);
      },
      (err: unknown) => setError(describeControlError(err)),
    );
  }, [api, setError]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (claimed === false && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    const token = await run(
      () => (pinMode ? api.hostPinLogin(pin) : claimed ? api.hostLogin(username, password) : api.claimHost(username, password)),
      describeControlError,
    );
    if (token) setHostToken(token);
    else setPin('');
  };

  const isSetup = claimed === false;
  const pinMode = !!claimed && pinEnabled && usePin;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-primary p-4">
      <form onSubmit={submit} className="surface w-full max-w-sm space-y-4 p-6" aria-label={isSetup ? 'Create host account' : 'Host login'}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-bg-elevated text-accent-gold">
            {isSetup ? <UserPlus size={22} aria-hidden /> : <ShieldCheck size={22} aria-hidden />}
          </span>
          <div>
            <h1 className="font-display text-xl tracking-wide uppercase">{isSetup ? 'Create Host Account' : 'Admin Login'}</h1>
            <p className="text-xs text-text-muted">
              {isSetup ? 'One-time setup. This account manages all tournaments.' : 'Host account required to manage tournaments.'}
            </p>
          </div>
        </div>

        {claimed === null && !error && <p className="text-sm text-text-muted">Checking...</p>}

        {pinMode && (
          <Field label="Admin PIN" hint="Quick unlock for the table. Tap Lock Session when you are done.">
            {(id) => (
              <TextInput
                id={id}
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                className="text-center font-mono text-2xl tracking-[0.5em]"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            )}
          </Field>
        )}

        {claimed !== null && !pinMode && (
          <>
            <Field label="Username">
              {(id) => <TextInput id={id} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />}
            </Field>
            <Field label="Password" hint={isSetup ? 'At least 6 characters. Store it somewhere safe.' : undefined}>
              {(id) => (
                <TextInput
                  id={id}
                  type="password"
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              )}
            </Field>
            {isSetup && (
              <Field label="Confirm password">
                {(id) => (
                  <TextInput id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
                )}
              </Field>
            )}
          </>
        )}

        {error && <Notice tone="danger">{error}</Notice>}

        <Button type="submit" variant="primary" icon={KeyRound} className="w-full" busy={busy} disabled={claimed === null || (pinMode && pin.length !== 6)}>
          {isSetup ? 'Create Account' : 'Unlock Admin'}
        </Button>
        {!!claimed && pinEnabled && (
          <Button variant="ghost" icon={usePin ? KeyRound : Hash} className="w-full" onClick={() => setUsePin((v) => !v)}>
            {usePin ? 'Use username and password' : 'Use Admin PIN'}
          </Button>
        )}
      </form>
    </div>
  );
}
