import type { RosterRow } from './types.ts';

/**
 * Bulk roster import: accepts CSV / TSV / semicolon rows of
 * `teamname, playername 1, playername 2`, auto-skips a header row and strips a
 * leading Google Forms timestamp column.
 */

const HEADER_WORDS = /\b(team|teams|teamname|tým|tym|name|jméno|jmeno|player|players|hráč|hrac|timestamp|časová|casova|zeitstempel)\b/i;

// 2024/05/01 12:34:56 · 5/1/2024 12:34:56 · 1.5.2024 12:34:56 · 2024-05-01T12:34:56 · 2024-05-01 12:34
const TIMESTAMP = /^\s*(\d{1,4}[./-]\s?\d{1,2}[./-]\s?\d{1,4})([ T]\d{1,2}:\d{2}(:\d{2})?(\s?(AM|PM))?.*)?\s*$/i;

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  const semis = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

/** RFC-4180-ish single-line split supporting "quoted, values" and "" escapes. */
export function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

export function isTimestampCell(cell: string): boolean {
  return cell.length > 0 && TIMESTAMP.test(cell);
}

export function parseRosterText(text: string): RosterRow[] {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: RosterRow[] = [];
  lines.forEach((line, index) => {
    let cells = splitDelimitedLine(line, detectDelimiter(line));
    if (index === 0 && cells.some((c) => HEADER_WORDS.test(c))) return;
    if (cells.length > 1 && isTimestampCell(cells[0] ?? '')) cells = cells.slice(1);
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    if (cells.length === 0 || cells.every((c) => c === '')) return;
    const [teamName = '', ...playerNames] = cells;
    rows.push({ teamName, playerNames });
  });
  return rows;
}

/** Most players listed on any imported row (used to suggest playersPerTeam). */
export function maxPlayersInRoster(rows: RosterRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.playerNames.length), 0);
}
