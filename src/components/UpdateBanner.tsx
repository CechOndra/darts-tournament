import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Checks version.json every minute. When a newer build is deployed, every open device
 * (stage, tablet, phones, admin) shows a reload bar: mixed versions can disagree on
 * match flow, so everyone should run the same one.
 */
export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let alive = true;
    const check = () =>
      fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((v: { build?: string } | null) => {
          if (alive && v?.build && v.build !== __BUILD_ID__) setStale(true);
        })
        .catch(() => undefined);
    void check();
    const t = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (!stale) return null;
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-accent-info px-4 py-2 text-sm font-semibold text-text-primary"
    >
      <RefreshCw size={16} aria-hidden /> A new version is available. Tap to reload this screen.
    </button>
  );
}
