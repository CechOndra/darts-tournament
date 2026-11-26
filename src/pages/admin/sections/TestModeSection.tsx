import { FastForward, FolderInput, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Field, Notice, TextInput, Toggle } from '../../../components/ui.tsx';
import { randomRosterRows } from '../../../engine/czechNames.ts';
import { hasStarted } from '../../../engine/selectors.ts';
import { DEFAULT_SKILL, nextSimulatable, simulateMatches } from '../../../engine/simulate.ts';
import type { TournamentState } from '../../../engine/state.ts';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';
import { compressAvatar, compressFutPhoto, compressLogo } from '../../../services/media/photoCompressor.ts';

type MockDataset = { teams: { name: string; logo?: string; players: { name?: string; nickname?: string; photo?: string; futPhoto?: string }[] }[] };
const toBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

/** Test tournament switch + simulator + mock dataset loader. The tools only exist while `meta.isTest` is on. */
export function TestModeSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const isTest = !!state.meta?.isTest;
  const [average, setAverage] = useState(String(DEFAULT_SKILL.average));
  const [variance, setVariance] = useState(String(DEFAULT_SKILL.variance));
  const [count, setCount] = useState('4');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const skill = { average: Math.min(120, Math.max(20, Number(average) || DEFAULT_SKILL.average)), variance: Math.min(30, Math.max(0, Number(variance) || 0)) };
  const n = Math.max(1, Math.floor(Number(count)) || 1);
  const blocked = state.live ? 'A match is on the oche. Finish or pause it first.' : !nextSimulatable(state) ? 'No match can be simulated right now.' : null;

  const simulate = async (limit: number, stage?: 'GROUP') => {
    const next = simulateMatches(state, limit, skill, Math.random, stage);
    const played = next.matches.filter((m) => m.status === 'COMPLETED').length - state.matches.filter((m) => m.status === 'COMPLETED').length;
    if (played > 0) await dispatch({ type: 'REPLACE_STATE', state: next }, { persist: 'immediate' });
    setMsg(played > 0 ? `Simulated ${played} match${played === 1 ? '' : 'es'}.` : 'Nothing to simulate.');
  };

  const loadDataset = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = JSON.parse(await file.text()) as MockDataset;
      const random = randomRosterRows(state.teams.length, state.settings.structure.playersPerTeam);
      for (const [i, team] of state.teams.entries()) {
        const src = data.teams[i];
        if (!src) continue;
        await dispatch({ type: 'RENAME_TEAM', teamId: team.id, name: src.name });
        if (src.logo) await dispatch({ type: 'SET_TEAM_LOGO', teamId: team.id, logoDataUrl: await compressLogo(await toBlob(src.logo)) });
        for (const [p, pid] of team.playerIds.entries()) {
          const prof = src.players[p];
          await dispatch({ type: 'RENAME_PLAYER', playerId: pid, name: prof?.name || random[i]?.playerNames[p] || '' });
          if (prof?.nickname) await dispatch({ type: 'SET_PLAYER_NICKNAME', playerId: pid, nickname: prof.nickname });
          if (prof?.futPhoto) await dispatch({ type: 'SET_PLAYER_FUT_PHOTO', playerId: pid, futPhotoDataUrl: await compressFutPhoto(await toBlob(prof.futPhoto)) });
          if (prof?.photo) await dispatch({ type: 'SET_PLAYER_AVATAR', playerId: pid, avatarDataUrl: await compressAvatar(await toBlob(prof.photo)) });
        }
      }
      await dispatch({ type: 'RENAME_TOURNAMENT', name: state.meta?.name ?? 'Test' }, { persist: 'immediate' });
      setMsg(`Loaded ${Math.min(data.teams.length, state.teams.length)} teams.`);
    } catch (err) {
      setMsg(`Could not load: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const locked = !isTest && hasStarted(state);
  return (
    <div className="space-y-3">
      <Toggle
        label="Test tournament"
        description={
          locked
            ? 'Not available: this tournament already has results. Create a new tournament to test.'
            : 'Shows match simulation controls. Simulated darts are fake: only use this on a throwaway tournament.'
        }
        checked={isTest}
        disabled={locked}
        onChange={(value) => void dispatch({ type: 'SET_TEST_MODE', value }, { persist: 'immediate' })}
      />
      {isTest && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Average skill (3-dart avg)">{(id) => <TextInput id={id} type="number" inputMode="numeric" min={20} max={120} value={average} onChange={(e) => setAverage(e.target.value)} />}</Field>
            <Field label="Spread between players">{(id) => <TextInput id={id} type="number" inputMode="numeric" min={0} max={30} value={variance} onChange={(e) => setVariance(e.target.value)} />}</Field>
          </div>
          <p className="text-xs text-text-muted">Each player gets a fixed personal average around the skill value (spread = standard deviation), then throws real darts at real targets, with busts and checkout misses.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" icon={Play} disabled={!!blocked} onClick={() => void simulate(1)}>
              Simulate next match
            </Button>
            <TextInput aria-label="Number of matches" type="number" inputMode="numeric" min={1} max={99} value={count} onChange={(e) => setCount(e.target.value)} className="w-20" />
            <Button size="sm" icon={FastForward} disabled={!!blocked} onClick={() => void simulate(n)}>
              Simulate {n} matches
            </Button>
            <Button size="sm" icon={FastForward} disabled={!!blocked} onClick={() => void simulate(Infinity, 'GROUP')}>
              Skip group stage
            </Button>
          </div>
          {blocked && <Notice>{blocked}</Notice>}
          <div className="border-t border-border-subtle pt-3">
            <Button size="sm" icon={FolderInput} busy={busy} onClick={() => fileRef.current?.click()}>
              Load mock dataset (.json)
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void loadDataset(e.target.files?.[0])} />
            <p className="mt-1 text-xs text-text-muted">Pick local-data/mock-dataset.json (see scripts/build-mock-dataset.py). Needs 8 teams; photos and logos stay in the tournament data only.</p>
          </div>
          {msg && <Notice tone="success">{msg}</Notice>}
        </>
      )}
    </div>
  );
}
