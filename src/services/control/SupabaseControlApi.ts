import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client.ts';
import type { Unsubscribe } from '../transport/types.ts';
import { toControlError, type ControlApi, type CreateTournamentInput, type SessionInfo, type TournamentSummary } from './types.ts';

interface TournamentListRow {
  id: string;
  name: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export class SupabaseControlApi implements ControlApi {
  readonly mode = 'supabase' as const;
  private readonly client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getSupabaseClient(url, anonKey);
  }

  private async rpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.client.rpc(fn, params);
    if (error) throw toControlError(error);
    return data as T;
  }

  hostStatus() {
    return this.rpc<{ claimed: boolean }>('host_status');
  }
  claimHost(username: string, password: string) {
    return this.rpc<string>('claim_host', { p_username: username, p_password: password });
  }
  hostLogin(username: string, password: string) {
    return this.rpc<string>('host_login', { p_username: username, p_password: password });
  }
  async updateHostCredentials(token: string, username: string, password: string) {
    await this.rpc('update_host_credentials', { p_token: token, p_username: username, p_password: password });
  }
  async logout(token: string) {
    await this.rpc('logout', { p_token: token });
  }
  validateSession(token: string, tournamentId: string | null) {
    return this.rpc<SessionInfo>('validate_session', { p_token: token, p_id: tournamentId });
  }

  async listTournaments(): Promise<TournamentSummary[]> {
    const { data, error } = await this.client
      .from('tournaments')
      .select('id, name, archived, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw toControlError(error);
    return (data as TournamentListRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      archived: r.archived,
      createdAt: Date.parse(r.created_at),
      updatedAt: Date.parse(r.updated_at),
    }));
  }

  async getActiveTournamentId(): Promise<string | null> {
    const { data, error } = await this.client.from('app_settings').select('active_tournament_id').maybeSingle();
    if (error) throw toControlError(error);
    return (data?.active_tournament_id as string | null | undefined) ?? null;
  }

  subscribeActiveTournament(cb: (id: string | null) => void): Unsubscribe {
    const channel = this.client
      .channel(`app-settings-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (change) => {
        const row = change.new as { active_tournament_id?: string | null };
        if (row && 'active_tournament_id' in row) cb(row.active_tournament_id ?? null);
      })
      .subscribe((status) => {
        // Re-sync after (re)connect in case we missed an update while offline.
        if (status === 'SUBSCRIBED') void this.getActiveTournamentId().then(cb, () => undefined);
      });
    return () => void this.client.removeChannel(channel);
  }

  async createTournament(token: string, input: CreateTournamentInput) {
    await this.rpc('create_tournament', {
      p_token: token,
      p_id: input.id,
      p_name: input.name,
      p_scorer_pin: input.scorerPin,
      p_state: input.state,
      p_client_id: input.clientId,
    });
  }
  async updateTournamentMeta(token: string, id: string, patch: { name?: string; archived?: boolean }) {
    await this.rpc('update_tournament_meta', {
      p_token: token,
      p_id: id,
      p_name: patch.name ?? null,
      p_archived: patch.archived ?? null,
    });
  }
  async setActiveTournament(token: string, id: string | null) {
    await this.rpc('set_active_tournament', { p_token: token, p_id: id });
  }
  async deleteTournament(token: string, id: string) {
    await this.rpc('delete_tournament', { p_token: token, p_id: id });
  }

  scorerLogin(tournamentId: string, pin: string) {
    return this.rpc<{ token: string; pinVersion: number }>('scorer_login', { p_id: tournamentId, p_pin: pin });
  }
  rotateScorerPin(token: string, tournamentId: string, newPin: string) {
    return this.rpc<number>('rotate_scorer_pin', { p_token: token, p_id: tournamentId, p_new_pin: newPin });
  }
}
