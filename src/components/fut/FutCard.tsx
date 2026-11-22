import { forwardRef, useEffect, useState } from 'react';
import type { FutCard as FutCardData, FutFrame } from '../../engine/stats.ts';
import { STAT_LABEL } from '../../engine/stats.ts';
import { loadCustomAsset, themeColor } from '../../services/media/customAssets.ts';

/**
 * FUT player card as one SVG (viewBox 816 x 1000 = the Canva shield), using the spec's
 * exact overlay coordinates so a Canva frame in /public/custom-cards/fut-<frame>.png lines up.
 */

const W = 816;
const H = 1000;
const px = (pct: number, of: number) => (pct / 100) * of;

const FRAME_TOKENS: Record<FutFrame, [string, string, string, string]> = {
  BRONZE: ['--fut-bronze-1', '--fut-bronze-2', '#e2b07a', '#8a5a2b'],
  SILVER: ['--fut-silver-1', '--fut-silver-2', '#f1f5f9', '#8a99ad'],
  GOLD: ['--fut-gold-1', '--fut-gold-2', '#fde68a', '#b7791f'],
  ICON: ['--fut-icon-1', '--fut-icon-2', '#1e293b', '#0b0f17'],
};

/** Shield outline used when no Canva frame is provided. */
const SHIELD = 'M408 18 L700 70 Q760 80 770 140 L790 720 Q792 790 730 830 L430 985 Q408 996 386 985 L86 830 Q24 790 26 720 L46 140 Q56 80 116 70 Z';

export interface FutCardProps {
  card: FutCardData;
  name: string;
  teamName: string;
  role: string;
  avatar: string | null;
  teamLogo?: string | null;
  className?: string;
}

