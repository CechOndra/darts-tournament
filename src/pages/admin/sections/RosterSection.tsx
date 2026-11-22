import { Camera, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { Avatar, Badge, Button, Field, Notice, TextInput } from '../../../components/ui.tsx';
import { parseRosterText } from '../../../engine/roster.ts';
import { groupLabel, placeholderCount } from '../../../engine/selectors.ts';
import type { TournamentState } from '../../../engine/state.ts';
import type { Player, Team } from '../../../engine/types.ts';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';
import { compressAvatar, dataUrlBytes } from '../../../services/media/photoCompressor.ts';

/** Text input that keeps local edits and commits on blur / Enter (one sync per edit, not per keystroke). */
export function CommitInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (v: string) => void; amber?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <TextInput
      {...rest}
      value={draft}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function PlayerRow({ player }: { player: Player }) {
  const dispatch = useDispatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await compressAvatar(file);
      await dispatch({ type: 'SET_PLAYER_AVATAR', playerId: player.id, avatarDataUrl: dataUrl }, { persist: 'immediate' });
      console.info(`[photo] ${player.id}: ${Math.round(dataUrlBytes(dataUrl) / 1024)} KB`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Avatar name={player.name} src={player.avatarDataUrl} size={44} />
        <CommitInput
          aria-label={`Player name (${player.id})`}
          value={player.isPlaceholderName ? '' : player.name}
          placeholder={player.isPlaceholderName ? player.name : 'Player name'}
          amber={player.isPlaceholderName}
          maxLength={40}
          onCommit={(name) => void dispatch({ type: 'RENAME_PLAYER', playerId: player.id, name })}
        />
        <Button
          size="sm"
          icon={Camera}
          busy={busy}
          aria-label={`Upload or snap photo for ${player.name}`}
          title="Upload / Snap Photo"
          onClick={() => fileRef.current?.click()}
          className="shrink-0"
        />
        {player.avatarDataUrl && (
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            aria-label={`Remove photo of ${player.name}`}
            onClick={() => void dispatch({ type: 'SET_PLAYER_AVATAR', playerId: player.id, avatarDataUrl: null }, { persist: 'immediate' })}
            className="shrink-0"
          />
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

function TeamCard({ team, state }: { team: Team; state: TournamentState }) {
  const dispatch = useDispatch();
  const showGroup = state.settings.structure.mode !== 'PLAYOFFS_ONLY' && state.settings.structure.groupCount > 1;
  return (
    <div className="surface-elevated space-y-3 p-3">
      <div className="flex items-center gap-2">
        <CommitInput
          aria-label={`Team name (${team.id})`}
          value={team.isPlaceholderName ? '' : team.name}
          placeholder={team.isPlaceholderName ? team.name : 'Team name'}
          amber={team.isPlaceholderName}
          maxLength={40}
          className="font-semibold"
          onCommit={(name) => void dispatch({ type: 'RENAME_TEAM', teamId: team.id, name })}
        />
        {showGroup && <Badge tone="gold">{groupLabel(team.groupIndex)}</Badge>}
      </div>
      {team.playerIds.map((pid) => {
        const p = state.players[pid];
        return p ? <PlayerRow key={pid} player={p} /> : null;
      })}
    </div>
  );
}

export function RosterSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const [csv, setCsv] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const placeholders = placeholderCount(state);

  const applyCsv = async () => {
    const rows = parseRosterText(csv);
    if (!rows.length) return;
    await dispatch({ type: 'APPLY_ROSTER_NAMES', rows }, { persist: 'immediate' });
    setApplied(`Applied names to ${Math.min(rows.length, state.teams.length)} teams.`);
    setCsv('');
  };

  return (
    <div className="space-y-4">
      <Field label="Tournament name">
        {(id) => (
          <CommitInput
            id={id}
            value={state.meta?.name ?? ''}
            maxLength={40}
            onCommit={(name) => void dispatch({ type: 'RENAME_TOURNAMENT', name }, { persist: 'immediate' })}
          />
        )}
      </Field>

      {placeholders > 0 && (
        <Notice>
          {placeholders} placeholder name{placeholders === 1 ? '' : 's'} (amber). Rename anytime — schedules and stats follow automatically.
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        {state.teams.map((t) => (
          <TeamCard key={t.id} team={t} state={state} />
        ))}
      </div>

      <details className="rounded-md border border-border-subtle p-3">
        <summary className="cursor-pointer text-sm font-medium">Bulk rename from CSV / spreadsheet</summary>
        <div className="mt-3 space-y-2">
          <textarea
            aria-label="Roster rows"
            rows={4}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={'Team name, Player 1, Player 2'}
            className="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-base outline-none focus:border-accent-gold"
          />
          <p className="text-xs text-text-muted">Rows map to teams in order (Team A, Team B, ...). Blank cells keep the current name.</p>
          <Button size="sm" icon={FileSpreadsheet} onClick={applyCsv} disabled={!csv.trim()}>
            Apply names
          </Button>
          {applied && <Notice tone="success">{applied}</Notice>}
        </div>
      </details>
    </div>
  );
}
