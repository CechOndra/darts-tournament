import { useCallback, useEffect, useState } from 'react';
import type { ClientRole } from '../services/transport/index.ts';
import { useTransportContext } from './TransportProvider.tsx';

/** Announce which route/role this client is on (drives Presence-based alerts). */
export function usePresenceRole(role: ClientRole, unlocked = false) {
  const { transport, status } = useTransportContext();
  useEffect(() => {
    if (status === 'connected') void transport.updatePresence({ role, unlocked });
  }, [transport, status, role, unlocked]);
}

/** Periodic round-trip ping in ms (null while unknown / disconnected). */
export function usePing(intervalMs = 5000): number | null {
  const { transport, status } = useTransportContext();
  const [ping, setPing] = useState<number | null>(null);
  useEffect(() => {
    if (status !== 'connected') {
      setPing(null);
      return;
    }
    let cancelled = false;
    const run = () =>
      transport
        .measureLatency()
        .then((ms) => !cancelled && setPing(ms))
        .catch(() => !cancelled && setPing(null));
    void run();
    const id = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [transport, status, intervalMs]);
  return ping;
}

/** Browser Fullscreen API wrapper for 1-tap kiosk mode on tablets / projectors. */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (err) {
      console.warn('[fullscreen] not available', err);
    }
  }, []);
  const supported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  return { isFullscreen, toggle, supported };
}