export const FutCard = forwardRef<SVGSVGElement, FutCardProps>(function FutCard({ card, name, teamName, role, avatar, teamLogo, className = '' }, ref) {
  const [custom, setCustom] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCustomAsset(`fut-${card.frame.toLowerCase()}.png`).then((u) => alive && setCustom(u));
    return () => {
      alive = false;
    };
  }, [card.frame]);

  const [t1, t2, f1, f2] = FRAME_TOKENS[card.frame];
  const c1 = themeColor(t1, f1);
  const c2 = themeColor(t2, f2);
  const icon = card.frame === 'ICON';
  const ink = icon ? themeColor('--fut-ink-light', '#f8fafc') : themeColor('--fut-ink-dark', '#3e3114');
  const accent = icon ? themeColor('--fut-icon-accent', '#f59e0b') : ink;
  const font = "Oswald, 'DIN Condensed', 'Arial Narrow', sans-serif";
  const nameSize = Math.min(px(5.2, H), (px(64, W) / Math.max(6, name.length)) * 1.7);
  const gid = `fut-${card.playerId}`;
  const left = card.ratings.slice(0, 3);
  const right = card.ratings.slice(3, 6);
  const rows = [63.5, 69.8, 76.1];

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label={`${name} FUT card, overall ${card.ovr}`}>
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        <linearGradient id={`${gid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.75" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${gid}-mask`}>
          <rect x={px(38, W)} y={px(19.5, H)} width={px(44, W)} height={px(33.5, H)} fill={`url(#${gid}-fade)`} />
        </mask>
        <clipPath id={`${gid}-clip`}>
          <path d={SHIELD} />
        </clipPath>
      </defs>

      {custom ? (
        <image href={custom} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <g>
          <path d={SHIELD} fill={`url(#${gid}-bg)`} stroke={accent} strokeWidth="6" />
          <g clipPath={`url(#${gid}-clip)`} opacity="0.18">
            <path d={`M0 ${px(53, H)} L${W} ${px(45, H)} L${W} ${H} L0 ${H} Z`} fill={ink} />
          </g>
          <line x1={px(14, W)} y1={px(53, H)} x2={px(86, W)} y2={px(53, H)} stroke={ink} strokeOpacity="0.35" strokeWidth="3" />
        </g>
      )}

      {/* Top-left info column (centered on x = 29%) */}
      <text x={px(29, W)} y={px(20.5, H) + px(9.5, H) * 0.8} textAnchor="middle" fill={ink} style={{ font: `700 ${px(9.5, H)}px ${font}` }}>
        {card.ovr}
      </text>
      <text x={px(29, W)} y={px(30.2, H) + 28} textAnchor="middle" fill={ink} style={{ font: `700 34px ${font}`, letterSpacing: 2 }}>
        {role}
      </text>
      <rect x={px(29, W) - px(9.5, W) / 2} y={px(36.2, H)} width={px(9.5, W)} height={px(4.8, H)} rx="4" fill={ink} fillOpacity="0.15" stroke={ink} strokeOpacity="0.4" />
      <text x={px(29, W)} y={px(36.2, H) + px(4.8, H) / 2 + 9} textAnchor="middle" fill={ink} style={{ font: `700 24px ${font}` }}>
        DARTS
      </text>
      {teamLogo ? (
        <image href={teamLogo} x={px(29, W) - px(9, W) / 2} y={px(43, H)} width={px(9, W)} height={px(6.5, H)} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <text x={px(29, W)} y={px(43, H) + px(6.5, H) / 2 + 12} textAnchor="middle" fill={ink} style={{ font: `700 36px ${font}` }}>
          {teamName.slice(0, 3).toUpperCase()}
        </text>
      )}

      {/* Portrait (bottom-aligned to the horizon at 53%) */}
      {avatar ? (
        <image
          href={avatar}
          x={px(38, W)}
          y={px(19.5, H)}
          width={px(44, W)}
          height={px(33.5, H)}
          preserveAspectRatio="xMidYMax slice"
          mask={`url(#${gid}-mask)`}
        />
      ) : (
        <text x={px(60, W)} y={px(44, H)} textAnchor="middle" fill={ink} fillOpacity="0.5" style={{ font: `700 200px ${font}` }}>
          {name.slice(0, 1).toUpperCase()}
        </text>
      )}

      {/* Name banner */}
      <text x={W / 2} y={px(55.2, H) + nameSize * 0.85} textAnchor="middle" fill={ink} style={{ font: `700 ${nameSize}px ${font}`, textTransform: 'uppercase' }}>
        {name.toUpperCase()}
      </text>
      <line x1={px(23, W)} y1={px(62, H)} x2={px(77, W)} y2={px(62, H)} stroke={ink} strokeOpacity="0.4" strokeWidth="2" />

      {/* 6-stat grid */}
      {[left, right].map((col, ci) =>
        col.map((r, ri) => {
          const x0 = px(ci === 0 ? 23 : 53, W);
          const y = px(rows[ri]!, H) + 40;
          return (
            <g key={r.code}>
              <text x={x0} y={y} fill={ink} style={{ font: `700 48px ${font}` }}>
                {r.value}
              </text>
              <text x={x0 + 78} y={y} fill={ink} style={{ font: `500 40px ${font}` }}>
                {STAT_LABEL[r.code].short}
              </text>
            </g>
          );
        }),
      )}
      <line x1={W / 2} y1={px(63, H)} x2={W / 2} y2={px(82.5, H)} stroke={ink} strokeOpacity="0.35" strokeWidth="2" />

      {/* Playstyle+ badge */}
      <g transform={`translate(${W / 2} ${px(83.5, H) + 30})`}>
        <rect x={-150} y={-26} width={300} height={52} rx={26} fill={ink} fillOpacity={icon ? 0.15 : 0.12} stroke={accent} strokeWidth="2" />
        <text textAnchor="middle" y={11} fill={accent} style={{ font: `700 28px ${font}`, letterSpacing: 1 }}>
          {card.playstyle.toUpperCase()}
        </text>
      </g>
    </svg>
  );
});
