import type { RosterRow } from './types.ts';

/** Random Czech team/player names (with diacritics) for test tournaments. */

const FIRST_M = ['Jiří', 'Jan', 'Petr', 'Josef', 'Pavel', 'Martin', 'Tomáš', 'Jaroslav', 'Miroslav', 'Zdeněk', 'Václav', 'Michal', 'František', 'Lukáš', 'Ondřej', 'Radek', 'Štěpán', 'Dušan', 'Matěj', 'Vojtěch', 'Jakub', 'Aleš', 'Přemysl', 'Bohumil', 'Čeněk', 'Milan', 'Luboš', 'Roman', 'Šimon', 'Vít', 'Mikuláš', 'Kryštof', 'Jindřich', 'Oldřich', 'Ctibor'];
const FIRST_F = ['Jana', 'Eva', 'Hana', 'Lenka', 'Petra', 'Lucie', 'Kateřina', 'Žaneta', 'Šárka', 'Zuzana', 'Věra', 'Markéta', 'Tereza', 'Barbora', 'Michaela', 'Klára', 'Růžena', 'Dagmar', 'Ivana', 'Alžběta', 'Radka'];
// [masculine, feminine]
const LAST: [string, string][] = [['Novotný', 'Novotná'], ['Svoboda', 'Svobodová'], ['Novák', 'Nováková'], ['Dvořák', 'Dvořáková'], ['Černý', 'Černá'], ['Procházka', 'Procházková'], ['Kučera', 'Kučerová'], ['Veselý', 'Veselá'], ['Horák', 'Horáková'], ['Němec', 'Němcová'], ['Pokorný', 'Pokorná'], ['Pospíšil', 'Pospíšilová'], ['Hájek', 'Hájková'], ['Jelínek', 'Jelínková'], ['Král', 'Králová'], ['Růžička', 'Růžičková'], ['Beneš', 'Benešová'], ['Fiala', 'Fialová'], ['Sedláček', 'Sedláčková'], ['Doležal', 'Doležalová'], ['Zeman', 'Zemanová'], ['Kolář', 'Kolářová'], ['Navrátil', 'Navrátilová'], ['Čermák', 'Čermáková'], ['Vaněk', 'Vaňková'], ['Kříž', 'Křížová'], ['Kovář', 'Kovářová'], ['Bartoš', 'Bartošová'], ['Šimek', 'Šimková'], ['Konečný', 'Konečná'], ['Čech', 'Čechová'], ['Říha', 'Říhová'], ['Žák', 'Žáková'], ['Šťastný', 'Šťastná'], ['Mařík', 'Maříková']];
const TEAMS = ['Šípaři z Žižkova', 'Trojitá dvacítka', 'Býci z Brna', 'Ostravští vlci', 'Plzeňští šípaři', 'Zlatá šipka', 'Dvojitá šestnáctka', 'Čeští lvi', 'Pražští draci', 'Hradečtí sokoli', 'Liberečtí rysi', 'Olomoucké sovy', 'Pardubičtí jestřábi', 'Kladenští kováři', 'Budějovičtí medvědi', 'Jihlavské lišky', 'Zlínští kanci', 'Karlovarské želvy', 'Opavští raci', 'Teplické štiky', 'Moravští orli', 'Slezští tygři', 'Šumavští jeleni', 'Ještědští sršni', 'Krkonošští ježci', 'Brdští vlci', 'Řezníci z Řeporyjí', 'Bullseye Břevnov', 'Mistři mířidel', 'Šipky a pivo'];

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function randomRosterRows(teamCount: number, playersPerTeam: number, rng: () => number = Math.random): RosterRow[] {
  const teams = shuffled(TEAMS, rng);
  const used = new Set<string>();
  const person = (): string => {
    for (let tries = 0; ; tries++) {
      const female = rng() < 0.3;
      const first = (female ? FIRST_F : FIRST_M)[Math.floor(rng() * (female ? FIRST_F : FIRST_M).length)]!;
      const last = LAST[Math.floor(rng() * LAST.length)]![female ? 1 : 0];
      const name = `${first} ${last}`;
      if (!used.has(name) || tries > 200) {
        used.add(name);
        return name;
      }
    }
  };
  return Array.from({ length: teamCount }, (_, i) => ({
    teamName: i < teams.length ? teams[i]! : `${teams[i % teams.length]!} ${Math.floor(i / teams.length) + 1}`,
    playerNames: Array.from({ length: playersPerTeam }, person),
  }));
}

/** The same rows as pasteable `Team, Player 1, Player 2` lines. */
export const rosterRowsToText = (rows: RosterRow[]): string => rows.map((r) => [r.teamName, ...r.playerNames].join(', ')).join('\n');
