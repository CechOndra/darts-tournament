import { useEffect, useMemo, useRef } from 'react';
import { CARD_BY_ID, CARD_TYPES, type CardTypeId } from '../../engine/cardCatalog.ts';
import { hashString, seededRandom } from '../../engine/cardPool.ts';
import { pickWeighted } from '../../engine/cards.ts';
import { playTick } from '../../services/audio/sound.ts';
import { CardIcon, RARITY_VAR } from './PowerCard.tsx';

export interface Candidate {
  cardTypeId: CardTypeId;
  weight: number;
}

const TILE = 208;
const GAP = 12;
const STEP = TILE + GAP;
const TILES = 50;
const WIN_INDEX = 41; // tile #42

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** Requests frames for `durationMs`, calling `frame(progress)`; returns a cancel function. */
function animate(durationMs: number, frame: (p: number) => void, done: () => void): () => void {
  let raf = 0;
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / durationMs);
    frame(p);
    if (p < 1) raf = requestAnimationFrame(step);
    else done();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/**
 * CS2-style case opening: a 50-tile strip built from the pool weights, the rolled card
 * at tile #42 with legendary near-miss decoys beside it, decelerating under a gold marker.
 */
export function CaseOpening({ winner, seed, candidates, durationMs = 5500, onDone }: { winner: CardTypeId; seed: string; candidates: Candidate[]; durationMs?: number; onDone: () => void }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const tiles = useMemo(() => {
    const rand = seededRandom(hashString(seed));
    const pool = candidates.length ? candidates : [{ cardTypeId: winner, weight: 1 }];
    const items = pool.map((c) => ({ item: c.cardTypeId, weight: c.weight }));
    const list = Array.from({ length: TILES }, () => pickWeighted(items, rand()) ?? winner);
    const legendary = CARD_TYPES.filter((c) => c.rarity === 'LEGENDARY').map((c) => c.id);
    const decoy = () => legendary[Math.floor(rand() * legendary.length)]!;
    list[WIN_INDEX - 1] = decoy();
    list[WIN_INDEX + 1] = decoy();
    list[WIN_INDEX] = winner;
    return { list, jitter: (rand() - 0.5) * TILE * 0.7 };
  }, [seed, candidates, winner]);

  useEffect(() => {
    const strip = stripRef.current;
    const view = viewRef.current;
    if (!strip || !view) return;
    const center = view.clientWidth / 2;
    const end = WIN_INDEX * STEP + TILE / 2 + tiles.jitter - center;
    let lastTile = -1;
    return animate(
      durationMs,
      (p) => {
        const x = end * easeOut(p);
        strip.style.transform = `translateX(${-x}px)`;
        const under = Math.floor((x + center) / STEP);
        if (under !== lastTile) {
          lastTile = under;
          playTick();
        }
      },
      () => doneRef.current(),
    );
  }, [tiles, durationMs]);

  return (
    <div ref={viewRef} className="relative w-full overflow-hidden rounded-xl border border-border-strong bg-bg-primary py-6">
      <div ref={stripRef} className="flex will-change-transform" style={{ gap: GAP }}>
        {tiles.list.map((id, i) => {
          const color = RARITY_VAR[CARD_BY_ID[id].rarity];
          return (
            <div key={i} className="relative flex shrink-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-md bg-bg-elevated pb-4" style={{ width: TILE, height: 200 }}>
              <span style={{ color }}>
                <CardIcon id={id} size={64} />
              </span>
              <span className="px-2 text-center font-display text-lg leading-tight font-bold uppercase">{CARD_BY_ID[id].name}</span>
              <span className="absolute inset-x-0 bottom-0 h-3" style={{ background: color }} />
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-accent-gold shadow-[0_0_16px_var(--accent-gold)]" />
    </div>
  );
}

/** Prize wheel: slices sized by pool weight, physics-style deceleration, peg ticks. */
export function SpinWheel({ winner, seed, candidates, durationMs = 5500, onDone }: { winner: CardTypeId; seed: string; candidates: Candidate[]; durationMs?: number; onDone: () => void }) {
  const wheelRef = useRef<SVGGElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const slices = useMemo(() => {
    const byType = new Map<CardTypeId, number>();
    for (const c of candidates) byType.set(c.cardTypeId, (byType.get(c.cardTypeId) ?? 0) + c.weight);
    if (!byType.has(winner)) byType.set(winner, 1);
    const total = [...byType.values()].reduce((a, b) => a + b, 0);
    let angle = 0;
    return [...byType.entries()].map(([id, w]) => {
      const sweep = (w / total) * 360;
      const s = { id, start: angle, sweep };
      angle += sweep;
      return s;
    });
  }, [candidates, winner]);

  const target = useMemo(() => {
    const rand = seededRandom(hashString(seed));
    const s = slices.find((x) => x.id === winner)!;
    const inside = s.start + s.sweep * (0.2 + rand() * 0.6);
    return 360 * 6 + (360 - inside); // pointer at 12 o'clock
  }, [slices, winner, seed]);

  useEffect(() => {
    const g = wheelRef.current;
    if (!g) return;
    let lastSlice = -1;
    return animate(
      durationMs,
      (p) => {
        const rot = target * easeOut(p);
        g.style.transform = `rotate(${rot}deg)`;
        const atPointer = (360 - (rot % 360)) % 360;
        const idx = slices.findIndex((s) => atPointer >= s.start && atPointer < s.start + s.sweep);
        if (idx !== lastSlice) {
          lastSlice = idx;
          playTick();
        }
      },
      () => doneRef.current(),
    );
  }, [target, slices, durationMs]);

  const R = 300;
  const point = (deg: number, r = R) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${R + r * Math.cos(a)},${R + r * Math.sin(a)}`;
  };

  return (
    <div className="relative">
      <svg width={R * 2} height={R * 2} viewBox={`0 0 ${R * 2} ${R * 2}`} aria-hidden>
        <g ref={wheelRef} style={{ transformOrigin: `${R}px ${R}px` }}>
          {slices.map((s, i) => {
            const large = s.sweep > 180 ? 1 : 0;
            const mid = s.start + s.sweep / 2;
            const color = RARITY_VAR[CARD_BY_ID[s.id].rarity];
            return (
              <g key={s.id}>
                <path
                  d={slices.length === 1 ? `M ${R} 0 A ${R} ${R} 0 1 1 ${R - 0.01} 0 Z` : `M ${R} ${R} L ${point(s.start)} A ${R} ${R} 0 ${large} 1 ${point(s.start + s.sweep)} Z`}
                  fill={i % 2 ? 'var(--bg-elevated)' : 'var(--bg-surface)'}
                  stroke={color}
                  strokeWidth={3}
                />
                <text
                  x={R}
                  y={R - R * 0.62}
                  transform={`rotate(${mid} ${R} ${R})`}
                  textAnchor="middle"
                  fill={color}
                  style={{ font: '600 15px var(--font-display)', textTransform: 'uppercase' }}
                >
                  {s.sweep > 10 ? CARD_BY_ID[s.id].name.slice(0, 16) : ''}
                </text>
              </g>
            );
          })}
          <circle cx={R} cy={R} r={40} fill="var(--bg-primary)" stroke="var(--accent-gold)" strokeWidth={4} />
        </g>
      </svg>
      <div className="absolute top-[-10px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[18px] border-t-[34px] border-x-transparent border-t-accent-gold" />
    </div>
  );
}
