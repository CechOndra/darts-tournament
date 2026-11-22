import { Activity, Maximize, Minimize, Wifi, WifiOff } from 'lucide-react';
import { useTransportContext } from '../hooks/TransportProvider.tsx';
import { useFullscreen, usePing } from '../hooks/useTransport.ts';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  connected: 'Live',
  reconnecting: 'Reconnecting',
  disconnected: 'Offline',
  error: 'Error',
};

const MODE_LABEL: Record<string, string> = {
  supabase: 'Cloud',
  local: 'LAN',
  loopback: 'Local only',
};

export function ConnectionBadge() {
  const { status, env } = useTransportContext();
  const live = status === 'connected';
  const Icon = live ? Wifi : WifiOff;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-elevated px-2.5 py-1 text-xs font-medium"
      title={env.fallbackReason ?? `Transport: ${env.mode}`}
    >
      <Icon size={14} className={live ? 'text-accent-success' : 'text-accent-warning'} aria-hidden />
      <span>{STATUS_LABEL[status]}</span>
      <span className="text-text-muted">· {MODE_LABEL[env.mode]}</span>
    </span>
  );
}

export function PingIndicator() {
  const ping = usePing();
  const tone = ping === null ? 'text-text-muted' : ping < 100 ? 'text-accent-success' : ping < 250 ? 'text-accent-warning' : 'text-accent-danger';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-elevated px-2.5 py-1 font-mono text-xs">
      <Activity size={14} className={tone} aria-hidden />
      <span>Ping: {ping === null ? '--' : ping} ms</span>
    </span>
  );
}

export function FullscreenButton() {
  const { isFullscreen, toggle, supported } = useFullscreen();
  if (!supported) return null;
  const Icon = isFullscreen ? Minimize : Maximize;
  return (
    <button
      type="button"
      onClick={toggle}
      className="touch-target inline-flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-elevated px-3 text-sm font-medium hover:border-border-strong"
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      <Icon size={18} aria-hidden />
      <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
    </button>
  );
}
