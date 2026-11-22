import { describe, expect, it } from 'vitest';
import { tournamentReducer } from './reducer.ts';
import { createEmptyState } from './state.ts';

describe('tournamentReducer', () => {
  it('replaces state immutably', () => {
    const incoming = { ...createEmptyState(), meta: { name: 'Cup', createdAt: 1 } };
    const next = tournamentReducer(createEmptyState(), { type: 'REPLACE_STATE', state: incoming });
    expect(next).toEqual(incoming);
    expect(next).not.toBe(incoming);
  });

  it('rejects backups with an unknown schema version', () => {
    const bad = { schemaVersion: 999, meta: null };
    expect(() => tournamentReducer(createEmptyState(), { type: 'REPLACE_STATE', state: bad })).toThrow();
  });

  it('resets to an empty state', () => {
    const s = { ...createEmptyState(), meta: { name: 'Cup', createdAt: 1 } };
    expect(tournamentReducer(s, { type: 'RESET_STATE' })).toEqual(createEmptyState());
  });
});
