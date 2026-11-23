import { Toggle } from '../../../components/ui.tsx';
import { memeSettings } from '../../../engine/memes.ts';
import type { TournamentState } from '../../../engine/state.ts';
import type { VisibilitySettings } from '../../../engine/types.ts';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';

/** Quick on/off switches for the night (apply instantly on every device). */
export function LiveSwitches({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const v = state.settings.visibility;
  const set = (patch: Partial<VisibilitySettings>) => void dispatch({ type: 'UPDATE_VISIBILITY', patch }, { persist: 'immediate' });
  const memes = memeSettings(state);
  return (
    <div className="divide-y divide-border-subtle">
      <Toggle
        label="Score caller"
        description="The stage announces every visit like a TV caller (One hundred and eighty!). Uses the stage PC's built-in voice."
        checked={v.scoreCaller === true}
        onChange={(scoreCaller) => set({ scoreCaller })}
      />
      <Toggle
        label="Caller: you require..."
        description="Also calls the finish for the next thrower, e.g. Anna, you require 40."
        checked={v.callRequire !== false}
        disabled={v.scoreCaller !== true}
        onChange={(callRequire) => set({ callRequire })}
      />
      {v.soundboardFeature !== false && (
        <Toggle
          label="Crowd buttons"
          description="Temporarily mute the guests' soundboard (the tab stays, buttons are locked)."
          checked={v.soundboardEnabled !== false}
          onChange={(soundboardEnabled) => set({ soundboardEnabled })}
        />
      )}
      <Toggle
        label="Memes on the stage"
        checked={memes.enabled}
        onChange={(enabled) => void dispatch({ type: 'UPDATE_MEME_SETTINGS', patch: { enabled } }, { persist: 'immediate' })}
      />
      <Toggle label="Small join QR on the stage" checked={v.showJoinQr !== false} onChange={(showJoinQr) => set({ showJoinQr })} />
    </div>
  );
}
