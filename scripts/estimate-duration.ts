// How long will the tournament take? Monte Carlo on your laptop, nothing is played in real time.
//
//   node scripts/estimate-duration.ts                       (defaults: 8 teams, 2 groups, 301 double out)
//   node scripts/estimate-duration.ts --start 18:00 --breaks 2 --break-min 10 --scenarios 1/1,2/1
//   node scripts/estimate-duration.ts --backup my-tournament-backup.json   (rules + format of a real one)
//   node scripts/estimate-duration.ts --help
//
// 1. RUNS simulated tournaments with the real engine (src/engine/simulate.ts) to get how many darts,
//    visits and legs every match needs (this depends on the skill you set).
// 2. Turns those into clock time with the pace settings below and spreads the matches over the dartboards
//    of each scenario ("groups/playoffs" boards, the final is always on one board).
// Needs Node 22.6+ (runs the TypeScript directly).
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DEFAULT_RULES, DEFAULT_STRUCTURE } from '../src/engine/defaults.ts';
import { DEFAULT_TIME, loadsOf, percentile, runTimeline, type MatchLoad } from '../src/engine/durationModel.ts';
import { simulateMatches } from '../src/engine/simulate.ts';
import { buildTournament } from '../src/engine/tournament.ts';

const { values: v } = parseArgs({
  options: {
    help: { type: 'boolean' },
    backup: { type: 'string' },
    teams: { type: 'string' }, groups: { type: 'string' }, players: { type: 'string' }, playoff: { type: 'string' },
    start: { type: 'string', default: '18:00' },
    runs: { type: 'string', default: '200' },
    avg: { type: 'string', default: '40' }, sd: { type: 'string', default: '8' },
    throw: { type: 'string', default: String(DEFAULT_TIME.throwSec[0]) }, 'throw-sd': { type: 'string', default: String(DEFAULT_TIME.throwSec[1]) },
    visit: { type: 'string', default: String(DEFAULT_TIME.visitSec[0]) }, 'visit-sd': { type: 'string', default: String(DEFAULT_TIME.visitSec[1]) },
    leg: { type: 'string', default: String(DEFAULT_TIME.legSec[0]) }, 'leg-sd': { type: 'string', default: String(DEFAULT_TIME.legSec[1]) },
    gap: { type: 'string', default: String(DEFAULT_TIME.gapSec[0]) }, 'gap-sd': { type: 'string', default: String(DEFAULT_TIME.gapSec[1]) },
    breaks: { type: 'string', default: String(DEFAULT_TIME.breaks) }, 'break-min': { type: 'string', default: String(DEFAULT_TIME.breakMin) },
    accident: { type: 'string', default: String(DEFAULT_TIME.accidentChance) }, 'accident-min': { type: 'string', default: String(DEFAULT_TIME.accidentMin) },
    cards: { type: 'string' }, 'loser-draws': { type: 'string' }, 'winner-draws': { type: 'string' },
    draw: { type: 'string', default: String(DEFAULT_TIME.cards.drawSec[0]) }, 'draw-sd': { type: 'string', default: String(DEFAULT_TIME.cards.drawSec[1]) },
    'play-chance': { type: 'string', default: String(DEFAULT_TIME.cards.playChance) },
    play: { type: 'string', default: String(DEFAULT_TIME.cards.playSec[0]) }, 'play-sd': { type: 'string', default: String(DEFAULT_TIME.cards.playSec[1]) },
    scenarios: { type: 'string', default: '1/1,2/1' },
  },
});

if (v.help) {
  console.log(`Options (all optional):
  Tournament   --teams 8 --groups 2 --players 2 --playoff 4   or   --backup file.json (rules + format)
  Skill        --avg 40  (3-dart average of the average player)   --sd 8  (spread between players)
  Pace         --throw 4 --throw-sd 1.5   seconds per dart
               --visit 12 --visit-sd 4    seconds per visit (walk to board, pull darts, score, switch player)
               --leg 45 --leg-sd 8        seconds between legs
               --gap 180 --gap-sd 60      seconds between matches on one board (call teams, scorer swap, stage show)
  Breaks       --breaks 1 --break-min 15  scheduled breaks (all boards stop), spread evenly
  Accidents    --accident 0.05 --accident-min 4   chance per match and mean minutes lost
  Power Cards  --cards on|groups|off   (default on = all stages; time cost only, results unchanged)
               --loser-draws 1 --winner-draws 1   draws after every match (a backup supplies its own values)
               --draw 25 --draw-sd 8      seconds per draw (animation + looking at the card)
               --play-chance 0.3 --play 30 --play-sd 10   chance per team and leg to play a card, seconds each
  Clock        --start 18:00   --runs 200 (simulated tournaments, each timed 20x)
  Boards       --scenarios 1/1,2/1        groups/playoffs boards per scenario: 1/1 = one board everywhere, 2/1 = two for groups (the final always uses 1)`);
  process.exit(0);
}

