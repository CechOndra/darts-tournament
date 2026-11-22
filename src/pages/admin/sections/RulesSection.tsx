import { AlertTriangle, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { MODE_LABEL } from '../../../components/admin/labels.ts';
import { RulesForm } from '../../../components/admin/RulesForm.tsx';
import { SettingsDraft } from '../../../components/admin/SettingsDraft.tsx';
import { mergeRules } from '../../../engine/reducer.ts';
import { RoundFormatPicker, StructureForm } from '../../../components/admin/StructureForm.tsx';
import { Button, Modal, Notice } from '../../../components/ui.tsx';
import { hasStarted } from '../../../engine/selectors.ts';
import type { TournamentState } from '../../../engine/state.ts';
import { validateStructure } from '../../../engine/tournament.ts';
import type { GameRules, MatchFormat, PlayoffRound, StructureSettings } from '../../../engine/types.ts';

interface RulesDraft {
  groupFormat: MatchFormat;
  playoffFormats: Record<PlayoffRound, MatchFormat>;
  rules: GameRules;
}

const LABELS: Record<string, string> = { groupFormat: 'Group stage format', playoffFormats: 'Playoff format', rules: 'Rules', specialRules: 'Special rules', THIRD_PLACE: '3rd place' };
import { useDispatch } from '../../../hooks/TransportProvider.tsx';

export function RulesSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const s = state.settings.structure;
  const [draft, setDraft] = useState<StructureSettings | null>(null);
  const draftErrors = draft ? validateStructure(draft) : [];
  const started = hasStarted(state);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{s.teamCount} teams</span> · {s.playersPerTeam === 1 ? 'singles' : s.playersPerTeam === 2 ? 'doubles' : 'triples'} ·{' '}
          {MODE_LABEL[s.mode]}
          {s.mode !== 'PLAYOFFS_ONLY' && ` · ${s.groupCount} group${s.groupCount === 1 ? '' : 's'}`}
          {s.mode === 'GROUPS_AND_PLAYOFFS' && ` · Top ${s.playoff.bracketSize}`}
        </p>
        <Button size="sm" variant="ghost" icon={Shuffle} onClick={() => setDraft(structuredClone(s))}>
          Change teams / groups
        </Button>
      </div>

      <SettingsDraft<RulesDraft>
        value={{ groupFormat: s.groupFormat, playoffFormats: s.playoff.formats, rules: state.settings.rules }}
        labels={LABELS}
        liveWarning={
          state.live
            ? 'A match is live right now. It keeps the rules it started with: these changes apply from the next match. Format changes only affect unplayed matches. Finished matches are never rescored.'
            : null
        }
        onApply={async (d) => {
          if (d.groupFormat !== s.groupFormat) await dispatch({ type: 'SET_GROUP_FORMAT', format: d.groupFormat }, { persist: 'immediate' });
          for (const round of Object.keys(d.playoffFormats) as PlayoffRound[]) {
            if (d.playoffFormats[round] !== s.playoff.formats[round]) await dispatch({ type: 'SET_PLAYOFF_FORMAT', round, format: d.playoffFormats[round] }, { persist: 'immediate' });
          }
          await dispatch({ type: 'UPDATE_RULES', patch: d.rules }, { persist: 'immediate' });
        }}
      >
        {(d, set) => (
          <>
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">Match formats (unplayed matches)</p>
              <RoundFormatPicker
                structure={{ ...s, groupFormat: d.groupFormat, playoff: { ...s.playoff, formats: d.playoffFormats } }}
                onGroupFormat={(groupFormat) => set({ ...d, groupFormat })}
                onRoundFormat={(round, format) => set({ ...d, playoffFormats: { ...d.playoffFormats, [round]: format } })}
              />
            </div>
            <RulesForm value={d.rules} onPatch={(patch) => set({ ...d, rules: mergeRules(d.rules, patch) })} />
          </>
        )}
      </SettingsDraft>

      {draft && (
        <Modal
          title="Change teams / groups"
          onClose={() => setDraft(null)}
          footer={
            <>
              <Button onClick={() => setDraft(null)}>Cancel</Button>
              <Button
                variant="danger"
                icon={AlertTriangle}
                disabled={draftErrors.length > 0}
                onClick={async () => {
                  await dispatch({ type: 'RESTRUCTURE', structure: draft }, { persist: 'immediate' });
                  setDraft(null);
                }}
              >
                Regenerate schedule
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Notice tone="danger">
              Regenerating rebuilds groups and the whole schedule{started ? ' and DELETES all match results recorded so far' : ''}. Team names and photos
              are kept.
            </Notice>
            <StructureForm value={draft} onChange={setDraft} />
            {draftErrors.map((e) => (
              <Notice key={e} tone="danger">{e}</Notice>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
