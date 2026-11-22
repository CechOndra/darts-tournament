import { createId } from '../transport/ids.ts';
import type { StateEnvelope, Unsubscribe } from '../transport/types.ts';
import { ControlError, type ControlApi, type CreateTournamentInput, type SessionInfo, type TournamentSummary } from './types.ts';

/**
 * Same-browser development backend (no Supabase configured). Mirrors the SQL RPC
 * semantics on top of localStorage so the full admin / scorer flow can be
 * exercised offline and in automated tests. Not a security boundary.
 */

interface Registry {
  host: { username: string; hash: string } | null;
  sessions: Record<string, { role: 'admin' | 'scorer'; tournamentId: string | null; pinVersion: number | null; expiresAt: number }>;
  tournaments: Record<string, { name: string; archived: boolean; createdAt: number; updatedAt: number; pinHash: string; pinVersion: number }>;
  activeId: string | null;
}

const REGISTRY_KEY = 'darts.loopback.control';
const SESSION_MS = 24 * 60 * 60 * 1000;
export const loopbackStateKey = (id: string) => `darts.loopback.${id}`;

async function hash(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(`darts:${value}`));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (const ch of `darts:${value}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}

function read(): Registry {
  try {
    const raw = globalThis.localStorage?.getItem(REGISTRY_KEY);
    if (raw) return JSON.parse(raw) as Registry;
  } catch {
    /* fall through */
  }
  return { host: null, sessions: {}, tournaments: {}, activeId: null };
}

function write(reg: Registry) {
  try {
    globalThis.localStorage?.setItem(REGISTRY_KEY, JSON.stringify(reg));
  } catch (err) {
    console.warn('[loopback-control] write failed', err);
  }
}

export class LoopbackControlApi implements ControlApi {
  readonly mode = 'loopback' as const;
  private readonly listeners = new Set<(id: string | null) => void>();
  private readonly channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(REGISTRY_KEY) : null;

  constructor() {
    if (this.channel) {
      this.channel.onmessage = (e: MessageEvent<{ activeId: string | null }>) => this.notify(e.data.activeId, false);
    }
  }

  private notify(activeId: string | null, broadcast: boolean) {
    for (const cb of this.listeners) cb(activeId);
    if (broadcast) this.channel?.postMessage({ activeId });
  }

  private newSession(reg: Registry, role: 'admin' | 'scorer', tournamentId: string | null, pinVersion: number | null) {
    const token = createId('tok');
    reg.sessions[token] = { role, tournamentId, pinVersion, expiresAt: Date.now() + SESSION_MS };
    return token;
  }

  private requireHost(reg: Registry, token: string) {
    const s = reg.sessions[token];
    if (!s || s.role !== 'admin' || s.expiresAt < Date.now()) throw new ControlError('unauthorized');
  }

  async hostStatus() {
    return { claimed: !!read().host };
  }

  async claimHost(username: string, password: string) {
    const reg = read();
    if (reg.host) throw new ControlError('host_already_claimed');
    if (username.trim().length < 3) throw new ControlError('invalid_username');
    if (password.length < 6) throw new ControlError('weak_password');
    reg.host = { username: username.trim(), hash: await hash(password) };
    const token = this.newSession(reg, 'admin', null, null);
    write(reg);
    return token;
  }

  async hostLogin(username: string, password: string) {
    const reg = read();
    if (!reg.host || reg.host.username.toLowerCase() !== username.trim().toLowerCase() || reg.host.hash !== (await hash(password))) {
      throw new ControlError('invalid_credentials');
    }
    const token = this.newSession(reg, 'admin', null, null);
    write(reg);
    return token;
  }

  async updateHostCredentials(token: string, username: string, password: string) {
    const reg = read();
    this.requireHost(reg, token);
    if (username.trim().length < 3 || password.length < 6) throw new ControlError('invalid_credentials_format');
    reg.host = { username: username.trim(), hash: await hash(password) };
    write(reg);
  }

  async logout(token: string) {
    const reg = read();
    delete reg.sessions[token];
    write(reg);
  }

  async validateSession(token: string, tournamentId: string | null): Promise<SessionInfo> {
    const reg = read();
    const s = reg.sessions[token];
    if (!s || s.expiresAt < Date.now()) return { valid: false };
    if (s.role === 'admin') return { valid: true, role: 'admin', pinVersion: null };
    if (!tournamentId || s.tournamentId !== tournamentId) return { valid: false };
    const t = reg.tournaments[tournamentId];
    if (!t || t.pinVersion !== s.pinVersion) return { valid: false };
    return { valid: true, role: 'scorer', pinVersion: s.pinVersion };
  }

  async listTournaments(): Promise<TournamentSummary[]> {
    return Object.entries(read().tournaments)
      .map(([id, t]) => ({ id, name: t.name, archived: t.archived, createdAt: t.createdAt, updatedAt: t.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getActiveTournamentId() {
    return read().activeId;
  }

  subscribeActiveTournament(cb: (id: string | null) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async createTournament(token: string, input: CreateTournamentInput) {
    const reg = read();
    this.requireHost(reg, token);
    if (reg.tournaments[input.id]) throw new ControlError('tournament_exists');
    if (!/^[0-9]{4}$/.test(input.scorerPin)) throw new ControlError('invalid_pin');
    const now = Date.now();
    reg.tournaments[input.id] = {
      name: input.name.trim() || 'Tournament',
      archived: false,
      createdAt: now,
      updatedAt: now,
      pinHash: await hash(input.scorerPin),
      pinVersion: 1,
    };
    const envelope: StateEnvelope<unknown> = {
      tournamentId: input.id,
      version: 1,
      updatedAt: now,
      originClientId: input.clientId,
      state: input.state,
    };
    try {
      globalThis.localStorage?.setItem(loopbackStateKey(input.id), JSON.stringify(envelope));
    } catch {
      /* ignore */
    }
    write(reg);
  }

  async updateTournamentMeta(token: string, id: string, patch: { name?: string; archived?: boolean }) {
    const reg = read();
    this.requireHost(reg, token);
    const t = reg.tournaments[id];
    if (!t) throw new ControlError('not_found');
    if (patch.name?.trim()) t.name = patch.name.trim();
    if (patch.archived !== undefined) t.archived = patch.archived;
    t.updatedAt = Date.now();
    const deactivated = patch.archived && reg.activeId === id;
    if (deactivated) reg.activeId = null;
    write(reg);
    if (deactivated) this.notify(null, true);
  }

  async setActiveTournament(token: string, id: string | null) {
    const reg = read();
    this.requireHost(reg, token);
    if (id && !reg.tournaments[id]) throw new ControlError('not_found');
    reg.activeId = id;
    if (id) reg.tournaments[id]!.archived = false;
    write(reg);
    this.notify(id, true);
  }

  async deleteTournament(token: string, id: string) {
    const reg = read();
    this.requireHost(reg, token);
    delete reg.tournaments[id];
    const wasActive = reg.activeId === id;
    if (wasActive) reg.activeId = null;
    for (const [tok, s] of Object.entries(reg.sessions)) if (s.tournamentId === id) delete reg.sessions[tok];
    write(reg);
    try {
      globalThis.localStorage?.removeItem(loopbackStateKey(id));
    } catch {
      /* ignore */
    }
    if (wasActive) this.notify(null, true);
  }

  async scorerLogin(tournamentId: string, pin: string) {
    const reg = read();
    const t = reg.tournaments[tournamentId];
    if (!t || t.pinHash !== (await hash(pin))) throw new ControlError('invalid_pin');
    const token = this.newSession(reg, 'scorer', tournamentId, t.pinVersion);
    write(reg);
    return { token, pinVersion: t.pinVersion };
  }

  async rotateScorerPin(token: string, tournamentId: string, newPin: string) {
    const reg = read();
    this.requireHost(reg, token);
    const t = reg.tournaments[tournamentId];
    if (!t) throw new ControlError('not_found');
    if (!/^[0-9]{4}$/.test(newPin)) throw new ControlError('invalid_pin');
    t.pinHash = await hash(newPin);
    t.pinVersion += 1;
    for (const [tok, s] of Object.entries(reg.sessions)) if (s.role === 'scorer' && s.tournamentId === tournamentId) delete reg.sessions[tok];
    write(reg);
    return t.pinVersion;
  }
}