const num = (k: keyof typeof v) => Number(v[k]);
const clock = (sec: number) => {
  const [h, m] = v.start!.split(':').map(Number);
  const t = Math.round(((h! * 60 + m!) * 60 + sec) / 60);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const hm = (sec: number) => `${Math.floor(sec / 3600)}h ${String(Math.round((sec % 3600) / 60)).padStart(2, '0')}m`;

let cardMode: 'OFF' | 'GROUPS' | 'ALL' = 'ALL';
let loserDraws = 1;
let winnerDraws = 1;
let structure = structuredClone(DEFAULT_STRUCTURE);
let rules = structuredClone(DEFAULT_RULES);
if (v.backup) {
  const saved = JSON.parse(readFileSync(v.backup, 'utf8'));
  structure = saved.settings.structure;
  rules = saved.settings.rules;
  const c = saved.settings.cards;
  if (c) {
    cardMode = c.mode === 'OFF' ? 'OFF' : c.mode === 'ALL_STAGES' ? 'ALL' : 'GROUPS';
    loserDraws = c.loserSpinsPerMatch;
    winnerDraws = c.winnerSpinsPerMatch;
  }
}
if (v.cards) cardMode = ({ on: 'ALL', groups: 'GROUPS', off: 'OFF' } as const)[v.cards as 'on'] ?? cardMode;
if (v['loser-draws']) loserDraws = num('loser-draws');
if (v['winner-draws']) winnerDraws = num('winner-draws');
if (v.teams) structure.teamCount = num('teams');
if (v.groups) structure.groupCount = num('groups');
if (v.players) structure.playersPerTeam = num('players');
if (v.playoff) structure.playoff.bracketSize = num('playoff') as 2 | 4 | 8;

const base = buildTournament({ id: 'est', name: 'est', createdAt: 0, structure, rules, roster: [], isTest: true });
const skill = { average: num('avg'), variance: num('sd') };
const runs = num('runs');
const loadSets: MatchLoad[][] = [];
for (let i = 0; i < runs; i++) loadSets.push(loadsOf(simulateMatches(base, Infinity, skill)));
const dartsPerMatch = loadSets.flat().reduce((s, l) => s + l.darts, 0) / loadSets.flat().length;

const time = {
  throwSec: [num('throw'), num('throw-sd')] as [number, number],
  visitSec: [num('visit'), num('visit-sd')] as [number, number],
  legSec: [num('leg'), num('leg-sd')] as [number, number],
  gapSec: [num('gap'), num('gap-sd')] as [number, number],
  breaks: num('breaks'),
  breakMin: num('break-min'),
  accidentChance: num('accident'),
  accidentMin: num('accident-min'),
  cards: { mode: cardMode, loserDraws, winnerDraws, drawSec: [num('draw'), num('draw-sd')] as [number, number], playChance: num('play-chance'), playSec: [num('play'), num('play-sd')] as [number, number] },
};

console.log(`${structure.teamCount} teams, ${structure.groupCount} group(s), ${loadSets[0]!.length} matches, avg ${skill.average} +- ${skill.variance}, ${rules.startingScore}, start ${v.start}`);
console.log(`~${dartsPerMatch.toFixed(0)} darts per match; ${time.breaks} break(s) of ${time.breakMin} min; cards ${cardMode === 'OFF' ? 'off' : `${cardMode === 'ALL' ? 'all stages' : 'groups only'}, draws loser ${loserDraws} / winner ${winnerDraws}`}; ${runs} simulated tournaments x 20 time draws\n`);
console.log('boards (groups/playoffs)   duration median [5%-95%]        finish median   finish 5%-95%     group stage ends');

let baseline = 0;
for (const sc of v.scenarios!.split(',')) {
  const [g, p] = sc.split('/').map(Number);
  const finish: number[] = [];
  const groupEnd: number[] = [];
  for (const loads of loadSets) {
    for (let k = 0; k < 20; k++) {
      const t = runTimeline(loads, { groups: g!, playoffs: p ?? g! }, time, Math.random);
      finish.push(t.finish);
      groupEnd.push(t.groupEnd);
    }
  }
  finish.sort((a, b) => a - b);
  groupEnd.sort((a, b) => a - b);
  const med = percentile(finish, 0.5);
  baseline ||= med;
  const saved = med === baseline ? '' : `  (saves ${hm(baseline - med)})`;
  console.log(
    `${sc.padEnd(26)} ${hm(med)} [${hm(percentile(finish, 0.05))} - ${hm(percentile(finish, 0.95))}]`.padEnd(66) +
      `${clock(med)}   ${clock(percentile(finish, 0.05))}-${clock(percentile(finish, 0.95))}   ${clock(percentile(groupEnd, 0.5))}${saved}`,
  );
  console.log(`${''.padEnd(26)} min ${hm(finish[0]!)}  max ${hm(finish.at(-1)!)}`);
}
