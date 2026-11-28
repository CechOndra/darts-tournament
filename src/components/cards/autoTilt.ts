import { resetTilt, setTilt } from '../../powercards/power-card.js';

/** Sways a card on its own for a few seconds so the holo shows. Stops early when someone touches it. Returns a stop function. */
export function autoTilt(card: HTMLElement, seconds = 4): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const t0 = performance.now();
  let raf = 0;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    card.removeEventListener('pointerdown', stop);
    card.removeEventListener('pointermove', stop);
    resetTilt(card);
  };
  const step = (now: number) => {
    const t = (now - t0) / 1000;
    if (t >= seconds) return stop();
    const k = Math.min(1, t / 0.4, (seconds - t) / 0.6); // ease in and out
    setTilt(card, 0.5 + 0.38 * Math.cos(t * 2.1) * k, 0.5 + 0.3 * Math.sin(t * 1.7) * k);
    raf = requestAnimationFrame(step);
  };
  card.addEventListener('pointerdown', stop);
  card.addEventListener('pointermove', stop);
  raf = requestAnimationFrame(step);
  return stop;
}
