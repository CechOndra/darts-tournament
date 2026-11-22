import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DEFAULT_STRUCTURE } from '../engine/defaults.ts';
import { buildTournament } from '../engine/tournament.ts';
import { centerSquareCrop, dataUrlBytes } from './media/photoCompressor.ts';
import { countActiveScorers } from './presence.ts';
import { createBackup, isScorerKickedOut, parseBackup } from './tournamentOps.ts';
import { describeControlError, toControlError } from './control/types.ts';
import type { PresenceMeta } from './transport/types.ts';

const state = buildTournament({
  id: 'cup-a',
  name: 'Cup A',
  createdAt: 1,
  structure: structuredClone(DEFAULT_STRUCTURE),
  rules: structuredClone(DEFAULT_RULES),
  roster: [],
});

describe('backups', () => {
  it('round-trips and retargets the tournament id', () => {
    const backup = createBackup({ tournamentId: 'cup-a', version: 7, updatedAt: 1, originClientId: 'c', state }, new Date(0));
    const restored = parseBackup(JSON.stringify(backup), 'cup-b');
    expect(restored.meta?.id).toBe('cup-b');
    expect(restored.teams).toEqual(state.teams);
  });

  it('rejects foreign or broken files', () => {
    expect(() => parseBackup('not json', 'x')).toThrow(/JSON/);
    expect(() => parseBackup('{"hello":1}', 'x')).toThrow(/backup/);
    const wrong = { format: 'darts-tournament-backup', state: { ...state, schemaVersion: 99 } };
    expect(() => parseBackup(JSON.stringify(wrong), 'x')).toThrow(/version/);
  });
});

describe('scorer security', () => {
  it('kicks out scorers whose pin version is stale', () => {
    expect(isScorerKickedOut(1, state)).toBe(false);
    expect(isScorerKickedOut(1, { ...state, security: { pinVersion: 2 } })).toBe(true);
    expect(isScorerKickedOut(1, null)).toBe(false);
  });

  it('counts only unlocked scorer devices', () => {
    const p = (role: PresenceMeta['role'], unlocked: boolean): PresenceMeta => ({
      clientId: Math.random().toString(),
      role,
      unlocked,
      pinVersion: 1,
      joinedAt: 0,
    });
    expect(countActiveScorers([p('scorer', true), p('scorer', false), p('admin', true), p('scorer', true)])).toBe(2);
  });
});

describe('control errors', () => {
  it('maps backend messages to friendly text', () => {
    expect(toControlError(new Error('P0001: invalid_credentials')).code).toBe('invalid_credentials');
    expect(describeControlError({ message: 'invalid_pin' })).toBe('Wrong PIN.');
    expect(toControlError(new Error('Failed to fetch')).code).toBe('network');
  });
});

describe('photo compressor', () => {
  it('center-crops to the largest square', () => {
    expect(centerSquareCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 });
    expect(centerSquareCrop(1080, 1920)).toEqual({ sx: 0, sy: 420, size: 1080 });
  });
  it('estimates data URL size', () => {
    expect(dataUrlBytes('data:image/webp;base64,AAAA')).toBe(3);
  });
});
