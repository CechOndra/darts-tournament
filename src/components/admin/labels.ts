import type {
  CheckoutMode,
  FirstThrowRule,
  FirstThrowTiebreak,
  KeypadLayout,
  ScorerDutyRule,
  PlayoffRound,
  StatsScope,
  TournamentMode,
} from '../../engine/types.ts';

export const MODE_LABEL: Record<TournamentMode, string> = {
  GROUPS_AND_PLAYOFFS: 'Groups + Playoffs',
  GROUPS_ONLY: 'Groups only',
  PLAYOFFS_ONLY: 'Playoffs only',
};

export const CHECKOUT_LABEL: Record<CheckoutMode, string> = {
  STRAIGHT_OUT: 'Straight out',
  DOUBLE_OUT: 'Double out',
  MASTER_OUT: 'Master out (double or triple)',
  HYBRID_SUB_50: 'Hybrid (straight out above 50, double below)',
};

export const FIRST_THROW_LABEL: Record<FirstThrowRule, string> = {
  LOWER_SEED_FIRST: 'Lower seed throws first',
  CLOSEST_TO_BULL_1P: 'Closest to bull (1 player)',
  CLOSEST_TO_BULL_2P: 'Closest to bull (2 players)',
  HIGH_SCORE_2DART_SHOOTOUT: 'High score 2-dart shootout',
  VIRTUAL_COIN_TOSS: 'Virtual coin toss',
  MANUAL_CHOICE: 'Manual choice on tablet',
};

export const TIEBREAK_LABEL: Record<FirstThrowTiebreak, string> = {
  VIRTUAL_COIN_TOSS: 'Virtual coin toss',
  CLOSEST_TO_BULL_1P: 'Closest to bull (1 player)',
  CLOSEST_TO_BULL_2P: 'Closest to bull (2 players)',
  HIGH_SCORE_2DART_SHOOTOUT: 'High score 2-dart shootout',
  SCHEDULE_HOME_TEAM: 'Home team (schedule order)',
};

export const ROUND_LABEL: Record<PlayoffRound, string> = {
  QF: 'Quarterfinals',
  SF: 'Semifinals',
  THIRD_PLACE: '3rd Place Match',
  FINAL: 'Grand Final',
};

export const STATS_SCOPE_LABEL: Record<StatsScope, string> = {
  ALL_MATCHES: 'All matches',
  GROUP_STAGE_ONLY: 'Group stage only',
};

export const DUTY_RULE_LABEL: Record<ScorerDutyRule, string> = {
  LOSER_SCORES_NEXT: 'Loser scores the next match',
  WINNER_SCORES_NEXT: 'Winner scores the next match',
  ON_DECK_TEAM: 'Team playing after the next match scores it',
  ADMIN_ALWAYS: 'Admin (Host) scores every match',
};

export const KEYPAD_LABEL: Record<KeypadLayout, { name: string; description: string }> = {
  MODIFIER: { name: 'Numbers + Double/Triple', description: '1-20 only. Tap DOUBLE or TRIPLE, then the number.' },
  STACKED_ROWS: { name: 'Singles, Doubles, Triples rows', description: 'Two rows of singles, then two rows of doubles, then triples.' },
  COLUMNS: { name: 'S / D / T columns', description: 'Each number has its single, double and triple side by side.' },
  ROWS_BY_TEN: { name: 'Classic grid', description: 'S, D, T rows for 1-10, then S, D, T rows for 11-20.' },
};
