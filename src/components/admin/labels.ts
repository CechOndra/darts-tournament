import type {
  CheckoutMode,
  FirstThrowRule,
  FirstThrowTiebreak,
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
