import { useEffect, useRef, useState } from 'react';
import type { MatchView } from '../../engine/match.ts';
import { detectMeme, MEME_BY_ID, memeSettings, type MemeId } from '../../engine/memes.ts';
import type { TournamentState } from '../../engine/state.ts';
import { useTransportContext } from '../../hooks/TransportProvider.tsx';
import { MEME_TEST_EVENT, memeImage, playMemeAudio } from '../../services/memeAssets.ts';

/** Shows the meme for the visit that just finished (bottom-right, score stays readable). */
export function MemeOverlay({ state, view }: { state: TournamentState; view: MatchView | null }) {
  const { transport } = useTransportContext();
  const settings = memeSettings(state);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [shown, setShown] = useState<{ id: MemeId; url: string | null; key: number } | null>(null);

  const show = (id: MemeId) => {
    const def = MEME_BY_ID[id];
    const s = settingsRef.current;
    void memeImage(def.file).then((url) => setShown({ id, url, key: Date.now() }));
    void playMemeAudio(def.file, def.caption, s.speech);
  };

  // New finished visit -> maybe a meme (never on first render / reconnect).
  const v = view?.lastCompletedVisit ?? null;
  const key = v && view ? `${view.match.id}-${v.legIndex}-${v.visitIndex}-${v.darts.length}` : '';
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = key;
    if (before === null || before === key || !v || !view) return;
    const s = settingsRef.current;
    if (!s.enabled) return;
    const id = detectMeme(view.legs[v.legIndex] ?? view.currentLeg, v);
    if (id && !s.off.includes(id)) show(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Admin "Test on stage".
  useEffect(
    () =>
      transport.onLiveEvent((e) => {
        if (e.type !== MEME_TEST_EVENT) return;
        const { id } = e.payload as { id: MemeId };
        if (MEME_BY_ID[id]) show(id);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transport],
  );

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), Math.max(1, settings.seconds) * 1000);
    return () => clearTimeout(t);
  }, [shown, settings.seconds]);

  if (!shown) return null;
  const def = MEME_BY_ID[shown.id];
  return (
    <div key={shown.key} className="pointer-events-none absolute right-6 bottom-24 z-30 w-[34rem] overflow-hidden rounded-xl border-2 border-accent-gold bg-bg-surface shadow-2xl">
      {shown.url ? <img src={shown.url} alt={def.name} className="max-h-[26rem] w-full object-contain" /> : null}
      <p className="px-4 py-2 text-center font-display text-3xl tracking-wide text-accent-gold uppercase">{def.caption}</p>
    </div>
  );
}
