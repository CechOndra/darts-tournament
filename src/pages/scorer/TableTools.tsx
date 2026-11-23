import { AlertTriangle, ArrowLeftRight, BellRing, PauseCircle, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { AdminPinGate } from '../../components/AdminPinGate.tsx';
import { PlayerOrderTool } from '../../components/match/PlayerOrderTool.tsx';
import { Button, Modal, Notice } from '../../components/ui.tsx';
import { formatClock } from '../../engine/pace.ts';
import type { TournamentState } from '../../engine/state.ts';
import { useDispatch, useTransportContext } from '../../hooks/TransportProvider.tsx';
import { callAdmin, resolveHelp, ringAdmin } from '../../services/tableOps.ts';

type AdminAction = 'pause' | 'restart' | null;

/** Scorer tools: call the admin, fix player order, and PIN-approved one-off admin actions. */
export function TableTools({ state, onClose }: { state: TournamentState; onClose: () => void }) {
  const { transport } = useTransportContext();
  const dispatch = useDispatch();
  const [gate, setGate] = useState<AdminAction>(null);
  const live = state.live;
  const help = state.helpRequest ?? null;
  const canPause = !!live && live.phase !== 'POST_MATCH';

  return (
    <>
      <Modal title="Table tools" wide onClose={onClose}>
        <div className="space-y-5">
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-text-muted uppercase">
              <AlertTriangle size={14} aria-hidden /> Need the admin?
            </p>
            {help ? (
              <div className="space-y-2">
                <Notice tone="warning">Admin called at {formatClock(help.at)}. The stage and the admin screen show it until it is resolved.</Notice>
                <div className="flex flex-wrap gap-2">
                  <Button icon={BellRing} onClick={() => void ringAdmin(transport)}>
                    Ring again
                  </Button>
                  <Button variant="ghost" icon={X} onClick={() => void resolveHelp(transport)}>
                    Cancel call
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="gold" icon={AlertTriangle} onClick={() => void callAdmin(transport, live?.matchId ?? null)}>
                Call admin
              </Button>
            )}
          </section>

          <section className="space-y-2 border-t border-border-subtle pt-4">
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-text-muted uppercase">
              <ArrowLeftRight size={14} aria-hidden /> Players threw in the wrong order?
            </p>
            {live ? <PlayerOrderTool state={state} matchId={live.matchId} /> : <p className="text-sm text-text-muted">Available while a match is on the oche.</p>}
          </section>

          <section className="space-y-2 border-t border-border-subtle pt-4">
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-text-muted uppercase">
              <ShieldCheck size={14} aria-hidden /> Admin only (asks for the Admin PIN, one action at a time)
            </p>
            <div className="flex flex-wrap gap-2">
              <Button icon={PauseCircle} disabled={!canPause} onClick={() => setGate('pause')}>
                Pause match (finish later)
              </Button>
              <Button icon={RotateCcw} disabled={!canPause} onClick={() => setGate('restart')}>
                Restart match from zero
              </Button>
            </div>
            <button type="button" className="text-xs text-text-muted underline" onClick={() => (window.location.hash = '#/admin')}>
              Open the full admin on this tablet (password or Admin PIN, stays unlocked until Lock Session)
            </button>
          </section>
        </div>
      </Modal>

      {gate === 'pause' && (
        <AdminPinGate
          title="Pause match"
          confirmLabel="Pause match"
          onClose={() => setGate(null)}
          onConfirm={async () => {
            await dispatch({ type: 'SUSPEND_MATCH', at: Date.now() }, { persist: 'immediate' });
            onClose();
          }}
        >
          The match leaves the oche with every dart and card kept. When it is started again you choose: resume where it was left, or start over.
        </AdminPinGate>
      )}
      {gate === 'restart' && (
        <AdminPinGate
          title="Restart match from zero"
          confirmLabel="Restart match"
          onClose={() => setGate(null)}
          onConfirm={async () => {
            await dispatch({ type: 'RESTART_MATCH', at: Date.now() }, { persist: 'immediate' });
            onClose();
          }}
        >
          All darts of this match are deleted and every Power Card played in it goes back to its team's hand. The match starts again at the starting order.
        </AdminPinGate>
      )}
    </>
  );
}
