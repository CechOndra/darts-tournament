import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '../transport/protocol.ts';
import type { Unsubscribe } from '../transport/types.ts';
import { ControlError, type ControlApi, type CreateTournamentInput, type SessionInfo, type TournamentSummary } from './types.ts';

type RpcAck<T> = { ok: true; data: T } | { ok: false; error: string };

/** Control RPCs over the LAN relay socket (server/index.js implements the same semantics as the SQL). */
export class LocalControlApi implements ControlApi {
  readonly mode = 'local' as const;
  private readonly socket: Socket;
  private readonly listeners = new Set<(id: string | null) => void>();

  constructor(url: string) {
    this.socket = io(url, { transports: ['websocket', 'polling'], reconnection: true });
    this.socket.on(SOCKET_EVENTS.CONTROL_ACTIVE, (id: string | null) => {
      for (const cb of this.listeners) cb(id);
    });
    this.socket.on('connect', () => {
      void this.getActiveTournamentId().then((id) => this.listeners.forEach((cb) => cb(id)), () => undefined);
    });
  }

  private async rpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    let ack: RpcAck<T>;
    try {
      ack = (await this.socket.timeout(8000).emitWithAck(SOCKET_EVENTS.CONTROL_RPC, { method, params })) as RpcAck<T>;
    } catch {
      throw new ControlError('network', 'LAN relay did not answer');
    }
    if (!ack.ok) throw new ControlError(ack.error);
    return ack.data;
  }

  hostStatus() {
    return this.rpc<{ claimed: boolean }>('hostStatus');
  }
  claimHost(username: string, password: string) {
    return this.rpc<string>('claimHost', { username, password });
  }
  hostLogin(username: string, password: string) {
    return this.rpc<string>('hostLogin', { username, password });
  }
  async updateHostCredentials(token: string, username: string, password: string) {
    await this.rpc('updateHostCredentials', { token, username, password });
  }
  async logout(token: string) {
    await this.rpc('logout', { token });
  }
  validateSession(token: string, tournamentId: string | null) {
    return this.rpc<SessionInfo>('validateSession', { token, tournamentId });
  }
  listTournaments() {
    return this.rpc<TournamentSummary[]>('listTournaments');
  }
  getActiveTournamentId() {
    return this.rpc<string | null>('getActiveTournamentId');
  }
  subscribeActiveTournament(cb: (id: string | null) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  async createTournament(token: string, input: CreateTournamentInput) {
    await this.rpc('createTournament', { token, ...input });
  }
  async updateTournamentMeta(token: string, id: string, patch: { name?: string; archived?: boolean }) {
    await this.rpc('updateTournamentMeta', { token, id, ...patch });
  }
  async setActiveTournament(token: string, id: string | null) {
    await this.rpc('setActiveTournament', { token, id });
  }
  async deleteTournament(token: string, id: string) {
    await this.rpc('deleteTournament', { token, id });
  }
  scorerLogin(tournamentId: string, pin: string) {
    return this.rpc<{ token: string; pinVersion: number }>('scorerLogin', { tournamentId, pin });
  }
  rotateScorerPin(token: string, tournamentId: string, newPin: string) {
    return this.rpc<number>('rotateScorerPin', { token, tournamentId, newPin });
  }
}
