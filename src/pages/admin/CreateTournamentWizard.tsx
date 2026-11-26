import { Dices, FileSpreadsheet, Plus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { RulesForm } from '../../components/admin/RulesForm.tsx';
import { StructureForm } from '../../components/admin/StructureForm.tsx';
import { CardBasicsForm } from '../../components/admin/CardSettingsForm.tsx';
import { TableSettingsForm } from '../../components/admin/TableSettingsForm.tsx';
import { Button, Field, Notice, TextInput, Toggle } from '../../components/ui.tsx';
import { DEFAULT_CARDS, DEFAULT_RULES, DEFAULT_STRUCTURE, DEFAULT_TABLE, LIMITS } from '../../engine/defaults.ts';
import { randomRosterRows, rosterRowsToText } from '../../engine/czechNames.ts';
import { mergeRules } from '../../engine/reducer.ts';
import { maxPlayersInRoster, parseRosterText } from '../../engine/roster.ts';
import { makeTournamentId, validateStructure } from '../../engine/tournament.ts';
import type { CardSettings, GameRules, StructureSettings, TableSettings } from '../../engine/types.ts';
import { useControl } from '../../hooks/ControlProvider.tsx';
import { useAsyncAction } from '../../hooks/useTransport.ts';
import { describeControlError } from '../../services/control/index.ts';
import { createId, getClientId } from '../../services/transport/ids.ts';
import { randomIconUrls } from '../../services/media/placeholders.ts';
import { createTournamentFromSetup } from '../../services/tournamentOps.ts';

const randomPin = () => {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0]! % 10000).padStart(4, '0');
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function CreateTournamentWizard({ onCreated, onCancel, hasLive }: { onCreated: (id: string) => void; onCancel?: () => void; hasLive: boolean }) {
  const { api, hostToken, setHostToken } = useControl();
  const [name, setName] = useState('');
  const [pin, setPin] = useState(randomPin);
  const [csv, setCsv] = useState('');
  const [structure, setStructure] = useState<StructureSettings>(() => structuredClone(DEFAULT_STRUCTURE));
  const [rules, setRules] = useState<GameRules>(() => structuredClone(DEFAULT_RULES));
  const [table, setTable] = useState<TableSettings>(() => ({ ...DEFAULT_TABLE }));
  const [cards, setCards] = useState<CardSettings>(() => structuredClone(DEFAULT_CARDS));
  const [makeLive, setMakeLive] = useState(!hasLive);
  const [randomIcons, setRandomIcons] = useState(false);
  const { busy, error, run } = useAsyncAction();

  const roster = useMemo(() => parseRosterText(csv), [csv]);
  const errors = validateStructure(structure);
  const pinValid = /^[0-9]{4}$/.test(pin);

  const importRoster = () => {
    if (!roster.length) return;
    const players = maxPlayersInRoster(roster);
    setStructure((s) => ({
      ...s,
      teamCount: clamp(roster.length, LIMITS.teamCount.min, LIMITS.teamCount.max),
      playersPerTeam: players > 0 ? (clamp(players, 1, 3) as 1 | 2 | 3) : s.playersPerTeam,
    }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hostToken || errors.length || !pinValid) return;
    const tournamentName = name.trim() || 'Darts Tournament';
    const id = makeTournamentId(tournamentName, createId().slice(0, 6));
    const done = await run(async () => {
      let rows = roster;
      if (randomIcons) {
        const n = structure.teamCount;
        const per = structure.playersPerTeam;
        const [logos, avatars] = await Promise.all([randomIconUrls('team', n), randomIconUrls('player', n * per)]);
        rows = Array.from({ length: n }, (_, i) => ({
          teamName: roster[i]?.teamName ?? '',
          playerNames: roster[i]?.playerNames ?? [],
          logoDataUrl: logos[i],
          avatarDataUrls: avatars.slice(i * per, (i + 1) * per),
        }));
      }
      await createTournamentFromSetup(
        api,
        hostToken,
        { id, name: tournamentName, createdAt: Date.now(), structure, rules, table, cards, roster: rows },
        pin,
        getClientId(),
      );
      if (makeLive) await api.setActiveTournament(hostToken, id);
      return true;
    }, (err) => {
      const msg = describeControlError(err);
      if (msg.includes('session expired')) setHostToken(null);
      return msg;
    });
    if (done) onCreated(id);
  };

  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Create tournament">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Tournament name">
          {(id) => <TextInput id={id} placeholder="Friday Night Darts" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />}
        </Field>
        <Field label="Scorer PIN" hint="Tablet unlock code. Changeable anytime.">
          {(id) => (
            <div className="flex gap-2">
              <TextInput
                id={id}
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                className="w-28 text-center font-mono tracking-[0.4em]"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <Button icon={Dices} aria-label="Generate random PIN" onClick={() => setPin(randomPin())} />
            </div>
          )}
        </Field>
      </div>

      <div className="space-y-2">
        <Field
          label="Roster import (optional)"
          hint="Paste rows like: Team name, Player 1, Player 2 — from a spreadsheet or Google Forms export. Headers and timestamps are skipped."
        >
          {(id) => (
            <textarea
              id={id}
              rows={4}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={'The Bulls, Anna, Ben\nTriple Trouble, Carl, Dana'}
              className="w-full rounded-md border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-base outline-none focus:border-accent-gold"
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" icon={Dices} onClick={() => setCsv(rosterRowsToText(randomRosterRows(structure.teamCount, structure.playersPerTeam)))}>
            Fill with random Czech names
          </Button>
        </div>
        <Toggle label="Random placeholder icons" description="Gives every team and player a random coloured icon (handy for testing)." checked={randomIcons} onChange={setRandomIcons} />
        {roster.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-text-muted">
              {roster.length} team{roster.length === 1 ? '' : 's'} found, up to {maxPlayersInRoster(roster)} players each.
            </p>
            <Button size="sm" icon={FileSpreadsheet} onClick={importRoster}>
              Match team count to roster
            </Button>
            {roster.length > LIMITS.teamCount.max && <Notice>Only the first {LIMITS.teamCount.max} teams will be used.</Notice>}
          </div>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-display text-sm tracking-widest text-text-muted uppercase">Format</legend>
        <StructureForm value={structure} onChange={setStructure} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-display text-sm tracking-widest text-text-muted uppercase">Game rules</legend>
        <RulesForm value={rules} onPatch={(p) => setRules((r) => mergeRules(r, p))} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-display text-sm tracking-widest text-text-muted uppercase">Scorer tablet</legend>
        <TableSettingsForm value={table} onPatch={(p) => setTable((t) => ({ ...t, ...p }))} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-display text-sm tracking-widest text-text-muted uppercase">Power Cards</legend>
        <CardBasicsForm value={cards} onPatch={(p) => setCards((c) => ({ ...c, ...p }))} />
        <p className="text-xs text-text-muted">Hand sizes, draws per match, copies per card and pools are in the Power Cards tab after creating.</p>
      </fieldset>

      <Toggle
        label="Make this the live tournament"
        description="Stage, scorer tablet and guest phones switch to it immediately."
        checked={makeLive}
        onChange={setMakeLive}
      />

      {errors.map((msg) => (
        <Notice key={msg} tone="danger">{msg}</Notice>
      ))}
      {!pinValid && <Notice tone="danger">The Scorer PIN must be exactly 4 digits.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" icon={Plus} busy={busy} disabled={errors.length > 0 || !pinValid}>
          Create Tournament
        </Button>
      </div>
    </form>
  );
}
