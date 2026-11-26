import { Field, SegmentedControl, Toggle } from '../../../components/ui.tsx';
import { STATS_SCOPE_LABEL } from '../../../components/admin/labels.ts';
import type { TournamentState } from '../../../engine/state.ts';
import type { StatsScope, VisibilitySettings } from '../../../engine/types.ts';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';

export function VisibilitySection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const v = state.settings.visibility;
  const set = (patch: Partial<VisibilitySettings>) => void dispatch({ type: 'UPDATE_VISIBILITY', patch }, { persist: 'immediate' });

  return (
    <div className="divide-y divide-border-subtle">
      <Toggle
        label="Stage: visit history"
        description="List every visit of the current leg under each team on the projector."
        checked={v.stageVisitHistory}
        onChange={(stageVisitHistory) => set({ stageVisitHistory })}
      />
      <Toggle
        label="Join QR code on the stage"
        description="Small QR in the corner between matches. Off: only the big QR you project yourself."
        checked={v.showJoinQr !== false}
        onChange={(showJoinQr) => set({ showJoinQr })}
      />
      <Toggle
        label="Crowd soundboard feature"
        description="Off: no Soundboard tab on guest phones and no crowd button on the tablet. To mute it for a moment use Live Switches instead."
        checked={v.soundboardFeature !== false}
        onChange={(soundboardFeature) => set({ soundboardFeature })}
      />
      <Toggle
        label="Breaks on guest phones"
        description="Show scheduled breaks between matches in the guest schedule."
        checked={v.showBreaksToGuests}
        onChange={(showBreaksToGuests) => set({ showBreaksToGuests })}
      />
      <Toggle label="Basic stats" description="3-dart average, high visit, checkouts on guest phones." checked={v.showBasicStats} onChange={(showBasicStats) => set({ showBasicStats })} />
      <Toggle label="Match ETAs" description="Estimated start times once Round 1 completes." checked={v.showMatchEtas} onChange={(showMatchEtas) => set({ showMatchEtas })} />
      <Toggle label="Awards preview" description="Keep OFF so winners stay secret until the ceremony." checked={v.showAwardsPreview} onChange={(showAwardsPreview) => set({ showAwardsPreview })} />
      <Toggle label="FUT player cards" description="Flip ON for the big reveal." checked={v.showPlayerFutCards} onChange={(showPlayerFutCards) => set({ showPlayerFutCards })} />
      <div className="space-y-2 py-3">
        <Field label="Names on FUT cards" hint="Default for everyone: stage, admin and phones.">
          {() => (
            <SegmentedControl
              ariaLabel="Names on FUT cards"
              value={v.futNames ?? 'FULL'}
              options={[{ value: 'FULL', label: 'Full names' }, { value: 'NICKNAME', label: 'Nicknames' }]}
              onChange={(futNames) => set({ futNames })}
            />
          )}
        </Field>
        <Toggle
          label="Guests can switch names"
          description="Phones get a Full names / Nicknames switch on the FUT cards (also decides the name on a downloaded card). Off: everyone sees the default above."
          checked={v.futNamesGuestChoice === true}
          onChange={(futNamesGuestChoice) => set({ futNamesGuestChoice })}
        />
      </div>
      <Toggle
        label="Ultimate Team"
        description="Reveal the team of the tournament on guest phones (best player per card stat)."
        checked={v.showUltimateTeam === true}
        onChange={(showUltimateTeam) => set({ showUltimateTeam })}
      />
      <Toggle
        label="Include card-affected throws"
        description="OFF: awards and FUT stats ignore visits changed by Power Cards."
        checked={v.includeCardAffectedThrows}
        onChange={(includeCardAffectedThrows) => set({ includeCardAffectedThrows })}
      />
      <div className="pt-3">
        <Field label="Stats scope">
          {() => (
            <SegmentedControl
              ariaLabel="Stats scope"
              value={v.statsScope}
              options={(Object.keys(STATS_SCOPE_LABEL) as StatsScope[]).map((s) => ({ value: s, label: STATS_SCOPE_LABEL[s] }))}
              onChange={(statsScope) => set({ statsScope })}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
