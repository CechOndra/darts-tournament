/** Absolute links to the app's routes on this deployment (optionally pinned to one tournament). */
export type AppRoute = '' | 'stage' | 'scorer' | 'admin' | 'print-cards' | 'board-map';

export function appUrl(route: AppRoute, tournamentId?: string | null): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  const query = tournamentId ? `?t=${encodeURIComponent(tournamentId)}` : '';
  return `${base}#/${route}${query}`;
}

/** Open a route in its own window (stage on the projector, scorer on a second screen...). */
export function openAppWindow(route: AppRoute, tournamentId?: string | null): void {
  window.open(appUrl(route, tournamentId), `darts-${route || 'guest'}`, 'noopener');
}
