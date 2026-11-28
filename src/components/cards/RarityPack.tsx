import gsap from 'gsap';
import { useCallback, useEffect, useRef } from 'react';
import { svg } from '../../powercards/icons.js';

/**
 * A booster pack in the rarity colour: click it (or wait) and it shakes, flashes and opens.
 * Used when a draw only shows the rarity; `onOpen` then plays the card reveal.
 */
export function RarityPack({ label, color, onOpen, autoOpenMs = 15000 }: { label: string; color: string; onOpen: () => void; autoOpenMs?: number }) {
  const packRef = useRef<HTMLButtonElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  const open = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    const pack = packRef.current;
    if (!pack || matchMedia('(prefers-reduced-motion: reduce)').matches) return openRef.current();
    gsap
      .timeline({ onComplete: () => openRef.current() })
      .to(pack, { keyframes: { x: [0, -16, 16, -12, 12, -6, 0] }, duration: 0.5, ease: 'sine.inOut' })
      .to(pack, { scale: 1.18, duration: 0.25, ease: 'power2.in' })
      .to(flashRef.current, { opacity: 1, duration: 0.15 }, '<0.1')
      .to(pack, { scale: 1.6, opacity: 0, duration: 0.25, ease: 'power2.out' })
      .to(flashRef.current, { opacity: 0, duration: 0.3 }, '<');
  }, []);

  useEffect(() => {
    const t = setTimeout(open, autoOpenMs); // safety: never leave the stage waiting forever
    return () => clearTimeout(t);
  }, [open, autoOpenMs]);

  return (
    <div className="relative flex flex-col items-center gap-6">
      <div ref={flashRef} className="pointer-events-none absolute -inset-40 z-10 opacity-0" style={{ background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0.6) 30%, transparent 65%)' }} />
      <div className="pack-idle" style={{ animation: 'pack-float 3.2s ease-in-out infinite' }}>
        <button
          ref={packRef}
          type="button"
          onClick={open}
          aria-label={`Open the ${label} pack`}
          className="relative flex h-[min(52vh,480px)] aspect-[5/7] cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border-0 p-0 text-white outline-none focus-visible:ring-4 focus-visible:ring-white/60"
          style={{
            background: `linear-gradient(160deg, color-mix(in srgb, ${color} 55%, #fff) 0%, ${color} 38%, color-mix(in srgb, ${color} 55%, #000) 100%)`,
            boxShadow: `0 0 60px -6px ${color}, inset 0 0 0 4px rgba(255,255,255,0.35)`,
          }}
        >
          <span className="absolute inset-x-0 top-0 h-6" style={{ background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.35) 0 6px, rgba(255,255,255,0.25) 6px 12px)' }} />
          <span className="absolute inset-x-0 bottom-0 h-6" style={{ background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.35) 0 6px, rgba(255,255,255,0.25) 6px 12px)' }} />
          <span className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.9) 50%, transparent 65%)' }} />
          <span className="h-[38%] w-[62%] drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] [&_svg]:h-full [&_svg]:w-full" aria-hidden dangerouslySetInnerHTML={{ __html: svg('dartboard') }} />
          <span className="font-display text-5xl tracking-widest uppercase drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]">{label}</span>
          <span className="text-sm tracking-[0.35em] uppercase opacity-90">Power card</span>
        </button>
      </div>
      <p className="font-display text-3xl tracking-widest text-text-muted uppercase">Click to open</p>
    </div>
  );
}
