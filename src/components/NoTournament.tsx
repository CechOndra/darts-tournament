import { Target } from 'lucide-react';

export function NoTournament({ loading, message }: { loading?: boolean; message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg-primary p-6 text-center">
      <Target size={56} className="text-accent-primary" aria-hidden />
      <p className="font-display text-2xl tracking-wide uppercase">{loading ? 'Connecting...' : 'No live tournament'}</p>
      {!loading && <p className="max-w-sm text-sm text-text-muted">{message ?? 'The host has not started a tournament yet. This screen updates automatically.'}</p>}
    </div>
  );
}
