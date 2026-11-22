import { ArrowDown, ArrowUp, Coffee, Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Field, Modal, Select, TextInput } from '../../../components/ui.tsx';
import { describeSlot, matchLabel, matchNumber, queuedMatches } from '../../../engine/selectors.ts';
import type { TournamentState } from '../../../engine/state.ts';
import { useDispatch } from '../../../hooks/TransportProvider.tsx';
import { createId } from '../../../services/transport/ids.ts';

export function BreakEditor({ state, onDone }: { state: TournamentState; onDone?: () => void }) {
  const dispatch = useDispatch();
  const upcoming = queuedMatches(state);
  const [afterMatchId, setAfter] = useState(upcoming[Math.min(5, upcoming.length - 1)]?.id ?? '');
  const [name, setName] = useState('Pizza & Minigame Break');
  const [minutes, setMinutes] = useState('20');

  return (
    <div className="space-y-3">
      <Field label="After match">
        {(id) => (
          <Select id={id} value={afterMatchId} onChange={(e) => setAfter(e.target.value)}>
            {upcoming.map((m) => (
              <option key={m.id} value={m.id}>
                M{matchNumber(state, m.id)} · {describeSlot(state, m.home)} vs {describeSlot(state, m.away)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <Field label="Break name">{(id) => <TextInput id={id} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Minutes">
          {(id) => <TextInput id={id} type="number" min={1} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
        </Field>
      </div>
      <Button
        icon={Plus}
        disabled={!afterMatchId}
        onClick={async () => {
          await dispatch(
            { type: 'ADD_BREAK', id: createId('break'), afterMatchId, name, durationMinutes: minutes ? Number(minutes) : null },
            { persist: 'immediate' },
          );
          onDone?.();
        }}
      >
        Add Break
      </Button>
    </div>
  );
}

export function ScheduleSection({ state }: { state: TournamentState }) {
  const dispatch = useDispatch();
  const [breakOpen, setBreakOpen] = useState(false);
  const queue = queuedMatches(state);
  const breaksAfter = (matchId: string) => state.breaks.filter((b) => b.afterMatchId === matchId && !b.completed);
  const done = state.matches.length - queue.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          {queue.length} upcoming · {done} completed
        </p>
        <Button size="sm" icon={Coffee} onClick={() => setBreakOpen(true)} disabled={queue.length === 0}>
          Schedule Break
        </Button>
      </div>

      <ol className="space-y-2">
        {queue.map((m, i) => (
          <li key={m.id}>
            <div className={`surface-elevated flex items-center gap-2 p-2 ${i === 0 ? 'border-accent-gold' : ''}`}>
              <span className="w-10 shrink-0 text-center font-mono text-xs text-text-muted">M{matchNumber(state, m.id)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {describeSlot(state, m.home)} <span className="text-text-muted">vs</span> {describeSlot(state, m.away)}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {matchLabel(state, m)} · {m.format}
                </p>
              </div>
              {i === 0 ? (
                <Badge tone="gold">{m.status === 'IN_PROGRESS' ? 'LIVE' : 'UP NEXT'}</Badge>
              ) : (
                <Button
                  size="sm"
                  icon={Play}
                  title="Set as Next Match"
                  aria-label={`Set match ${matchNumber(state, m.id)} as next`}
                  onClick={() => void dispatch({ type: 'SET_NEXT_MATCH', matchId: m.id }, { persist: 'immediate' })}
                />
              )}
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  className="flex h-6 w-8 items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => void dispatch({ type: 'MOVE_IN_QUEUE', matchId: m.id, delta: -1 })}
                >
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="flex h-6 w-8 items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30"
                  aria-label="Move down"
                  disabled={i === queue.length - 1}
                  onClick={() => void dispatch({ type: 'MOVE_IN_QUEUE', matchId: m.id, delta: 1 })}
                >
                  <ArrowDown size={14} aria-hidden />
                </button>
              </div>
            </div>
            {breaksAfter(m.id).map((b) => (
              <div key={b.id} className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-accent-gold/50 px-3 py-2 text-sm text-accent-gold">
                <Coffee size={16} aria-hidden />
                <span className="flex-1 truncate">
                  {b.name}
                  {b.durationMinutes ? ` · ${b.durationMinutes} min` : ''}
                </span>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center text-text-muted hover:text-accent-danger"
                  aria-label={`Remove ${b.name}`}
                  onClick={() => void dispatch({ type: 'REMOVE_BREAK', breakId: b.id }, { persist: 'immediate' })}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            ))}
          </li>
        ))}
      </ol>

      {breakOpen && (
        <Modal title="Schedule a break" onClose={() => setBreakOpen(false)}>
          <BreakEditor state={state} onDone={() => setBreakOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
