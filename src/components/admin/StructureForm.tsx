import { LIMITS } from '../../engine/defaults.ts';
import { nextPowerOfTwo } from '../../engine/schedule.ts';
import { MATCH_FORMATS, PLAYOFF_ROUNDS, type BracketSize, type MatchFormat, type PlayoffRound, type StructureSettings, type TournamentMode } from '../../engine/types.ts';
import { Field, SegmentedControl, Select, Toggle } from '../ui.tsx';
import { MODE_LABEL, ROUND_LABEL } from './labels.ts';

const formatOptions = MATCH_FORMATS.map((f) => ({ value: f, label: f }));

/** Rounds that exist for a given structure. */
export function activePlayoffRounds(s: StructureSettings): PlayoffRound[] {
  if (s.mode === 'GROUPS_ONLY') return [];
  const size = s.mode === 'PLAYOFFS_ONLY' ? nextPowerOfTwo(s.teamCount) : s.playoff.bracketSize;
  return PLAYOFF_ROUNDS.filter((r) => {
    if (r === 'QF') return size >= 8;
    if (r === 'SF') return size >= 4;
    if (r === 'THIRD_PLACE') return size >= 4 && s.playoff.thirdPlaceMatch;
    return true;
  });
}

export function RoundFormatPicker({
  structure,
  onGroupFormat,
  onRoundFormat,
}: {
  structure: StructureSettings;
  onGroupFormat: (f: MatchFormat) => void;
  onRoundFormat: (round: PlayoffRound, f: MatchFormat) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {structure.mode !== 'PLAYOFFS_ONLY' && (
        <Field label="Group stage format">
          {(id) => (
            <Select id={id} value={structure.groupFormat} onChange={(e) => onGroupFormat(e.target.value as MatchFormat)}>
              {formatOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {activePlayoffRounds(structure).map((round) => (
        <Field key={round} label={ROUND_LABEL[round]}>
          {(id) => (
            <Select id={id} value={structure.playoff.formats[round]} onChange={(e) => onRoundFormat(round, e.target.value as MatchFormat)}>
              {formatOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          )}
        </Field>
      ))}
    </div>
  );
}

/** Team count, players, mode, groups, bracket and per-round formats. */
export function StructureForm({ value, onChange }: { value: StructureSettings; onChange: (next: StructureSettings) => void }) {
  const set = (patch: Partial<StructureSettings>) => onChange({ ...value, ...patch });
  const setPlayoff = (patch: Partial<StructureSettings['playoff']>) => set({ playoff: { ...value.playoff, ...patch } });
  const teamOptions = Array.from({ length: LIMITS.teamCount.max - LIMITS.teamCount.min + 1 }, (_, i) => i + LIMITS.teamCount.min);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Teams">
          {(id) => (
            <Select id={id} value={value.teamCount} onChange={(e) => set({ teamCount: Number(e.target.value) })}>
              {teamOptions.map((n) => (
                <option key={n} value={n}>{n} teams</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Players per team">
          {() => (
            <SegmentedControl
              ariaLabel="Players per team"
              value={value.playersPerTeam}
              options={LIMITS.playersPerTeam.map((n) => ({ value: n, label: n === 1 ? 'Singles' : n === 2 ? 'Doubles' : 'Triples' }))}
              onChange={(n) => set({ playersPerTeam: n })}
            />
          )}
        </Field>
      </div>

      <Field label="Tournament structure">
        {() => (
          <SegmentedControl
            ariaLabel="Tournament structure"
            value={value.mode}
            options={(Object.keys(MODE_LABEL) as TournamentMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            onChange={(mode) => set({ mode })}
          />
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        {value.mode !== 'PLAYOFFS_ONLY' && (
          <Field label="Groups">
            {() => (
              <SegmentedControl
                ariaLabel="Number of groups"
                value={value.groupCount}
                options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
                onChange={(groupCount) => set({ groupCount })}
              />
            )}
          </Field>
        )}
        {value.mode === 'GROUPS_AND_PLAYOFFS' && (
          <Field label="Playoff bracket">
            {() => (
              <SegmentedControl
                ariaLabel="Playoff bracket size"
                value={value.playoff.bracketSize}
                options={([2, 4, 8] as BracketSize[]).map((n) => ({ value: n, label: `Top ${n}` }))}
                onChange={(bracketSize) => setPlayoff({ bracketSize })}
              />
            )}
          </Field>
        )}
      </div>

      {value.mode !== 'GROUPS_ONLY' && (
        <Toggle
          label="3rd Place Match"
          description="Semifinal losers play for bronze before the Grand Final."
          checked={value.playoff.thirdPlaceMatch}
          onChange={(thirdPlaceMatch) => setPlayoff({ thirdPlaceMatch })}
        />
      )}

      <RoundFormatPicker
        structure={value}
        onGroupFormat={(groupFormat) => set({ groupFormat })}
        onRoundFormat={(round, f) => setPlayoff({ formats: { ...value.playoff.formats, [round]: f } })}
      />
    </div>
  );
}
