import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface RouteHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function RouteHeader({ icon: Icon, title, subtitle, actions }: RouteHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg-elevated text-accent-gold">
          <Icon size={22} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold tracking-wide uppercase">{title}</h1>
          {subtitle && <p className="truncate text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Placeholder({ milestone, children }: { milestone: number; children: ReactNode }) {
  return (
    <div className="surface p-5 text-sm text-text-muted">
      <p className="mb-1 font-display text-xs tracking-widest text-accent-gold uppercase">Milestone {milestone}</p>
      {children}
    </div>
  );
}
