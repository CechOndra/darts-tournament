import { ServerCog, ShieldCheck, Users } from 'lucide-react';
import { Placeholder, RouteHeader } from '../components/RouteHeader.tsx';
import { ConnectionBadge, PingIndicator } from '../components/StatusIndicators.tsx';
import { useTransportContext } from '../hooks/TransportProvider.tsx';
import { usePresenceRole } from '../hooks/useTransport.ts';
import { countActiveScorers, countByRole } from '../services/presence.ts';

export function AdminPage() {
  usePresenceRole('admin');
  const { env, envelope, status, peers, connectError, transport } = useTransportContext();
  const roles = countByRole(peers);

  const rows: [string, string][] = [
    ['Transport', env.mode + (env.requestedMode !== env.mode ? ` (requested: ${env.requestedMode})` : '')],
    ['Status', status],
    ['Tournament ID', env.tournamentId],
    ['State version', envelope ? String(envelope.version) : 'none yet'],
    ['Client ID', transport.clientId],
    ['Active scorers', String(countActiveScorers(peers))],
  ];

  return (
    <div className="min-h-dvh bg-bg-primary">
      <RouteHeader
        icon={ShieldCheck}
        title="Admin Control"
        subtitle="Tournament setup & live operations"
        actions={
          <>
            <PingIndicator />
            <ConnectionBadge />
          </>
        }
      />
      <main className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-3">
        <section className="surface p-4 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm tracking-widest text-text-muted uppercase">
            <ServerCog size={16} aria-hidden /> Realtime Diagnostics
          </h2>
          {(env.fallbackReason || connectError) && (
            <p className="mb-3 rounded-md border border-accent-warning/40 bg-accent-warning/10 px-3 py-2 text-sm text-accent-warning">
              {connectError ?? env.fallbackReason}
            </p>
          )}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-border-subtle py-1.5">
                <dt className="text-text-muted">{k}</dt>
                <dd className="truncate font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="surface p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm tracking-widest text-text-muted uppercase">
            <Users size={16} aria-hidden /> Connected Devices ({peers.length})
          </h2>
          <ul className="space-y-1.5 text-sm">
            {Object.entries(roles).map(([role, n]) => (
              <li key={role} className="flex justify-between rounded-md bg-bg-elevated px-3 py-2">
                <span className="capitalize">{role}</span>
                <span className="font-mono">{n}</span>
              </li>
            ))}
            {peers.length === 0 && <li className="text-text-muted">No presence data yet.</li>}
          </ul>
        </section>

        <div className="lg:col-span-3">
          <Placeholder milestone={2}>
            Admin login, tournament creation, CSV roster import, photo compressor, Scorer PIN rotation and
            visibility toggles arrive in Milestone 2.
          </Placeholder>
        </div>
      </main>
    </div>
  );
}
