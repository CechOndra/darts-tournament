import type { LegView, VisitView } from './match.ts';
import type { TournamentState } from './state.ts';

/**
 * Stage meme overlays: pure detection of "meme moments" from a finished visit.
 * Images live in public/memes/<id>.(png|jpg|gif|webp); placeholders ship as .svg.
 */

export type MemeId =
  | 'SAME_SCORE'
  | 'MAXIMUM'
  | 'TON_PLUS'
  | 'BED_AND_BREAKFAST'
  | 'BUST'
  | 'ALL_MISS'
  | 'BIG_CHECKOUT'
  | 'BULL_FINISH'
  | 'MADHOUSE';

export interface MemeDef {
  id: MemeId;
  name: string;
  /** Suggested meme template for the image you drop in. */
  template: string;
  trigger: string;
  /** Spoken line (optional Web Speech) / caption. */
  caption: string;
  file: string;
}

export const MEMES: MemeDef[] = [
  { id: 'BIG_CHECKOUT', name: 'Big checkout', template: 'Galaxy brain', trigger: 'Checkout of 100 or more', caption: 'What a finish!', file: 'big-checkout' },
  { id: 'BULL_FINISH', name: 'Bull finish', template: 'Mic drop', trigger: 'Finishing on the bull (50)', caption: 'Bullseye finish. Mic drop.', file: 'bull-finish' },
  { id: 'MADHOUSE', name: 'Madhouse', template: 'Madhouse / exhausted', trigger: 'Finishing on double 1', caption: 'Welcome to the madhouse.', file: 'madhouse' },
  { id: 'MAXIMUM', name: 'One hundred and eighty', template: 'Leo cheers', trigger: 'A 180', caption: 'One hundred and eighty!', file: 'maximum' },
  { id: 'SAME_SCORE', name: 'Same score', template: 'Spider-Man pointing at Spider-Man', trigger: 'Same 3-dart score as the opponent just hit, or as your own previous visit', caption: 'Wait, that is the same score!', file: 'same-score' },
  { id: 'BED_AND_BREAKFAST', name: 'Bed and breakfast', template: 'Bed and breakfast (26)', trigger: 'Exactly 26', caption: 'Bed and breakfast.', file: 'bed-and-breakfast' },
  { id: 'TON_PLUS', name: 'Ton plus', template: 'Stonks', trigger: 'A visit of 100 to 179', caption: 'Stonks.', file: 'ton-plus' },
  { id: 'ALL_MISS', name: 'Three misses', template: 'Visible confusion', trigger: '3 darts and 0 points (no bust)', caption: 'Where did they go?', file: 'all-miss' },
  { id: 'BUST', name: 'Bust', template: 'This is fine (dog in fire)', trigger: 'A bust', caption: 'This is fine.', file: 'bust' },
];

export const MEME_BY_ID = Object.fromEntries(MEMES.map((m) => [m.id, m])) as Record<MemeId, MemeDef>;

export interface MemeSettings {
  enabled: boolean;
  /** Memes the admin switched off. */
  off: MemeId[];
  seconds: number;
  /** Read the caption aloud with the browser's speech voice (when no meme mp3 exists). */
  speech: boolean;
}

export const DEFAULT_MEMES: MemeSettings = { enabled: true, off: [], seconds: 5, speech: false };
export const memeSettings = (state: TournamentState): MemeSettings => ({ ...DEFAULT_MEMES, ...state.settings.memes });

/** The meme moment of a just-finished visit (highest priority first), or null. */
export function detectMeme(leg: LegView, visit: VisitView): MemeId | null {
  if (!visit.complete) return null;
  const last = visit.darts[visit.darts.length - 1];
  if (visit.checkout && last) {
    if (visit.scoreBefore >= 100) return 'BIG_CHECKOUT';
    if (last.segment === 50) return 'BULL_FINISH';
    if (last.segment === 1 && last.multiplier === 2) return 'MADHOUSE';
  }
  if (visit.bust) return 'BUST';
  if (visit.scored === 180) return 'MAXIMUM';
  const idx = leg.visits.findIndex((v) => v.visitIndex === visit.visitIndex);
  const before = leg.visits.slice(0, idx).filter((v) => v.complete && !v.bust);
  const opp = [...before].reverse().find((v) => v.side !== visit.side);
  const own = [...before].reverse().find((v) => v.side === visit.side);
  const prevOpp = idx > 0 && leg.visits[idx - 1]?.side !== visit.side ? leg.visits[idx - 1] : opp;
  if (visit.scored > 0 && ((prevOpp && !prevOpp.bust && prevOpp.scored === visit.scored) || (own && own.scored === visit.scored))) return 'SAME_SCORE';
  if (visit.scored === 26) return 'BED_AND_BREAKFAST';
  if (visit.scored >= 100) return 'TON_PLUS';
  if (visit.scored === 0 && visit.darts.length >= 3) return 'ALL_MISS';
  return null;
}
