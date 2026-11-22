import { STAT_LABEL, type FutCard } from '../../engine/stats.ts';

/** 6-axis radar (55-99 scale) with an optional "compare with" overlay. */
export function RadarChart({ card, compare, size = 280, label, compareLabel }: { card: FutCard; compare?: FutCard | null; size?: number; label?: string; compareLabel?: string }) {
  const c = size / 2;
  const r = size / 2 - Math.max(40, size * 0.14);
  const n = card.ratings.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const k = Math.max(0, (v - 40) / 59); // 40 at the center so 55 is still visible
    return [c + Math.cos(a) * r * k, c + Math.sin(a) * r * k] as const;
  };
  const poly = (fc: FutCard) =>
    card.ratings
      .map((rt, i) => {
        const v = fc.ratings.find((x) => x.code === rt.code)?.value ?? 55;
        return pt(i, v).join(',');
      })
      .join(' ');

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Attribute radar chart">
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <polygon
            key={k}
            points={card.ratings.map((_, i) => pt(i, 40 + 59 * k).join(',')).join(' ')}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={1}
          />
        ))}
        {card.ratings.map((rt, i) => {
          const [x, y] = pt(i, 99);
          const [lx, ly] = pt(i, 108);
          return (
            <g key={rt.code}>
              <line x1={c} y1={c} x2={x} y2={y} stroke="var(--border-subtle)" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" style={{ font: '600 12px var(--font-display)' }}>
                {STAT_LABEL[rt.code].short} {rt.value}
              </text>
            </g>
          );
        })}
        {compare && <polygon points={poly(compare)} fill="var(--accent-info)" fillOpacity={0.18} stroke="var(--accent-info)" strokeWidth={2} />}
        <polygon points={poly(card)} fill="var(--accent-gold)" fillOpacity={0.25} stroke="var(--accent-gold)" strokeWidth={2.5} />
      </svg>
      {(label || compareLabel) && (
        <figcaption className="flex gap-4 text-xs">
          {label && <span className="text-accent-gold">{label}</span>}
          {compare && compareLabel && <span className="text-accent-info">vs {compareLabel}</span>}
        </figcaption>
      )}
    </figure>
  );
}
